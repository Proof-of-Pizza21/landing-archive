import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, type Socket } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function eventually(condition: () => Promise<boolean> | boolean) {
  for (let attempt = 0; attempt < 300; attempt++) { if (await condition()) return; await tick(); }
  assert.fail('Expected local request lifecycle transition did not occur');
}

test('aborted request bodies do not block restore, while disconnected async mutations remain fenced', { timeout: 30000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-restore-abort-'));
  process.env.DATA_DIR = directory; process.env.MIN_FREE_GIB = '0'; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, run, get } = await import('../src/db.js');
  const app = await createApp();
  let started = deferred(), release = deferred(), finished = false, shouldThrow = false, returnReply = false, replyEarly = false;
  let loginStarted = deferred(), loginAborted = deferred();
  app.addHook('onRequest', async request => { if (request.routeOptions.url === '/api/auth/login') loginStarted.resolve(); });
  app.addHook('onRequestAbort', async request => { if (request.routeOptions.url === '/api/auth/login') loginAborted.resolve(); });
  app.post('/api/security-delayed-write', async (_request, reply) => {
    if (replyEarly) reply.send({ accepted: true });
    started.resolve(); await release.promise;
    run("INSERT OR REPLACE INTO settings VALUES ('abort_test', 'completed')");
    finished = true;
    if (shouldThrow) throw new Error('Test write failed after its asynchronous phase');
    return returnReply ? reply.send({ ok: true }) : { ok: true };
  });
  const sockets: Socket[] = [];
  let authorization = '';
  const call = (method: any, url: string, payload?: any, headers = {}) => app.inject({ method, url, payload, headers: { authorization, ...headers } });
  try {
    const setup = await call('POST', '/api/auth/setup', { username: 'archive-test', password: 'temporary-test-password' });
    assert.equal(setup.statusCode, 200, setup.body);
    authorization = `Bearer ${setup.json().token}`;
    const backup = (await call('GET', '/api/export')).rawPayload;
    async function prepare() {
      const upload = await call('POST', '/api/restore/uploads', { bytes: backup.length }); assert.equal(upload.statusCode, 200, upload.body);
      const id = upload.json().id;
      assert.equal((await call('PUT', `/api/restore/uploads/${id}?offset=0`, backup, { 'content-type': 'application/octet-stream' })).statusCode, 200);
      const verify = await call('POST', `/api/restore/uploads/${id}/verify`); assert.equal(verify.statusCode, 200, verify.body);
      return id;
    }
    const apply = (id: string) => call('POST', `/api/restore/uploads/${id}/apply`, { confirmId: id, password: 'temporary-test-password' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = (app.server.address() as { port: number }).port;
    async function wire(path: string, bodyBytes: number, body: string, authenticated = false) {
      const socket = connect(port, '127.0.0.1'); sockets.push(socket);
      await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
      socket.write(`POST ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n${authenticated ? `Authorization: ${authorization}\r\n` : ''}Content-Type: application/json\r\nContent-Length: ${bodyBytes}\r\nConnection: close\r\n\r\n${body}`);
      return socket;
    }
    await t.test('a public login interrupted during upload permits the next real restore without restart', async () => {
      const id = await prepare();
      const socket = await wire('/api/auth/login', 100, '{');
      await loginStarted.promise; socket.destroy(); await loginAborted.promise;
      const result = await apply(id); assert.equal(result.statusCode, 200, result.body);
      assert.equal((await call('GET', '/api/restore/status')).json().applying, false);
    });
    await t.test('disconnect cannot release a running write, and a pending body cannot begin during maintenance', async () => {
      const id = await prepare();
      const socket = await wire('/api/security-delayed-write', 2, '{}', true);
      await started.promise; socket.destroy();
      loginStarted = deferred();
      const body = JSON.stringify({ username: 'archive-test', password: 'temporary-test-password' });
      const slowLogin = await wire('/api/auth/login', Buffer.byteLength(body), body.slice(0, 1));
      await loginStarted.promise;
      let applied = false;
      const applying = Promise.resolve(apply(id)).then(result => { applied = true; return result; });
      await eventually(async () => (await call('GET', '/api/restore/status')).json().applying === true);
      const response = new Promise<string>(resolve => { let text = ''; slowLogin.on('data', data => { text += data.toString(); }); slowLogin.once('end', () => resolve(text)); });
      slowLogin.write(body.slice(1));
      assert.match(await response, /^HTTP\/1\.1 503 /, 'A body arriving across the maintenance boundary must not start a mutation');
      assert.equal(applied, false, 'Restore must wait until the disconnected async mutation finishes');
      assert.equal(finished, false);
      release.resolve();
      const result = await applying; assert.equal(result.statusCode, 200, result.body);
      assert.equal(finished, true); assert.equal(get("SELECT value FROM settings WHERE key='abort_test'")!.value, 'completed');
    });
    await t.test('returning a Fastify reply after disconnect releases the completed write', async () => {
      const id = await prepare();
      started = deferred(); release = deferred(); finished = false; returnReply = true;
      const socket = await wire('/api/security-delayed-write', 2, '{}', true);
      await started.promise; socket.destroy(); release.resolve();
      await eventually(() => finished);
      const result = await apply(id); assert.equal(result.statusCode, 200, result.body);
      returnReply = false;
    });
    await t.test('an early response does not release a mutation that is still running', async () => {
      const id = await prepare();
      started = deferred(); release = deferred(); finished = false; replyEarly = true;
      assert.equal((await call('POST', '/api/security-delayed-write', {})).statusCode, 200);
      let applied = false;
      const applying = Promise.resolve(apply(id)).then(result => { applied = true; return result; });
      await eventually(async () => (await call('GET', '/api/restore/status')).json().applying === true);
      await tick(); assert.equal(applied, false); assert.equal(finished, false);
      release.resolve();
      const result = await applying; assert.equal(result.statusCode, 200, result.body);
      assert.equal(finished, true); replyEarly = false;
    });
    await t.test('an async handler error also releases its write slot', async () => {
      started = deferred(); release = deferred(); finished = false; shouldThrow = true;
      const failing = Promise.resolve(call('POST', '/api/security-delayed-write', {}));
      await started.promise; release.resolve();
      assert.equal((await failing).statusCode, 500);
      const result = await apply(await prepare()); assert.equal(result.statusCode, 200, result.body);
    });
  } finally {
    release.resolve(); for (const socket of sockets) socket.destroy();
    await app.close(); db.close(); rmSync(directory, { recursive: true, force: true });
  }
});
