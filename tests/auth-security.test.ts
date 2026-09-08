import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('matched routes require a session for every equivalent HTTP request target', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-auth-security-'));
  process.env.DATA_DIR = directory; process.env.SCHEDULER_ENABLED = 'false';
  const { createApp } = await import('../src/server.js');
  const { db, get } = await import('../src/db.js');
  const app = await createApp();
  app.get('/future-private', async () => ({ private: true }));
  try {
    const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'audit-user', password: 'temporary-test-password' } });
    const cookie = String(setup.headers['set-cookie']).split(';')[0];
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = (app.server.address() as { port: number }).port;
    const wire = (method: string, path: string, session = '') => new Promise<{ status: number; cache: string | undefined }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, method, path, headers: { ...(session ? { cookie: session } : {}), 'content-type': 'application/json' } }, response => {
        response.resume();
        response.once('end', () => resolve({ status: response.statusCode!, cache: response.headers['cache-control'] }));
      });
      req.setTimeout(3000, () => req.destroy(new Error('Local test timed out')));
      req.once('error', reject);
      req.end(['POST', 'PATCH'].includes(method) ? '{}' : undefined);
    });
    const routes = [
      ['GET', '/sites'], ['GET', '/dashboard'], ['GET', '/sites/fixture'],
      ['GET', '/pages/fixture'], ['GET', '/versions/fixture'],
      ['GET', '/versions/fixture/html'], ['HEAD', '/versions/fixture/html'],
      ['GET', '/versions/fixture/screenshot'], ['HEAD', '/versions/fixture/screenshot'],
      ['GET', '/compare?left=a&right=b'], ['GET', '/search?q=test'],
      ['GET', '/export'], ['GET', '/source'], ['POST', '/sites'],
      ['POST', '/sites/fixture/pages'], ['POST', '/sites/fixture/scan'],
      ['POST', '/pages/fixture/scan'], ['PATCH', '/sites/fixture'], ['PATCH', '/pages/fixture'],
    ];
    for (const prefix of ['/api', '/%61pi', '/a%70i', '/ap%69', 'http://example.test/api']) {
      for (const [method, suffix] of routes) {
        const result = await wire(method, prefix + suffix);
        assert.equal(result.status, 401, `${method} ${prefix}${suffix}`);
        assert.equal(result.cache, 'no-store');
      }
      assert.equal((await wire('GET', prefix + '/sites', cookie)).status, 200);
    }
    assert.equal((await wire('GET', '/future-private')).status, 401);
    assert.equal((await wire('GET', '/future-private', cookie)).status, 200);
    assert.equal((await wire('GET', '/api/health')).status, 200);
    assert.equal((await wire('GET', '/api/auth/status')).status, 200);
    assert.equal((await wire('GET', '/%61pi/export', 'landing_archive_session=invalid')).status, 401);
    assert.equal(get('SELECT COUNT(*) n FROM sites')!.n, 0);
    assert.equal(get('SELECT COUNT(*) n FROM jobs')!.n, 0);
    await wire('POST', '/api/auth/logout', cookie);
    assert.equal((await wire('GET', '/%61pi/sites', cookie)).status, 401);
  } finally { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
