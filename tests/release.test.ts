import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('release validation accepts this package and rejects mismatched versions, repositories and refs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-release-'));
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const env = { ...process.env, REQUESTED_VERSION: version, REPOSITORY: 'Proof-of-Pizza21/landing-archive', TRIGGER_REF: `refs/tags/v${version}`, GITHUB_ENV: join(directory, 'output') };
  const run = (overrides = {}) => spawnSync(process.execPath, ['scripts/release-metadata.mjs'], { env: { ...env, ...overrides }, encoding: 'utf8' });
  try {
    const tagged = run(); assert.equal(tagged.status, 0, tagged.stderr);
    assert.equal(readFileSync(env.GITHUB_ENV, 'utf8'), `RELEASE_VERSION=${version}\n`);
    assert.equal(run({ TRIGGER_REF: 'refs/heads/main' }).status, 0);
    assert.notEqual(run({ REQUESTED_VERSION: '0.1.0' }).status, 0);
    assert.notEqual(run({ REQUESTED_VERSION: '1.0.0' }).status, 0);
    assert.notEqual(run({ REPOSITORY: 'outside/example' }).status, 0);
    assert.notEqual(run({ TRIGGER_REF: 'refs/heads/unreviewed' }).status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('release refuses stale image labels and worker versions before publication', () => {
  const directory = mkdtempSync(join(tmpdir(), 'landing-release-label-'));
  const packageText = readFileSync('package.json', 'utf8'), { version } = JSON.parse(packageText);
  const docker = readFileSync('Dockerfile', 'utf8'), worker = readFileSync('src/version.ts', 'utf8');
  mkdirSync(join(directory, 'src')); writeFileSync(join(directory, 'package.json'), packageText);
  const run = () => spawnSync(process.execPath, [resolve('scripts/release-metadata.mjs')], { cwd: directory, env: { ...process.env, REQUESTED_VERSION: version, REPOSITORY: 'Proof-of-Pizza21/landing-archive', TRIGGER_REF: `refs/tags/v${version}`, GITHUB_ENV: join(directory, 'output') }, encoding: 'utf8' });
  try {
    writeFileSync(join(directory, 'Dockerfile'), docker.replace(`version="${version}"`, 'version="0.1.0"')); writeFileSync(join(directory, 'src/version.ts'), worker);
    assert.notEqual(run().status, 0);
    writeFileSync(join(directory, 'Dockerfile'), docker); writeFileSync(join(directory, 'src/version.ts'), worker.replace(version, '0.1.0'));
    assert.notEqual(run().status, 0);
    writeFileSync(join(directory, 'src/version.ts'), worker); assert.equal(run().status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
