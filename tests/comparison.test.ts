import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { locateVisualChanges } from '../src/image-regions.js';
import { visualDifference } from '../src/image-compare.js';
import { compareContent } from '../src/comparison.js';
import { contentFields } from '../src/content-fields.js';

function picture(width = 240, height = 900, boxes: { x: number; y: number; width: number; height: number }[] = []) {
  const png = new PNG({ width, height }); png.data.fill(255);
  for (const r of boxes) for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) {
    const offset = (y * width + x) * 4;
    png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = 0;
  }
  return PNG.sync.write(png);
}

test('visual regions locate separate changes and match the existing equal-size detector', async () => {
  const boxes = [{ x: 48, y: 120, width: 60, height: 48 }, { x: 156, y: 756, width: 36, height: 60 }];
  const left = picture(), right = picture(240, 900, boxes);
  const result = await locateVisualChanges(left, right);
  assert.equal(result.regions.length, 2);
  assert.equal(result.difference, await visualDifference(left, right));
  for (const box of boxes) assert.ok(result.regions.some(r => r.x <= box.x && r.y <= box.y && r.x + r.width >= box.x + box.width && r.y + r.height >= box.y + box.height));
  assert.deepEqual((await locateVisualChanges(left, left)).regions, []);
  const reversed = await locateVisualChanges(right, left);
  assert.deepEqual(reversed.regions, result.regions);
  assert.equal(reversed.difference, result.difference);
});

test('unequal dimensions stay aligned and a one-pixel edge remains discoverable', async () => {
  const result = await locateVisualChanges(picture(1440, 2000), picture(1440, 2001));
  assert.deepEqual(result.left, { width: 1440, height: 2000 });
  assert.deepEqual(result.right, { width: 1440, height: 2001 });
  assert.ok(result.regions.some(r => r.y <= 2000 && r.y + r.height === 2001));
  assert.ok(result.difference < 0.01, 'Dimension heuristic must not be reported as a measured 100% difference');
  const wider = await locateVisualChanges(picture(100, 100), picture(120, 100));
  assert.ok(wider.regions.some(r => r.x <= 100 && r.x + r.width === 120));
  assert.ok(wider.regions.every(r => r.x >= 96), 'Only the added right edge should be highlighted');
});

test('region decoding rejects oversized, corrupt and cancelled inputs without unsafe fallback', async () => {
  const left = picture(), right = picture(240, 900, [{ x: 20, y: 20, width: 24, height: 24 }]);
  const large = Buffer.from(left); large.writeUInt32BE(12000, 16);
  await assert.rejects(locateVisualChanges(large, right), (error: any) => error.statusCode === 422);
  const corrupt = Buffer.from(right); corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(locateVisualChanges(left, corrupt), (error: any) => error.statusCode === 422);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(locateVisualChanges(left, right, controller.signal));
  const running = new AbortController(); const pending = locateVisualChanges(left, right, running.signal); running.abort();
  await assert.rejects(pending, (error: any) => error.statusCode === 422);
});

test('comparison explains metadata-only changes including link multiplicity and unchanged image pixels', () => {
  const base = { title: 'Landing', text: 'Offerta stabile', headings: '["Offerta"]', links: '[{"url":"https://example.com/offer?utm_source=A","text":"Scopri"}]', images: '["https://example.com/hero.png?cache=A"]', final_url: 'https://example.com/' };
  const changed = { ...base, links: '[{"url":"https://example.com/offer?utm_source=B","text":"Scopri"}]', images: '["https://example.com/hero.png?cache=B"]' };
  const result = compareContent(base, changed);
  assert.deepEqual(result.changes.map(c => c.kind), ['links', 'images']);
  assert.equal(result.changedLinks.added[0].url, 'https://example.com/offer?utm_source=B');
  assert.equal(result.changedImages.removed[0], 'https://example.com/hero.png?cache=A');
  assert.ok(!result.textDiff.some(part => part.added || part.removed));
  assert.deepEqual(compareContent(base, { ...base, text: 'Offerta   stabile', title: ' Landing ' }).changes, []);
  const duplicated = { ...base, links: JSON.stringify([...JSON.parse(base.links), ...JSON.parse(base.links)]) };
  assert.equal(compareContent(base, duplicated).changedLinks.added.length, 1);
  const detail = compareContent(base, { ...base, title: 'Nuovo titolo', headings: '["Nuova offerta"]', final_url: 'https://example.com/new/' });
  assert.equal(detail.details.length, 3);
  assert.deepEqual(detail.details[1].after, ['Nuova offerta']);
});

test('shared content fields retain the signature format of previously archived captures', () => {
  const sample = { title: ' Landing ', text: 'Offerta\n stabile', headings: [' Offerta '], links: [{ url: 'https://example.com/b', text: ' B ' }, { url: 'https://example.com/a', text: 'A' }], imageUrls: ['https://example.com/b.png', 'https://example.com/a.png', 'https://example.com/b.png'], finalUrl: 'https://example.com/' };
  assert.equal(JSON.stringify(contentFields(sample)), '{"title":"Landing","text":"Offerta stabile","headings":["Offerta"],"links":[["https://example.com/a","A"],["https://example.com/b","B"]],"images":["https://example.com/a.png","https://example.com/b.png"],"finalUrl":"https://example.com/"}');
});
