import { metadataScript } from './page-metadata.js';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { CaptureInput, CaptureResult } from './types.js';
import { CaptureError, normalizeUrl, safeFetch, safeRequest, validatePublicUrl, type RequestBudget, type SafeResponse } from './network.js';

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
    }).catch(error => { browserPromise = undefined; throw error; });
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
export async function capturePage(input: CaptureInput): Promise<CaptureResult> {
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
  try {
    const browser = await getBrowser();
    controller.signal.throwIfAborted();
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
        const response = await safeRequest(request.url(), {
          headers: await request.allHeaders(), method: request.method() as 'GET' | 'HEAD',
          signal: controller.signal, budget, maxBytes: 12 * 1024 * 1024, timeoutMs: 15_000,
        });
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
    const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 45_000) });
    if (!response) throw new CaptureError('Il sito non ha restituito una pagina.', 'NETWORK_ERROR');
    const statusCode = response.status();
    if (statusCode < 200 || statusCode >= 300) throw new CaptureError(`Il sito ha risposto HTTP ${statusCode}.`, 'HTTP_ERROR', statusCode);
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType && !/html|xhtml/i.test(contentType)) throw new CaptureError('L’indirizzo non restituisce una pagina HTML.', 'UNSUPPORTED_CONTENT', statusCode);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { warnings.add('Il sito mantiene connessioni attive: acquisizione eseguita dopo un’attesa limitata.'); });
    await page.waitForTimeout(1000);
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
    const metadata = await page.evaluate(`${metadataScript}(${JSON.stringify(ignoreSelectors)})`) as {
      title: string; text: string; headings: string[]; links: { url: string; text: string }[]; imageUrls: string[];
      height: number; invalidSelectors: string[]; cookieBanner: boolean; challenge: boolean;
    };
    if (metadata.challenge || /^(just a moment|attention required|verify you are human|checking your browser)/i.test(metadata.title.trim())) {
      throw new CaptureError('Il sito mostra una verifica anti-bot. Nessuna nuova versione è stata archiviata.', 'CAPTCHA', statusCode);
    }
    if (metadata.cookieBanner) warnings.add('È presente un banner cookie; viene conservato senza esprimere consenso.');
    if (metadata.invalidSelectors.length) warnings.add('Uno o più selettori da ignorare non sono validi.');
    if (metadata.height > 20_000) warnings.add('Screenshot limitato ai primi 20.000 pixel; i contenuti caricati più in basso potrebbero essere incompleti.');
    const masks = ignoreSelectors.filter(selector => !metadata.invalidSelectors.includes(selector)).map(selector => page.locator(selector));
    const screenshot = await page.screenshot({
      type: 'png', animations: 'disabled', caret: 'hide', mask: masks, maskColor: '#e5e7eb',
      ...(metadata.height > 20_000 ? { clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 20_000 } } : { fullPage: true }),
      timeout: 15_000,
    });
    const userAgent = await page.evaluate('navigator.userAgent') as string;
    await page.exposeFunction('__landingFetchResource', async (url: string) => {
      try {
        const resource = resourceCache.get(normalizeUrl(url)) ?? await safeFetch(url, { headers: { 'user-agent': userAgent }, signal: controller.signal, budget, maxBytes: 10 * 1024 * 1024, timeoutMs: 12_000 });
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
    if (Buffer.byteLength(html) > 80 * 1024 * 1024) throw new CaptureError('La copia HTML supera il limite di 80 MB.', 'SIZE_LIMIT');
    return {
      requestedUrl, finalUrl, statusCode, title: metadata.title, text: metadata.text,
      headings: metadata.headings, links: metadata.links, imageUrls: metadata.imageUrls,
      html, screenshot, warnings: [...warnings], capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason instanceof CaptureError ? controller.signal.reason : new CaptureError('Acquisizione annullata.', 'ABORTED');
    if (navigationError) throw navigationError;
    if (error instanceof CaptureError) throw error;
    const wrapped = new CaptureError(error instanceof Error && error.name === 'TimeoutError' ? 'La pagina non ha terminato il caricamento entro il limite.' : 'Acquisizione non completata. Riprovare o controllare lo stato del sito.', error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'CAPTURE_FAILED');
    wrapped.cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {});
  }
}
