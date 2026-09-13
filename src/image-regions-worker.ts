import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { validateScreenshot } from './capture-limits.js';
import type { Region } from './image-regions.js';

// Bounded, disposable decoder. No database, archive writes or network access.
process.once('message', (input: { left: Buffer; right: Buffer }) => {
  try {
    const a = validateScreenshot(input.left), b = validateScreenshot(input.right);
    const originalWidth = Math.max(a.width, b.width), originalHeight = Math.max(a.height, b.height);
    // Same sampling as the detector for equal-size images. Unequal sizes share
    // an origin and scale: stretching each page would hide or invent shifts.
    const width = Math.min(480, originalWidth), height = Math.min(6000, Math.ceil(originalHeight * width / originalWidth));
    const sample = (buffer: Buffer) => {
      const png = PNG.sync.read(buffer), out = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const px = Math.floor(x * originalWidth / width), py = Math.floor(y * originalHeight / height);
        if (px < png.width && py < png.height) out.set(png.data.subarray((py * png.width + px) * 4, (py * png.width + px) * 4 + 4), (y * width + x) * 4);
      }
      return out;
    };
    const left = sample(input.left), right = sample(input.right), mask = new Uint8Array(width * height * 4);
    let different = pixelmatch(left, right, mask, width, height, { threshold: 0.2, includeAA: false, diffMask: true });
    // Missing parts are changes even when the remaining pixels are pure white.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const px = Math.floor(x * originalWidth / width), py = Math.floor(y * originalHeight / height);
      if ((px < a.width && py < a.height) !== (px < b.width && py < b.height)) {
        const offset = (y * width + x) * 4 + 3;
        if (!mask[offset]) { mask[offset] = 255; different++; }
      }
    }
    const tile = 12, columns = Math.ceil(width / tile), rows = Math.ceil(height / tile);
    const cells = new Uint8Array(columns * rows);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (mask[(y * width + x) * 4 + 3]) cells[Math.floor(y / tile) * columns + Math.floor(x / tile)] = 1;
    }
    const regions: Region[] = [];
    for (let seed = 0; seed < cells.length; seed++) {
      if (!cells[seed]) continue;
      const queue = [seed]; cells[seed] = 0;
      let x0 = width, y0 = height, x1 = 0, y1 = 0;
      for (let i = 0; i < queue.length; i++) {
        const index = queue[i], x = index % columns, y = Math.floor(index / columns);
        x0 = Math.min(x0, x * tile); y0 = Math.min(y0, y * tile);
        x1 = Math.max(x1, Math.min(width, (x + 1) * tile)); y1 = Math.max(y1, Math.min(height, (y + 1) * tile));
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * columns + nx;
          if (nx >= 0 && nx < columns && ny >= 0 && ny < rows && cells[next]) { cells[next] = 0; queue.push(next); }
        }
      }
      const x = Math.floor(x0 * originalWidth / width), y = Math.floor(y0 * originalHeight / height);
      regions.push({ x, y, width: Math.ceil(x1 * originalWidth / width) - x, height: Math.ceil(y1 * originalHeight / height) - y });
    }
    // A thin added edge can fall between sampled pixels. Still locate it without
    // pretending the detector's dimension heuristic is a measured percentage.
    const addEdge = (edge: Region) => {
      if (!regions.some(r => r.x <= edge.x && r.y <= edge.y && r.x + r.width >= edge.x + edge.width && r.y + r.height >= edge.y + edge.height)) regions.push(edge);
    };
    if (a.width !== b.width) addEdge({ x: Math.min(a.width, b.width), y: 0, width: Math.abs(a.width - b.width), height: originalHeight });
    if (a.height !== b.height) addEdge({ x: 0, y: Math.min(a.height, b.height), width: originalWidth, height: Math.abs(a.height - b.height) });
    regions.sort((l, r) => l.y - r.y || l.x - r.x);
    const grouped = regions.length > 100;
    if (grouped) {
      const tail = regions.splice(99), x = Math.min(...tail.map(r => r.x)), y = Math.min(...tail.map(r => r.y));
      regions.push({ x, y, width: Math.max(...tail.map(r => r.x + r.width)) - x, height: Math.max(...tail.map(r => r.y + r.height)) - y });
    }
    process.send?.({ difference: different / (width * height), regions, grouped }, () => process.exit(0));
  } catch { process.send?.({ error: true }, () => process.exit(1)); }
});
