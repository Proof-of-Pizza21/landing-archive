import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yauzl from 'yauzl';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64', 'The published Umbrel image targets amd64');
const release = JSON.parse(await readFile(new URL('./browser-release.json', import.meta.url), 'utf8'));
assert.match(release.version, /^\d+\.\d+\.\d+\.\d+$/);
assert.match(release.sha256, /^[a-f0-9]{64}$/);
const prefix = 'chrome-headless-shell-linux64/';
assert.equal(release.url, `https://storage.googleapis.com/chrome-for-testing-public/${release.version}/linux64/${prefix.slice(0, -1)}.zip`);
const destination = resolve(process.argv[2] || '/opt/landing-browser');
const temporary = await mkdtemp(join(tmpdir(), 'landing-browser-install-'));
const archive = join(temporary, 'browser.zip');
try {
  const response = await fetch(release.url, { redirect: 'error', signal: AbortSignal.timeout(180_000) });
  assert.equal(response.status, 200, 'Official browser download failed');
  const source = Readable.fromWeb(response.body);
  let bytes = 0;
  source.on('data', chunk => { bytes += chunk.length; if (bytes > 200 * 1024 ** 2) source.destroy(new Error('Browser download too large')); });
  await pipeline(source, createWriteStream(archive, { flags: 'wx', mode: 0o600 }));
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  assert.equal(hash.digest('hex'), release.sha256, 'Browser checksum mismatch');
  await mkdir(destination, { recursive: true, mode: 0o755 });
  const zip = await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true }, (error, value) => error ? reject(error) : resolve(value)));
  try {
    await new Promise((done, reject) => {
      let entries = 0, expanded = 0;
      zip.once('error', reject); zip.once('end', done);
      zip.on('entry', entry => {
        void (async () => {
          assert.ok(++entries <= 2000 && (expanded += entry.uncompressedSize) <= 1024 ** 3);
          const name = entry.fileName;
          assert.ok(name.startsWith(prefix) && !name.includes('\\') && !name.split('/').includes('..'));
          const kind = entry.externalFileAttributes >>> 16 & 0o170000;
          assert.ok([0, 0o100000, 0o040000].includes(kind), 'Browser archive must contain only files and directories');
          const target = join(destination, name);
          if (name.endsWith('/')) await mkdir(target, { recursive: true, mode: 0o755 });
          else {
            await mkdir(dirname(target), { recursive: true, mode: 0o755 });
            const input = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream)));
            await pipeline(input, createWriteStream(target, { flags: 'wx', mode: 0o644 }));
            if (entry.externalFileAttributes >>> 16 & 0o111) await chmod(target, 0o755);
          }
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } finally { zip.close(); }
  const executable = join(destination, prefix, 'chrome-headless-shell');
  await chmod(executable, 0o755);
  const result = await promisify(execFile)(executable, ['--version'], { timeout: 10_000 });
  assert.ok(result.stdout.includes(release.version), 'Installed browser version mismatch');
  await writeFile(join(destination, 'browser-release.json'), JSON.stringify(release, null, 2) + '\n', { mode: 0o644 });
  console.log(`Installed official headless browser ${release.version}; SHA-256 verified.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
