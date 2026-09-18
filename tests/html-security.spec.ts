import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { sanitizeArchiveDocument } from '../src/html-transform.js';
import { capturePage, closeBrowser } from '../src/capture.js';

test('downloaded HTML is inert with scripts enabled and no HTTP response headers', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-html-safety-'));
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined) });
  try {
    const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const source = `<!doctype html><head><base href="https://outside.example/"><meta http-equiv="refresh" content="0;url=https://outside.example/refresh"><style>@import "https://outside.example/import"; body{color:rgb(10,20,30);background-image:url(https://outside.example/background)}</style><link rel="stylesheet" href="https://outside.example/style"></head><body onload="window.compromised=true"><h1>Local copy</h1><script>window.compromised=true;fetch('https://outside.example/script')</script><img id="local" src="${image}"><img src="https://outside.example/image" onerror="window.compromised=true"><iframe src="https://outside.example/frame"></iframe><a href="https://outside.example/navigation" target="_top" ping="https://outside.example/ping">Live link</a><form action="https://outside.example/form"><button>Send</button></form><math><mtext><table><mglyph><style><!--</style><img title="--><img src=https://outside.example/mutation onerror=window.compromised=true>"></math></body>`;
    const file = join(directory, 'copy.html');
    writeFileSync(file, await sanitizeArchiveDocument(source, 'https://example.com/'));
    const context = await browser.newContext({ javaScriptEnabled: true });
    const remote: string[] = [];
    await context.route(/^https?:/, route => { remote.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { name: 'Local copy' }).count(), 1);
    assert.equal(await page.evaluate(() => Reflect.get(window, 'compromised')), undefined);
    assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).color), 'rgb(10, 20, 30)');
    assert.equal(await page.locator('#local').evaluate(node => (node as HTMLImageElement).naturalWidth), 1);
    assert.equal(await page.getByRole('button', { name: 'Send' }).isDisabled(), true);
    await page.getByRole('link', { name: 'Live link' }).click();
    assert.ok(page.url().startsWith(pathToFileURL(file).href));
    assert.deepEqual(remote, []);
    assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').count(), 1);
    await context.close();
  } finally { await browser.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('page-controlled serialization cannot return active HTML from the capture pipeline', async () => {
  const forged = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'"></head><body><h1>Forged copy</h1><script>window.compromised=true</script><img src="https://outside.example/leak" onerror="window.compromised=true"><a href="https://outside.example/">Remote</a></body></html>`;
  const source = `<!doctype html><h1>Original copy</h1><script>
    const original = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function(...args) {
      const doc = Reflect.apply(original, this, args);
      Object.defineProperty(doc.documentElement, 'outerHTML', { get: () => ${JSON.stringify(forged).replace(/</g, '\\u003c')} });
      return doc;
    };
  </script>`;
  const transport = async (url: string) => ({ url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(source) });
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/' }, transport);
    assert.match(result.html, /Forged copy/);
    assert.doesNotMatch(result.html, /<script|onerror=|src="https:/);
    assert.match(result.html, /script-src 'none'/);
    assert.match(result.html, /data-archive-href="https:\/\/outside\.example\//);
    assert.equal(result.quality?.archiveStatus, 'partial', 'Forged content also fails the independent rendering-quality check');
  } finally { await closeBrowser(); }
});
