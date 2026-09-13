import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
