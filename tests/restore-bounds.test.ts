import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PNG } from 'pngjs';
import { zipEntries, zipFixture } from './zip-helper.js';
import { captureLimits } from '../src/capture-limits.js';

test('restore limits individual strings and serialized metadata before installing any rows', { timeout: 30000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-restore-bounds-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, all, run, id, addPage, now, later } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const app = await createApp();
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'restore-test', password: 'temporary-test-password' } });
    const authorization = `Bearer ${setup.json().token}`;
    const call = (method: any, url: string, payload?: unknown, headers = {}) => app.inject({ method, url, payload, headers: { authorization, ...headers } });
    const siteId = id(); run('INSERT INTO sites(id,name,url,next_discovery_at,created_at,updated_at) VALUES(?,?,?,?,?,?)', siteId, 'Original site', 'https://example.com/', later(24), now(), now());
    const page = addPage(siteId, 'https://example.com/').page;
    const png = new PNG({ width: 4, height: 4 }); png.data.fill(255);
    const version = await recordCapture(page, get('SELECT * FROM sites WHERE id=?', siteId)!, {
      requestedUrl: page.url, finalUrl: page.url, statusCode: 200, title: 'Original title', text: 'Original evidence', links: [], headings: [], imageUrls: [], html: '<p>Original evidence</p>', screenshot: PNG.sync.write(png), warnings: [], capturedAt: now(),
      quality: { status: 'complete', missingImages: 0, reasons: [], version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete' },
    });
    const backup = (await call('GET', '/api/export')).rawPayload;
    const changed = async (mutate: (copy: DatabaseSync) => void) => {
      const files = zipEntries(backup), path = join(directory, 'changed.sqlite'); writeFileSync(path, files.get('archive.sqlite')!);
      const copy = new DatabaseSync(path); try { mutate(copy); } finally { copy.close(); }
      files.set('archive.sqlite', readFileSync(path)); rmSync(path);
      return zipFixture(files);
    };
    const verify = async (bytes: Buffer) => {
      const start = await call('POST', '/api/restore/uploads', { bytes: bytes.length }); assert.equal(start.statusCode, 200, start.body);
      const token = start.json().id;
      for (let offset = 0; offset < bytes.length; offset += 1024 ** 2) {
        const sent = await call('PUT', `/api/restore/uploads/${token}?offset=${offset}`, bytes.subarray(offset, offset + 1024 ** 2), { 'content-type': 'application/octet-stream' });
        assert.equal(sent.statusCode, 200, sent.body);
      }
      return { token, response: await call('POST', `/api/restore/uploads/${token}/verify`) };
    };
    const original = JSON.stringify({ sites: all('SELECT * FROM sites'), pages: all('SELECT * FROM pages'), versions: all('SELECT * FROM versions'), checks: all('SELECT * FROM checks'), events: all('SELECT * FROM events') });
    await t.test('oversized scalar fields and metadata are rejected and the current evidence/account stay intact', async () => {
      const oversized: [string, (copy: DatabaseSync) => void][] = [
        ['site name', copy => copy.prepare('UPDATE sites SET name=?').run('a'.repeat(121))],
        ['page title', copy => copy.prepare('UPDATE pages SET title=?').run('a'.repeat(501))],
        ['page notes', copy => copy.prepare('UPDATE pages SET notes=?').run('a'.repeat(20001))],
        ['page source', copy => copy.prepare('UPDATE pages SET source=?').run('a'.repeat(65))],
        ['page status', copy => copy.prepare('UPDATE pages SET last_status=?').run('a'.repeat(65))],
        ['version title', copy => copy.prepare('UPDATE versions SET title=?').run('a'.repeat(501))],
        ['version URL', copy => copy.prepare('UPDATE versions SET final_url=?').run('https://example.com/' + 'a'.repeat(captureLimits.url))],
        ['version text', copy => copy.prepare('UPDATE versions SET text=?').run('a'.repeat(captureLimits.text + 1))],
        ['version signature', copy => copy.prepare('UPDATE versions SET signature=?').run('a'.repeat(65))],
        ['version reason', copy => copy.prepare('UPDATE versions SET reason=?').run('a'.repeat(8193))],
        ['check message', copy => copy.prepare('UPDATE checks SET message=?').run('a'.repeat(8193))],
        ['event message', copy => copy.prepare('UPDATE events SET message=?').run('a'.repeat(8193))],
        ['event kind', copy => copy.prepare('UPDATE events SET kind=?').run('a'.repeat(65))],
        ['quality padding', copy => copy.prepare('UPDATE versions SET quality=?').run(JSON.stringify({ status: 'complete', missingImages: 0, reasons: [], padding: 'a'.repeat(200000) }))],
        ['metadata padding', copy => copy.prepare('UPDATE versions SET links=?').run('[]' + ' '.repeat(captureLimits.metadataBytes))],
        ['settings padding', copy => copy.prepare("INSERT INTO settings VALUES ('inbox_kinds',?)").run(' '.repeat(10000) + '[]')],
        ['binary text cell', copy => copy.prepare('UPDATE events SET message=?').run(Buffer.from('not a text value'))],
      ];
      for (const [name, mutate] of oversized) {
        const { response } = await verify(await changed(mutate)); assert.equal(response.statusCode, 422, name + ': ' + response.body);
        assert.equal((await call('GET', '/api/restore/status')).json().upload, null);
        assert.equal(JSON.stringify({ sites: all('SELECT * FROM sites'), pages: all('SELECT * FROM pages'), versions: all('SELECT * FROM versions'), checks: all('SELECT * FROM checks'), events: all('SELECT * FROM events') }), original, name);
        assert.equal((await call('GET', '/api/auth/status')).json().authenticated, true);
        assert.deepEqual(all('PRAGMA foreign_key_check'), []);
      }
    });
    await t.test('legitimate UTF-8 boundary values retain complete text and notes after restore', async () => {
      const title = '界'.repeat(500), note = '界'.repeat(20000), text = '界'.repeat(captureLimits.text);
      const bytes = await changed(copy => {
        copy.prepare('UPDATE sites SET name=?,notes=?').run('界'.repeat(120), note);
        copy.prepare('UPDATE pages SET title=?,notes=?').run(title, note);
        copy.prepare('UPDATE versions SET title=?,text=?,reason=?,quality=?').run(title, text, '界'.repeat(8192), JSON.stringify({ status: 'complete', missingImages: 0, reasons: [] }));
        copy.prepare('UPDATE checks SET message=?').run('界'.repeat(8192));
        copy.prepare('UPDATE events SET message=?').run('界'.repeat(8192));
        copy.prepare('INSERT INTO version_notes VALUES (?,?,?,?)').run(version.versionId, note, 1, now());
        copy.prepare('INSERT INTO version_tags VALUES (?,?)').run(version.versionId, '界'.repeat(40));
        copy.prepare("INSERT INTO settings VALUES ('inbox_kinds',?)").run('["changed"]');
      });
      const { token, response } = await verify(bytes); assert.equal(response.statusCode, 200, response.body);
      const applied = await call('POST', `/api/restore/uploads/${token}/apply`, { confirmId: token, password: 'temporary-test-password' }); assert.equal(applied.statusCode, 200, applied.body);
      assert.equal(get('SELECT text FROM versions')!.text, text); assert.equal(get('SELECT title FROM pages')!.title, title);
      assert.equal(get('SELECT note FROM version_notes')!.note, note); assert.equal(get('SELECT paused FROM sites')!.paused, 1);
      assert.deepEqual(all('PRAGMA foreign_key_check'), []);
    });
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
