import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { capturePage, closeBrowser } from '../src/capture.js';

const picture = () => { const png = new PNG({ width: 100, height: 100 }); png.data.fill(140); for (let n = 3; n < png.data.length; n += 4) png.data[n] = 255; return PNG.sync.write(png); };

test('real browser detects missing images and keeps ignored content in full copies', async () => {
  let broken = true, counter = 10;
  const transport = async (url: string) => {
    const isImage = url.endsWith('/hero.png');
    return { url, status: isImage && broken ? 404 : 200, headers: { 'content-type': isImage ? 'image/png' : 'text/html' }, body: isImage ? broken ? Buffer.alloc(0) : picture() : Buffer.from(`<!doctype html><title>Quality fixture</title><body><h1>Stable offer</h1><p id="price">100 euro</p><p id="counter">${counter}</p><img width="100" height="100" src="/hero.png"><button id="cta">Buy now</button></body>`) };
  };
  try {
    const partial = await capturePage({ url: 'https://1.1.1.1/', ignoreSelectors: ['#counter'], importantSelectors: ['#price', '#cta'] }, transport);
    assert.equal(partial.quality?.status, 'partial'); assert.equal(partial.quality?.missingImages, 1);
    assert.match(partial.text, /10/); assert.doesNotMatch(partial.detection!.content.text, /\b10\b/);
    assert.match(partial.html, /id="counter"/); assert.equal(partial.detection!.ignored.length, 1);
    assert.equal(partial.detection!.important[1].text.trim(), 'Buy now');
    broken = false; counter = 9;
    const full = await capturePage({ url: 'https://1.1.1.1/', ignoreSelectors: ['#counter'], importantSelectors: ['#price', '#cta'] }, transport);
    assert.equal(full.quality?.status, 'complete'); assert.equal(full.quality?.missingImages, 0);
    assert.equal(partial.detection!.content.text, full.detection!.content.text);
    assert.deepEqual(partial.detection!.content.imageUrls, full.detection!.content.imageUrls);
    assert.match(full.html, /data:image\/png/);
  } finally { await closeBrowser(); }
});

test('visual selection, two-copy preview, discovery settings and lifecycle filters work on desktop and phone', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-rules-ui-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, listPages, addPage } = await import('../src/db.js');
  const { recordCapture, recordFailure } = await import('../src/history.js');
  const app = await createApp();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'rules-test', password: 'temporary-test-password' } });
    const cookie = String(setup.headers['set-cookie']).split(';')[0];
    const site = (await app.inject({ method: 'POST', url: '/api/sites', headers: { cookie }, payload: { name: 'Campaign fixture', url: 'https://1.1.1.1/', maxPages: 10 } })).json().site;
    const row = get('SELECT * FROM sites WHERE id=?', site.id)!;
    const target = listPages(site.id)[0];
    for (let n = 0; n < 2; n++) await recordCapture(get('SELECT * FROM pages WHERE id=?', target.id)!, row, {
      requestedUrl: target.url, finalUrl: target.url, statusCode: 200, title: 'Offer fixture', text: `Offer ${n} Price 100 Counter ${10 - n}`, links: [], headings: ['Offer'], imageUrls: [], warnings: [], screenshot: picture(), capturedAt: `2026-09-${10 + n}T10:00:00.000Z`,
      html: `<!doctype html><html><head><style>body{font:20px system-ui;margin:30px}#counter{padding:20px;background:#ffeccc}button{padding:20px}p{margin:24px 0}</style><script>window.parent.badArchiveScript=true</script></head><body><h1>Offer ${n}</h1><p id="counter">Counter ${10 - n}</p><p id="price">Price 100</p><button id="cta">Buy now</button><a href="https://external.example/">External</a><img src="https://external.example/tracker.png"></body></html>`,
    });
    const vanished = addPage(site.id, 'https://1.1.1.1/old-offer', 'sitemap').page;
    for (let i = 0; i < 2; i++) recordFailure(get('SELECT * FROM pages WHERE id=?', vanished.id)!, row, { statusCode: 404, message: 'HTTP 404' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ url: origin, name: cookie.split('=')[0], value: cookie.slice(cookie.indexOf('=') + 1), httpOnly: true, sameSite: 'Strict' }]);
    const external: string[] = [], errors: string[] = [];
    await context.route('**/*', route => { if (!route.request().url().startsWith(origin + '/')) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/#/page/${target.id}`);
    await page.getByRole('button', { name: 'Zone da monitorare', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Scegli zone nella pagina"]');
    await frame.locator('#counter').click();
    await page.getByRole('button', { name: 'Escludi dal confronto', exact: true }).click();
    await page.getByLabel('Mostra anche la copia precedente').check();
    await page.frameLocator('iframe[title="Anteprima regole nella copia precedente"]').locator('#counter').waitFor();
    await page.getByText('Ultima copia: 1 elementi · Precedente: 1 elementi', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Zona importante', exact: true }).click();
    await frame.locator('#cta').click();
    await page.getByRole('button', { name: 'Segna come importante', exact: true }).click();
    await page.getByRole('button', { name: 'Salva regole', exact: true }).click();
    await page.getByText('Regole salvate.', { exact: false }).waitFor();
    const saved = get('SELECT * FROM pages WHERE id=?', target.id)!;
    assert.equal(JSON.parse(saved.ignore_rules)[0].selector, '#counter');
    assert.equal(JSON.parse(saved.important_rules)[0].selector, '#cta');
    assert.equal(await page.evaluate(() => (window as any).badArchiveScript), undefined);
    const screenshots = process.env.UI_SCREENSHOT_DIR;
    if (screenshots) { mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: join(screenshots, 'monitoring-rules-desktop.png'), fullPage: true }); }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) await page.screenshot({ path: join(screenshots, 'monitoring-rules-phone.png'), fullPage: true });
    await page.getByRole('link', { name: site.name, exact: true }).last().click();
    await page.getByRole('heading', { name: 'Vita delle landing', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Non raggiungibili 1', exact: true }).click();
    assert.equal(await page.locator('.lifecycle-table tbody tr').count(), 1);
    assert.match(await page.locator('.lifecycle-table').innerText(), /old-offer/);
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
    await page.getByLabel('Cerca nuove landing ogni', { exact: false }).fill('2');
    await page.getByRole('button', { name: 'Opzioni avanzate', exact: false }).click();
    await page.getByLabel('Cerca nuove landing in questi percorsi', { exact: false }).fill('/offers\n/webinars');
    await page.getByLabel('Escludi dalla scoperta questi percorsi', { exact: false }).fill('/offers/old');
    await page.getByRole('button', { name: 'Salva impostazioni', exact: true }).click();
    await page.getByText('Ricerca nuove landing ogni 2 ore', { exact: true }).waitFor();
    const settings = get('SELECT * FROM sites WHERE id=?', site.id)!;
    assert.equal(settings.interval_hours, 6); assert.equal(settings.discovery_interval_hours, 2);
    assert.deepEqual(JSON.parse(settings.include_paths), ['/offers', '/webinars']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) await page.screenshot({ path: join(screenshots, 'monitoring-lifecycle-phone.png'), fullPage: true });
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
  } finally { await browser?.close(); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
