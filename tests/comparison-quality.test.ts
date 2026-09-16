import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareContent } from '../src/comparison.js';

test('comparison distinguishes new image bytes, failed loads and unchanged assets served from another URL', () => {
  const content = { title: 'Offer', text: 'Price 100', headings: '[]', links: '[]', images: '["https://example.com/hero.png"]', final_url: 'https://example.com/' };
  const asset = { url: 'https://example.com/hero.png', hash: 'a'.repeat(64), kind: 'image', status: 'loaded', rectangles: [] };
  const before = { ...content, detection: JSON.stringify({ assets: [asset] }) };
  const result = (change: Record<string, unknown>) => compareContent(before, { ...content, detection: JSON.stringify({ assets: [{ ...asset, ...change }] }) });
  assert.deepEqual(result({ hash: 'b'.repeat(64) }).resourceChanges.replaced, [asset.url]);
  assert.ok(result({ hash: 'b'.repeat(64) }).changes.some(change => change.kind === 'asset_content'));
  assert.deepEqual(result({ status: 'failed', hash: undefined }).resourceChanges.unavailable, [asset.url]);
  assert.equal(result({ status: 'failed', hash: undefined }).resourceChanges.replaced.length, 0);
  assert.deepEqual(result({ url: 'https://example.com/hero-new-name.png' }).resourceChanges.relocated, [{ before: asset.url, after: 'https://example.com/hero-new-name.png' }]);
  assert.equal(compareContent(content, content).resourceChanges.replaced.length, 0);
});

test('region comparison separates moved sections from changed copy without inventing matches', () => {
  const content = { title: 'Offer', text: 'Price 100', headings: '[]', links: '[]', images: '[]', final_url: 'https://example.com/' };
  const block = { key: 'main:1/p:1', text: 'Price 100', rectangles: [{ x: 20, y: 40, width: 120, height: 30 }] };
  const row = (blocks: unknown[]) => ({ ...content, detection: JSON.stringify({ blocks }) });
  const before = row([block]);
  assert.equal(compareContent(before, row([{ ...block, rectangles: [{ ...block.rectangles[0], y: 90 }] }])).regions[0].kind, 'position');
  assert.equal(compareContent(before, row([{ ...block, text: 'Price 150' }])).regions[0].kind, 'text');
  assert.equal(compareContent(before, row([{ ...block, rectangles: [{ ...block.rectangles[0], y: 42 }] }])).regions.length, 0);
  assert.equal(compareContent(before, row([{ ...block, text: 'Changed' }, block])).regions.length, 0);
});
