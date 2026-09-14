// Uploaded databases are parsed only in this disposable process. SQL/schema from
// the upload is never installed in the live archive; rows enter our own schema.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { createWriteStream, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { open, type ZipFile, type Entry } from 'yauzl';
import { db, type Row } from './db.js';
import { archiveTables, archiveSchema } from './backup.js';
import { eventKinds } from './library.js';
import { validateMetadata, validateRectangles, validateScreenshot } from './capture-limits.js';

const root = process.argv[2];
const bad = () => { throw new Error('Backup non valido, incompleto o oltre i limiti del ripristino guidato.'); };
const files = new Map<string, { bytes: number; hash: string }>();
const maxExpanded = Number(process.argv[3]);
async function extract() {
  const zip = await new Promise<ZipFile>((resolve, reject) => open(join(root, 'upload.zip'), { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => error ? reject(error) : resolve(zip!)));
  let total = 0;
  if (zip.entryCount > 100002) { zip.close(); bad(); }
  await new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => { zip.close(); reject(error); };
    zip.once('error', fail); zip.once('end', resolve);
    zip.on('entry', (entry: Entry) => {
      void (async () => {
        const name = entry.fileName, match = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})\.(html|png)$/.exec(name);
        if (name !== 'archive.sqlite' && name !== 'manifest.json' && (!match || match[1] !== match[2].slice(0, 2))) bad();
        const kind = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (files.has(name) || entry.isEncrypted() || (kind && kind !== 0x8000) || ![0, 8].includes(entry.compressionMethod)) bad();
        const limit = name === 'manifest.json' ? 65536 : name === 'archive.sqlite' ? 1024 ** 3 : 64 * 1024 ** 2;
        if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize > limit || total + entry.uncompressedSize > maxExpanded) bad();
        total += entry.uncompressedSize;
        const target = join(root, 'extracted', name); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        const source = await new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream!)));
        let bytes = 0, checksum = 0; const hash = createHash('sha256');
        const guard = new Transform({ transform(chunk, _encoding, done) { bytes += chunk.length; if (bytes > entry.uncompressedSize || bytes > limit) return done(new Error('File troppo grande')); hash.update(chunk); checksum = crc32(chunk, checksum); done(null, chunk); } });
        await pipeline(source, guard, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
        const digest = hash.digest('hex');
        if (checksum !== entry.crc32 || bytes !== entry.uncompressedSize || (match && digest !== match[2])) bad();
        if (match?.[3] === 'png') validateScreenshot(readFileSync(target));
        files.set(name, { bytes, hash: digest }); zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}
const array = (v: any, max = 50000) => { if (!Array.isArray(v) || v.length > max) bad(); return v as any[]; };
const strings = (v: any, max = 50000, length = 4096) => { if (array(v, max).some(x => typeof x !== 'string' || x.length > length)) bad(); };
function quality(v: any) { if (v !== null && (!v || !['complete','partial'].includes(v.status) || !Number.isInteger(v.missingImages) || v.missingImages < 0 || v.missingImages > 50000)) bad(); if (v) strings(v.reasons, 20, 1000); }
function checkRow(table: string, row: Row) {
  for (const [key, value] of Object.entries(row)) {
    if (value === null) { if (['id','event_id','version_id'].includes(key) && ['sites','pages','versions','checks','events','event_reads','version_notes','version_tags'].includes(table) && !(['checks','events'].includes(table) && key === 'version_id')) bad(); continue; }
    if (typeof value === 'string') {
      if (Buffer.byteLength(value) > 8 * 1024 ** 2 || value.includes('\0')) bad();
      if ((key === 'id' || key.endsWith('_id')) && !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) bad();
      if (key.endsWith('_at') && (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)) bad();
      if (key === 'url' || key === 'final_url') { const url = new URL(value); if (!['http:','https:'].includes(url.protocol) || url.username || url.password || value.length > 4096) bad(); }
    } else if (typeof value !== 'number' || !Number.isFinite(value)) bad();
  }
  const limits: Record<string, [number, number]> = { ignore_selectors: [30,500], include_paths:[20,300], exclude_paths:[20,300], sitemap_sources:[1000,4096], headings:[100,500], images:[500,4096], warnings:[100,1000] };
  for (const key of ['ignore_selectors','include_paths','exclude_paths','sitemap_sources','headings','images','warnings']) if (key in row) strings(JSON.parse(row[key]), ...limits[key]);
  for (const key of ['ignore_rules','important_rules']) if (key in row) for (const rule of array(JSON.parse(row[key]), 30)) if (!rule || typeof rule.selector !== 'string' || rule.selector.length > 500 || typeof rule.label !== 'string' || rule.label.length > 120) bad();
  if ('quality' in row) quality(JSON.parse(row.quality));
  if (table === 'sites') {
    if (!['own','competitor'].includes(row.kind) || row.interval_hours < 1 || row.interval_hours > 8760 || row.max_pages < 1 || row.max_pages > 500 || !Number.isInteger(row.max_pages) || ![0,1].includes(row.include_subdomains) || ![0,1].includes(row.paused)) bad();
    if (row.discovery_interval_hours !== undefined && (row.discovery_interval_hours < 1 || row.discovery_interval_hours > 8760)) bad();
    if (row.name.length > 120 || row.notes.length > 20000) bad();
    // Restoring never starts visits automatically.
    row.paused = 1;
  }
  if (table === 'pages' && (row.notes.length > 20000 || row.title.length > 500)) bad();
  if (table === 'versions') {
    if (!Number.isInteger(row.status_code) || row.status_code < 100 || row.status_code > 599) bad();
    validateMetadata({ title: row.title, text: row.text, headings: JSON.parse(row.headings), links: JSON.parse(row.links), imageUrls: JSON.parse(row.images) });
    if (row.detection) {
      const data = JSON.parse(row.detection);
      if (data !== null) {
        if (!data || typeof data.rulesKey !== 'string' || data.rulesKey.length > 128) bad();
        validateMetadata(data.content); validateRectangles(data.ignored, 300);
        for (const item of array(data.important, 20)) {
          if (!item || typeof item.selector !== 'string' || item.selector.length > 500 || !Number.isInteger(item.count) || item.count < 0) bad();
          validateMetadata({ title: '', text: item.text, headings: [], links: item.links, imageUrls: item.imageUrls }); validateRectangles(item.rectangles, 300);
        }
      }
    }
  }
  if (table === 'version_notes' && (row.note.length > 20000 || ![0,1].includes(row.favorite))) bad();
  if (table === 'version_tags' && (typeof row.tag !== 'string' || !row.tag.trim() || row.tag.length > 40)) bad();
  if (table === 'objects') {
    if (!/^[a-f0-9]{64}$/.test(row.hash) || !['html','png'].includes(row.kind) || row.path !== `objects/${row.hash.slice(0,2)}/${row.hash}.${row.kind}`) bad();
    const file = files.get(row.path); if (!file || file.hash !== row.hash || file.bytes !== row.bytes) bad();
  }
}
async function validate() {
  await extract();
  if (!files.has('manifest.json') || !files.has('archive.sqlite')) bad();
  const manifest = JSON.parse(readFileSync(join(root, 'extracted/manifest.json'), 'utf8'));
  if (typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))) bad();
  if (manifest.app !== 'Landing Archive' || !Number.isInteger(manifest.schema) || manifest.schema < 1 || manifest.schema > archiveSchema) bad();
  // Bound SQLite's native allocations as well as the child JavaScript heap.
  // Set this before opening untrusted database pages or parsing their schema.
  db.exec('PRAGMA hard_heap_limit=67108864');
  const source = new DatabaseSync(join(root, 'extracted/archive.sqlite'), { readOnly: true, allowExtension: false, enableDoubleQuotedStringLiterals: false });
  try {
    source.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA mmap_size=0; PRAGMA cache_size=-4096;');
    const schema = source.prepare('SELECT type,name,sql FROM sqlite_schema LIMIT 101').all() as Row[];
    const allowed = new Set([...archiveTables, 'jobs', 'settings', 'users', 'sessions']);
    if (schema.length > 100 || schema.some(row => !['table','index'].includes(row.type) || (row.type === 'table' && (!allowed.has(row.name) || /\b(VIRTUAL|GENERATED|CHECK)\b/i.test(row.sql) && row.name !== 'version_notes')))) bad();
    // Computed columns may omit the GENERATED keyword. Check every table,
    // including optional settings, before selecting any of its values.
    for (const entry of schema.filter(row => row.type === 'table')) {
      const columns = source.prepare(`PRAGMA table_xinfo(${entry.name})`).all() as Row[];
      if (columns.length > 40 || columns.some(column => column.hidden)) bad();
    }
    if (source.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') bad();
    const counts: Row = {}; let totalRows = 0;
    db.exec('PRAGMA trusted_schema=OFF; BEGIN IMMEDIATE;');
    for (const table of archiveTables) {
      if (!schema.some(row => row.type === 'table' && row.name === table)) { if (['version_notes','version_tags','event_reads'].includes(table) && manifest.schema < 4) { counts[table] = 0; continue; } bad(); }
      const expected = db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
      const actual = source.prepare(`PRAGMA table_xinfo(${table})`).all() as Row[];
      if (actual.some(c => c.hidden || !expected.some(e => e.name === c.name))) bad();
      const names = expected.filter(e => actual.some(c => c.name === e.name)).map(e => e.name);
      if (!names.length) bad();
      const insert = db.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`);
      let count = 0;
      for (const value of source.prepare(`SELECT ${names.join(',')} FROM ${table}`).iterate()) {
        const row = value as Row; if (++totalRows > 5000000) bad(); checkRow(table, row);
        insert.run(...names.map(name => row[name])); count++;
      }
      if ((table === 'sites' && count > 500) || (table === 'pages' && count > 100000)) bad();
      counts[table] = count;
    }
    if (files.size !== counts.objects + 2 || db.prepare('PRAGMA foreign_key_check').get()) bad();
    if (db.prepare(`SELECT 1 FROM pages p LEFT JOIN versions v ON v.id=p.last_version_id WHERE p.last_version_id IS NOT NULL AND (v.id IS NULL OR v.page_id<>p.id) LIMIT 1`).get()) bad();
    if (db.prepare('SELECT 1 FROM checks c JOIN versions v ON v.id=c.version_id WHERE v.page_id<>c.page_id LIMIT 1').get()) bad();
    if (db.prepare('SELECT 1 FROM events e JOIN pages p ON p.id=e.page_id WHERE p.site_id<>e.site_id LIMIT 1').get()) bad();
    if (db.prepare('SELECT 1 FROM events e JOIN versions v ON v.id=e.version_id WHERE e.page_id IS NULL OR v.page_id<>e.page_id LIMIT 1').get()) bad();
    if (db.prepare('SELECT 1 FROM version_tags GROUP BY version_id HAVING count(*)>12 LIMIT 1').get()) bad();
    db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE)');
    // Preference is optional and never imports arbitrary application settings.
    if (schema.some(row => row.name === 'settings')) {
      const setting = source.prepare("SELECT value FROM settings WHERE key='inbox_kinds'").get() as Row | undefined;
      if (setting) { const kinds = JSON.parse(setting.value); strings(kinds, 30, 50); if (kinds.some((kind: string) => !Object.hasOwn(eventKinds, kind))) bad(); db.prepare("INSERT INTO settings VALUES ('inbox_kinds',?)").run(JSON.stringify(kinds)); }
    }
    const bytes = (db.prepare('SELECT COALESCE(SUM(bytes),0) bytes FROM objects').get() as Row).bytes;
    db.close();
    return { sites: counts.sites, pages: counts.pages, versions: counts.versions, checks: counts.checks, bytes, createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt.slice(0,30) : '', schema: manifest.schema, databaseBytes: statSync(join(root, 'canonical/archive.sqlite')).size };
  } finally { source.close(); }
}
validate().then(result => { process.send?.({ ok: true, result }, () => process.exit(0)); }).catch(() => { process.send?.({ ok: false }, () => process.exit(1)); });
