import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

test('comparison highlights archived regions, explains invisible changes and stays usable on a phone', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-comparison-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, addPage } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
  const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'comparison-test', password: 'temporary-test-password' } });
  const authorization = `Bearer ${setup.json().token}`;
  const call = (url: string) => app.inject({ method: 'GET', url, headers: { authorization } });
  const site = (await app.inject({ method: 'POST', url: '/api/sites', headers: { authorization }, payload: { name: 'Comparison fixture', url: 'https://1.1.1.1/', maxPages: 1 } })).json().site;
  const row = get('SELECT * FROM sites WHERE id=?', site.id)!;
  const pageRow = addPage(site.id, 'https://1.1.1.1/').page;
  const picture = (changed: boolean) => {
    const png = new PNG({ width: 1200, height: 10000 }); png.data.fill(255);
    const rectangles = [{ x: 80, y: 70, width: 1040, height: 140, color: [229, 239, 213] }, { x: 80, y: 400, width: 420, height: 120, color: changed ? [15, 50, 35] : [170, 215, 245] }, { x: 680, y: 8700, width: 400, height: 120, color: changed ? [100, 30, 10] : [180, 220, 140] }];
    for (const r of rectangles) for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) {
      const offset = (y * png.width + x) * 4;
      [png.data[offset], png.data[offset + 1], png.data[offset + 2]] = r.color;
    }
    return PNG.sync.write(png);
  };
  const firstImage = picture(false), secondImage = picture(true);
  const save = async (day: number, changed: boolean, tracking: string) => (await recordCapture(get('SELECT * FROM pages WHERE id=?', pageRow.id)!, row, {
    requestedUrl: pageRow.url, finalUrl: pageRow.url, title: 'Landing di prova', text: changed ? 'Offerta 120 euro' : 'Offerta 100 euro', statusCode: 200,
    html: '<html><body><h1>Landing di prova</h1><p>Una copia conservata nell’archivio.</p></body></html>', screenshot: changed ? secondImage : firstImage,
    headings: ['Offerta'], links: [{ url: `https://example.com/offer?utm_source=${tracking}`, text: 'Scopri' }], imageUrls: [`https://example.com/hero.png?cache=${tracking}`], warnings: [], quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] },  capturedAt: `2026-09-${day}T12:00:00.000Z`,
  })).versionId;
  const a = await save(10, false, 'A'), b = await save(11, true, 'A'), c = await save(12, true, 'B');
  const versionsBefore = get('SELECT COUNT(*) n FROM versions')!.n, objectsBefore = get('SELECT COUNT(*) n FROM objects')!.n;
  const endpoint = `/api/compare/visual?left=${a}&right=${b}`;
  assert.equal((await app.inject({ url: endpoint })).statusCode, 401);
  assert.equal((await call('/api/compare/visual')).statusCode, 400);
  const wrongPage = addPage(site.id, 'https://1.1.1.1/other').page;
  const wrongVersion = (await recordCapture(wrongPage, row, { requestedUrl: wrongPage.url, finalUrl: wrongPage.url, title: 'Other', text: 'Other', statusCode: 200, html: '<h1>Other</h1>', screenshot: firstImage, headings: [], links: [], imageUrls: [], warnings: [], quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] },  capturedAt: '2026-09-12T12:00:00.000Z' })).versionId;
  assert.equal((await call(`/api/compare/visual?left=${a}&right=${wrongVersion}`)).statusCode, 400);
  const concurrent = await Promise.all([call(endpoint), call(endpoint)]);
  assert.deepEqual(concurrent.map(r => r.statusCode).sort(), [200, 409]);
  const visualResponse = await call(endpoint);
  assert.equal(visualResponse.headers['cache-control'], 'no-store');
  assert.equal(visualResponse.headers['x-content-type-options'], 'nosniff');
  assert.equal(visualResponse.json().regions.length, 2);
  assert.equal((await call(`/api/compare/visual?left=${b}&right=${c}`)).json().regions.length, 0);
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ origin, token }) => { if (location.origin === origin) { sessionStorage.setItem('landing-archive.session.v2', token); localStorage.setItem('landing-archive.language', 'it'); } }, { origin, token: authorization.slice(7) });
  const outside: string[] = [];
  await context.route('**/*', route => { if (!route.request().url().startsWith(origin + '/')) { outside.push(route.request().url()); return route.abort(); } return route.continue(); });
  const page = await context.newPage();
    await page.goto(`${origin}/#/page/${pageRow.id}`);
    await page.getByRole('button', { name: 'Confronta', exact: true }).click();
    await page.getByText('Nessuna zona diversa', { exact: true }).waitFor();
    assert.match(await page.locator('.comparison-summary').innerText(), /Collegamenti/);
    assert.match(await page.locator('.comparison-summary').innerText(), /Indirizzi delle immagini/);
    await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
    assert.match(await page.locator('.comparison-details').innerText(), /hero\.png\?cache=A/);
    assert.match(await page.locator('.comparison-details').innerText(), /hero\.png\?cache=B/);
    await page.getByLabel('Versione di partenza').selectOption(a);
    await page.getByLabel('Versione da confrontare').selectOption(b);
    await page.getByRole('button', { name: 'Aspetto', exact: true }).click();
    await page.locator('.difference-overlay rect').first().waitFor();
    assert.equal(await page.locator('.difference-overlay rect').count(), 4);
    await page.getByRole('button', { name: 'Modifica successiva', exact: true }).click();
    await page.getByText('Zona 2 di 2', { exact: true }).waitFor();
    const scroll = await page.locator('.highlighted-comparison .compare-image').evaluateAll(nodes => nodes.map(node => node.scrollTop));
    assert.ok(scroll[0] > 1000); assert.ok(Math.abs(scroll[0] - scroll[1]) < 2);
    await page.getByLabel('Evidenzia le modifiche', { exact: true }).uncheck();
    assert.equal(await page.locator('.difference-overlay').count(), 0);
    await page.getByLabel('Evidenzia le modifiche', { exact: true }).check();
    await page.getByRole('button', { name: 'Modifica precedente', exact: true }).click();
    const screenshots = process.env.UI_SCREENSHOT_DIR;
    if (screenshots) { mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: join(screenshots, 'comparison-desktop.png'), fullPage: true }); }
    await page.getByRole('button', { name: 'Testo', exact: true }).click();
    assert.equal(await page.locator('.text-diff ins').innerText(), '120');
    assert.equal(await page.locator('.text-diff del').innerText(), '100');
    await page.getByRole('button', { name: 'Aspetto', exact: true }).click();
    await page.locator('.difference-overlay rect').first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Apri navigazione', exact: true }).waitFor();
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
    for (const box of await page.locator('.compare-panel button, .compare-panel select').evaluateAll(nodes => nodes.map(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })))) assert.ok(box.left >= 0 && box.right <= 390);
    if (screenshots) await page.screenshot({ path: join(screenshots, 'comparison-phone.png'), fullPage: true });
    assert.deepEqual(outside, []);
    assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, versionsBefore + 1);
    // The other-page fixture adds only its HTML; comparing never stores images or overlays.
    assert.equal(get('SELECT COUNT(*) n FROM objects')!.n, objectsBefore + 1);
  } finally { await browser?.close(); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
