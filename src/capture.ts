import { readPageMetadata } from './page-metadata.js';
import { captureLimits, screenshotClip, validateCaptureResult } from './capture-limits.js';
import { browserStartupFailure, logBrowserStartupFailure } from './browser-startup.js';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { CaptureInput, CaptureResult } from './types.js';
import { CaptureError, normalizeUrl, safeFetch, validatePublicUrl, type RequestBudget, type SafeResponse } from './network.js';

export { CaptureError } from './network.js';
const require = createRequire(import.meta.url);
let browserPromise: Promise<Browser> | undefined;
let bundlePromise: Promise<string> | undefined;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(localChrome) ? localChrome : undefined);
    browserPromise = chromium.launch({
      headless: true, executablePath, chromiumSandbox: true,
      // All legitimate traffic is fulfilled through the DNS-pinned Node transport.
      // This dead proxy also closes unhandled browser network channels.
      proxy: { server: 'http://127.0.0.1:9' },
      args: ['--proxy-bypass-list=<-loopback>', '--disable-quic', '--disable-background-networking', '--disable-component-update', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    }).then(browser => {
      browser.on('disconnected', () => { browserPromise = undefined; });
      return browser;
    }).catch(error => {
      browserPromise = undefined;
      const failure = browserStartupFailure(error);
      logBrowserStartupFailure(failure);
      throw failure;
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = undefined;
  if (pending) await (await pending).close();
}

function getSingleFileBundle(): Promise<string> {
  if (!bundlePromise) bundlePromise = build({
    entryPoints: [require.resolve('single-file-core/single-file.js')],
    bundle: true, write: false, format: 'iife', globalName: '__landingSingleFile', platform: 'browser', target: 'es2022',
  }).then(result => result.outputFiles[0].text).catch(error => { bundlePromise = undefined; throw error; });
  return bundlePromise;
}

/** A successful result is always HTML with a 2xx status, never a CAPTCHA/error page. */
export async function capturePage(input: CaptureInput, fetchResource: typeof safeFetch = safeFetch): Promise<CaptureResult> {
  const requestedUrl = normalizeUrl(input.url);
  await validatePublicUrl(requestedUrl);
  input.signal?.throwIfAborted();
  const timeoutMs = Math.max(10_000, Math.min(input.timeoutMs ?? 90_000, 180_000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new CaptureError('Tempo massimo di acquisizione esaurito.', 'TIMEOUT')), timeoutMs);
  const abort = () => controller.abort(input.signal?.reason ?? new CaptureError('Acquisizione annullata.', 'ABORTED'));
  input.signal?.addEventListener('abort', abort, { once: true });
  let context: BrowserContext | undefined;
  const warnings = new Set<string>();
  const budget: RequestBudget = { bytes: 0, requests: 0, maxBytes: 100 * 1024 * 1024, maxRequests: 600 };
  const resourceCache = new Map<string, SafeResponse>();
  let cacheBytes = 0;
  let navigationError: CaptureError | undefined;
  let pendingNavigation: SafeResponse | undefined;
  let cachedNavigation: SafeResponse | undefined;
  let lastNavigation: SafeResponse | undefined;
  let phase = 'avvio del browser';
  try {
    const browser = await getBrowser();
    controller.signal.throwIfAborted();
    phase = 'preparazione della pagina';
    context = await browser.newContext({
      viewport: { width: Math.max(360, Math.min(input.viewport?.width ?? 1440, 1920)), height: Math.max(600, Math.min(input.viewport?.height ?? 1000, 1200)) },
      deviceScaleFactor: 1, locale: 'it-IT', timezoneId: 'Europe/Rome',
      serviceWorkers: 'block', acceptDownloads: false, bypassCSP: true,
      reducedMotion: 'reduce', colorScheme: 'light',
    });
    controller.signal.addEventListener('abort', () => { void context?.close().catch(() => {}); }, { once: true });
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request();
      try {
        if (!['GET', 'HEAD'].includes(request.method())) {
          warnings.add('Richieste di invio dati bloccate: alcune funzioni interattive potrebbero non comparire.');
          return await route.abort('blockedbyclient');
        }
        if (request.resourceType() === 'media') {
          warnings.add('Audio e video non vengono scaricati.');
          return await route.abort('blockedbyclient');
        }
        if (!/^https?:/i.test(request.url())) return await route.abort('blockedbyclient');
        const mainNavigation = request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame();
        const response = mainNavigation && cachedNavigation?.url === normalizeUrl(request.url()) ? cachedNavigation : await fetchResource(request.url(), {
          headers: await request.allHeaders(), method: request.method() as 'GET' | 'HEAD',
          signal: controller.signal, budget, maxBytes: 12 * 1024 * 1024, timeoutMs: 15_000,
        });
        if (mainNavigation) {
          cachedNavigation = undefined;
          if (response.url !== normalizeUrl(request.url())) {
            // Playwright does not route the later hops of a browser HTTP redirect.
            // Follow them through the pinned transport, then navigate explicitly to
            // the final URL so origin and relative links are correct in Chromium.
            pendingNavigation = response;
            return await route.abort('aborted');
          }
          lastNavigation = response;
        }
        if (response.status === 200 && cacheBytes + response.body.length <= 50 * 1024 * 1024) {
          const key = normalizeUrl(request.url());
          cacheBytes -= resourceCache.get(key)?.body.length ?? 0;
          resourceCache.set(key, response);
          cacheBytes += response.body.length;
        }
        await route.fulfill({ status: response.status, headers: response.headers, body: response.body });
      } catch (error) {
        if (request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame()) {
          navigationError = error instanceof CaptureError ? error : new CaptureError('Impossibile raggiungere la pagina.', 'NETWORK_ERROR');
        } else {
          warnings.add(error instanceof CaptureError && error.code === 'BLOCKED_URL' ? 'Una risorsa verso una rete privata è stata bloccata.' : 'Alcune risorse non sono state scaricate (errore di rete o limite di acquisizione).');
        }
        await route.abort('blockedbyclient').catch(() => {});
      }
    });
    const page = await context.newPage();
    context.on('page', popup => { if (popup !== page) void popup.close().catch(() => {}); });
    page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
    phase = 'apertura della pagina';
    let destination = requestedUrl;
    for (let navigation = 0; navigation < 6; navigation++) {
      pendingNavigation = undefined;
      navigationError = undefined;
      try { await page.goto(destination, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 45_000) }); }
      catch (error) { if (!pendingNavigation) throw error; }
      if (!pendingNavigation) {
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { warnings.add('Il sito mantiene connessioni attive: acquisizione eseguita dopo un’attesa limitata.'); });
        await page.waitForTimeout(1000);
      }
      if (!pendingNavigation) break;
      if (navigation === 5) throw new CaptureError('Troppi reindirizzamenti durante il caricamento.', 'REDIRECT_LIMIT');
      cachedNavigation = pendingNavigation;
      destination = (pendingNavigation as SafeResponse).url;
    }
    controller.signal.throwIfAborted();
    if (navigationError) throw navigationError;
    const response = lastNavigation as SafeResponse | undefined;
    if (!response) throw new CaptureError('Il sito non ha restituito una pagina.', 'NETWORK_ERROR');
    const statusCode = response.status;
    if (statusCode < 200 || statusCode >= 300) throw new CaptureError(`Il sito ha risposto HTTP ${statusCode}.`, 'HTTP_ERROR', statusCode);
    const contentType = response.headers['content-type'] ?? '';
    if (contentType && !/html|xhtml/i.test(contentType)) throw new CaptureError('L’indirizzo non restituisce una pagina HTML.', 'UNSUPPORTED_CONTENT', statusCode);
    phase = 'caricamento degli elementi della pagina';
    // Limited scrolling triggers lazy images without clicking buttons or sending forms.
    await page.evaluate(`(async () => {
      const originalX = scrollX, originalY = scrollY;
      const limit = Math.min(document.documentElement.scrollHeight, 20000);
      for (let y = 0; y < limit; y += Math.max(700, innerHeight)) {
        scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 120));
      }
      scrollTo(originalX, originalY);
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]);
    })()`);
    await page.waitForTimeout(600);
    const finalUrl = normalizeUrl(page.url());
    await validatePublicUrl(finalUrl);
    const ignoreSelectors = (input.ignoreSelectors ?? []).filter(selector => typeof selector === 'string' && selector.length <= 500).slice(0, 30);
    phase = 'lettura del testo e dei collegamenti';
    const metadata = await readPageMetadata(page, ignoreSelectors);
    if (metadata.challenge || /^(just a moment|attention required|verify you are human|checking your browser)/i.test(metadata.title.trim())) {
      throw new CaptureError('Il sito mostra una verifica anti-bot. Nessuna nuova versione è stata archiviata.', 'CAPTCHA', statusCode);
    }
    if (metadata.cookieBanner) warnings.add('È presente un banner cookie; viene conservato senza esprimere consenso.');
    if (metadata.invalidSelectors.length) warnings.add('Uno o più selettori da ignorare non sono validi.');
    const clip = screenshotClip(page.viewportSize()!.width, metadata.height);
    if (metadata.height > clip.height) warnings.add(`Screenshot limitato ai primi ${clip.height} pixel per contenere la memoria; la copia HTML può includere contenuti più in basso.`);
    const masks = ignoreSelectors.filter(selector => !metadata.invalidSelectors.includes(selector)).map(selector => page.locator(selector));
    phase = 'creazione dello screenshot';
    const screenshot = await page.screenshot({
      type: 'png', animations: 'disabled', caret: 'hide', mask: masks, maskColor: '#e5e7eb',
      // fullPage enables capture below the viewport; the trusted clip always
      // bounds BOTH dimensions before Chromium allocates the screenshot.
      fullPage: true, clip,
      timeout: 15_000,
    });
    const userAgent = await page.evaluate('navigator.userAgent') as string;
    await page.exposeFunction('__landingFetchResource', async (url: string) => {
      try {
        const resource = resourceCache.get(normalizeUrl(url)) ?? await fetchResource(url, { headers: { 'user-agent': userAgent }, signal: controller.signal, budget, maxBytes: 10 * 1024 * 1024, timeoutMs: 12_000 });
        if (resource.status < 200 || resource.status >= 300) warnings.add('Alcune risorse della copia offline non sono disponibili sul sito.');
        // SingleFile needs content type; omitting Set-Cookie also avoids Headers rejecting multiple cookies.
        return { status: resource.status, headers: { 'content-type': resource.headers['content-type'] ?? 'application/octet-stream' }, data: resource.body.toString('base64') };
      } catch (error) {
        const reason = error instanceof CaptureError ? error.code : ((error as { code?: string })?.code || 'NETWORK_ERROR');
        let host = 'risorsa';
        try { host = new URL(url).hostname; } catch { /* Keep a neutral label for malformed resource URLs. */ }
        warnings.add(`Copia offline: alcune risorse di ${host} non sono state incorporate (${reason}).`);
        throw error;
      }
    });
    phase = 'preparazione della copia HTML';
    await page.evaluate(await getSingleFileBundle());
    const html = await page.evaluate(`(async () => {
      __landingSingleFile.init({fetch: async url => {
        const value = await window.__landingFetchResource(String(url));
        const bytes = Uint8Array.from(atob(value.data), char => char.charCodeAt(0));
        return {status: value.status, headers: new Headers(value.headers), arrayBuffer: async () => bytes.buffer};
      }});
      const result = await __landingSingleFile.getPageData({
        removeHiddenElements: false, removeUnusedStyles: true, removeUnusedFonts: true,
        removeFrames: true, removeScripts: true, blockScripts: true, blockVideos: true, blockAudios: true,
        removeAlternativeFonts: true, removeAlternativeImages: true, removeAlternativeMedias: true,
        groupDuplicateImages: true, loadDeferredImages: false, compressHTML: false,
        insertMetaCSP: true, insertSingleFileComment: true, saveFavicon: true,
        maxResourceSizeEnabled: true, maxResourceSize: 10, networkTimeout: 12000,
      });
      // Parse inertly; do not attach archived content back to the live document.
      const doc = new DOMParser().parseFromString(result.content, 'text/html');
      doc.querySelectorAll('script,iframe,frame,object,embed,base').forEach(node => node.remove());
      doc.querySelectorAll('meta[http-equiv]').forEach(node => {
        if (/^(refresh|content-security-policy)$/i.test(node.getAttribute('http-equiv') || '')) node.remove();
      });
      doc.querySelectorAll('*').forEach(node => {
        for (const attr of Array.from(node.attributes)) {
          if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || /^(javascript|vbscript):/i.test(attr.value.replace(/[\\u0000-\\u0020]/g, ''))) node.removeAttribute(attr.name);
        }
      });
      doc.querySelectorAll('form').forEach(node => { node.removeAttribute('action'); node.removeAttribute('method'); });
      doc.querySelectorAll('input,button,select,textarea').forEach(node => node.setAttribute('disabled', ''));
      const csp = doc.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy';
      csp.content = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; media-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
      doc.head.prepend(csp);
      return '<!DOCTYPE html>\\n' + doc.documentElement.outerHTML;
    })()`) as string;
    const result = {
      requestedUrl, finalUrl, statusCode, title: metadata.title, text: metadata.text,
      headings: metadata.headings, links: metadata.links, imageUrls: metadata.imageUrls,
      html, screenshot, warnings: [...warnings].slice(0, captureLimits.warnings).map(warning => warning.slice(0, captureLimits.warning)), capturedAt: new Date().toISOString(),
    };
    phase = 'verifica dei file acquisiti';
    validateCaptureResult(result);
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      throw new CaptureError(`${reason instanceof CaptureError ? reason.message : 'Acquisizione annullata.'} Fase: ${phase}.`, reason instanceof CaptureError ? reason.code : 'ABORTED');
    }
    if (navigationError) throw navigationError;
    if (error instanceof CaptureError) throw error;
    const networkCode = error instanceof Error ? error.message.match(/net::(ERR_[A-Z_]+)/)?.[1] : undefined;
    const wrapped = new CaptureError(`Acquisizione non completata durante: ${phase}.${networkCode ? ` Errore di rete: ${networkCode}.` : ''}${phase === 'avvio del browser' ? ' Controlla i log del motore in Umbrel: il browser potrebbe non riuscire ad avviarsi.' : ''}`, error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'CAPTURE_FAILED');
    wrapped.cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {});
  }
}
