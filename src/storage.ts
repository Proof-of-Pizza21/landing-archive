import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync, readFileSync, statfsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, minFreeBytes } from './config.js';
import { get, run, id } from './db.js';

export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

export function storageStatus() {
  const fs = statfsSync(dataDir);
  return { freeBytes: fs.bavail * fs.bsize, totalBytes: fs.blocks * fs.bsize, minFreeBytes };
}

export function checkSpace(additional = 0) {
  if (storageStatus().freeBytes < minFreeBytes + additional) {
    throw Object.assign(new Error('Spazio insufficiente: le nuove acquisizioni sono sospese. Le versioni esistenti sono al sicuro.'), { code: 'DISK_FULL' });
  }
}

export function putObject(data: string | Buffer, kind: 'html' | 'png') {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const digest = hash(buffer);
  const existing = get('SELECT * FROM objects WHERE hash=?', digest);
  if (existing) return existing;
  checkSpace(buffer.length);
  const relative = `objects/${digest.slice(0, 2)}/${digest}.${kind}`;
  const target = join(dataDir, relative);
  mkdirSync(join(dataDir, 'objects', digest.slice(0, 2)), { recursive: true });
  const temporary = join(dataDir, 'tmp', id());
  try {
    writeFileSync(temporary, buffer, { mode: 0o600 });
    renameSync(temporary, target);
  } finally { try { unlinkSync(temporary); } catch {} }
  run('INSERT OR IGNORE INTO objects (hash,kind,bytes,path) VALUES (?,?,?,?)', digest, kind, buffer.length, relative);
  return get('SELECT * FROM objects WHERE hash=?', digest)!;
}

export function objectPath(digest: string) {
  const object = get('SELECT * FROM objects WHERE hash=?', digest);
  if (!object) throw new Error('File non trovato');
  return join(dataDir, object.path);
}

export const readObject = (digest: string) => readFileSync(objectPath(digest));

/** Remove only objects that no remaining version references, including shared files. */
export function removeUnusedObjects(hashes: string[]) {
  let deletedBytes = 0, pendingFiles = 0;
  for (const digest of new Set(hashes)) {
    const object = get(`SELECT * FROM objects o WHERE hash=? AND NOT EXISTS
      (SELECT 1 FROM versions v WHERE v.html_hash=o.hash OR v.screenshot_hash=o.hash)`, digest);
    if (!object) continue;
    try { unlinkSync(join(dataDir, object.path)); }
    catch (error: any) { if (error.code !== 'ENOENT') { pendingFiles++; continue; } }
    run('DELETE FROM objects WHERE hash=?', digest);
    deletedBytes += object.bytes;
  }
  return { deletedBytes, pendingFiles };
}
