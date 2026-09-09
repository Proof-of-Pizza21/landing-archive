import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { ZipArchive } from 'archiver';
import type { CaptureResult } from '../src/types.js';

test('manual controls and deletion preserve queue, archive and backup integrity', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-actions-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false'; process.env.CAPTURE_WORKER_URL = 'http://worker:4311';
  const { createApp } = await import('../src/server.js');
  const { db, get, all, run, now, later, enqueue } = await import('../src/db.js');
  const { processNextJob } = await import('../src/jobs.js');
  const { recordCapture } = await import('../src/history.js');
  const { objectPath, readObject } = await import('../src/storage.js');
  const app = await createApp();
  const png = new PNG({ width: 8, height: 8 }); png.data.fill(255);
  const image = PNG.sync.write(png);
  const capture = (url: string, text = 'Shared'): CaptureResult => ({ requestedUrl: url, finalUrl: url, statusCode: 200, title: text, text, html: `<html>${text}</html>`, screenshot: image, links: [], headings: [], imageUrls: [], warnings: [], capturedAt: now() });
  const response = (url: string, text?: string) => new Response(JSON.stringify({ ...capture(url, text), screenshot: image.toString('base64') }));
  let blocked: ((value: Response) => void) | undefined;
  let stall = false;
  const visited: string[] = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const input = JSON.parse(options.body); visited.push(input.url);
    if (stall) return new Promise<Response>(resolve => { blocked = resolve; });
    return response(input.url);
  });
  let session = '';
  const call = (method: any, url: string, payload?: unknown, headers = {}) => app.inject({ method, url, payload, headers: { cookie: session, ...headers } });
  const spinUntil = async (predicate: () => boolean) => { for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(predicate()); };
  try {
    const setup = await call('POST', '/api/auth/setup', { username: 'test-user', password: 'temporary-test-password' });
    session = String(setup.headers['set-cookie']).split(';')[0];
    const a = (await call('POST', '/api/sites', { name: 'Site A', url: 'https://1.1.1.1/', maxPages: 1 })).json().site;
    const b = (await call('POST', '/api/sites', { name: 'Site B', url: 'https://8.8.8.8/', maxPages: 1 })).json().site;
    const pageA = get('SELECT * FROM pages WHERE site_id=?', a.id)!;
    const pageB = get('SELECT * FROM pages WHERE site_id=?', b.id)!;

    await t.test('manual check advances a delayed retry, takes priority and runs while paused', async () => {
      run('UPDATE sites SET paused=1 WHERE id=?', a.id);
      run("UPDATE jobs SET available_at=?,attempts=2,error='Old failure' WHERE site_id=?", later(10), a.id);
      run('UPDATE jobs SET created_at=? WHERE site_id=?', later(-1), b.id);
      const manual = await call('POST', `/api/sites/${a.id}/scan`, { force: true });
      assert.equal(manual.statusCode, 200);
      const job = get("SELECT * FROM jobs WHERE site_id=? AND status='queued'", a.id)!;
      assert.equal(job.manual, 1); assert.equal(job.attempts, 0); assert.equal(job.error, null);
      assert.ok(Date.parse(job.available_at) <= Date.now());
      await processNextJob();
      assert.equal(visited[0], a.url); assert.equal(get('SELECT paused FROM sites WHERE id=?', a.id)!.paused, 1);
      assert.equal(get('SELECT COUNT(*) n FROM versions WHERE page_id=?', pageA.id)!.n, 1);
      await processNextJob();
      assert.equal(visited[1], b.url);
      const va = get('SELECT * FROM versions WHERE page_id=?', pageA.id)!;
      const vb = get('SELECT * FROM versions WHERE page_id=?', pageB.id)!;
      assert.equal(va.html_hash, vb.html_hash); assert.equal(va.screenshot_hash, vb.screenshot_hash);
    });

    await t.test('restart releases a stalled job, deduplicates new requests and rejects its late result', async () => {
      await call('POST', `/api/pages/${pageA.id}/scan`, { force: true }); stall = true;
      const old = processNextJob(); await spinUntil(() => !!blocked);
      const oldId = get("SELECT id FROM jobs WHERE status='running'")!.id;
      const before = get('SELECT COUNT(*) n FROM versions')!.n;
      const restarted = await call('POST', `/api/pages/${pageA.id}/scan`, { force: true });
      assert.equal(restarted.statusCode, 200); await old;
      assert.equal(get('SELECT status FROM jobs WHERE id=?', oldId)!.status, 'cancelled');
      assert.equal(get("SELECT COUNT(*) n FROM checks WHERE status='cancelled'")!.n, 1);
      await Promise.all([call('POST', `/api/pages/${pageA.id}/scan`, { force: true }), call('POST', `/api/pages/${pageA.id}/scan`, { force: true })]);
      assert.equal(get("SELECT COUNT(*) n FROM jobs WHERE status='queued' AND page_id=?", pageA.id)!.n, 1);
      stall = false; blocked!(response(a.url, 'Late obsolete result')); blocked = undefined;
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, before);
      await processNextJob();
      assert.equal(get("SELECT COUNT(*) n FROM jobs WHERE status IN ('queued','running')")!.n, 0);
    });

    await t.test('deletion needs authentication, same-origin and explicit matching confirmation', async () => {
      assert.equal((await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: a.id }, { cookie: '' })).statusCode, 401);
      assert.equal((await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: a.id }, { origin: 'https://outside.example' })).statusCode, 403);
      assert.equal((await call('DELETE', `/api/sites/${a.id}`, {})).statusCode, 400);
      assert.equal((await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: b.id })).statusCode, 400);
      assert.ok(get('SELECT id FROM sites WHERE id=?', a.id));
    });

    await t.test('deletion waits for an active backup without altering its source files', async () => {
      const finalize = ZipArchive.prototype.finalize;
      let archive: ZipArchive | undefined, release: (() => void) | undefined;
      const finalizeMock = mock.method(ZipArchive.prototype, 'finalize', function(this: ZipArchive) {
        archive = this; return new Promise<void>(resolve => { release = resolve; });
      });
      const backup = call('GET', '/api/export');
      // app.inject starts lazily when consumed as a promise.
      const result = Promise.resolve(backup);
      try {
        await spinUntil(() => !!archive);
        const deletion = await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: a.id });
        assert.equal(deletion.statusCode, 409); assert.match(deletion.json().error, /backup/);
        assert.ok(get('SELECT id FROM sites WHERE id=?', a.id));
        await finalize.call(archive!); release!();
        assert.equal((await result).statusCode, 200);
      } finally { finalizeMock.mock.restore(); }
    });

    await t.test('deleting a running site removes only its data, prevents resurrection and preserves shared files', async () => {
      await recordCapture(get('SELECT * FROM pages WHERE id=?', pageA.id)!, get('SELECT * FROM sites WHERE id=?', a.id)!, capture(a.url, 'Only site A'));
      const unique = get("SELECT html_hash FROM versions WHERE title='Only site A'")!.html_hash;
      const uniquePath = objectPath(unique);
      const shared = get('SELECT html_hash,screenshot_hash FROM versions WHERE page_id=?', pageB.id)!;
      await call('POST', `/api/pages/${pageA.id}/scan`, { force: true }); stall = true;
      const old = processNextJob(); await spinUntil(() => !!blocked);
      const deletion = await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: a.id });
      assert.equal(deletion.statusCode, 200); assert.equal(deletion.json().pendingFiles, 0);
      assert.ok(deletion.json().deletedBytes > 0); await old;
      assert.equal(existsSync(uniquePath), false);
      assert.ok(readObject(shared.html_hash).length); assert.ok(readObject(shared.screenshot_hash).length);
      stall = false; blocked!(response(a.url, 'Late deleted site')); blocked = undefined;
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(get('SELECT COUNT(*) n FROM sites')!.n, 1);
      assert.equal(get('SELECT COUNT(*) n FROM pages')!.n, 1);
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 1);
      assert.equal(get('SELECT COUNT(*) n FROM jobs WHERE site_id=?', a.id)!.n, 0);
      assert.deepEqual(all('PRAGMA foreign_key_check'), []);
      assert.equal((await call('GET', `/api/pages/${pageA.id}`)).statusCode, 404);
      assert.equal((await call('DELETE', `/api/sites/${a.id}`, { confirmSiteId: a.id })).statusCode, 404);
      assert.equal((await call('DELETE', `/api/sites/${b.id}`, { confirmSiteId: b.id })).statusCode, 200);
      assert.equal(get('SELECT COUNT(*) n FROM objects')!.n, 0);
      assert.deepEqual(all('PRAGMA foreign_key_check'), []);
    });
  } finally { fetchMock.mock.restore(); await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
