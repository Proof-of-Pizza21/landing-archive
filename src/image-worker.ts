import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { validateScreenshot, validateRectangles } from './capture-limits.js';
import type { VisualOptions } from './image-compare.js';

// Bounded, disposable decoder. Compare coordinates without stretching either
// image; small layout jitter is not itself evidence of a content change.
process.once('message', (input: { left: Buffer; right: Buffer; options?: VisualOptions }) => {
  try {
    const left = validateScreenshot(input.left), right = validateScreenshot(input.right);
    const ignored = input.options?.ignored || [], important = input.options?.important || [];
    validateRectangles(ignored, 600); validateRectangles(important, 600);
    const scale = Math.min(1, 480 / Math.max(left.width, right.width));
    const width = Math.ceil(Math.max(left.width, right.width) * scale);
    const height = Math.min(6000, Math.ceil(Math.max(left.height, right.height) * scale));
    const sample = (buffer: Buffer) => {
      const png = PNG.sync.read(buffer), out = new Uint8Array(width * height * 4); out.fill(255);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const sx = Math.floor(x / scale), sy = Math.floor(y / scale);
        if (sx < png.width && sy < png.height) {
          const offset = (sy * png.width + sx) * 4;
          out.set(png.data.subarray(offset, offset + 4), (y * width + x) * 4);
        }
      }
      return out;
    };
    const a = sample(input.left), b = sample(input.right);
    const mask = new Uint8Array(width * height), priority = new Uint8Array(width * height);
    const fill = (rects: typeof ignored, target: Uint8Array) => {
      for (const r of rects) for (let y = Math.max(0, Math.floor(r.y * scale)); y < Math.min(height, Math.ceil((r.y + r.height) * scale)); y++) {
        target.fill(1, y * width + Math.max(0, Math.floor(r.x * scale)), y * width + Math.min(width, Math.ceil((r.x + r.width) * scale)));
      }
    };
    fill(ignored, mask); fill(important, priority);
    // Important zones take precedence over a broader exclusion.
    for (let p = 0; p < mask.length; p++) if (mask[p] && !priority[p]) { a.fill(229, p * 4, p * 4 + 3); b.fill(229, p * 4, p * 4 + 3); }
    const diff = new Uint8Array(width * height * 4);
    pixelmatch(a, b, diff, width, height, { threshold: 0.2, includeAA: false, diffMask: true });
    const similarNearby = (from: Uint8Array, to: Uint8Array, x: number, y: number) => {
      const offset = (y * width + x) * 4;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const other = (ny * width + nx) * 4;
        if (Math.abs(from[offset] - to[other]) <= 35 && Math.abs(from[offset + 1] - to[other + 1]) <= 35 && Math.abs(from[offset + 2] - to[other + 2]) <= 35) return true;
      }
      return false;
    };
    let changed = 0, considered = 0, importantChanged = 0, importantPixels = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (mask[p] && !priority[p]) continue;
      const sx = x / scale, sy = y / scale;
      const outside = (sx >= left.width || sy >= left.height) !== (sx >= right.width || sy >= right.height);
      if (outside && Math.abs(left.width - right.width) <= 3 && Math.abs(left.height - right.height) <= 3) continue;
      considered++; if (priority[p]) importantPixels++;
      if (!outside && (!diff[p * 4 + 3] || (similarNearby(a, b, x, y) && similarNearby(b, a, x, y)))) continue;
      changed++; if (priority[p]) importantChanged++;
    }
    // Priority regions are evaluated against their own area, so a small CTA
    // image does not disappear in the denominator of a very long screenshot.
    const difference = Math.min(1, Math.max(changed / Math.max(1, considered), importantChanged / Math.max(1, importantPixels)));
    process.send?.({ difference }, () => process.exit(0));
  } catch { process.send?.({ error: true }, () => process.exit(1)); }
});
