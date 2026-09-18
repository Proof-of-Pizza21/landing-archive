import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PNG } from 'pngjs';
import { zipEntries, zipFixture } from './zip-helper.js';

test('quality-aware backup validates references and evidence, clears pending confirmations and upgrades schema 4', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-restore-quality-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, all, run, id, addPage, now, later } = await import('../src/db.js');
  const { recordCapture } = await import('../src/history.js');
  const { recordDiagnostic, listPageDiagnostics } = await import('../src/diagnostics.js');
  const app = await createApp();
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'restore-quality-test', password: 'temporary-test-password' } });
    const authorization = `Bearer ${setup.json().token}`;
    const call = (method: any, url: string, payload?: unknown, headers = {}) => app.inject({ method, url, payload, headers: { authorization, ...headers } });
    const siteId = id(); run('INSERT INTO sites(id,name,url,next_discovery_at,created_at,updated_at) VALUES(?,?,?,?,?,?)', siteId, 'Restore fixture', 'https://example.com/', later(24), now(), now());
    const page = addPage(siteId, 'https://example.com/').page, secondPage = addPage(siteId, 'https://example.com/second').page;
    const png = new PNG({ width: 16, height: 16 }); png.data.fill(255);
    const result = { requestedUrl: page.url, finalUrl: page.url, statusCode: 200, title: 'Offer', text: 'Price 100', links: [], headings: [], imageUrls: [], html: '<p>Price 100</p>', screenshot: PNG.sync.write(png), warnings: [], capturedAt: now(), quality: { status: 'complete' as const, missingImages: 0, reasons: [], version: 2 as const, stable: true, renderStatus: 'complete' as const, archiveStatus: 'complete' as const } };
    const version = await recordCapture(page, get('SELECT * FROM sites WHERE id=?', siteId)!, result);
    await recordCapture(secondPage, get('SELECT * FROM sites WHERE id=?', siteId)!, { ...result, requestedUrl: secondPage.url, finalUrl: secondPage.url });
    run('UPDATE pages SET candidate_fingerprint=?,candidate_count=2,candidate_clean_count=1,candidate_retry_count=2,candidate_first_at=?,candidate_last_at=? WHERE id=?', 'a'.repeat(64), now(), now(), page.id);
    const backup = (await call('GET', '/api/export')).rawPayload;
    const changed = async (mutate: (copy: DatabaseSync) => void, schema?: number) => {
      const files = zipEntries(backup), path = join(directory, 'mutated.sqlite'); writeFileSync(path, files.get('archive.sqlite')!);
      const copy = new DatabaseSync(path); try { mutate(copy); } finally { copy.close(); }
      files.set('archive.sqlite', readFileSync(path)); rmSync(path);
      if (schema) { const manifest = JSON.parse(files.get('manifest.json')!.toString()); manifest.schema = schema; files.set('manifest.json', Buffer.from(JSON.stringify(manifest))); }
      return zipFixture(files);
    };
    const upload = async (bytes: Buffer) => {
      const started = await call('POST', '/api/restore/uploads', { bytes: bytes.length }); assert.equal(started.statusCode, 200, started.body);
      const token = started.json().id;
      const sent = await call('PUT', `/api/restore/uploads/${token}?offset=0`, bytes, { 'content-type': 'application/octet-stream' }); assert.equal(sent.statusCode, 200, sent.body);
      return token;
    };
    await t.test('cross-page and partial references, invalid quality, bad evidence and out-of-range retry counts are rejected', async () => {
      const bad = [
        (copy: DatabaseSync) => copy.prepare('UPDATE pages SET reference_version_id=? WHERE id=?').run(version.versionId, secondPage.id),
        (copy: DatabaseSync) => copy.prepare('UPDATE versions SET quality=? WHERE id=?').run(JSON.stringify({ status: 'partial', missingImages: 1, reasons: ['Missing'] }), version.versionId),
        (copy: DatabaseSync) => copy.prepare('UPDATE versions SET quality=? WHERE id=?').run(JSON.stringify({ status: 'complete', missingImages: 0, reasons: [], version: 2, stable: false, renderStatus: 'complete', archiveStatus: 'complete' }), version.versionId),
        (copy: DatabaseSync) => copy.exec(`UPDATE checks SET evidence='{"kind":"invented"}'`),
        (copy: DatabaseSync) => copy.exec(`UPDATE versions SET evidence='{"fingerprint":"bad"}'`),
        (copy: DatabaseSync) => copy.exec('UPDATE pages SET candidate_retry_count=3'),
      ];
      for (const mutate of bad) {
        const token = await upload(await changed(mutate)), verified = await call('POST', `/api/restore/uploads/${token}/verify`);
        assert.equal(verified.statusCode, 422, verified.body);
        assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 2);
        assert.equal(get('SELECT reference_version_id FROM pages WHERE id=?', page.id)!.reference_version_id, version.versionId);
      }
    });
    await t.test('valid schema 5 preserves the reliable reference but clears retries and temporary samples', async () => {
      const diagnostic = recordDiagnostic(page.id, { ...result, quality: { status: 'partial', missingImages: 1, reasons: ['Incomplete'] } }, { kind: 'incomplete' }); assert.ok(diagnostic);
      const token = await upload(backup), verified = await call('POST', `/api/restore/uploads/${token}/verify`);
      assert.equal(verified.statusCode, 200, verified.body);
      const applied = await call('POST', `/api/restore/uploads/${token}/apply`, { confirmId: token, password: 'temporary-test-password' }); assert.equal(applied.statusCode, 200, applied.body);
      const restored = get('SELECT * FROM pages WHERE id=?', page.id)!;
      assert.equal(restored.reference_version_id, version.versionId); assert.equal(restored.candidate_fingerprint, null);
      assert.equal(restored.candidate_count, 0); assert.equal(restored.candidate_clean_count, 0); assert.equal(restored.candidate_retry_count, 0);
      assert.deepEqual(listPageDiagnostics(page.id), []); assert.equal(get('SELECT paused FROM sites')!.paused, 1);
      assert.deepEqual(all('PRAGMA foreign_key_check'), []);
    });
    await t.test('a real schema 4 backup without any new columns imports with conservative defaults', async () => {
      const old = await changed(copy => {
        copy.exec('DROP INDEX versions_page_variant');
        for (const field of ['reference_version_id','candidate_fingerprint','candidate_count','candidate_first_at','candidate_last_at','candidate_clean_count','candidate_retry_count']) copy.exec(`ALTER TABLE pages DROP COLUMN ${field}`);
        for (const field of ['review_state','variant_key','evidence']) copy.exec(`ALTER TABLE versions DROP COLUMN ${field}`);
        copy.exec('ALTER TABLE checks DROP COLUMN evidence; PRAGMA user_version=4');
      }, 4);
      const token = await upload(old), verified = await call('POST', `/api/restore/uploads/${token}/verify`);
      assert.equal(verified.statusCode, 200, verified.body); assert.equal(verified.json().schema, 4);
      const applied = await call('POST', `/api/restore/uploads/${token}/apply`, { confirmId: token, password: 'temporary-test-password' }); assert.equal(applied.statusCode, 200, applied.body);
      const restored = get('SELECT * FROM pages WHERE id=?', page.id)!;
      assert.equal(restored.reference_version_id, null); assert.equal(restored.candidate_retry_count, 0);
      assert.equal(get('SELECT review_state FROM versions WHERE id=?', version.versionId)!.review_state, 'legacy');
      assert.equal(get('PRAGMA user_version')!.user_version, 5); assert.deepEqual(all('PRAGMA foreign_key_check'), []);
    });
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
