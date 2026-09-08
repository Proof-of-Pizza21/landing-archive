import { CaptureError } from './network.js';
import type { CaptureResult, DiscoveryResult } from './types.js';

export const captureLimits = Object.freeze({
  width: 1920, height: 20000, pixels: 12_000_000,
  screenshotBytes: 16 * 1024 * 1024, htmlBytes: 32 * 1024 * 1024,
  metadataBytes: 8 * 1024 * 1024, workerBytes: 64 * 1024 * 1024,
  text: 1_500_000, headings: 100, heading: 500, links: 2000,
  url: 4096, linkText: 200, images: 500, warnings: 100, warning: 1000,
});
export const limitError = () => new CaptureError('La pagina supera i limiti di acquisizione. Le copie precedenti sono conservate.', 'SIZE_LIMIT');
export function screenshotClip(width: number, height: number) {
  const w = Math.max(1, Math.min(captureLimits.width, Math.floor(width)));
  const h = Math.max(1, Math.min(captureLimits.height, Math.floor(captureLimits.pixels / w), Math.floor(height)));
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw limitError();
  return { x: 0, y: 0, width: w, height: h };
}

/** Validate the complete PNG framing before a decoder allocates any pixel data. */
export function validateScreenshot(buffer: Buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 45 || buffer.length > captureLimits.screenshotBytes || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw limitError();
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') throw limitError();
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  // Chromium emits 8-bit noninterlaced RGB/RGBA. Interlaced PNGs would use an
  // unbounded inflate path in pngjs, and are not part of our capture protocol.
  if (!width || !height || width > captureLimits.width || height > captureLimits.height || width * height > captureLimits.pixels || buffer[24] !== 8 || ![2, 6].includes(buffer[25]) || buffer[26] || buffer[27] || buffer[28]) throw limitError();
  let cursor = 8, chunks = 0, sawData = false;
  while (cursor + 12 <= buffer.length && ++chunks <= 10000) {
    const length = buffer.readUInt32BE(cursor), type = buffer.toString('ascii', cursor + 4, cursor + 8);
    const end = cursor + 12 + length;
    if (end > buffer.length || (type === 'IHDR' && cursor !== 8)) throw limitError();
    if (type === 'IDAT') sawData = true;
    if (type === 'IEND') {
      if (length || !sawData || end !== buffer.length) throw limitError();
      return { width, height };
    }
    cursor = end;
  }
  throw limitError();
}

function string(value: unknown, max: number): asserts value is string {
  if (typeof value !== 'string' || value.length > max) throw limitError();
}
function strings(value: unknown, count: number, length: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length > count) throw limitError();
  for (const item of value) string(item, length);
}
export function validateMetadata(value: any) {
  if (!value || typeof value !== 'object') throw limitError();
  string(value.title, 500); string(value.text, captureLimits.text);
  strings(value.headings, captureLimits.headings, captureLimits.heading);
  strings(value.imageUrls, captureLimits.images, captureLimits.url);
  if (!Array.isArray(value.links) || value.links.length > captureLimits.links) throw limitError();
  for (const link of value.links) {
    if (!link || typeof link !== 'object') throw limitError();
    string(link.url, captureLimits.url); string(link.text, captureLimits.linkText);
  }
  // Validate individual fields first so serialization itself has a known bound.
  const metadata = { title: value.title, text: value.text, headings: value.headings, links: value.links, imageUrls: value.imageUrls };
  if (Buffer.byteLength(JSON.stringify(metadata)) > captureLimits.metadataBytes) throw limitError();
}
export function validateCaptureResult(value: any): asserts value is CaptureResult {
  validateMetadata(value);
  string(value.requestedUrl, captureLimits.url); string(value.finalUrl, captureLimits.url);
  string(value.capturedAt, 40);
  if (!Number.isFinite(Date.parse(value.capturedAt)) || !Number.isInteger(value.statusCode) || value.statusCode < 200 || value.statusCode >= 300) throw limitError();
  strings(value.warnings, captureLimits.warnings, captureLimits.warning);
  string(value.html, captureLimits.htmlBytes);
  if (!value.html.length || Buffer.byteLength(value.html) > captureLimits.htmlBytes) throw limitError();
  validateScreenshot(value.screenshot);
}
export function decodeCaptureResult(value: any): CaptureResult {
  if (!value || typeof value !== 'object') throw limitError();
  string(value.screenshot, Math.ceil(captureLimits.screenshotBytes / 3) * 4);
  if (value.screenshot.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.screenshot)) throw limitError();
  const result = { ...value, screenshot: Buffer.from(value.screenshot, 'base64') };
  validateCaptureResult(result);
  return result;
}
export function validateDiscoveryResult(value: any): asserts value is DiscoveryResult {
  if (!value || !Array.isArray(value.urls) || value.urls.length > 500) throw limitError();
  strings(value.warnings, captureLimits.warnings, captureLimits.warning);
  for (const item of value.urls) {
    if (!item || !['seed', 'sitemap', 'link'].includes(item.source)) throw limitError();
    string(item.url, captureLimits.url);
  }
}

/** Count the actual stream, including chunked bodies, before JSON.parse. */
export async function readWorkerJson(response: Response, maxBytes = captureLimits.workerBytes): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw limitError();
  let complete = false;
  try {
    const declared = response.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw limitError();
    const chunks: Buffer[] = []; let bytes = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) throw limitError();
      chunks.push(Buffer.from(part.value));
    }
    complete = true;
    try { return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
    catch { throw new CaptureError('Risposta del motore non valida.', 'INVALID_RESULT'); }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
