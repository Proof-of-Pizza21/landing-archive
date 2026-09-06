import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

test('persistent job queue retries, pause, lease recovery and remote worker protocol', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-jobs-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.CAPTURE_WORKER_URL = 'http://worker:4311';
  const { db, get, all, run, id, now, later, addPage, enqueue } = await import('../src/db.js');
  const { scheduleDue, processNextJob, stopJobs, startJobs } = await import('../src/jobs.js');
  const siteId = id();
  run('INSERT INTO sites (id,name,url,max_pages,next_discovery_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', siteId, 'Example', 'https://example.com/', 1, later(24), now(), now());
  const { page } = addPage(siteId, 'https://example.com/');
  const png = new PNG({ width: 5, height: 5 }); png.data.fill(255);
  let fail = false, requests = 0;
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    requests++;
    assert.match(options.headers.Authorization, /^Bearer [a-f0-9]{64}$/);
    const input = JSON.parse(options.body); assert.equal(input.url, 'https://example.com/');
    if (fail) return new Response(JSON.stringify({ error: 'Temporary site outage', code: 'HTTP_ERROR', statusCode: 503 }), { status: 422 });
    return new Response(JSON.stringify({ requestedUrl: input.url, finalUrl: input.url, statusCode: 200, title: 'Test', text: 'Test', links: [], headings: [], imageUrls: [], html: '<html>Test</html>', screenshot: PNG.sync.write(png).toString('base64'), capturedAt: now(), warnings: [] }));
  });
  try {
    await t.test('due pages queue once, and a remote capture commits before completion', async () => {
      scheduleDue(); scheduleDue(); assert.equal(get("SELECT COUNT(*) n FROM jobs WHERE status='queued'")!.n, 1);
      await processNextJob();
      assert.equal(requests, 1); assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 1);
      assert.equal(get('SELECT status FROM jobs')!.status, 'done');
      assert.ok(Date.parse(get('SELECT next_check_at FROM pages')!.next_check_at) > Date.now());
    });
    await t.test('temporary failures retain old version and record each attempt, then recover', async () => {
      fail = true; enqueue(siteId, page.id, 'capture'); await processNextJob();
      let pending = get("SELECT * FROM jobs WHERE status='queued'")!;
      assert.equal(pending.attempts, 1); assert.ok(Date.parse(pending.available_at) > Date.now());
      assert.equal(get('SELECT COUNT(*) n FROM checks')!.n, 2);
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 1);
      run('UPDATE jobs SET available_at=? WHERE id=?', now(), pending.id); fail = false;
      await processNextJob();
      assert.equal(get('SELECT status FROM jobs WHERE id=?', pending.id)!.status, 'done');
      assert.equal(get('SELECT COUNT(*) n FROM versions')!.n, 1);
      assert.equal(get("SELECT COUNT(*) n FROM events WHERE kind='recovered'")!.n, 1);
    });
    await t.test('pause prevents scheduling and execution; restart resumes one interrupted job', async () => {
      run('UPDATE sites SET paused=1 WHERE id=?', siteId); run('UPDATE pages SET next_check_at=?', now());
      scheduleDue(); assert.equal(get("SELECT COUNT(*) n FROM jobs WHERE status='queued'")!.n, 0);
      const jobId = enqueue(siteId, page.id, 'capture')!;
      const before = requests; await processNextJob(); assert.equal(requests, before);
      run("UPDATE jobs SET status='running',lease_until=? WHERE id=?", later(1), jobId);
      run('UPDATE sites SET paused=0 WHERE id=?', siteId);
      startJobs();
      for (let n = 0; n < 50 && get('SELECT status FROM jobs WHERE id=?', jobId)!.status !== 'done'; n++) await new Promise(resolve => setTimeout(resolve, 10));
      await stopJobs();
      assert.equal(get('SELECT status FROM jobs WHERE id=?', jobId)!.status, 'done');
      assert.equal(requests, before + 1);
      assert.equal(all("SELECT * FROM jobs WHERE status IN ('queued','running')").length, 0);
    });
  } finally { await stopJobs(); fetchMock.mock.restore(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
