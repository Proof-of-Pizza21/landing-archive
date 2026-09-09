import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { metadataScript, readPageMetadata } from '../src/page-metadata.js';
import { captureLimits, screenshotClip, validateScreenshot } from '../src/capture-limits.js';
import { capturePage, closeBrowser } from '../src/capture.js';
import { safeFetch, validatePublicUrl } from '../src/network.js';

test('rendered metadata excludes randomized invisible traps but retains real content and links', async () => {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/*', route => route.abort());
    const render = async (random: string) => {
      await page.setContent(`<base href="https://example.com/"><title>Landing</title><body>
        <div style="display:contents"><h1>Offerta reale</h1><a href="/offer">Scopri</a></div>
        <div style="display:none">display ${random}</div>
        <div style="visibility:hidden">visibility ${random}</div>
        <div style="position:absolute;overflow:hidden;display:inline;height:1px;width:1px;z-index:-1000;padding:0"><label>trap ${random}</label><input></div>
        <div style="opacity:0">opacity ${random}</div><div style="position:absolute;left:-9000px">offscreen ${random}</div>
        <div class="ignore"><a href="/random-${random}">Ignored ${random}</a><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>
        <div><label>Nome *</label>${random === 'A' ? '<div hidden>random field</div>\n ' : ''}<label>Email *</label>${random === 'B' ? '<div hidden>random field</div>\n ' : ''}<label>Messaggio</label></div>
        <div style="margin-top:2000px"><h2>Contenuto in fondo</h2></div>
      </body>`);
      return await page.evaluate(`${metadataScript}([".ignore"])`) as any;
    };
    const a = await render('A'), b = await render('B');
    assert.equal(a.text.replace(/\s+/g, ' '), b.text.replace(/\s+/g, ' '));
    assert.match(a.text, /Offerta reale/); assert.match(a.text, /Contenuto in fondo/);
    assert.equal(/trap|opacity|offscreen|Ignored/.test(a.text), false);
    assert.deepEqual(a.links, [{ url: 'https://example.com/offer', text: 'Scopri' }]);
    assert.deepEqual(a.headings, ['Offerta reale', 'Contenuto in fondo']);
    assert.deepEqual(a.imageUrls, []);
    await page.setContent('<title>Bounded fixture</title><body style="margin:0"><div style="width:12000px;height:1200px">Wide page</div></body>');
    const shot = await page.screenshot({ fullPage: true, clip: screenshotClip(1440, 1200) });
    assert.deepEqual(validateScreenshot(shot), { width: 1440, height: 1200 });
    await page.evaluate(() => {
      let parent = document.body;
      for (let i = 0; i < 100; i++) { const heading = document.createElement('h1'); parent.append(heading); parent = heading; }
      parent.textContent = 'neutral'.repeat(15000);
      // A site's monkey-patching must not alter metadata or remove its limits.
      Array.from = (() => { throw new Error('Page-controlled Array.from'); }) as typeof Array.from;
    });
    const bounded = await readPageMetadata(page, []);
    assert.equal(bounded.title, 'Bounded fixture');
    assert.equal(bounded.headings.length, 100);
    assert.ok(bounded.headings.every(value => value.length <= captureLimits.heading));
    assert.ok(Buffer.byteLength(JSON.stringify(bounded)) < 200000);
  } finally { await browser.close(); }
});

test('capture follows redirects through the protected transport and retains the final origin', async () => {
  const visited: string[] = [];
  const transport: typeof safeFetch = async (url, options) => safeFetch(url, options, async target => {
    await validatePublicUrl(target); visited.push(target);
    if (target === 'https://1.1.1.1/start') return { url: target, status: 301, headers: { location: 'https://8.8.8.8/offers/final/' }, body: Buffer.alloc(0) };
    if (target.endsWith('/style.css')) return { url: target, status: 302, headers: { location: '/assets/main.css' }, body: Buffer.alloc(0) };
    const css = target.endsWith('.css');
    const body = css ? 'body { background: rgb(240, 245, 220); }' : '<!doctype html><html><head><title>Redirect fixture</title><link rel="stylesheet" href="style.css"></head><body><h1>Archived after redirect</h1><a href="next">Next offer</a></body></html>';
    return { url: target, status: 200, headers: { 'content-type': css ? 'text/css' : 'text/html' }, body: Buffer.from(body) };
  });
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/start', timeoutMs: 30000 }, transport);
    assert.equal(result.requestedUrl, 'https://1.1.1.1/start');
    assert.equal(result.finalUrl, 'https://8.8.8.8/offers/final/');
    assert.equal(result.title, 'Redirect fixture');
    assert.equal(result.statusCode, 200);
    assert.ok(result.links.some(link => link.url === 'https://8.8.8.8/offers/final/next'));
    assert.ok(visited.includes('https://8.8.8.8/offers/final/style.css'));
    assert.ok(visited.includes('https://8.8.8.8/assets/main.css'));
    assert.match(result.html, /Archived after redirect/);
    assert.ok(validateScreenshot(result.screenshot).width > 0);
    const unsafe: typeof safeFetch = async (url, options) => safeFetch(url, options, async target => {
      await validatePublicUrl(target);
      return { url: target, status: 302, headers: { location: 'http://127.0.0.1/private' }, body: Buffer.alloc(0) };
    });
    await assert.rejects(capturePage({ url: 'https://1.1.1.1/start' }, unsafe), (error: any) => error.code === 'BLOCKED_URL');
  } finally { await closeBrowser(); }
});
