import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';

export const dataDir = resolve(process.env.DATA_DIR || './data');
export const workerTokenFile = resolve(process.env.WORKER_TOKEN_FILE || join(dataDir, 'worker-token'));
export const host = process.env.HOST || '127.0.0.1';
export const port = Number(process.env.PORT || 4310);
export const minFreeBytes = Number(process.env.MIN_FREE_GIB || 5) * 1024 ** 3;
export const workerUrl = process.env.CAPTURE_WORKER_URL || '';
export const schedulerEnabled = process.env.SCHEDULER_ENABLED !== 'false';

export function initializeData() {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(join(dataDir, 'objects'), { recursive: true, mode: 0o700 });
  mkdirSync(join(dataDir, 'tmp'), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(workerTokenFile), { recursive: true, mode: 0o700 });
  // Upgrades retain the existing credential when moving it out of the archive.
  // Only the coordinator initializes secrets; a worker must never create /data.
  let token: string;
  try { token = getWorkerToken(); }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    const previous = join(dataDir, 'worker-token');
    try { token = readToken(previous); }
    catch (legacyError: any) { if (legacyError.code !== 'ENOENT') throw legacyError; token = randomBytes(32).toString('hex'); }
  }
  try { writeFileSync(workerTokenFile, token, { flag: 'wx', mode: 0o600 }); }
  catch (error: any) { if (error.code !== 'EEXIST') throw error; }
  return getWorkerToken();
}

function readToken(path: string) {
  const token = readFileSync(path, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Credenziale del motore non valida');
  return token;
}

export function getWorkerToken() {
  return readToken(workerTokenFile);
}
