import type { Page } from 'playwright';
import { captureLimits, limitError, validateCaptureSignals, validateMetadata } from './capture-limits.js';
import type { DetectionData, PageContent } from './types.js';

// Run in an isolated world so page scripts cannot replace these built-ins.
export const metadataScript = `((selectors, importantSelectors = []) => {
  const limits = ${JSON.stringify(captureLimits)};
  const live = document.body;
  const body = live ? live.cloneNode(true) : document.createElement('body');
  const liveNodes = Array.from(live?.querySelectorAll('*') || []);
  if (liveNodes.length > 50000) throw new Error('DOM limit');
  const clonedNodes = Array.from(body.querySelectorAll('*'));
  liveNodes.forEach((node, index) => {
    if (node.localName === 'img' && node.currentSrc) clonedNodes[index]?.setAttribute('src', node.currentSrc);
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    const clipped = ['hidden','clip'].includes(style.overflow) && (rect.width <= 1 || rect.height <= 1);
    if (style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || Number(style.opacity) === 0 || node.hasAttribute('hidden') || clipped || (style.display !== 'contents' && !node.getClientRects().length) || rect.right < 0 || rect.bottom + scrollY < 0) clonedNodes[index]?.remove();
  });
  const collect = root => {
    const clean = root.cloneNode(true);
    clean.querySelectorAll('script,style,noscript,template,svg,[hidden]').forEach(node => node.remove());
    clean.querySelectorAll('p,div,section,header,footer,main,article,h1,h2,h3,h4,h5,h6,li,td,th,label,button,br').forEach(node => { node.prepend('\\n'); node.append('\\n'); });
    return {
      title: document.title.slice(0, 500),
      text: (clean.textContent || '').replace(/[\\t\\r ]+/g, ' ').replace(/\\n\\s*\\n/g, '\\n').trim().slice(0, limits.text),
      headings: Array.from(clean.querySelectorAll('h1,h2,h3')).slice(0, limits.headings).map(node => (node.textContent || '').trim().slice(0, limits.heading)).filter(Boolean),
      links: Array.from(clean.querySelectorAll('a[href]')).slice(0, limits.links).map(node => ({ url: node.href, text: (node.textContent || '').trim().slice(0, limits.linkText) })).filter(link => /^https?:/.test(link.url) && link.url.length <= limits.url),
      imageUrls: Array.from(clean.querySelectorAll('img')).slice(0, limits.images).map(node => node.currentSrc || node.src).filter(url => /^https?:/.test(url) && url.length <= limits.url),
    };
  };
  const rectangles = nodes => nodes.slice(0, 100).map(node => {
    const r = node.getBoundingClientRect(); return { x: Math.max(0, r.x + scrollX), y: Math.max(0, r.y + scrollY), width: Math.min(1920, Math.max(0, r.width)), height: Math.min(20000, Math.max(0, r.height)) };
  }).filter(r => r.width > 0 && r.height > 0 && r.y < 20000 && r.x < 1920);
  const full = collect(body), invalidSelectors = [], ignored = [];
  for (const selector of selectors) {
    try {
      ignored.push(...rectangles(Array.from(document.querySelectorAll(selector))));
      if (body.matches(selector)) body.replaceChildren();
      else body.querySelectorAll(selector).forEach(node => node.remove());
    } catch { invalidSelectors.push(selector); }
  }
  const important = importantSelectors.map(selector => {
    let nodes = [];
    try { nodes = Array.from(document.querySelectorAll(selector)).slice(0, 100); } catch { invalidSelectors.push(selector); }
    const root = document.createElement('div');
    for (const node of nodes) root.append(node.cloneNode(true));
    const content = collect(root);
    return { selector, count: nodes.length, text: content.text.slice(0, 20000), links: content.links.slice(0, 100), imageUrls: content.imageUrls.slice(0, 100), rectangles: rectangles(nodes) };
  });
  const excluded = node => !importantSelectors.some(selector => { try { return Boolean(node.closest(selector)); } catch { return false; } }) && selectors.some(selector => { try { return Boolean(node.closest(selector)); } catch { return false; } });
  const visible = node => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node);
    return r.width > 2 && r.height > 2 && r.right > 0 && r.y + scrollY < 20000 && r.bottom + scrollY > 0 && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && style.display !== 'none' && !['hidden','collapse'].includes(style.visibility) && Number(style.opacity) !== 0;
  };
  const missingImages = Array.from(document.images).filter(img => visible(img) && !excluded(img) && (!img.complete || img.naturalWidth === 0)).length;
  const assets = [], assetMap = new Map(), blocks = [];
  const addAsset = (raw, kind, status, node) => {
    let url; try { url = new URL(raw, document.baseURI).href; } catch { return; }
    if (!/^https?:/.test(url) || url.length > limits.url || !raw) return;
    const key = kind + ':' + url, rects = rectangles([node]);
    const existing = assetMap.get(key);
    if (existing) {
      existing.rectangles.push(...rects.slice(0, Math.max(0, 20 - existing.rectangles.length)));
      if (status !== 'loaded') existing.status = status;
    } else if (assets.length < limits.assets) {
      const asset = { url, kind, status, rectangles: rects }; assets.push(asset); assetMap.set(key, asset);
    }
  };
  for (const node of liveNodes) {
    if (excluded(node) || !visible(node)) continue;
    if (node.localName === 'img') {
      const raw = node.currentSrc || node.getAttribute('src') || node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('data-original') || '';
      addAsset(raw, 'image', node.complete && node.naturalWidth > 0 ? 'loaded' : node.complete && raw ? 'failed' : 'pending', node);
    }
    const background = getComputedStyle(node).backgroundImage;
    for (const match of background.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) addAsset(match[1], 'background', 'pending', node);
    if (blocks.length < limits.blocks && /^(h[1-6]|p|li|button|a|label|td|th|blockquote)$/.test(node.localName)) {
      const text = (node.textContent || '').normalize('NFKC').replace(/\\s+/g, ' ').trim().slice(0, limits.blockText);
      if (!text) continue;
      const path = []; let current = node;
      for (let depth = 0; current && current !== live && depth < 6; depth++, current = current.parentElement) {
        let index = 1, sibling = current.previousElementSibling;
        while (sibling) { if (sibling.localName === current.localName) index++; sibling = sibling.previousElementSibling; }
        path.unshift(current.localName + ':' + index);
      }
      blocks.push({ key: path.join('/').slice(0, 500), text, rectangles: rectangles([node]) });
    }
  }
  const fontFaces = Array.from(document.fonts).slice(0, 500);
  return { ...full, comparison: collect(body), ignored: ignored.slice(0, 300), important,
    assets, blocks, fontsPending: document.fonts.status === 'loading', fontsFailed: fontFaces.filter(font => font.status === 'error').length,
    missingImages: Math.min(missingImages, 50000), height: document.documentElement.scrollHeight,
    invalidSelectors, cookieBanner: Boolean(document.querySelector('[id*="cookie-banner"],[class*="cookie-banner"],#onetrust-banner-sdk,#CybotCookiebotDialog')),
    challenge: Boolean(document.querySelector('#challenge-running,#challenge-stage,form#challenge-form')) };
})`;

export async function readPageMetadata(page: Page, selectors: string[], important: string[] = []) {
  const session = await page.context().newCDPSession(page);
  try {
    const { frameTree } = await session.send('Page.getFrameTree');
    const { executionContextId } = await session.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'landing-archive-metadata', grantUniveralAccess: false });
    const evaluated = await session.send('Runtime.evaluate', { expression: `${metadataScript}(${JSON.stringify(selectors)}, ${JSON.stringify(important)})`, contextId: executionContextId, returnByValue: true, timeout: 5000 });
    if (evaluated.exceptionDetails) throw limitError();
    const value = evaluated.result.value;
    validateMetadata(value); validateMetadata(value.comparison); validateCaptureSignals(value);
    const backgrounds = value.assets.filter((asset: { kind: string }) => asset.kind === 'background').slice(0, 80);
    if (backgrounds.length) {
      // HTTP 200 alone does not mean a CSS background is a decodable image.
      // Cache bounded probes in the isolated world; page scripts cannot forge them.
      const decoded = await session.send('Runtime.evaluate', {
        expression: `(async () => {
          const cache = globalThis.__landingBackgroundDecodes ||= new Map();
          return Promise.all(${JSON.stringify(backgrounds.map((asset: { url: string }) => asset.url))}.map(async url => {
            if (!cache.has(url) && cache.size < 80) cache.set(url, new Promise(resolve => {
              const img = new Image(); let done = false;
              const finish = value => { if (done) return; done = true; clearTimeout(timer); img.onload = img.onerror = null; resolve(value); };
              const timer = setTimeout(() => finish('pending'), 1800);
              img.onload = () => finish(img.naturalWidth > 0 ? 'loaded' : 'failed'); img.onerror = () => finish('failed'); img.src = url;
            }));
            return [url, cache.has(url) ? await cache.get(url) : 'pending'];
          }));
        })()`, contextId: executionContextId, returnByValue: true, awaitPromise: true, timeout: 2500,
      });
      const states = new Map<string, string>(decoded.result.value || []);
      for (const asset of value.assets) if (asset.kind === 'background') asset.status = states.get(asset.url) || 'pending';
      validateCaptureSignals(value);
    }
    if (typeof value.height !== 'number' || !Number.isFinite(value.height) || !Array.isArray(value.invalidSelectors) || value.invalidSelectors.length > 60) throw limitError();
    if (typeof value.fontsPending !== 'boolean' || !Number.isInteger(value.fontsFailed) || value.fontsFailed < 0 || value.fontsFailed > 500) throw limitError();
    return value as PageContent & { comparison: PageContent; ignored: DetectionData['ignored']; important: DetectionData['important']; assets: NonNullable<DetectionData['assets']>; blocks: NonNullable<DetectionData['blocks']>; fontsPending: boolean; fontsFailed: number; missingImages: number; height: number; invalidSelectors: string[]; cookieBanner: boolean; challenge: boolean };
  } finally { await session.detach().catch(() => {}); }
}
