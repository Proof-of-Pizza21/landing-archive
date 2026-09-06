import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';

const version = process.env.REQUESTED_VERSION;
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(process.env.REPOSITORY, 'Proof-of-Pizza21/landing-archive', 'Unexpected publication repository');
assert.match(version || '', /^0\.1\.0$/, 'Only the reviewed 0.1.0 preview is enabled');
assert.equal(pkg.version, version, 'Requested version differs from package.json');
assert.equal(pkg.author, 'Proof-of-Pizza21 <259956083+Proof-of-Pizza21@users.noreply.github.com>', 'Unexpected package author');
const ref = process.env.TRIGGER_REF;
assert.ok(ref === 'refs/heads/main' || ref === `refs/tags/v${version}`, 'Unexpected release ref');
assert.ok(process.env.GITHUB_ENV, 'This helper is intended for the release workflow');
appendFileSync(process.env.GITHUB_ENV, `RELEASE_VERSION=${version}\n`);
console.log(`Validated Landing Archive ${version}, linux/amd64 preview.`);
