// Evaluated inside the capture browser; shared with the browser regression tests.
export const metadataScript = `((selectors) => {
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
        headings: Array.from(body.querySelectorAll('h1,h2,h3')).map(node => (node.textContent || '').trim()).filter(Boolean).slice(0, 100),
        links: Array.from(body.querySelectorAll('a[href]')).slice(0, 2000).map(node => ({ url: node.href, text: (node.innerText || node.textContent || '').trim().slice(0, 200) })).filter(link => /^https?:/.test(link.url)),
        imageUrls: Array.from(body.querySelectorAll('img')).slice(0, 500).map(node => node.currentSrc || node.src).filter(url => /^https?:/.test(url)),
        height: document.documentElement.scrollHeight,
        invalidSelectors,
        cookieBanner: Boolean(document.querySelector('[id*="cookie-banner"],[class*="cookie-banner"],#onetrust-banner-sdk,#CybotCookiebotDialog')),
        challenge: Boolean(document.querySelector('#challenge-running,#challenge-stage,form#challenge-form')),
      };
    })`;
