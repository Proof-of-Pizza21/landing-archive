import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { validateScreenshot } from './capture-limits.js';

// This disposable process never imports the database or writes archive files.
process.once('message', (input: { left: Buffer; right: Buffer }) => {
  try {
    const left = validateScreenshot(input.left), right = validateScreenshot(input.right);
    let difference: number;
    if (left.width !== right.width || Math.abs(left.height - right.height) > 2) difference = 1;
    else if (left.height !== right.height) difference = 0.01;
    else {
      const width = Math.min(480, left.width), height = Math.min(6000, Math.ceil(left.height * width / left.width));
      const sample = (buffer: Buffer) => {
        const png = PNG.sync.read(buffer);
        const out = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const offset = (Math.floor(y * png.height / height) * png.width + Math.floor(x * png.width / width)) * 4;
          out.set(png.data.subarray(offset, offset + 4), (y * width + x) * 4);
        }
        return out;
      };
      difference = pixelmatch(sample(input.left), sample(input.right), undefined, width, height, { threshold: 0.2, includeAA: false }) / (width * height);
    }
    process.send?.({ difference }, () => process.exit(0));
  } catch { process.send?.({ error: true }, () => process.exit(1)); }
});
