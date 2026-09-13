import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { validateScreenshot } from './capture-limits.js';

export type Region = { x: number; y: number; width: number; height: number };
export type VisualRegions = {
  width: number; height: number;
  left: { width: number; height: number }; right: { width: number; height: number };
  difference: number; regions: Region[]; grouped: boolean;
};
const unavailable = () => Object.assign(new Error('Evidenziazione non disponibile entro i limiti di sicurezza. Puoi comunque consultare le copie originali e il confronto del contenuto.'), { statusCode: 422 });

export async function locateVisualChanges(left: Buffer, right: Buffer, signal?: AbortSignal): Promise<VisualRegions> {
  signal?.throwIfAborted();
  let a: { width: number; height: number }, b: { width: number; height: number };
  try { a = validateScreenshot(left); b = validateScreenshot(right); } catch { throw unavailable(); }
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height);
  if (left.equals(right)) return { width, height, left: a, right: b, difference: 0, regions: [], grouped: false };
  const built = new URL('./image-regions-worker.js', import.meta.url), production = existsSync(built);
  const child = fork(production ? built : new URL('./image-regions-worker.ts', import.meta.url), [], {
    execArgv: ['--max-old-space-size=128', ...(production ? [] : ['--import', 'tsx'])],
    serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value?: VisualRegions) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); child.kill('SIGKILL');
      if (value) resolve(value); else reject(unavailable());
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish(), 5000);
    signal?.addEventListener('abort', abort, { once: true });
    child.once('message', (message: any) => {
      if (!message || !Number.isFinite(message.difference) || message.difference < 0 || message.difference > 1 || typeof message.grouped !== 'boolean' || !Array.isArray(message.regions) || message.regions.length > 100) return finish();
      for (const r of message.regions) {
        if (!r || ![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > width || r.y + r.height > height) return finish();
      }
      finish({ width, height, left: a, right: b, difference: message.difference, regions: message.regions, grouped: message.grouped });
    });
    child.once('error', () => finish()); child.once('exit', () => finish());
    if (signal?.aborted) return finish();
    child.send({ left, right }, error => { if (error) finish(); });
  });
}
