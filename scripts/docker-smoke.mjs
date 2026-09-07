import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

// Only public example.com is fetched. All account credentials and downloaded
// artifacts exist solely in a fresh temporary project and are never logged.
const image = process.env.PREVIEW_IMAGE || 'landing-archive:ci';
const project = `landing-archive-ci-${randomBytes(5).toString('hex')}`;
const temporary = await mkdtemp(join(tmpdir(), 'landing-archive-ci-'));
const composeFile = join(temporary, 'compose.json');
const base = 'http://127.0.0.1:4310';
let cookie = '';
let started = false;

function command(binary, args, { input, quiet = false, timeout = 180_000 } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`${binary} exceeded the test time limit`)); }, timeout);
    child.stdout.on('data', data => { stdout += data; if (!quiet) process.stdout.write(data); });
    child.stderr.on('data', data => { stderr += data; if (!quiet) process.stderr.write(data); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${binary} failed with status ${code}${quiet ? `: ${stderr.slice(-2000)}` : ''}`));
      else done(stdout);
    });
    child.stdin.end(input);
  });
}
const compose = (args, options) => command('docker', ['compose', '-p', project, '-f', composeFile, ...args], options);
const worker = script => compose(['exec', '-T', 'worker', 'node', '--input-type=module'], { input: script, quiet: true });
async function api(path, { method = 'GET', body, authenticated = true, expected = 200 } = {}) {
  const response = await fetch(base + path, {
    method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(authenticated && cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, expected, `${method} ${path}: unexpected status ${response.status}`);
  return response;
}
const json = async (path, options) => (await api(path, options)).json();
async function waitForCheck(pageId, count) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const result = await json(`/api/pages/${pageId}`);
    if (result.checks.length >= count) {
      assert.ok(['ok', 'unchanged'].includes(result.checks[0].status), `Public example capture failed: ${result.checks[0].status} (${result.checks[0].message})`);
      return result;
    }
    await delay(1500);
  }
  throw new Error('The public example capture did not complete within four minutes');
}
const check = message => console.log(`PASS ${message}`);

try {
  const configuration = JSON.parse(await command('docker', ['compose', '-f', 'compose.yaml', 'config', '--format', 'json'], { quiet: true }));
  configuration.name = project;
  for (const [name, service] of Object.entries(configuration.services)) {
    assert.ok(['web', 'worker'].includes(name), 'Unexpected service in smoke configuration');
    service.image = image;
    delete service.build;
    service.restart = 'no';
    assert.equal(service.read_only, true, `${name} root filesystem must remain read-only`);
    assert.equal(service.user, '1000:1000', `${name} must remain non-root`);
  }
  assert.ok(configuration.services.worker.volumes.some(volume => volume.target === '/data' && volume.read_only), 'Worker archive mount must be read-only');
  assert.ok(configuration.services.worker.security_opt.some(option => option.startsWith('seccomp=')), 'Worker must use the supplied Chromium seccomp profile');
  const seccomp = resolve('umbrel-community-store/proof-of-pizza21-landing-archive/seccomp-profile.json.template');
  await readFile(seccomp);
  configuration.services.worker.security_opt = configuration.services.worker.security_opt.map(option => option.startsWith('seccomp=') ? `seccomp=${seccomp}` : option);
  // Override resource names only: the shipped security, health and volume flags stay intact.
  for (const [name, value] of Object.entries(configuration.volumes || {})) value.name = `${project}_${name}`;
  for (const [name, value] of Object.entries(configuration.networks || {})) value.name = `${project}_${name}`;
  await writeFile(composeFile, JSON.stringify(configuration, null, 2), { mode: 0o600 });
  const metadata = JSON.parse(await command('docker', ['image', 'inspect', image], { quiet: true }))[0];
  assert.equal(metadata.Architecture, 'amd64');
  assert.equal(metadata.Os, 'linux');
  started = true;
  await compose(['up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180']);
  check('Linux amd64 image starts with the shipped container restrictions');

  await api('/api/dashboard', { authenticated: false, expected: 401 });
  assert.equal((await json('/api/auth/status', { authenticated: false })).setupRequired, true);
  const password = randomBytes(24).toString('base64url');
  const setup = await api('/api/auth/setup', { method: 'POST', body: { username: 'smoke-test', password }, authenticated: false });
  cookie = setup.headers.get('set-cookie')?.split(';')[0] || '';
  assert.ok(cookie, 'Setup must create an HttpOnly session');
  assert.match(setup.headers.get('set-cookie') || '', /httponly/i);
  assert.match(setup.headers.get('set-cookie') || '', /samesite=strict/i);
  await api('/api/auth/setup', { method: 'POST', body: { username: 'smoke-test', password }, expected: 409 });
  check('First-run setup and authenticated API access');

  for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/', 'http://[::1]/']) {
    await api('/api/sites', { method: 'POST', body: { name: 'Blocked internal target', url }, expected: 400 });
  }
  await worker(`
    import assert from 'node:assert/strict';
    import {readFileSync, writeFileSync} from 'node:fs';
    assert.equal(process.getuid(), 1000);
    assert.throws(() => writeFileSync('/data/smoke-must-not-write', 'x'), error => error.code === 'EROFS');
    const token = readFileSync('/data/worker-token', 'utf8').trim();
    const missing = await fetch('http://127.0.0.1:4311/capture', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://example.com/'})});
    assert.equal(missing.status, 401);
    for (const operation of ['capture','discover']) {
      const response = await fetch('http://127.0.0.1:4311/' + operation,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/'})});
      assert.equal(response.status,422);
      assert.equal((await response.json()).code,'BLOCKED_URL');
    }
    const malformed = await fetch('http://127.0.0.1:4311/capture',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'});
    assert.equal(malformed.status,400);
  `);
  check('SSRF blocked at web and worker APIs; worker authorization and read-only archive enforced');

  // Diagnose the actual sandbox before the app deliberately sanitizes browser
  // errors. This probe contains no credentials and opens no remote page.
  await worker(`
    import assert from 'node:assert/strict';
    import {chromium} from 'playwright';
    const browser = await chromium.launch({headless:true,chromiumSandbox:true});
    try {
      const page = await browser.newPage();
      await page.setContent('<title>Sandbox smoke test</title>');
      assert.equal(await page.title(), 'Sandbox smoke test');
    } finally {await browser.close();}
  `);
  check('Chromium starts and renders with its Linux sandbox enabled');

  const created = await json('/api/sites', { method: 'POST', body: { name: 'Public example smoke test', url: 'https://example.com/', kind: 'own', maxPages: 1, intervalHours: 24 }, expected: 201 });
  const siteId = created.site.id;
  const site = await json(`/api/sites/${siteId}`);
  assert.equal(site.pages.length, 1);
  const pageId = site.pages[0].id;
  const captured = await waitForCheck(pageId, 1);
  assert.equal(captured.versions.length, 1);
  const versionId = captured.versions[0].id;
  const screenshot = Buffer.from(await (await api(`/api/versions/${versionId}/screenshot`)).arrayBuffer());
  assert.equal(screenshot.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const htmlResponse = await api(`/api/versions/${versionId}/html`);
  assert.match(htmlResponse.headers.get('content-disposition') || '', /^attachment/);
  assert.match(htmlResponse.headers.get('content-security-policy') || '', /sandbox/);
  const html = await htmlResponse.text();
  assert.match(html, /Example Domain/i);
  assert.doesNotMatch(html, /<script(?:\s|>)/i);
  assert.match(html, /script-src (?:'|&#39;)none(?:'|&#39;)/);
  await worker(`
    import assert from 'node:assert/strict';
    import {chromium} from 'playwright';
    const browser = await chromium.launch({headless:true,chromiumSandbox:true});
    try {
      const context = await browser.newContext({offline:true,javaScriptEnabled:false});
      const page = await context.newPage();
      await page.setContent(Buffer.from(${JSON.stringify(Buffer.from(html).toString('base64'))},'base64').toString('utf8'));
      assert.match(await page.title(),/Example Domain/i);
      assert.match(await page.locator('body').innerText(),/Example Domain/i);
    } finally {await browser.close();}
  `);
  check(`Real example.com capture through the worker; PNG ${screenshot.length} bytes and static offline HTML ${Buffer.byteLength(html)} bytes`);

  await api(`/api/pages/${pageId}/scan`, { method: 'POST', body: {} });
  const repeated = await waitForCheck(pageId, 2);
  assert.equal(repeated.versions.length, 1, 'An unchanged page must not create a duplicate version');
  assert.equal(repeated.checks[0].status, 'unchanged');
  check('A second real scan records a check without duplicating the unchanged version');

  const zipPath = join(temporary, 'backup.zip');
  await writeFile(zipPath, Buffer.from(await (await api('/api/export')).arrayBuffer()), { mode: 0o600 });
  const names = (await command('unzip', ['-Z1', zipPath], { quiet: true })).trim().split('\n');
  assert.ok(names.includes('archive.sqlite') && names.includes('manifest.json'));
  assert.ok(names.some(name => name.startsWith('objects/')));
  assert.ok(names.every(name => !name.startsWith('/') && !name.split('/').includes('..')));
  assert.ok(names.every(name => !/worker-token|session|cookie/i.test(name)));
  const restored = join(temporary, 'backup-verification');
  await mkdir(restored);
  await command('unzip', ['-q', zipPath, '-d', restored], { quiet: true });
  const backup = new DatabaseSync(join(restored, 'archive.sqlite'), { readOnly: true });
  try {
    assert.equal(backup.prepare('SELECT COUNT(*) count FROM sessions').get().count, 0);
    assert.equal(backup.prepare('SELECT COUNT(*) count FROM versions').get().count, 1);
    for (const object of backup.prepare('SELECT hash,path FROM objects').all()) {
      const data = await readFile(join(restored, object.path));
      assert.equal(createHash('sha256').update(data).digest('hex'), object.hash);
    }
  } finally { backup.close(); }
  check('Backup ZIP has a consistent database, immutable objects and no live sessions/token');

  await compose(['restart', 'web', 'worker']);
  await compose(['up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180']);
  const persisted = await json(`/api/pages/${pageId}`);
  assert.equal(persisted.versions.length, 1);
  assert.equal(persisted.versions[0].id, versionId);
  assert.equal(persisted.checks.length, 2);
  assert.equal((await json('/api/auth/status')).authenticated, true);
  await api('/api/auth/logout', { method: 'POST', body: {} });
  await api('/api/dashboard', { expected: 401 });
  cookie = '';
  await api('/api/auth/login', { method: 'POST', body: { username: 'smoke-test', password }, authenticated: false });
  check('Archive, checks and login survive a service restart; logout revokes its session');
  console.log('Docker smoke test completed. No captured content or credentials will be uploaded.');
} finally {
  if (started) await compose(['down', '--volumes', '--remove-orphans'], { quiet: true }).catch(() => console.error('Could not remove the isolated smoke-test containers.'));
  await rm(temporary, { recursive: true, force: true });
}
