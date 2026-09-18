import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { visualDifference } from '../src/image-compare.js';
import { comparisonUrl, monitoringKey } from '../src/detection.js';
import { discoverSite, matchesDiscoveryPaths } from '../src/discovery.js';
import type { CaptureResult, DiscoveryResult } from '../src/types.js';

function picture(height = 1200, shift = 0, color = 30, tiny = false) {
  const png = new PNG({ width: 600, height }); png.data.fill(255);
  for (let y = 100 + shift; y < (tiny ? 110 : 300) + shift; y++) for (let x = 60 + shift; x < (tiny ? 70 : 300) + shift; x++) {
    const offset = (y * png.width + x) * 4; png.data[offset] = color; png.data[offset + 1] = color; png.data[offset + 2] = color;
  }
  return PNG.sync.write(png);
}

test('comparison tolerates a couple of shifted pixels and a tiny height change, but retains real visual changes', async () => {
  const original = picture();
  assert.ok(await visualDifference(original, picture(1201)) < 0.005);
  assert.ok(await visualDifference(original, picture(1202, 2)) < 0.005);
  assert.ok(await visualDifference(original, picture(1200, 0, 180)) > 0.005);
  assert.ok(await visualDifference(original, picture(1500)) > 0.005);
  assert.equal(await visualDifference(original, picture(1200, 0, 180), { ignored: [{ x: 58, y: 98, width: 244, height: 204 }] }), 0);
  const important = [{ x: 60, y: 100, width: 10, height: 10 }];
  const before = picture(1200, 0, 20, true), after = picture(1200, 0, 210, true);
  assert.ok(await visualDifference(before, after) < 0.005);
  assert.ok(await visualDifference(before, after, { important }) > 0.005);
});

test('only known tracking identifiers are ignored; offer and asset version parameters are preserved', () => {
  assert.equal(comparisonUrl('https://example.com/offer?utm_source=a&gclid=123&plan=pro'), 'https://example.com/offer?plan=pro');
  for (const parameter of ['price','offer','variant','ab','lang','v','cache','token','utm_custom']) assert.notEqual(comparisonUrl(`https://example.com/?${parameter}=A`), comparisonUrl(`https://example.com/?${parameter}=B`));
});

test('quality checks, changed prices, new rules and lifecycle observations preserve archive history', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-monitoring-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get, all, listPages, addPage } = await import('../src/db.js');
  const { recordCapture, recordFailure } = await import('../src/history.js');
  const { recordDiscovery } = await import('../src/jobs.js');
  const { readObject } = await import('../src/storage.js');
  const app = await createApp();
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'monitor-test', password: 'temporary-test-password' } });
    const authorization = `Bearer ${setup.json().token}`;
    const call = (method: any, url: string, payload?: unknown) => app.inject({ method, url, payload, headers: { authorization } });
    const response = await call('POST', '/api/sites', { name: 'Monitoring fixture', url: 'https://1.1.1.1/', discoveryIntervalHours: 3, includePaths: ['/offers'], excludePaths: ['/offers/old'], maxPages: 20 });
    assert.equal(response.statusCode, 201);
    const siteId = response.json().site.id;
    const pageId = listPages(siteId)[0].id;
    const site = () => get('SELECT * FROM sites WHERE id=?', siteId)!;
    const page = () => get('SELECT * FROM pages WHERE id=?', pageId)!;
    let clock = Date.now() - 3600000;
    const make = (options: Partial<CaptureResult> = {}): CaptureResult => ({ requestedUrl: 'https://1.1.1.1/', finalUrl: 'https://1.1.1.1/', statusCode: 200, title: 'Offer', text: 'Price 100', headings: ['Offer'], links: [{ url: 'https://example.com/offer?utm_source=A', text: 'Buy' }], imageUrls: ['https://example.com/hero.png'], html: '<h1>Offer</h1><p>Price 100</p>', screenshot: picture(), warnings: [], capturedAt: new Date(clock += 1000).toISOString(), quality: { status: 'complete', missingImages: 0, reasons: [], version: 2, stable: true, renderStatus: 'complete', archiveStatus: 'complete' }, ...options });
    const record = (result: CaptureResult) => recordCapture(page(), site(), result);
    const original = await record(make());
    const tracking = await record(make({ links: [{ url: 'https://example.com/offer?utm_source=B', text: 'Buy' }], screenshot: picture(1202, 2) }));
    assert.equal(tracking.changed, false);
    const missing = { status: 'partial' as const, missingImages: 1, reasons: ['Immagine non caricata.'] };
    const incomplete = await record(make({ screenshot: picture(1200, 0, 255), quality: missing }));
    assert.equal(incomplete.changed, false); assert.equal(incomplete.versionId, original.versionId);
    assert.equal(page().last_status, 'partial');
    assert.ok(Date.parse(page().next_check_at) < Date.now() + 6 * 60000);
    await record(make({ screenshot: picture(1200, 0, 255), quality: missing }));
    assert.ok(Date.parse(page().next_check_at) < Date.now() + 6 * 60000);
    await record(make({ screenshot: picture(1200, 0, 255), quality: missing }));
    assert.ok(Date.parse(page().next_check_at) > Date.now() + 5 * 3600000, 'At most two short quality retries per incomplete sequence');
    assert.equal((await record(make())).changed, false);
    const price = await record(make({ text: 'Price 120', html: '<p>Price 120</p>' }));
    assert.equal(price.kind, 'changed');
    assert.equal((await record(make())).kind, 'returned');
    const priceWithMissingImage = await record(make({ text: 'Price 150', html: '<p>Price 150</p>', screenshot: picture(1200, 0, 255), quality: missing }));
    assert.equal(priceWithMissingImage.changed, true);
    assert.equal(priceWithMissingImage.kind, 'observed');
    assert.equal(JSON.parse(get('SELECT quality FROM versions WHERE id=?', priceWithMissingImage.versionId)!.quality).status, 'partial');
    assert.equal((await record(make({ text: 'Price 150', html: '<p>Price 150</p>', screenshot: picture(1200, 0, 255), quality: missing }))).changed, false);
    assert.equal((await record(make({ text: 'Price 150' }))).kind, 'quality_restored');
    assert.match(readObject(get('SELECT html_hash FROM versions WHERE id=?', original.versionId)!.html_hash).toString(), /Price 100/);
    const rules = { ignoreRules: [{ selector: '#counter', label: 'Countdown' }], importantRules: [{ selector: '#price', label: 'Prezzo' }] };
    assert.equal((await app.inject({ method: 'PATCH', url: `/api/pages/${pageId}/rules`, payload: rules })).statusCode, 401);
    assert.equal((await call('PATCH', `/api/pages/${pageId}/rules`, rules)).statusCode, 200);
    const raw = make({ text: 'Price 150 Counter 10', html: '<p id="price">Price 150</p><p id="counter">10</p>' });
    const data = { rulesKey: monitoringKey(['#counter'], ['#price']), content: { ...raw, text: 'Price 150' }, ignored: [], important: [{ selector: '#price', count: 1, text: 'Price 150', links: [], imageUrls: [], rectangles: [] }] };
    const baseline = await record({ ...raw, detection: data });
    assert.equal(baseline.kind, 'baseline');
    assert.equal((await record({ ...make({ text: 'Price 150 Counter 9' }), detection: data })).changed, false);
    assert.match(readObject(get('SELECT html_hash FROM versions WHERE id=?', baseline.versionId)!.html_hash).toString(), /counter/);
    assert.equal((await record({ ...raw, capturedAt: new Date(clock += 1000).toISOString(), detection: { ...data, important: [{ ...data.important[0], text: 'Price 160' }] } })).message, 'Modifica in una zona importante');
    assert.equal((await call('PATCH', `/api/pages/${pageId}/rules`, { ignoreRules: Array(31).fill(rules.ignoreRules[0]), importantRules: [] })).statusCode, 400);
    assert.equal((await call('PATCH', `/api/sites/${siteId}`, { discoveryIntervalHours: 0 })).statusCode, 400);
    assert.equal((await call('PATCH', `/api/sites/${siteId}`, { excludePaths: ['https://example.com/'] })).statusCode, 400);
    const discovered: DiscoveryResult = { urls: [{ url: 'https://1.1.1.1/offers/new', source: 'sitemap' }, { url: 'https://1.1.1.1/offers/old/ignored', source: 'sitemap' }], warnings: [], sitemap: { urls: ['https://1.1.1.1/', 'https://1.1.1.1/offers/new'], sources: ['https://1.1.1.1/sitemap.xml'], complete: true } };
    recordDiscovery(site(), discovered);
    assert.equal(listPages(siteId).length, 2);
    assert.equal(site().discovery_interval_hours, 3);
    assert.ok(Math.abs(Date.parse(site().next_discovery_at) - Date.parse(site().last_discovery_at) - 3 * 3600000) < 1000);
    assert.equal(page().sitemap_state, 'present');
    recordDiscovery(site(), { ...discovered, sitemap: { ...discovered.sitemap!, urls: [], complete: false } });
    assert.equal(page().sitemap_state, 'present', 'Partial discovery cannot prove absence');
    recordDiscovery(site(), { ...discovered, sitemap: { ...discovered.sitemap!, urls: [] } });
    assert.equal(page().sitemap_state, 'absent'); assert.notEqual(page().last_status, 'missing');
    const count = all('SELECT * FROM versions').length;
    recordFailure(page(), site(), { statusCode: 404, message: 'HTTP 404' });
    assert.notEqual(listPages(siteId)[0].lifecycle, 'missing');
    recordFailure(page(), site(), { statusCode: 410, message: 'HTTP 410' });
    assert.equal(listPages(siteId)[0].lifecycle, 'missing');
    await record({ ...raw, detection: data });
    assert.equal(listPages(siteId)[0].lifecycle, 'recovered');
    assert.ok(all('SELECT * FROM versions').length >= count);
    assert.ok(listPages(siteId)[0].firstSeenAt); assert.ok(listPages(siteId)[0].lastSuccessfulAt);
    const manual = addPage(siteId, 'https://1.1.1.1/outside-scope', 'manual');
    assert.equal(manual.added, true);
    assert.equal(get('PRAGMA integrity_check')!.integrity_check, 'ok');
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('discovery tracks sitemap presence even at the page limit and refuses absence after incomplete indexes', async () => {
  assert.equal(matchesDiscoveryPaths('https://example.com/offers/new', ['/offers'], []), true);
  assert.equal(matchesDiscoveryPaths('https://example.com/offers-old', ['/offers'], []), false);
  assert.equal(matchesDiscoveryPaths('https://example.com/offers/old/x', ['/offers'], ['/offers/old']), false);
  let failChild = false;
  const transport = async (url: string) => {
    const path = new URL(url).pathname;
    const body = path === '/robots.txt' ? 'Sitemap: https://1.1.1.1/map.xml' : path === '/map.xml' ? '<sitemapindex><sitemap><loc>https://1.1.1.1/child.xml</loc></sitemap></sitemapindex>' : '<urlset><url><loc>https://1.1.1.1/offers/new</loc></url></urlset>';
    const status = path === '/robots.txt' || path === '/map.xml' || (path === '/child.xml' && !failChild) ? 200 : 404;
    return { url, status, body: Buffer.from(body), headers: { 'content-type': 'application/xml' } };
  };
  const result = await discoverSite({ url: 'https://1.1.1.1/', maxPages: 1 }, transport);
  assert.equal(result.urls.length, 1); assert.equal(result.sitemap?.complete, true);
  assert.deepEqual(result.sitemap?.urls, ['https://1.1.1.1/offers/new']);
  failChild = true;
  assert.equal((await discoverSite({ url: 'https://1.1.1.1/', maxPages: 1 }, transport)).sitemap?.complete, false);
});
