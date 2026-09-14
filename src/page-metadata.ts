import type { Page } from 'playwright';
import { captureLimits, limitError, validateMetadata } from './capture-limits.js';
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
  const missingImages = Array.from(document.images).filter(img => {
    const r = img.getBoundingClientRect(), style = getComputedStyle(img);
    return !!(img.currentSrc || img.getAttribute('src')) && r.width > 2 && r.height > 2 && r.y + scrollY < 20000 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && (!img.complete || img.naturalWidth === 0);
  }).length;
  return { ...full, comparison: collect(body), ignored: ignored.slice(0, 300), important,
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
    validateMetadata(value); validateMetadata(value.comparison);
    if (typeof value.height !== 'number' || !Number.isFinite(value.height) || !Array.isArray(value.invalidSelectors) || value.invalidSelectors.length > 60) throw limitError();
    return value as PageContent & { comparison: PageContent; ignored: DetectionData['ignored']; important: DetectionData['important']; missingImages: number; height: number; invalidSelectors: string[]; cookieBanner: boolean; challenge: boolean };
  } finally { await session.detach().catch(() => {}); }
}
