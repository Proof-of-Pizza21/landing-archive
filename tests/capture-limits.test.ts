import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { captureLimits, screenshotClip, validateScreenshot, decodeCaptureResult, readWorkerJson } from '../src/capture-limits.js';
import { visualDifference } from '../src/image-compare.js';

function png(red: number) {
  const image = new PNG({ width: 64, height: 64 });
  for (let n = 0; n < image.data.length; n += 4) { image.data[n] = red; image.data[n + 3] = 255; }
  return PNG.sync.write(image);
}
const limited = (error: any) => error.code === 'SIZE_LIMIT';
test('screenshot limits cover width, height, pixels and dangerous PNG framing before decode', () => {
  for (const [width, height] of [[1440, 20000], [12000, 1200], [1920, 1000000]]) {
    const clip = screenshotClip(width, height);
    assert.ok(clip.width <= 1920 && clip.height <= 20000 && clip.width * clip.height <= captureLimits.pixels);
  }
  const normal = png(0);
  assert.deepEqual(validateScreenshot(normal), { width: 64, height: 64 });
  for (const change of [(b: Buffer) => b.writeUInt32BE(12000, 16), (b: Buffer) => b.writeUInt32BE(0xffffffff, 20), (b: Buffer) => b[28] = 1, (b: Buffer) => b[24] = 16]) {
    const altered = Buffer.from(normal); change(altered); assert.throws(() => validateScreenshot(altered), limited);
  }
  const duplicateHeader = Buffer.concat([normal.subarray(0, 33), normal.subarray(8)]);
  assert.throws(() => validateScreenshot(duplicateHeader), limited);
  assert.throws(() => validateScreenshot(Buffer.concat([normal, Buffer.alloc(1)])), limited);
});

test('worker protocol bounds metadata and screenshot payloads before accepting a capture', () => {
  const capture = { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', statusCode: 200, title: 'Fixture', text: 'Test', headings: [], imageUrls: [], links: [], capturedAt: new Date().toISOString(), html: '<html>Test</html>', screenshot: png(0).toString('base64'), warnings: [] };
  assert.equal(decodeCaptureResult(capture).text, 'Test');
  for (const patch of [{ headings: ['x'.repeat(501)] }, { links: [{ url: 'x'.repeat(4097), text: '' }] }, { screenshot: 'not png' }, { text: {} }, { warnings: Array(101).fill('x') }, { html: '' }]) {
    assert.throws(() => decodeCaptureResult({ ...capture, ...patch }), limited);
  }
});

test('worker stream is bounded even without a truthful content-length, and cancels the body', async () => {
  assert.deepEqual(await readWorkerJson(new Response('{"ok":true}'), 32), { ok: true });
  for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '999999' }]) {
    let cancelled = false, pulls = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(16)); }, cancel() { cancelled = true; } });
    await assert.rejects(readWorkerJson(new Response(body, { headers }), 32), limited);
    assert.equal(cancelled, true); assert.ok(pulls <= 4);
  }
  await assert.rejects(readWorkerJson(new Response('{broken}')), (error: any) => error.code === 'INVALID_RESULT');
});

test('visual comparison runs in a disposable process and safely handles oversized legacy images', async () => {
  const left = png(0), right = png(255);
  assert.equal(await visualDifference(left, left), 0);
  assert.equal(await visualDifference(left, right), 1);
  const legacy = Buffer.from(left); legacy.writeUInt32BE(12000, 16);
  assert.equal(await visualDifference(legacy, right), 1);
  await assert.rejects(visualDifference(left, legacy), limited);
  const corrupt = Buffer.from(right); corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(visualDifference(left, corrupt), (error: any) => error.code === 'IMAGE_LIMIT');
});
