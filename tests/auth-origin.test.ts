import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

test('origin sessions reject all legacy cookies and native-resource tickets are narrowly scoped and revocable', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-auth-origin-'));
  process.env.DATA_DIR = directory; process.env.SCHEDULER_ENABLED = 'false';
  const { db, run, get, now } = await import('../src/db.js');
  const { registerAuth, passwordHash } = await import('../src/auth.js');
  const legacy = 'a'.repeat(64), digest = (value: string) => createHash('sha256').update(value).digest('hex');
  run('INSERT INTO users VALUES (?,?,?,?)', 'owner', 'local-owner', passwordHash('temporary-test-password'), now());
  run('INSERT INTO sessions VALUES (?,?,?)', digest(legacy), 'owner', '2099-01-01T00:00:00.000Z');
  const app = Fastify(); await app.register(cookie); registerAuth(app);
  app.get('/api/sites', async () => ({ private: true }));
  app.get('/api/versions/:id/screenshot', async () => 'private-image');
  app.get('/api/versions/:id/offline/html', async () => '<p>Archived page</p>');
  app.get('/api/export', async () => 'private-backup');
  let credential = '';
  const call = (method: 'GET' | 'HEAD' | 'POST', url: string, payload?: unknown, authorization = credential) => app.inject({ method, url, payload, headers: authorization ? { authorization } : {} });
  const ticketFor = async (path: string) => {
    const response = await call('POST', '/api/auth/resource-ticket', { path });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['cache-control'], 'no-store');
    return response.json().url as string;
  };
  try {
    await t.test('migration preserves the account but invalidates the old session permanently', async () => {
      assert.equal(get('SELECT COUNT(*) n FROM sessions')!.n, 0);
      const status = await app.inject({ method: 'GET', url: '/api/auth/status', headers: { cookie: `landing_archive_session=${legacy}` } });
      assert.deepEqual(status.json(), { setupRequired: false, authenticated: false });
      assert.match(String(status.headers['set-cookie']), /landing_archive_session=;/);
      for (const headers of [{ cookie: `landing_archive_session=${legacy}` }, { authorization: `Bearer ${legacy}` }]) {
        assert.equal((await app.inject({ method: 'GET', url: '/api/sites', headers })).statusCode, 401);
      }
      const response = await call('POST', '/api/auth/login', { username: 'local-owner', password: 'temporary-test-password' });
      assert.match(response.json().token, /^la2_[a-f0-9]{64}$/);
      assert.equal(response.headers['set-cookie'], undefined);
      credential = `Bearer ${response.json().token}`;
      assert.equal((await call('GET', '/api/sites')).statusCode, 200);
      const hash = get('SELECT hash FROM sessions')!.hash;
      assert.match(hash, /^v2:[a-f0-9]{64}$/); assert.ok(!hash.includes(response.json().token));
      assert.equal((await app.inject({ method: 'GET', url: '/api/sites', headers: { cookie: `landing_archive_session=${response.json().token}` } })).statusCode, 401);
      assert.equal((await call('GET', `/api/sites?token=${response.json().token}`, undefined, '')).statusCode, 401);
    });
    await t.test('tickets only authorize their exact read-only resource and never the general API', async () => {
      const url = await ticketFor('/api/versions/fixture/screenshot');
      assert.ok(!url.includes(credential.slice(7)));
      const ok = await call('GET', url, undefined, '');
      assert.equal(ok.statusCode, 200); assert.equal(ok.body, 'private-image');
      assert.equal(ok.headers['cache-control'], 'no-store'); assert.equal(ok.headers['referrer-policy'], 'no-referrer');
      assert.equal((await call('GET', url, undefined, '')).statusCode, 200, 'native resource may reload before expiry');
      for (const denied of [url.replace('fixture', 'another'), url.replace('/screenshot', '/html'), url.replace('/api/', '/%61pi/'), url + '&extra=1', url + '&access_ticket=' + url.split('=').at(-1), '/api/sites?' + url.split('?')[1]]) {
        assert.equal((await call('GET', denied, undefined, '')).statusCode, 401, denied);
      }
      assert.equal((await call('HEAD', url, undefined, '')).statusCode, 401);
      assert.equal((await call('POST', url, {}, '')).statusCode, 401);
      assert.equal((await call('POST', '/api/auth/resource-ticket', { path: '/api/export' }, '')).statusCode, 401);
      for (const path of ['/api/sites', '/api/auth/status', '/api/export?x=1', '/api/versions/x/screenshot?access_ticket=x', '/api/versions/x/../fixture/screenshot', '/api/versions/%66ixture/screenshot', '/api/versions/fixture/offline/html?at=invalid', '/api/export#x', '//outside.example/api/export', 'https://outside.example/api/export']) {
        assert.equal((await call('POST', '/api/auth/resource-ticket', { path })).statusCode, 400, path);
      }
    });
    await t.test('offline dates cannot be changed or duplicated and tickets expire in one minute', async () => {
      const path = '/api/versions/fixture/offline/html?at=2026-09-01T10%3A00%3A00.000Z';
      const url = await ticketFor(path);
      assert.equal((await call('GET', url, undefined, '')).statusCode, 200);
      for (const changed of [url.replace('09-01', '09-02'), url.replace('10%3A00', '10:00'), url + '&at=2026-09-01T10%3A00%3A00.000Z']) assert.equal((await call('GET', changed, undefined, '')).statusCode, 401);
      const realNow = Date.now;
      Date.now = () => realNow() + 60_001;
      try { assert.equal((await call('GET', url, undefined, '')).statusCode, 401); } finally { Date.now = realNow; }
    });
    await t.test('ticket store is bounded and superseded oldest URLs are rejected', async () => {
      const old = await ticketFor('/api/export');
      let fresh = '';
      for (let i = 0; i < 2048; i++) fresh = await ticketFor('/api/export');
      assert.equal((await call('GET', old, undefined, '')).statusCode, 401);
      assert.equal((await call('GET', fresh, undefined, '')).statusCode, 200);
    });
    await t.test('other ports cannot mint tickets and logout revokes tickets immediately', async () => {
      const url = await ticketFor('/api/export');
      const crossPort = await app.inject({ method: 'POST', url: '/api/auth/resource-ticket', payload: { path: '/api/export' }, headers: { authorization: credential, host: 'umbrel.test:3131', origin: 'http://umbrel.test:3132' } });
      assert.equal(crossPort.statusCode, 403);
      await call('POST', '/api/auth/logout', {});
      assert.equal((await call('GET', url, undefined, '')).statusCode, 401);
      assert.equal((await call('GET', '/api/sites')).statusCode, 401);
      assert.equal(get('SELECT COUNT(*) n FROM sessions')!.n, 0);
    });
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
