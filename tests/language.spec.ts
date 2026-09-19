import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

test('language selection defaults to English, persists, and leaves archived Italian content unchanged', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-language-ui-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, run } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'language-test', password: 'temporary-test-password' } });
    assert.equal(setup.statusCode, 200);
    const authorization = `Bearer ${setup.json().token}`;
    // These intentionally match application translations: user content must never
    // be passed through the system-message catalog, even if the words are known.
    const siteName = 'Nessuna modifica significativa', title = 'Prima versione archiviata';
    const pageNotes = 'Il sito ha risposto HTTP 404.', capturedText = '5 immagini visibili non sono state caricate completamente.';
    const siteResult = await app.inject({ method: 'POST', url: '/api/sites', headers: { authorization }, payload: { name: siteName, url: 'https://1.1.1.1/', maxPages: 1, paused: true } });
    assert.equal(siteResult.statusCode, 201);
    const site = siteResult.json().site;
    const archivedPage = get('SELECT * FROM pages WHERE site_id=?', site.id)!;
    const png = new PNG({ width: 40, height: 40 }); png.data.fill(255);
    const capture = await recordCapture(archivedPage, get('SELECT * FROM sites WHERE id=?', site.id)!, {
      requestedUrl: archivedPage.url, finalUrl: archivedPage.url, title, text: capturedText, statusCode: 200,
      html: `<html lang="it"><head><title>${title}</title></head><body><h1>${title}</h1><p>${capturedText}</p></body></html>`,
      screenshot: PNG.sync.write(png), links: [], headings: [], imageUrls: [], warnings: [], capturedAt: '2026-09-01T12:00:00.000Z',
      quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] },
    });
    assert.ok(capture.versionId);
    run('UPDATE pages SET notes=? WHERE id=?', pageNotes, archivedPage.id);
    run('UPDATE versions SET reason=? WHERE id=?', 'Prima versione archiviata', capture.versionId);
    const before = {
      site: get('SELECT * FROM sites WHERE id=?', site.id), page: get('SELECT * FROM pages WHERE id=?', archivedPage.id),
      version: get('SELECT * FROM versions WHERE id=?', capture.versionId),
    };
    await app.listen({ host: '127.0.0.1', port: 0 });
    const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined) });
    const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const screenshot = async (name: string) => {
      if (!process.env.UI_SCREENSHOT_DIR) return;
      mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, name), fullPage: true, animations: 'disabled' });
    };
    await page.goto(`${origin}/#/settings`);
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.language), 'it-IT');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.getByLabel('App language', { exact: true }).inputValue(), 'en');
    // The selector also works before authentication, without submitting the form.
    await page.getByLabel('App language', { exact: true }).selectOption('it');
    await page.getByRole('button', { name: 'Accedi', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'it');
    await page.getByLabel('Lingua dell’app', { exact: true }).selectOption('en');
    await page.getByLabel('Username', { exact: true }).fill('language-test');
    await page.getByLabel('Password', { exact: true }).fill('temporary-test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await screenshot('settings-english-desktop.png');
    await page.getByLabel('App language', { exact: true }).selectOption('it');
    await page.getByRole('heading', { name: 'Impostazioni', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('landing-archive.language')), 'it');
    await page.reload();
    await page.getByRole('heading', { name: 'Impostazioni', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Lingua dell’app', { exact: true }).inputValue(), 'it');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot('settings-italian-phone.png');
    await page.setViewportSize({ width: 1440, height: 1100 });

    const verifyContent = async (language: 'en' | 'it') => {
      await page.goto(`${origin}/#/page/${archivedPage.id}/${capture.versionId}`);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.ok(await page.locator('.sidebar-site').filter({ hasText: siteName }).isVisible());
      assert.equal(await page.getByLabel(language === 'en' ? 'Page notes' : 'Annotazioni sulla pagina', { exact: true }).inputValue(), pageNotes);
      const frame = page.frameLocator(`iframe[title="${language === 'en' ? 'Archived offline page' : 'Pagina archiviata offline'}"]`);
      await frame.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.ok(await frame.getByText(capturedText, { exact: true }).isVisible());
    };
    await verifyContent('it');
    await page.getByRole('link', { name: 'Impostazioni', exact: true }).click();
    await page.getByLabel('Lingua dell’app', { exact: true }).selectOption('en');
    await verifyContent('en');
    assert.match(await page.locator('.timeline-item.selected').innerText(), /First capture/);
    await screenshot('archive-english-original-italian-content.png');
    await page.evaluate(() => localStorage.setItem('landing-archive.language', 'unsupported-language'));
    await page.goto(`${origin}/#/settings`);
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    assert.equal(await page.getByLabel('App language', { exact: true }).inputValue(), 'en');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.deepEqual({
      site: get('SELECT * FROM sites WHERE id=?', site.id), page: get('SELECT * FROM pages WHERE id=?', archivedPage.id),
      version: get('SELECT * FROM versions WHERE id=?', capture.versionId),
    }, before, 'switching language does not migrate or rewrite archive data');
    // Real storage events synchronize only the preference, not archive credentials.
    const other = await context.newPage();
    await other.goto(origin);
    await other.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await page.getByLabel('App language', { exact: true }).selectOption('it');
    await other.getByRole('button', { name: 'Accedi', exact: true }).waitFor();
    await other.getByLabel('Lingua dell’app', { exact: true }).selectOption('en');
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await other.close();

    // A denied localStorage getter must not prevent login or in-memory switching.
    const restricted = await browser.newContext();
    await restricted.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    const privatePage = await restricted.newPage();
    privatePage.on('pageerror', error => errors.push(error.message));
    await privatePage.goto(origin);
    await privatePage.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    await privatePage.getByLabel('App language', { exact: true }).selectOption('it');
    await privatePage.getByRole('button', { name: 'Accedi', exact: true }).waitFor();
    await restricted.close();
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
