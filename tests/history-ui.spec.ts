import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

test('history interface shows returned dates, paginated observations and explicit cleanup on desktop and phone', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-history-ui-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, run, id } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'history-interface-test', password: 'temporary-test-password' } });
  const authorization = `Bearer ${setup.json().token}`;
  const site = (await app.inject({ method: 'POST', url: '/api/sites', headers: { authorization }, payload: { name: 'Landing fixture', url: 'https://1.1.1.1/', paused: true } })).json().site;
  const pageRow = get('SELECT * FROM pages WHERE site_id=?', site.id)!;
  const png = new PNG({ width: 600, height: 500 }); png.data.fill(250);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  const make = (text: string, day: number) => recordCapture(get('SELECT * FROM pages WHERE id=?', pageRow.id)!, get('SELECT * FROM sites WHERE id=?', site.id)!, {
    requestedUrl: pageRow.url, finalUrl: pageRow.url, statusCode: 200, title: 'Landing fixture', text, headings: [], imageUrls: [], links: [],
    html: `<html><body style="font-family:sans-serif;padding:40px;background:#faf8f4"><h1>${text}</h1><p>Una pagina di esempio per verificare la cronologia.</p></body></html>`, screenshot: PNG.sync.write(png), warnings: [], capturedAt: `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    quality: { version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete', status: 'complete', missingImages: 0, reasons: [] },
  });
  const a = await make('Offerta A', 1), b = await make('Offerta B', 3); await make('Offerta A', 5);
  const duplicate = { ...get('SELECT * FROM versions WHERE id=?', b.versionId)!, id: id(), captured_at: '2026-09-04T10:00:00.000Z', review_state: 'legacy', variant_key: '', evidence: '{}' };
  run(`INSERT INTO versions (${Object.keys(duplicate).join(',')}) VALUES (${Object.keys(duplicate).map(() => '?').join(',')})`, ...Object.values(duplicate));
  for (let index = 0; index < 1002; index++) run('INSERT INTO checks(id,page_id,created_at,status,message,version_id,evidence) VALUES(?,?,?,?,?,?,?)', id(), pageRow.id, new Date(Date.parse('2026-08-01T00:00:00Z') + index * 60000).toISOString(), 'unchanged', 'Nessuna modifica significativa', a.versionId, '{"kind":"unchanged"}');
  await app.listen({ host: '127.0.0.1', port: 0 });
  const origin = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (process.platform === 'darwin' && existsSync(chrome) ? chrome : undefined), headless: true, chromiumSandbox: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ origin, token }) => { if (location.origin === origin) sessionStorage.setItem('landing-archive.session.v2', token); }, { origin, token: authorization.slice(7) });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const screenshot = async (name: string) => { if (process.env.UI_SCREENSHOT_DIR) { mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, name), fullPage: true }); } };
  try {
    await page.goto(`${origin}/#/page/${pageRow.id}`);
    await page.getByRole('button', { name: 'Per variante', exact: true }).waitFor();
    const selected = page.locator('.timeline-item.selected');
    assert.match(await selected.innerText(), /Ritorno a una variante/);
    assert.match(await page.locator('.capture-panel iframe').getAttribute('src') || '', /at=2026-09-05/);
    await screenshot('history-desktop.png');
    await page.getByRole('button', { name: 'Per variante', exact: true }).click();
    assert.match(await page.locator('.variant-groups').innerText(), /2 date/);
    await page.getByRole('button', { name: 'Tutte le osservazioni', exact: true }).click();
    await page.getByRole('button', { name: 'Carica controlli precedenti', exact: true }).click();
    await page.getByText('1005 di 1005 controlli', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Versioni utili', exact: true }).click();
    await page.getByRole('button', { name: 'Anteprima pulizia', exact: true }).click();
    const dialog = page.getByRole('dialog'), remove = dialog.getByRole('button', { name: /Elimina.*copie selezionate/ });
    await dialog.locator('.cleanup-candidates input').waitFor();
    assert.equal(await remove.isEnabled(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot('history-review-phone.png');
    await dialog.locator('.cleanup-candidates input').check();
    assert.equal(await remove.isEnabled(), false, 'Selecting a row alone cannot delete it');
    await dialog.locator('.cleanup-confirmation input').check();
    await remove.click();
    await dialog.getByRole('heading', { name: 'Revisione completata' }).waitFor();
    assert.equal(get('SELECT id FROM versions WHERE id=?', duplicate.id), undefined);
    assert.ok(get('SELECT id FROM versions WHERE id=?', a.versionId)); assert.ok(get('SELECT id FROM versions WHERE id=?', b.versionId));
    assert.equal(get('SELECT count(*) n FROM checks WHERE page_id=?', pageRow.id)!.n, 1006);
    await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await screenshot('history-phone.png');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto(`${origin}/#/site/${site.id}`);
    await page.getByRole('button', { name: 'Azzera copie e riscarica', exact: true }).click();
    const resetDialog = page.getByRole('dialog'), reset = resetDialog.getByRole('button', { name: 'Conferma azzeramento e scansione', exact: true });
    await resetDialog.getByRole('checkbox').waitFor(); assert.equal(await reset.isEnabled(), false);
    await screenshot('site-reset-phone.png');
    await resetDialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    assert.equal(get('SELECT count(*) n FROM versions')!.n, 2);
    await page.getByRole('button', { name: 'Azzera copie e riscarica', exact: true }).click();
    await resetDialog.getByRole('checkbox').check(); await reset.click();
    await resetDialog.waitFor({ state: 'hidden' });
    assert.equal(get('SELECT count(*) n FROM versions')!.n, 0);
    assert.equal(get('SELECT count(*) n FROM checks')!.n, 1006);
    assert.equal(get('SELECT count(*) n FROM sites')!.n, 1);
    assert.equal(get("SELECT count(*) n FROM jobs WHERE status='queued' AND manual=1")!.n, 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
