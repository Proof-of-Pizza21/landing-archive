import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { validateScreenshot } from './capture-limits.js';
import { CaptureError } from './network.js';

export async function visualDifference(left: Buffer, right: Buffer): Promise<number> {
  validateScreenshot(right);
  // Old oversized captures remain downloadable. Establish a new safe baseline
  // rather than decoding an unbounded legacy image or repeatedly retrying it.
  try { validateScreenshot(left); } catch { return 1; }
  if (left.equals(right)) return 0;
  const built = new URL('./image-worker.js', import.meta.url);
  const production = existsSync(built);
  const child = fork(production ? built : new URL('./image-worker.ts', import.meta.url), [], {
    execArgv: ['--max-old-space-size=128', ...(production ? [] : ['--import', 'tsx'])],
    serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value?: number) => {
      if (settled) return;
      settled = true; clearTimeout(timer); child.kill('SIGKILL');
      if (value === undefined) reject(new CaptureError('Confronto immagine interrotto entro i limiti di sicurezza.', 'IMAGE_LIMIT'));
      else resolve(value);
    };
    // A parent deadline remains runnable even when PNG decoding is synchronous.
    const timer = setTimeout(() => finish(), 5000);
    child.once('message', (message: any) => finish(typeof message?.difference === 'number' && Number.isFinite(message.difference) && message.difference >= 0 && message.difference <= 1 ? message.difference : undefined));
    child.once('error', () => finish()); child.once('exit', () => finish());
    child.send({ left, right }, error => { if (error) finish(); });
  });
}
