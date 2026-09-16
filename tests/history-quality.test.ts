import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { monitoringKey } from '../src/detection.js';
import type { CaptureResult, CaptureQuality, CaptureAsset } from '../src/types.js';
import { zipEntries } from './zip-helper.js';

const complete: CaptureQuality = { version: 2, status: 'complete', stable: true, missingImages: 0, reasons: [], renderStatus: 'complete', archiveStatus: 'complete' };
const partial: CaptureQuality = { ...complete, status: 'partial', missingImages: 1, reasons: ['An image did not load.'], renderStatus: 'partial' };
const asset: CaptureAsset = { kind: 'image', url: 'https://example.com/hero.png', status: 'loaded', hash: 'a'.repeat(64), rectangles: [] };
function picture(color = 40, shift = 0) {
  const png = new PNG({ width: 240, height: 300 }); png.data.fill(255);
  for (let y = 50; y < 160; y++) for (let x = 30 + shift; x < 170 + shift; x++) {
    const i = (y * png.width + x) * 4; png.data[i] = png.data[i + 1] = png.data[i + 2] = color;
  }
  return PNG.sync.write(png);
}

test('quality gate preserves evidence without making incomplete renders into reference versions', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-quality-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, all, addPage, run } = await import('../src/db.js');
  const { recordCapture, recordFailure } = await import('../src/history.js');
  const app = await createApp();
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'quality-test', password: 'temporary-test-password' } });
  const cookie = String(setup.headers['set-cookie']).split(';')[0];
  const call = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
  const site = (await app.inject({ method: 'POST', url: '/api/sites', headers: { cookie }, payload: { name: 'Quality fixture', url: 'https://1.1.1.1/', maxPages: 100, intervalHours: 24 } })).json().site;
  let clock = Date.parse('2026-09-01T10:00:00Z');
  function fixture(path: string) {
    const url = `https://1.1.1.1/${path}`, row = addPage(site.id, url).page;
    const page = () => get('SELECT * FROM pages WHERE id=?', row.id)!;
    const count = () => get('SELECT count(*) n FROM versions WHERE page_id=?', row.id)!.n;
    const make = (text = 'Price 100. Book a call.', options: Partial<CaptureResult> = {}, assets: CaptureAsset[] = [asset]): CaptureResult => {
      const content = { title: 'Offer', text, headings: ['Offer'], links: [{ url: 'https://1.1.1.1/target', text: 'Book' }], imageUrls: assets.map(a => a.url) };
      return { ...content, requestedUrl: url, finalUrl: url, statusCode: 200, html: `<h1>Offer</h1><p>${text}</p>`, screenshot: picture(), warnings: [], capturedAt: new Date(clock += 60000).toISOString(), quality: complete,
        detection: { content, rulesKey: monitoringKey([], []), ignored: [], important: [], assets, blocks: [] }, ...options };
    };
    return { page, count, make, record: (result: CaptureResult) => recordCapture(page(), get('SELECT * FROM sites WHERE id=?', site.id)!, result) };
  }
  try {
    await t.test('A → missing image and short missing text → A retains one version and every check', async () => {
      const f = fixture('partial'), first = await f.record(f.make());
      const failed = { ...asset, status: 'failed' as const, hash: undefined };
      for (const text of ['Price 100.', 'Price', '']) {
        assert.equal((await f.record(f.make(text, { quality: partial, screenshot: picture(255) }, [failed]))).changed, false);
        assert.equal(f.page().reference_version_id, first.versionId);
      }
      assert.equal(f.page().candidate_retry_count, 2);
      assert.ok(Date.parse(f.page().next_check_at) > Date.now() + 23 * 3600000);
      assert.equal((await f.record(f.make())).changed, false);
      assert.equal(f.count(), 1); assert.equal(f.page().reference_version_id, first.versionId);
      assert.equal(get('SELECT count(*) n FROM checks WHERE page_id=?', f.page().id)!.n, 5);
      assert.equal((await call(`/api/pages/${f.page().id}`)).json().diagnostics.length, 1);
    });
    await t.test('only the same absence in separated clean visits can be confirmed', async () => {
      const f = fixture('absence'); await f.record(f.make());
      assert.equal((await f.record(f.make('Price 100.'))).changed, false);
      assert.equal((await f.record(f.make('Book a call.'))).changed, false, 'A different missing fragment is not confirmation');
      assert.equal(f.page().candidate_clean_count, 1);
      const tooSoon = f.make('Book a call.', { capturedAt: f.page().candidate_last_at });
      assert.equal((await f.record(tooSoon)).changed, false, 'Rapid manual clicks cannot confirm absence');
      await f.record(f.make('Book a call.', { quality: partial }));
      assert.equal((await f.record(f.make('Book a call.'))).changed, false, 'An incomplete intervening visit resets clean evidence');
      const accepted = await f.record(f.make('Book a call.'));
      assert.equal(accepted.kind, 'changed'); assert.equal(f.count(), 2);
      assert.equal(f.page().reference_version_id, accepted.versionId);
    });
    await t.test('network failures interrupt confirmation and never remove archived copies', async () => {
      const f = fixture('failure'); const first = await f.record(f.make());
      await f.record(f.make('Price 100.'));
      recordFailure(f.page(), get('SELECT * FROM sites WHERE id=?', site.id)!, { statusCode: 503, message: 'Temporary failure' });
      assert.equal((await f.record(f.make('Price 100.'))).changed, false);
      assert.equal(f.page().reference_version_id, first.versionId); assert.equal(f.count(), 1);
      assert.equal((await f.record(f.make('Price 100.'))).kind, 'changed');
    });
    await t.test('a stable new price with a failed image is retained separately and then improved', async () => {
      const f = fixture('new-offer'), first = await f.record(f.make());
      const failed = { ...asset, status: 'failed' as const, hash: undefined };
      const seen = await f.record(f.make('Price 150. Book a call.', { quality: partial }, [failed]));
      assert.equal(seen.kind, 'observed'); assert.equal(f.page().reference_version_id, first.versionId);
      assert.equal((await f.record(f.make('Price 150. Book a call.', { quality: partial }, [failed]))).changed, false);
      const clean = await f.record(f.make('Price 150. Book a call.'));
      assert.equal(clean.kind, 'quality_restored'); assert.equal(f.count(), 3);
      const versions = all('SELECT * FROM versions WHERE page_id=? ORDER BY captured_at', f.page().id);
      assert.equal(versions[1].review_state, 'observed'); assert.equal(versions[1].variant_key, versions[2].variant_key);
      assert.equal(f.page().reference_version_id, clean.versionId);
    });
    await t.test('unstable changing text stays temporary; the first sighting remains protected', async () => {
      const f = fixture('unstable'); const first = await f.record(f.make());
      for (const price of [120, 130, 140]) assert.equal((await f.record(f.make(`Price ${price}. Book a call.`, { quality: { ...partial, stable: false } }))).changed, false);
      assert.equal((await f.record(f.make('Content unavailable. Try again.', { quality: partial }))).changed, false, 'A fallback message with missing content is not a new offer');
      assert.equal(f.count(), 1); assert.equal(f.page().reference_version_id, first.versionId);
      const newPage = fixture('first-partial'); const observed = await newPage.record(newPage.make('Fleeting offer', { quality: partial }));
      assert.ok(observed.versionId); assert.equal(newPage.page().reference_version_id, null);
      assert.equal((await call(`/api/pages/${newPage.page().id}/cleanup`)).json().candidates.length, 0);
    });
    await t.test('same image bytes at a new URL are unchanged, new bytes at the same URL are a real change', async () => {
      const f = fixture('images'); const a = await f.record(f.make());
      assert.equal((await f.record(f.make(undefined, {}, [{ ...asset, url: 'https://example.com/moved.png' }]))).changed, false);
      const changed = await f.record(f.make(undefined, {}, [{ ...asset, hash: 'b'.repeat(64) }]));
      assert.equal(changed.kind, 'changed'); assert.notEqual(changed.versionId, a.versionId); assert.equal(f.count(), 2);
    });
    await t.test('pure visual differences need two consistent renders; tiny shifts are tolerated between confirmations', async () => {
      const f = fixture('visual'); const first = await f.record(f.make());
      assert.equal((await f.record(f.make(undefined, { screenshot: picture(190) }))).changed, false);
      const confirmed = await f.record(f.make(undefined, { screenshot: picture(190, 1) }));
      assert.equal(confirmed.kind, 'changed'); assert.equal(f.count(), 2); assert.notEqual(confirmed.versionId, first.versionId);
      assert.equal((await f.record(f.make())).kind, 'returned'); assert.equal(f.count(), 2);
    });
    await t.test('returned variants keep their dates in checks, export and offline navigation', async () => {
      const f = fixture('return'); const a = await f.record(f.make('Offer A'));
      const b = await f.record(f.make('Offer B'));
      const returnCapture = f.make('Offer A'), back = await f.record(returnCapture);
      assert.equal(back.kind, 'returned'); assert.equal(back.versionId, a.versionId); assert.equal(f.count(), 2);
      assert.equal(f.page().last_version_id, a.versionId);
      const detail = (await call(`/api/pages/${f.page().id}`)).json();
      assert.equal(detail.checks.length, 3); assert.equal(detail.checks[0].evidence.kind, 'returned');
      assert.equal(detail.checks[0].createdAt, returnCapture.capturedAt);
      const offline = (await call(`/api/versions/${b.versionId}/offline?at=${encodeURIComponent(returnCapture.capturedAt)}`)).json();
      assert.ok(JSON.stringify(offline).includes(a.versionId));
      const exported = await call(`/api/sites/${site.id}/export`);
      assert.equal(exported.statusCode, 200, exported.body.slice(0, 100));
      const files = zipEntries(exported.rawPayload);
      assert.equal([...files.entries()].filter(([path, data]) => /^versions\/\d+\.html$/.test(path) && /<p>Offer [AB]<\/p>/.test(data.toString())).length, 3);
      assert.match([...files.values()].map(value => value.toString()).join(' '), /Ritorno|ritorno|riutilizz|acquisizione/i);
    });
    await t.test('rules changed during a capture cannot overwrite the current reference', async () => {
      const f = fixture('rules'); const first = await f.record(f.make());
      run('UPDATE pages SET ignore_rules=? WHERE id=?', JSON.stringify([{ selector: '#counter', label: 'Counter' }]), f.page().id);
      await assert.rejects(f.record(f.make('New content')), /regole/);
      assert.equal(f.page().reference_version_id, first.versionId); assert.equal(f.count(), 1);
    });
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
