import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { capturePage, closeBrowser } from '../src/capture.js';
import type { safeFetch } from '../src/network.js';

test('a page-forged packaging result is sanitized outside the hostile JS world and remains inert from disk', async () => {
  const artifact = '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://outside.example/refresh"><script>window.archiveCompromised=true;fetch("https://outside.example/script")</script></head><body onload="window.archiveCompromised=true"><h1>Forged artifact marker</h1><img src="https://outside.example/image" onerror="window.archiveCompromised=true"><form action="https://outside.example/send"><button>Send</button></form><a href="javascript:window.archiveCompromised=true">Run</a></body></html>';
  const source = `<html><head><title>Hostile packaging fixture</title><script>
    const artifact = ${JSON.stringify(artifact).replaceAll('<', '\\u003c')};
    const NativeParser = window.DOMParser;
    window.DOMParser = class extends NativeParser {
      parseFromString(content, type) {
        const doc = super.parseFromString(content, type);
        if (content.includes('Forged artifact marker')) Object.defineProperty(doc.documentElement, 'outerHTML', { get: () => artifact });
        return doc;
      }
    };
    Object.defineProperty(window, '__landingSingleFile', { configurable: true,
      get: () => ({ init() {}, async getPageData() { return { content: artifact }; } }), set() {} });
  </script></head><body><h1>Actual page content</h1></body></html>`;
  const transport: typeof safeFetch = async url => ({ url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(source) });
  const directory = mkdtempSync(join(tmpdir(), 'landing-hostile-copy-'));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const result = await capturePage({ url: 'https://1.1.1.1/', timeoutMs: 30000 }, transport);
    assert.match(result.html, /Forged artifact marker/, 'The fixture must actually replace the packaged artifact');
    assert.doesNotMatch(result.html, /<script|onload=|onerror=|http-equiv="refresh"|javascript:/i);
    assert.match(result.html, /Content-Security-Policy/);
    const file = join(directory, 'archive.html'); writeFileSync(file, result.html);
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined) });
    const context = await browser.newContext();
    const external: string[] = [];
    await context.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href);
    assert.equal(await page.locator('h1').textContent(), 'Forged artifact marker');
    await page.getByRole('link', { name: 'Run', exact: true }).click();
    assert.equal(await page.evaluate('window.archiveCompromised'), undefined);
    assert.equal(await page.locator('button').isDisabled(), true);
    assert.deepEqual(external, []);
    assert.ok(page.url().startsWith('file:'));
  } finally { await browser?.close(); await closeBrowser(); rmSync(directory, { recursive: true, force: true }); }
});
