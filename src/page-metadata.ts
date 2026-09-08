import type { Page } from 'playwright';
import { captureLimits, limitError, validateMetadata } from './capture-limits.js';

// Evaluated in a CDP isolated world: the page cannot replace the built-ins used
// to bound the result before it crosses back into the acquisition process.
export const metadataScript = `((selectors) => {
      const limits = ${JSON.stringify(captureLimits)};
      const body = document.body ? document.body.cloneNode(true) : document.createElement('body');
      // textContent on a detached clone includes invisible honeypots and randomized form traps.
      // Match live and cloned nodes before removing anything, then keep only rendered content.
      const liveNodes = Array.from(document.body?.querySelectorAll('*') || []);
      const clonedNodes = Array.from(body.querySelectorAll('*'));
      liveNodes.forEach((node, index) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const clipped = ['hidden', 'clip'].includes(style.overflow) && (rect.width <= 1 || rect.height <= 1);
        const notRendered = style.display !== 'contents' && !node.getClientRects().length;
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0 || node.hasAttribute('hidden') || clipped || notRendered || rect.right < 0 || rect.bottom + scrollY < 0) clonedNodes[index]?.remove();
      });
      const invalidSelectors = [];
      for (const selector of selectors) {
        try { body.querySelectorAll(selector).forEach(node => node.remove()); }
        catch { invalidSelectors.push(selector); }
      }
      body.querySelectorAll('script,style,noscript,template,svg,[hidden]').forEach(node => node.remove());
      // A detached clone has no layout-derived innerText separators. Explicit block
      // boundaries keep randomized hidden fields from changing adjacent word spacing.
      body.querySelectorAll('p,div,section,header,footer,main,article,h1,h2,h3,h4,h5,h6,li,td,th,label,button,br').forEach(node => {
        node.prepend('\\n'); node.append('\\n');
      });
      const text = (body.innerText || body.textContent || '').replace(/[\\t\\r ]+/g, ' ').replace(/\\n\\s*\\n/g, '\\n').trim().slice(0, 1500000);
      return {
        title: document.title.slice(0, 500), text,
        headings: Array.from(body.querySelectorAll('h1,h2,h3')).slice(0, limits.headings).map(node => (node.textContent || '').trim().slice(0, limits.heading)).filter(Boolean),
        links: Array.from(body.querySelectorAll('a[href]')).slice(0, limits.links).map(node => ({ url: node.href, text: (node.innerText || node.textContent || '').trim().slice(0, limits.linkText) })).filter(link => /^https?:/.test(link.url) && link.url.length <= limits.url),
        imageUrls: Array.from(body.querySelectorAll('img')).slice(0, limits.images).map(node => node.currentSrc || node.src).filter(url => /^https?:/.test(url) && url.length <= limits.url),
        height: document.documentElement.scrollHeight,
        invalidSelectors,
        cookieBanner: Boolean(document.querySelector('[id*="cookie-banner"],[class*="cookie-banner"],#onetrust-banner-sdk,#CybotCookiebotDialog')),
        challenge: Boolean(document.querySelector('#challenge-running,#challenge-stage,form#challenge-form')),
      };
    })`;

export async function readPageMetadata(page: Page, selectors: string[]) {
  const session = await page.context().newCDPSession(page);
  try {
    const { frameTree } = await session.send('Page.getFrameTree');
    const { executionContextId } = await session.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'landing-archive-metadata', grantUniveralAccess: false });
    const evaluated = await session.send('Runtime.evaluate', { expression: `${metadataScript}(${JSON.stringify(selectors)})`, contextId: executionContextId, returnByValue: true, timeout: 5000 });
    if (evaluated.exceptionDetails) throw limitError();
    const value = evaluated.result.value;
    validateMetadata(value);
    if (typeof value.height !== 'number' || !Number.isFinite(value.height) || !Array.isArray(value.invalidSelectors) || value.invalidSelectors.length > 30) throw limitError();
    return value as { title: string; text: string; headings: string[]; links: { url: string; text: string }[]; imageUrls: string[]; height: number; invalidSelectors: string[]; cookieBanner: boolean; challenge: boolean };
  } finally { await session.detach().catch(() => {}); }
}
