import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isCriticalResource, observedAssets, packagingResourceRelevant, readinessSignature, renderProblems, type PageMetadata } from '../src/capture-readiness.js';
import { validateDetection, validateQuality } from '../src/capture-limits.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const rect = { x: 0, y: 0, width: 100, height: 100 };
const metadata = (): PageMetadata => ({ title: 'Offer', text: 'Price 100', headings: [], links: [], imageUrls: [], comparison: { title: 'Offer', text: 'Price 100', headings: [], links: [], imageUrls: [] }, ignored: [], important: [], assets: [], blocks: [], fontsPending: false, fontsFailed: 0, missingImages: 0, height: 1000, invalidSelectors: [], cookieBanner: false, challenge: false });

test('asset hashes identify bytes without promoting unavailable resources to loaded', () => {
  const assets = [{ url: 'https://public.example/hero.png', kind: 'image' as const, status: 'loaded' as const, rectangles: [rect] }, { url: 'https://public.example/bg.png', kind: 'background' as const, status: 'pending' as const, rectangles: [rect] }];
  const resources = new Map([[assets[0].url, { status: 200, kind: 'image', hash: hash('creative A') }], [assets[1].url, { status: 404, kind: 'image' }]]);
  const first = observedAssets(assets, resources);
  assert.equal(first[0].hash, hash('creative A')); assert.equal(first[1].status, 'failed'); assert.equal(first[1].hash, undefined);
  resources.set(assets[0].url, { status: 200, kind: 'image', hash: hash('creative B') });
  assert.notEqual(observedAssets(assets, resources)[0].hash, first[0].hash);
  resources.set(assets[0].url, { status: 200, kind: 'image', hash: hash('undecodable') });
  assert.equal(observedAssets([{ ...assets[0], status: 'failed' }], resources)[0].hash, undefined);
});

test('readiness catches text and assets changing and reports incomplete fonts and expected sections', () => {
  const first = metadata(); const initial = readinessSignature(first);
  first.comparison.text = 'Price 149'; assert.notEqual(readinessSignature(first), initial);
  first.fontsFailed = 1; first.missingImages = 2;
  first.assets = [{ url: 'https://public.example/bg.png', kind: 'background', status: 'failed', rectangles: [rect] }];
  first.important = [{ selector: '#price', count: 0, text: '', links: [], imageUrls: [], rectangles: [] }];
  assert.equal(renderProblems(first, false).length, 5);
  assert.deepEqual(renderProblems(metadata(), true), []);
});

test('tracker failures do not claim incomplete content, while essential assets and content APIs do', () => {
  assert.equal(isCriticalResource('https://www.google-analytics.com/collect', 'fetch', 'https://public.example', 'POST'), false);
  assert.equal(isCriticalResource('https://public.example/telemetry', 'fetch', 'https://public.example', 'POST'), false);
  assert.equal(isCriticalResource('https://adserver.example/ad.js', 'script', 'https://public.example'), true);
  assert.equal(isCriticalResource('https://public.example/api/offers', 'fetch', 'https://public.example', 'POST'), true);
  assert.equal(isCriticalResource('https://cdn.example/react.min.js', 'script', 'https://public.example'), true);
  assert.equal(isCriticalResource('https://cdn.example/site.woff2', 'font', 'https://public.example'), true);
  assert.equal(packagingResourceRelevant('https://public.example/favicon.ico', new Map(), new Set(), new Set()), false);
  assert.equal(packagingResourceRelevant('https://public.example/hero.png', new Map(), new Set(['https://public.example/hero.png']), new Set()), true);
});

test('protocol validation bounds signals and forbids complete without complete verified stages', () => {
  const quality = { version: 2, stable: true, status: 'complete', renderStatus: 'complete', archiveStatus: 'complete', missingImages: 0, reasons: [] };
  validateQuality(quality);
  for (const patch of [{ missingImages: 1 }, { stable: false }, { archiveStatus: 'partial' }, { renderStatus: undefined }, { version: 3 }]) assert.throws(() => validateQuality({ ...quality, ...patch }));
  const data = { rulesKey: hash('rules'), content: metadata().comparison, ignored: [], important: [], assets: [{ url: 'https://public.example/image', kind: 'image', status: 'loaded', hash: hash('image'), rectangles: [rect] }], blocks: [{ key: 'main:1/p:1', text: 'Price 100', rectangles: [rect] }] };
  validateDetection(data);
  assert.throws(() => validateDetection({ ...data, assets: [{ ...data.assets[0], status: 'failed' }] }));
  assert.throws(() => validateDetection({ ...data, assets: [{ ...data.assets[0], rectangles: Array(21).fill(rect) }] }));
  assert.throws(() => validateDetection({ ...data, blocks: [{ ...data.blocks[0], text: 'a'.repeat(4001) }] }));
});
