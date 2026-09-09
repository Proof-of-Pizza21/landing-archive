import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('opening a previous archive preserves pending jobs while adding manual scheduling', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-migration-'));
  process.env.DATA_DIR = directory;
  const old = new DatabaseSync(join(directory, 'archive.sqlite'));
  old.exec(`CREATE TABLE jobs (id TEXT PRIMARY KEY,site_id TEXT NOT NULL,page_id TEXT,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT,available_at TEXT NOT NULL,lease_until TEXT,attempts INTEGER NOT NULL DEFAULT 0,error TEXT);
    INSERT INTO jobs(id,site_id,page_id,kind,created_at,available_at,attempts,error) VALUES('pending','site','page','capture','2026-09-01','2026-09-02',2,'Earlier error');
    PRAGMA user_version=1;`);
  old.close();
  const { db, get } = await import('../src/db.js');
  try {
    const job = get('SELECT * FROM jobs WHERE id=?', 'pending')!;
    assert.equal(job.status, 'queued'); assert.equal(job.attempts, 2);
    assert.equal(job.error, 'Earlier error'); assert.equal(job.available_at, '2026-09-02');
    assert.equal(job.manual, 0); assert.equal(get('PRAGMA user_version')!.user_version, 2);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
