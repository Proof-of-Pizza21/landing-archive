import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';

export const dataDir = resolve(process.env.DATA_DIR || './data');
export const host = process.env.HOST || '127.0.0.1';
export const port = Number(process.env.PORT || 4310);
export const minFreeBytes = Number(process.env.MIN_FREE_GIB || 5) * 1024 ** 3;
export const workerUrl = process.env.CAPTURE_WORKER_URL || '';
export const schedulerEnabled = process.env.SCHEDULER_ENABLED !== 'false';

export function initializeData() {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(join(dataDir, 'objects'), { recursive: true, mode: 0o700 });
  mkdirSync(join(dataDir, 'tmp'), { recursive: true, mode: 0o700 });
  const secretPath = join(dataDir, 'worker-token');
  try { writeFileSync(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
  catch (error: any) { if (error.code !== 'EEXIST') throw error; }
  return readFileSync(secretPath, 'utf8').trim();
}

export function getWorkerToken() {
  return readFileSync(join(dataDir, 'worker-token'), 'utf8').trim();
}
