import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

test('real browser confines login to one port while native images, offline frames and streamed downloads work', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-auth-browser-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, addPage } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  const siteReads: { origin?: string; authorization?: string; status: number }[] = [];
  app.addHook('onResponse', async (request, reply) => { if (request.method === 'GET' && request.routeOptions.url === '/api/sites') siteReads.push({ origin: request.headers.origin, authorization: request.headers.authorization, status: reply.statusCode }); });
  const received: { authorization?: string; cookie?: string; referer?: string; url?: string }[] = [];
  const neighboringApp = createServer((request, response) => {
    received.push({ authorization: request.headers.authorization, cookie: request.headers.cookie, referer: request.headers.referer, url: request.url });
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><title>Different Umbrel app</title><h1>Different app on another port</h1>');
  });
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'origin-test', password: 'temporary-test-password' } });
  const authorization = `Bearer ${setup.json().token}`;
  const siteResponse = await app.inject({ method: 'POST', url: '/api/sites', headers: { authorization }, payload: { name: 'Origin isolation fixture', url: 'https://1.1.1.1/', maxPages: 1, paused: true } });
  assert.equal(siteResponse.statusCode, 201);
  const site = siteResponse.json().site, siteRow = get('SELECT * FROM sites WHERE id=?', site.id)!;
  const archivedPage = addPage(site.id, 'https://1.1.1.1/').page;
  const png = new PNG({ width: 12, height: 12 }); png.data.fill(255);
  const capture = await recordCapture(archivedPage, siteRow, { requestedUrl: archivedPage.url, finalUrl: archivedPage.url, title: 'Private archived page', text: 'Private archived content', statusCode: 200, html: '<!doctype html><html><head><title>Private archived page</title></head><body><h1>Private archived content</h1></body></html>', screenshot: PNG.sync.write(png), headings: [], links: [], imageUrls: [], warnings: [], quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] }, capturedAt: '2026-09-01T12:00:00.000Z' });
  await app.listen({ host: '127.0.0.1', port: 0 });
  await new Promise<void>(resolve => neighboringApp.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const neighbor = `http://127.0.0.1:${(neighboringApp.address() as { port: number }).port}`;
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  await context.addInitScript(origin => { if (location.origin === origin) localStorage.setItem('landing-archive.language', 'it'); }, origin);
  const page = await context.newPage();
  const errors: string[] = [], nativeRequests: { url: string; authorization?: string }[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (request.url().includes('access_ticket=')) nativeRequests.push({ url: request.url(), authorization: request.headers().authorization }); });
  try {
    // Exercise the actual login form and client rather than installing a credential
    // through a test initializer; this verifies sessionStorage and request headers.
    await page.goto(`${origin}/#/page/${archivedPage.id}`);
    await page.getByLabel('Nome utente', { exact: true }).fill('origin-test');
    await page.getByLabel('Password', { exact: true }).fill('temporary-test-password');
    await page.getByRole('button', { name: 'Accedi', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Pagina archiviata offline"]');
    await frame.getByRole('heading', { name: 'Private archived content' }).waitFor();
    const token = await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2'));
    assert.match(token!, /^la2_[a-f0-9]{64}$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('landing-archive.session.v2')), null);
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'landing_archive_session'), false);
    const frameUrl = await page.locator('iframe[title="Pagina archiviata offline"]').getAttribute('src');
    assert.ok(frameUrl?.includes('access_ticket=')); assert.ok(!frameUrl.includes(token!));
    assert.equal((await context.request.get(`${origin}/api/versions/${capture.versionId}/offline/html`)).status(), 401);

    await page.getByRole('button', { name: 'Screenshot', exact: true }).click();
    const screenshot = page.locator('.screenshot-view img'); await screenshot.waitFor();
    await screenshot.evaluate(async (image: HTMLImageElement) => { await image.decode(); });
    assert.equal(await screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth), 12);
    const screenshotUrl = await screenshot.getAttribute('src');
    assert.ok(screenshotUrl?.includes('access_ticket='));
    const popupPromise = context.waitForEvent('page');
    await page.getByTitle('Apri lo screenshot completo').click();
    const popup = await popupPromise; await popup.waitForURL('**/*access_ticket=*');
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();

    const htmlDownloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Scarica HTML', exact: true }).click();
    const htmlDownload = await htmlDownloadPromise;
    assert.match(htmlDownload.suggestedFilename(), /\.html$/);
    assert.match(htmlDownload.url(), /access_ticket=/);
    await htmlDownload.saveAs(join(directory, 'download.html'));
    assert.match(readFileSync(join(directory, 'download.html'), 'utf8'), /Private archived content/);
    await page.getByRole('link', { name: 'Backup e ripristino', exact: true }).click();
    const backupPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Scarica backup completo', exact: true }).click();
    const backup = await backupPromise;
    assert.match(backup.url(), /access_ticket=/);
    await backup.saveAs(join(directory, 'download.zip'));
    assert.equal(readFileSync(join(directory, 'download.zip')).readUInt32LE(0), 0x04034b50);
    assert.equal(nativeRequests.some(request => Boolean(request.authorization)), false, 'native resources use their scoped ticket, not the full session');
    assert.ok(nativeRequests.some(request => request.url.includes('/offline/html')));
    assert.ok(nativeRequests.some(request => request.url.includes('/screenshot')));

    // Keep the same tab so this checks origin isolation rather than just tab isolation.
    await page.goto(neighbor);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), null);
    assert.equal(await page.evaluate(() => document.cookie.includes('landing_archive_session')), false);
    assert.ok(received.length > 0);
    assert.equal(received.some(request => request.authorization || request.cookie?.includes('landing_archive_session') || JSON.stringify(request).includes(token!)), false);
    await page.evaluate(async target => { try { await fetch(target + '/api/sites', { credentials: 'include' }); } catch { /* CORS also rejects reading the response. */ } }, origin);
    assert.ok(siteReads.some(request => request.origin === neighbor && !request.authorization && request.status === 401), 'the neighboring app receives no credential and the server rejects its request');

    await page.goto(`${origin}/#/page/${archivedPage.id}`);
    await frame.getByRole('heading', { name: 'Private archived content' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), token, 'returning to the origin keeps the tab session');
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await page.getByRole('button', { name: 'Accedi', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), null);
    assert.equal((await context.request.get(origin + screenshotUrl)).status(), 401, 'logout revokes existing native-resource tickets');
    assert.equal((await context.request.get(origin + frameUrl)).status(), 401);
    assert.equal((await context.request.get(origin + '/api/sites', { headers: { authorization: `Bearer ${token}` } })).status(), 401);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); await app.close();
    await new Promise<void>(resolve => neighboringApp.close(() => resolve()));
    db.close(); rmSync(directory, { recursive: true, force: true });
  }
});
