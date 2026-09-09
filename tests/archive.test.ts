import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { PNG } from 'pngjs';
import type { CaptureResult } from '../src/types.js';

// Inspect ZIP contents without requiring external commands or unpacking untrusted paths.
function zipEntries(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(end, -1);
  let cursor = buffer.readUInt32LE(end + 16);
  for (let n = 0; n < buffer.readUInt16LE(end + 10); n++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    const method = buffer.readUInt16LE(cursor + 10), size = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28), extra = buffer.readUInt16LE(cursor + 30), comment = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString();
    const local = buffer.readUInt32LE(cursor + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const value = buffer.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(value) : value);
    cursor += 46 + nameLength + extra + comment;
  }
  return files;
}

test('archive workflow: authentication, version history, failures, comparison and restorable export', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-archive-test-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { all, get, run, db } = await import('../src/db.js');
  const { recordCapture, recordFailure } = await import('../src/history.js');
  const { readObject } = await import('../src/storage.js');
  const app = await createApp();
  let session = '', siteId = '', pageId = '', first = '', second = '';
  let instant = Date.now() - 3600000;
  const call = (method: any, url: string, payload?: unknown, extra = {}) => app.inject({ method, url, headers: { cookie: session, ...extra }, payload });
  try {
    await t.test('private API, setup, wrong-origin and invalid URL protections', async () => {
      assert.equal((await call('GET', '/api/sites')).statusCode, 401);
      assert.deepEqual((await call('GET', '/api/health')).json(), { ok: true });
      const wrongOrigin = await call('POST', '/api/auth/setup', { username: 'localuser', password: 'local-test-password' }, { origin: 'https://external.example' });
      assert.equal(wrongOrigin.statusCode, 403);
      const setup = await call('POST', '/api/auth/setup', { username: 'localuser', password: 'local-test-password' });
      assert.equal(setup.statusCode, 200);
      session = String(setup.headers['set-cookie']).split(';')[0];
      assert.match(String(setup.headers['set-cookie']), /HttpOnly/);
      assert.match(String(setup.headers['set-cookie']), /SameSite=Strict/);
      assert.equal((await call('POST', '/api/auth/setup', { username: 'another', password: 'local-test-password' })).statusCode, 409);
      assert.equal((await call('POST', '/api/sites', { name: 'Internal', url: 'http://127.0.0.1' })).statusCode, 400);
      assert.equal((await call('POST', '/api/sites', { name: 'Example', url: 'https://1.1.1.1', intervalHours: -1 })).statusCode, 400);
    });
    await t.test('add site and deduplicate concurrent manual scan requests', async () => {
      const response = await call('POST', '/api/sites', { name: 'Example', url: 'https://1.1.1.1', maxPages: 1, intervalHours: 6 });
      assert.equal(response.statusCode, 201, response.body);
      siteId = response.json().site.id;
      pageId = (await call('GET', `/api/sites/${siteId}`)).json().pages[0].id;
      await Promise.all([call('POST', `/api/pages/${pageId}/scan`), call('POST', `/api/pages/${pageId}/scan`)]);
      assert.equal(get("SELECT COUNT(*) n FROM jobs WHERE kind='capture' AND status='queued'")!.n, 1);
    });
    function capture(value: string): CaptureResult {
      const png = new PNG({ width: 12, height: 12 });
      for (let n = 0; n < png.data.length; n += 4) { png.data[n] = value === 'A' ? 255 : 0; png.data[n + 1] = value === 'B' ? 255 : 0; png.data[n + 3] = 255; }
      return { requestedUrl: 'https://1.1.1.1/', finalUrl: 'https://1.1.1.1/', statusCode: 200, title: 'Landing', text: `Offerta ${value}`, links: [{ url: `https://1.1.1.1/${value}`, text: value }], headings: ['Landing'], imageUrls: [], html: `<html><body>Offerta ${value}</body></html>`, screenshot: PNG.sync.write(png), capturedAt: new Date(instant += 1000).toISOString(), warnings: [] };
    }
    const record = (result: CaptureResult) => recordCapture(get('SELECT * FROM pages WHERE id=?', pageId)!, get('SELECT * FROM sites WHERE id=?', siteId)!, result);
    await t.test('A → A → B → A keeps three versions, four checks and reuses files', async () => {
      const a = await record(capture('A')); first = a.versionId;
      assert.equal(a.kind, 'captured');
      const unchanged = await record(capture('A'));
      assert.equal(unchanged.changed, false); assert.equal(unchanged.versionId, first);
      second = (await record(capture('B'))).versionId;
      const returned = await record(capture('A'));
      assert.equal(returned.kind, 'returned'); assert.notEqual(returned.versionId, first);
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 3);
      assert.equal(get('SELECT COUNT(*) n FROM checks')!.n, 4);
      assert.equal(get('SELECT COUNT(*) n FROM objects')!.n, 4);
      assert.equal(get('SELECT html_hash FROM versions WHERE id=?', first)!.html_hash, get('SELECT html_hash FROM versions WHERE id=?', returned.versionId)!.html_hash);
    });
    await t.test('two 404s mark missing without losing copies; recovery keeps chronology', async () => {
      const failed = () => recordFailure(get('SELECT * FROM pages WHERE id=?', pageId)!, get('SELECT * FROM sites WHERE id=?', siteId)!, { statusCode: 404, message: 'HTTP 404' });
      failed(); assert.equal(get('SELECT last_status FROM pages WHERE id=?', pageId)!.last_status, 'unavailable');
      failed(); assert.equal(get('SELECT last_status FROM pages WHERE id=?', pageId)!.last_status, 'missing');
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 3);
      for (const v of all('SELECT * FROM versions')) { assert.ok(readObject(v.html_hash).length); assert.ok(readObject(v.screenshot_hash).length); }
      await record(capture('A'));
      assert.equal(get("SELECT COUNT(*) n FROM events WHERE kind='recovered'")!.n, 1);
    });
    await t.test('notes, text/link comparison, historic search and safe file downloads', async () => {
      assert.equal((await call('PATCH', `/api/pages/${pageId}`, { notes: 'Un’offerta interessante' })).statusCode, 200);
      const detail = (await call('GET', `/api/pages/${pageId}`)).json();
      assert.equal(detail.notes, 'Un’offerta interessante'); assert.equal(detail.checks.length, 7);
      const comparison = (await call('GET', `/api/compare?left=${first}&right=${second}`)).json();
      assert.ok(comparison.textDiff.some((d: any) => d.added && d.value.includes('B')));
      assert.equal(comparison.changedLinks.added[0].text, 'B'); assert.equal(comparison.changedLinks.removed[0].text, 'A');
      assert.equal((await call('GET', '/api/search?q=Offerta%20B')).json().pages[0].id, pageId);
      const html = await call('GET', `/api/versions/${first}/html`);
      assert.match(String(html.headers['content-disposition']), /^attachment;/); assert.match(String(html.headers['content-security-policy']), /sandbox/);
      const image = await call('GET', `/api/versions/${first}/screenshot`);
      assert.equal(image.headers['content-type'], 'image/png'); assert.equal(PNG.sync.read(image.rawPayload).width, 12);
    });
    await t.test('changing frequency updates existing schedules; pause still allows an explicit manual check', async () => {
      await call('PATCH', `/api/sites/${siteId}`, { intervalHours: 12, paused: true });
      const page = get('SELECT * FROM pages WHERE id=?', pageId)!;
      assert.equal(Date.parse(page.next_check_at) - Date.parse(page.last_checked_at), 12 * 3600000);
      assert.equal((await call('POST', `/api/pages/${pageId}/scan`)).statusCode, 200);
      assert.equal(get('SELECT paused FROM sites WHERE id=?', siteId)!.paused, 1);
      assert.equal((await call('PATCH', `/api/sites/${siteId}`, { url: 'https://8.8.8.8/' })).statusCode, 400);
    });
    await t.test('backup restores consistent database and objects without active sessions', async () => {
      const result = await call('GET', '/api/export');
      assert.equal(result.statusCode, 200, result.body.slice(0, 100));
      const files = zipEntries(result.rawPayload);
      assert.equal(JSON.parse(files.get('manifest.json')!.toString()).schema, 2);
      assert.equal(files.has('worker-token'), false);
      const restoredPath = join(directory, 'restored.sqlite'); writeFileSync(restoredPath, files.get('archive.sqlite')!);
      const restored = new DatabaseSync(restoredPath);
      try {
        assert.equal(restored.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
        assert.equal(restored.prepare('SELECT COUNT(*) n FROM versions').get()!.n, 3);
        assert.equal(restored.prepare('SELECT COUNT(*) n FROM checks').get()!.n, 7);
        assert.equal(restored.prepare('SELECT COUNT(*) n FROM sessions').get()!.n, 0);
        for (const object of restored.prepare('SELECT path,bytes FROM objects').all()) assert.equal(files.get(String(object.path))!.length, object.bytes);
      } finally { restored.close(); }
    });
    await t.test('source download includes build and distribution files, without archives or secrets', async () => {
      const result = await call('GET', '/api/source');
      assert.equal(result.statusCode, 200);
      const files = zipEntries(result.rawPayload);
      for (const name of ['src/server.ts', 'web/App.tsx', 'Dockerfile', 'README.md', 'compose.yaml', '.dockerignore', 'LICENSE', 'docs/INSTALL.md', 'umbrel-community-store/proof-of-pizza21-landing-archive/seccomp-profile.json.template', 'umbrel-community-store/proof-of-pizza21-landing-archive/data/.gitkeep']) assert.ok(files.has(name), name);
      assert.equal([...files.keys()].some(name => name.endsWith('.sqlite') || name.endsWith('worker-token')), false);
    });
    await t.test('worker authenticates requests and rejects private URLs without launching Chrome', async () => {
      const { createWorker } = await import('../src/worker.js');
      const { getWorkerToken } = await import('../src/config.js');
      const worker = createWorker();
      try {
        assert.equal((await worker.inject({ method: 'POST', url: '/capture', payload: { url: 'https://1.1.1.1' } })).statusCode, 401);
        assert.equal((await worker.inject({ method: 'GET', url: '/api/health' })).statusCode, 200);
        const blocked = await worker.inject({ method: 'POST', url: '/capture', headers: { authorization: `Bearer ${getWorkerToken()}` }, payload: { url: 'http://127.0.0.1' } });
        assert.equal(blocked.statusCode, 422); assert.equal(blocked.json().code, 'BLOCKED_URL');
      } finally { await worker.close(); }
    });
    await t.test('logout revokes server-side session', async () => {
      await call('POST', '/api/auth/logout'); assert.equal((await call('GET', '/api/sites')).statusCode, 401);
      assert.equal(get('SELECT COUNT(*) n FROM sessions')!.n, 0);
    });
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
