import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, unlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import type { CaptureResult } from '../src/types.js';

function capture(shade = 255): CaptureResult {
  const png = new PNG({ width: 24, height: 24 }); png.data.fill(shade);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', statusCode: 200, title: 'Fixture', text: 'Offer', links: [], headings: [], imageUrls: [], html: '<p>Private archived markup</p>', screenshot: PNG.sync.write(png), warnings: [], capturedAt: new Date().toISOString(), quality: { status: 'partial', missingImages: 1, reasons: ['Immagine assente'] } };
}

test('temporary diagnostics remain bounded, private, expiring and independent from permanent history', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-diagnostics-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const diagnostics = await import('../src/diagnostics.js');
  const { createApp } = await import('../src/server.js');
  const { db, run, get, id, addPage, now, later } = await import('../src/db.js');
  const app = await createApp();
  const limits = { ...diagnostics.diagnosticLimits }, root = join(directory, 'diagnostics');
  const reset = () => { rmSync(root, { recursive: true, force: true }); mkdirSync(root); Object.assign(diagnostics.diagnosticLimits, limits); };
  const metadataFile = (page: string, sample: string) => join(root, `${page}.${sample}.json`);
  const age = (page: string, sample: string, ageMs: number, expiryMs = 48 * 3600000) => {
    const file = metadataFile(page, sample), metadata = JSON.parse(readFileSync(file, 'utf8'));
    metadata.createdAt = new Date(Date.now() - ageMs).toISOString(); metadata.expiresAt = new Date(Date.now() - ageMs + expiryMs).toISOString();
    writeFileSync(file, JSON.stringify(metadata));
  };
  try {
    await t.test('identical failed renders share one screenshot and do not store HTML or permanent objects', () => {
      reset();
      const first = diagnostics.recordDiagnostic('page-a', capture(), { kind: 'incomplete' });
      assert.ok(first);
      assert.equal(diagnostics.recordDiagnostic('page-a', capture(), { kind: 'incomplete' }), first);
      assert.deepEqual(readdirSync(root).sort(), [`page-a.${first}.json`, `page-a.${first}.png`].sort());
      assert.equal(get('SELECT COUNT(*) n FROM objects')!.n, 0);
      assert.deepEqual(diagnostics.readDiagnostic('page-a', first!), capture().screenshot);
      assert.throws(() => diagnostics.readDiagnostic('page-b', first!), { statusCode: 404 });
      assert.throws(() => diagnostics.readDiagnostic('page-a', '../../worker-token'), { statusCode: 404 });
    });
    await t.test('per-page sample count, global byte quota and total count are enforced', () => {
      reset(); diagnostics.diagnosticLimits.perPage = 2;
      const first = diagnostics.recordDiagnostic('page-a', capture(10), {})!; age('page-a', first, 10000);
      const second = diagnostics.recordDiagnostic('page-a', capture(20), {})!; age('page-a', second, 5000);
      const third = diagnostics.recordDiagnostic('page-a', capture(30), {})!;
      assert.equal(diagnostics.listPageDiagnostics('page-a').length, 2);
      assert.throws(() => diagnostics.readDiagnostic('page-a', first), { statusCode: 404 });
      assert.ok(diagnostics.readDiagnostic('page-a', third));
      diagnostics.diagnosticLimits.maxSamples = 2;
      const other = diagnostics.recordDiagnostic('page-b', capture(40), {})!;
      assert.equal(diagnostics.diagnosticsStatus().count, 2); assert.ok(diagnostics.readDiagnostic('page-b', other));
      const single = diagnostics.listPageDiagnostics('page-b')[0].bytes;
      diagnostics.diagnosticLimits.maxBytes = single + 100;
      diagnostics.pruneDiagnostics();
      assert.ok(diagnostics.diagnosticsStatus().bytes <= diagnostics.diagnosticLimits.maxBytes);
      diagnostics.recordDiagnostic('page-c', capture(50), {});
      assert.ok(diagnostics.diagnosticsStatus().bytes <= diagnostics.diagnosticLimits.maxBytes);
      diagnostics.diagnosticLimits.maxBytes = 10;
      assert.equal(diagnostics.recordDiagnostic('page-z', capture(), {}), undefined);
      assert.equal(diagnostics.diagnosticsStatus().count, 0);
    });
    await t.test('48-hour expiry cannot be extended by corrupt metadata, and malformed pairs remain in the quota until cleanup', () => {
      reset();
      const expired = diagnostics.recordDiagnostic('page-a', capture(), {})!;
      age('page-a', expired, 49 * 3600000, 365 * 24 * 3600000);
      assert.equal(diagnostics.listPageDiagnostics('page-a').length, 0);
      diagnostics.pruneDiagnostics();
      assert.equal(readdirSync(root).length, 0);
      writeFileSync(join(root, 'page-b.broken.json'), '{invalid');
      writeFileSync(join(root, 'page-b.broken.png'), Buffer.alloc(3000));
      assert.equal(diagnostics.diagnosticsStatus().bytes, 3008);
      assert.equal(diagnostics.listPageDiagnostics('page-b').length, 0);
      diagnostics.diagnosticLimits.maxBytes = 3100;
      assert.equal(diagnostics.recordDiagnostic('page-c', capture(), {}), undefined, 'Unpaired files still consume the byte quota');
      const past = new Date(Date.now() - 120000);
      for (const filename of readdirSync(root)) utimesSync(join(root, filename), past, past);
      diagnostics.pruneDiagnostics();
      assert.equal(readdirSync(root).length, 0);
    });
    await t.test('filesystem errors and symlinks never stop capture logging or expose external files', () => {
      reset(); rmSync(root, { recursive: true }); writeFileSync(root, 'unavailable');
      assert.doesNotThrow(() => diagnostics.pruneDiagnostics());
      assert.equal(diagnostics.recordDiagnostic('page-a', capture(), {}), undefined);
      assert.deepEqual(diagnostics.listPageDiagnostics('page-a'), []);
      unlinkSync(root);
      const external = join(directory, 'external'); mkdirSync(external);
      const sentinel = join(external, 'sentinel'); writeFileSync(sentinel, 'private');
      symlinkSync(external, root);
      assert.equal(diagnostics.recordDiagnostic('page-a', capture(), {}), undefined);
      assert.doesNotThrow(() => diagnostics.removePageDiagnostics('page-a'));
      assert.equal(readFileSync(sentinel, 'utf8'), 'private');
      unlinkSync(root); mkdirSync(root);
      const sample = diagnostics.recordDiagnostic('page-a', capture(), {})!;
      unlinkSync(join(root, `page-a.${sample}.png`)); symlinkSync(sentinel, join(root, `page-a.${sample}.png`));
      assert.throws(() => diagnostics.readDiagnostic('page-a', sample), { statusCode: 404 });
      diagnostics.pruneDiagnostics(); assert.equal(readFileSync(sentinel, 'utf8'), 'private');
      assert.equal(existsSync(join(root, `page-a.${sample}.png`)), false);
    });
    await t.test('authenticated screenshot route rejects other pages and expired samples', async () => {
      reset();
      const siteId = id();
      run('INSERT INTO sites(id,name,url,next_discovery_at,created_at,updated_at) VALUES(?,?,?,?,?,?)', siteId, 'Diagnostic fixture', 'https://example.com/', later(24), now(), now());
      const page = addPage(siteId, 'https://example.com/').page, otherPage = addPage(siteId, 'https://example.com/other').page;
      const sample = diagnostics.recordDiagnostic(page.id, capture(), {})!;
      const url = `/api/pages/${page.id}/diagnostics/${sample}/screenshot`;
      assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
      const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'diagnostic-test', password: 'temporary-test-password' } });
      const cookie = String(setup.headers['set-cookie']).split(';')[0], headers = { cookie };
      const response = await app.inject({ method: 'GET', url, headers });
      assert.equal(response.statusCode, 200); assert.match(String(response.headers['content-type']), /image\/png/);
      assert.equal((await app.inject({ method: 'GET', url: `/api/pages/${otherPage.id}/diagnostics/${sample}/screenshot`, headers })).statusCode, 404);
      age(page.id, sample, 49 * 3600000);
      assert.equal((await app.inject({ method: 'GET', url, headers })).statusCode, 404);
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 0);
    });
  } finally { Object.assign(diagnostics.diagnosticLimits, limits); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
