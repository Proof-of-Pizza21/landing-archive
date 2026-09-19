import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

type ObservedRequest = { path: string; cookie?: string; authorization?: string; status?: number };
const cookieName = 'UMBREL_PROXY_TOKEN';
const proxyCookie = `${cookieName}=local-proxy-fixture`;
const listen = (server: Server) => new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const originOf = (server: Server) => `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const close = (server: Server) => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });

test('Umbrel cookie authentication and origin-scoped app sessions work together through the proxy', { timeout: 90_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-umbrel-proxy-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, addPage } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  const upstreamRequests: ObservedRequest[] = [], proxyRequests: ObservedRequest[] = [], loginRequests: ObservedRequest[] = [];
  app.addHook('onResponse', async (request, reply) => {
    upstreamRequests.push({ path: request.url, cookie: request.headers.cookie, authorization: request.headers.authorization, status: reply.statusCode });
  });
  const loginServer = createServer((request, response) => {
    loginRequests.push({ path: request.url || '/', cookie: request.headers.cookie, authorization: request.headers.authorization });
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><title>Umbrel login fixture</title><h1>Umbrel login fixture</h1>');
  });
  const proxy = createServer((request, response) => {
    const observed: ObservedRequest = { path: request.url || '/', cookie: request.headers.cookie, authorization: request.headers.authorization };
    proxyRequests.push(observed);
    // Umbrel 1.7.4 checks its own cookie before forwarding any app route. If it is
    // absent, the proxy redirects to its login service on a different port.
    if (!request.headers.cookie?.split(';').some(value => value.trim() === proxyCookie)) {
      observed.status = 302;
      response.writeHead(302, { Location: originOf(loginServer) + '/?path=' + encodeURIComponent(observed.path) });
      response.end(); return;
    }
    const headers = { ...request.headers };
    const remainingCookies = headers.cookie?.split(';').filter(value => value.trim().split('=')[0] !== cookieName).join(';').trim();
    if (remainingCookies) headers.cookie = remainingCookies; else delete headers.cookie;
    // Preserve the external Host, as Umbrel does, so app origin checks still run.
    const upstream = httpRequest(originOf(app.server) + observed.path, { method: request.method, headers }, result => {
      observed.status = result.statusCode;
      response.writeHead(result.statusCode || 502, result.headers); result.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
    response.on('close', () => { if (!response.writableFinished) upstream.destroy(); });
  });
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'proxy-test', password: 'temporary-test-password' } });
  const authorization = `Bearer ${setup.json().token}`;
  const added = await app.inject({ method: 'POST', url: '/api/sites', headers: { authorization }, payload: { name: 'Proxy fixture', url: 'https://1.1.1.1/', maxPages: 1, paused: true } });
  assert.equal(added.statusCode, 201);
  const site = added.json().site, siteRow = get('SELECT * FROM sites WHERE id=?', site.id)!;
  const archivedPage = addPage(site.id, 'https://1.1.1.1/').page;
  const png = new PNG({ width: 12, height: 12 }); png.data.fill(255);
  const capture = await recordCapture(archivedPage, siteRow, {
    requestedUrl: archivedPage.url, finalUrl: archivedPage.url, title: 'Archived proxy fixture', text: 'Content behind the proxy', statusCode: 200,
    html: '<!doctype html><html><head><title>Archived proxy fixture</title></head><body><h1>Content behind the proxy</h1></body></html>',
    screenshot: PNG.sync.write(png), headings: [], links: [], imageUrls: [], warnings: [],
    quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] },
    capturedAt: '2026-09-01T12:00:00.000Z',
  });
  await app.listen({ host: '127.0.0.1', port: 0 }); await listen(loginServer); await listen(proxy);
  const origin = originOf(proxy), neighboringOrigin = originOf(loginServer);
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
  const addProxyCookie = async (context: Awaited<ReturnType<typeof browser.newContext>>) => context.addCookies([{ name: cookieName, value: 'local-proxy-fixture', url: origin, httpOnly: true, sameSite: 'Lax' }]);
  try {
    // Reproduce 0.1.13 without changing source files: it omitted browser cookies
    // from fetch while the initial HTML navigation still passed the proxy gate.
    const brokenContext = await browser.newContext();
    await addProxyCookie(brokenContext);
    await brokenContext.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, options) => nativeFetch(input, { ...options, credentials: 'omit' });
    });
    const brokenPage = await brokenContext.newPage();
    await brokenPage.goto(origin);
    await brokenPage.locator('.startup .notice.error').waitFor();
    assert.equal(await brokenPage.getByLabel('Nome utente', { exact: true }).count(), 0);
    assert.ok(proxyRequests.some(request => request.path === '/api/auth/status' && !request.cookie && request.status === 302));
    assert.equal(loginRequests.length, 0, 'fetch never follows the proxy redirect');
    await brokenContext.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(origin => { if (location.origin === origin) localStorage.setItem('landing-archive.language', 'it'); }, origin);
    await addProxyCookie(context);
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const firstStatus = page.waitForResponse(response => response.url() === origin + '/api/auth/status');
    await page.goto(`${origin}/#/page/${archivedPage.id}`);
    assert.equal((await firstStatus).status(), 200, 'startup must reach the app before an app session exists');
    await page.getByLabel('Nome utente', { exact: true }).fill('proxy-test');
    await page.getByLabel('Password', { exact: true }).fill('temporary-test-password');
    await page.getByRole('button', { name: 'Accedi', exact: true }).click();
    await page.frameLocator('iframe[title="Pagina archiviata offline"]').getByRole('heading', { name: 'Content behind the proxy' }).waitFor();
    const token = await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2'));
    assert.match(token!, /^la2_[a-f0-9]{64}$/);
    assert.ok(proxyRequests.some(request => request.path === '/api/auth/login' && request.cookie?.includes(proxyCookie) && request.status === 200));
    assert.ok(upstreamRequests.some(request => request.path === '/api/sites' && request.authorization === `Bearer ${token}` && request.status === 200));
    assert.equal(upstreamRequests.some(request => request.cookie?.includes(cookieName)), false, 'Umbrel strips its own credential before forwarding');
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'landing_archive_session'), false);

    await page.getByRole('button', { name: 'Screenshot', exact: true }).click();
    const screenshot = page.locator('.screenshot-view img'); await screenshot.waitFor();
    await screenshot.evaluate(async (image: HTMLImageElement) => { await image.decode(); });
    assert.equal(await screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth), 12);
    const screenshotUrl = (await screenshot.getAttribute('src'))!;
    assert.ok(screenshotUrl.includes('access_ticket=')); assert.ok(!screenshotUrl.includes(token!));
    assert.ok(proxyRequests.some(request => request.path === screenshotUrl && request.cookie?.includes(proxyCookie) && !request.authorization && request.status === 200));

    // Losing only the Umbrel session cannot forward the still-valid app bearer
    // to its login service, nor reach the private backend through a redirect.
    await context.clearCookies({ name: cookieName });
    const beforeRedirect = loginRequests.length;
    const failed = page.waitForEvent('requestfailed', { predicate: request => request.url() === origin + '/api/auth/status' });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('session-expired')));
    await failed;
    assert.ok(proxyRequests.some(request => request.path === '/api/auth/status' && request.authorization === `Bearer ${token}` && !request.cookie && request.status === 302));
    assert.equal(loginRequests.length, beforeRedirect, 'authenticated fetch must not follow the login redirect');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), token);
    await addProxyCookie(context);

    // Cookies themselves span ports, but the archive bearer remains confined to
    // its origin even when this same tab opens the neighboring login service.
    await page.goto(neighboringOrigin);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), null);
    assert.equal(loginRequests.some(request => request.authorization || JSON.stringify(request).includes(token!)), false);
    const legacy = await context.request.get(`${origin}/api/sites`, { headers: { Cookie: `${proxyCookie}; landing_archive_session=${token}` } });
    assert.equal(legacy.status(), 401, 'an app token in a cookie never authenticates the archive');

    await page.goto(`${origin}/#/page/${archivedPage.id}`);
    await page.frameLocator('iframe[title="Pagina archiviata offline"]').getByRole('heading', { name: 'Content behind the proxy' }).waitFor();
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await page.getByRole('button', { name: 'Accedi', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('landing-archive.session.v2')), null);
    assert.equal((await context.request.get(origin + screenshotUrl)).status(), 401, 'logout revokes native-resource tickets behind the proxy');
    assert.equal((await context.request.get(`${origin}/api/versions/${capture.versionId}/screenshot`)).status(), 401);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close(); await close(proxy); await close(loginServer); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true });
  }
});
