import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = pathToFileURL(resolve('src/config.ts')).href;
function isolated(script: string, data: string, secret?: string) {
  const env = { ...process.env, DATA_DIR: data };
  if (secret) env.WORKER_TOKEN_FILE = secret; else delete env.WORKER_TOKEN_FILE;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
}

test('worker credential moves out of the archive without changing an existing token', () => {
  const root = mkdtempSync(join(tmpdir(), 'landing-worker-auth-'));
  const data = join(root, 'archive'), secret = join(root, 'worker-auth', 'worker-token');
  mkdirSync(data);
  const old = '1'.repeat(64), rotated = '2'.repeat(64);
  writeFileSync(join(data, 'worker-token'), old, { mode: 0o600 });
  const init = `import assert from 'node:assert/strict'; const c = await import(${JSON.stringify(config)}); assert.match(c.initializeData(), /^[a-f0-9]{64}$/);`;
  try {
    isolated(init, data, secret);
    assert.equal(readFileSync(secret, 'utf8'), old);
    assert.equal(statSync(secret).mode & 0o777, 0o600);
    assert.equal(statSync(join(root, 'worker-auth')).mode & 0o777, 0o700);
    writeFileSync(secret, rotated);
    isolated(init, data, secret);
    assert.equal(readFileSync(secret, 'utf8'), rotated, 'An upgrade must not overwrite a rotated dedicated token');
    assert.equal(readFileSync(join(data, 'worker-token'), 'utf8'), old, 'Legacy data remains unchanged for rollback');
    isolated(init, join(root, 'new-archive'), join(root, 'new-auth', 'worker-token'));
    assert.match(readFileSync(join(root, 'new-auth', 'worker-token'), 'utf8'), /^[a-f0-9]{64}$/);
    isolated(init, join(root, 'standalone'));
    assert.match(readFileSync(join(root, 'standalone', 'worker-token'), 'utf8'), /^[a-f0-9]{64}$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('worker runs with only its dedicated secret, never imports or initializes the archive, and sees rotation', () => {
  const root = mkdtempSync(join(tmpdir(), 'landing-worker-no-archive-'));
  const data = join(root, 'unavailable-archive'), secret = join(root, 'worker-token');
  writeFileSync(data, 'This is a regular file; a database cannot be opened here.');
  writeFileSync(secret, '3'.repeat(64));
  const worker = pathToFileURL(resolve('src/worker.ts')).href;
  try {
    isolated(`
      import assert from 'node:assert/strict';
      import { writeFileSync } from 'node:fs';
      const { createWorker } = await import(${JSON.stringify(worker)});
      const app = createWorker();
      try {
        assert.equal((await app.inject('/api/health')).statusCode, 200);
        assert.equal((await app.inject({ method: 'POST', url: '/capture', headers: { authorization: 'Bearer ' + '3'.repeat(64) }, payload: {} })).statusCode, 400);
        writeFileSync(process.env.WORKER_TOKEN_FILE, '4'.repeat(64));
        assert.equal((await app.inject({ method: 'POST', url: '/capture', headers: { authorization: 'Bearer ' + '3'.repeat(64) }, payload: {} })).statusCode, 401);
        assert.equal((await app.inject({ method: 'POST', url: '/capture', headers: { authorization: 'Bearer ' + '4'.repeat(64) }, payload: {} })).statusCode, 400);
      } finally { await app.close(); }
    `, data, secret);
    assert.equal(readFileSync(data, 'utf8'), 'This is a regular file; a database cannot be opened here.');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
