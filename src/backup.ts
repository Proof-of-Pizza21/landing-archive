import { ZipArchive } from 'archiver';
import { DatabaseSync } from 'node:sqlite';
import { createWriteStream, readFileSync, rmSync, statSync, openSync, writeSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { db, id, now, type Row } from './db.js';
import { dataDir } from './config.js';
import { checkSpace } from './storage.js';
import { offlineMaxBytes, type OfflineTarget } from './offline.js';

import { offlineDocumentIsolated } from './html-transform.js';
import { localize } from './localization.js';

export { appVersion as archiveVersion } from './version.js';
import { appVersion as archiveVersion } from './version.js';
export const archiveSchema = 5;
export const archiveTables = ['sites', 'pages', 'objects', 'versions', 'checks', 'events', 'version_notes', 'version_tags', 'event_reads'] as const;
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export const portablePolicy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${portablePolicy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1">`;
export function snapshot() {
  checkSpace(Number((db.prepare('PRAGMA page_count').get() as Row).page_count) * Number((db.prepare('PRAGMA page_size').get() as Row).page_size));
  const path = join(dataDir, 'tmp', `${id()}.sqlite`);
  db.prepare('VACUUM INTO ?').run(path);
  return path;
}
export function backupZip(path: string) {
  const copy = new DatabaseSync(path);
  let objects: Row[];
  try {
    copy.exec('DELETE FROM sessions; DELETE FROM objects WHERE NOT EXISTS (SELECT 1 FROM versions WHERE html_hash=objects.hash OR screenshot_hash=objects.hash);');
    objects = copy.prepare('SELECT path FROM objects').all() as Row[];
  } finally { copy.close(); }
  const zip = new ZipArchive({ zlib: { level: 3 } });
  zip.file(path, { name: 'archive.sqlite' });
  for (const object of objects) zip.file(join(dataDir, object.path), { name: object.path });
  zip.append(JSON.stringify({ app: 'Landing Archive', version: archiveVersion, schema: archiveSchema, createdAt: now(), restore: 'Open Backup and restore in Landing Archive. Guided restore keeps your current account and pauses all sites. To restore manually, stop the services and restore archive.sqlite and objects into an empty data directory owned by UID/GID 1000:1000.' }, null, 2), { name: 'manifest.json' });
  return zip;
}
export async function saveSafetyBackup(destination: string) {
  const path = snapshot();
  try {
    const zip = backupZip(path);
    zip.on('warning', error => zip.destroy(error));
    const writing = pipeline(zip, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
    await Promise.all([writing, zip.finalize()]);
  } finally { rmSync(path, { force: true }); }
}
export function portableZip(path: string, siteId: string) {
  const copy = new DatabaseSync(path, { readOnly: true });
  const zip = new ZipArchive({ zlib: { level: 3 } });
  const controller = new AbortController();
  const indexPath = path + '.html';
  let indexFd: number | undefined;
  const closeIndex = () => { if (indexFd !== undefined) { closeSync(indexFd); indexFd = undefined; } };
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; controller.abort(); closeIndex(); copy.close(); rmSync(indexPath, { force: true }); };
  try {
    const site = copy.prepare('SELECT * FROM sites WHERE id=?').get(siteId) as Row;
    const versions = copy.prepare(`SELECT v.id,v.id entry_id,v.page_id,v.captured_at,v.captured_at archived_at,v.title,v.final_url,v.html_hash,v.screenshot_hash,v.reason,p.url
      FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id=?
      UNION ALL
      SELECT v.id,c.id entry_id,v.page_id,c.created_at captured_at,v.captured_at archived_at,v.title,v.final_url,v.html_hash,v.screenshot_hash,c.message reason,p.url
      FROM checks c JOIN versions v ON v.id=c.version_id JOIN pages p ON p.id=c.page_id
      WHERE p.site_id=? AND c.created_at<>v.captured_at AND json_extract(c.evidence,'$.kind')='returned'
      ORDER BY captured_at,entry_id LIMIT 20001`).all(siteId, siteId) as Row[];
    if (versions.length > 20000) throw Object.assign(new Error('Questo sito supera 20.000 versioni: usa il backup completo.'), { statusCode: 413 });
    const files = new Map(versions.map((v, index) => [v.entry_id, `${index + 1}.html`]));
    const pages = new Map<string, Row[]>();
    for (const v of versions) { const history = pages.get(v.page_id) || []; history.push(v); pages.set(v.page_id, history); }
    indexFd = openSync(indexPath, 'wx', 0o600);
    writeSync(indexFd, `<!doctype html><html lang="en"><head>${head}<title>${escapeHtml(site.name)} · Archive</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px}li{margin:24px 0}small{display:block}a{color:#12624a}p{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(site.name)}</h1><p>${escapeHtml(site.url)}</p><p>${escapeHtml(site.notes)}</p><p>${versions.length} versions and recurrences, in chronological order. Open copies in your browser. Links lead to the latest version available on or before the page date, or to the first later copy: check the date in the top bar. Links without an archived copy remain inactive. Forms and scripts are disabled. This browsing archive does not replace a full backup.</p><ol>`);
    // Produce one sanitized copy at a time as archiver consumes the prior entry.
    // This keeps export memory proportional to a page, not the entire site.
    let cursor = 0, writing = false;
    const next = async () => {
      if (writing || zip.destroyed) return;
      if (cursor >= versions.length) {
        writing = true;
        writeSync(indexFd!, '</ol></body></html>'); closeIndex();
        zip.file(indexPath, { name: 'index.html' });
        void zip.finalize().catch(error => zip.destroy(error)); return;
      }
      writing = true;
      const v = versions[cursor++], name = files.get(v.entry_id)!, picture = name.replace('.html', '.png');
      const targets: OfflineTarget[] = [...pages.values()].map(history => { const target = history.findLast(row => row.captured_at <= v.captured_at) || history[0]; return { id: target.entry_id, url: target.url, finalUrl: target.final_url, title: target.title, capturedAt: target.captured_at, later: target.captured_at > v.captured_at }; });
      const tags = (copy.prepare('SELECT tag FROM version_tags WHERE version_id=? ORDER BY tag').all(v.id) as Row[]).map(row => row.tag).join(', ');
      const note = (copy.prepare('SELECT note,favorite FROM version_notes WHERE version_id=?').get(v.id) || {}) as Row;
      let html: string;
      const object = copy.prepare('SELECT path FROM objects WHERE hash=?').get(v.html_hash) as Row;
      let fallback = false;
      try {
        const source = join(dataDir, object.path);
        if (statSync(source).size > offlineMaxBytes) throw new Error('limit');
        html = await offlineDocumentIsolated(readFileSync(source, 'utf8'), v.final_url, targets, files, { signal: controller.signal });
      } catch { fallback = true; html = '<html lang="en"><head></head><body><p>This copy is too complex or unavailable. View the archived screenshot instead.</p></body></html>'; }
      if (disposed || zip.destroyed || controller.signal.aborted) return;
      const bar = `<aside lang="en" style="all:initial;display:block;background:#fff4cc;color:#172a23;padding:16px;font:16px system-ui;position:relative;z-index:2147483647"><a href="../index.html">Archive index</a> · Observed on ${escapeHtml(v.captured_at)}${v.archived_at !== v.captured_at ? ` · Variant first captured on ${escapeHtml(v.archived_at)}` : ''} · <a href="../screenshots/${picture}">Screenshot</a></aside>`;
      html = html.replace(/<head(?:\s[^>]*)?>/i, `<head>${head}`).replace(/<body([^>]*)>/, `<body$1>${bar}`);
      checkSpace(Buffer.byteLength(html) + 128 * 1024);
      writeSync(indexFd!, `<li><a href="versions/${name}">${escapeHtml(v.title || v.url)}</a> ${note.favorite ? '★' : ''}<small>${escapeHtml(v.captured_at)} · ${escapeHtml(v.url)} · ${escapeHtml(localize(v.reason, 'en'))}${fallback ? ' · Screenshot only' : ''}</small><small>${escapeHtml(tags)}</small><p>${escapeHtml(note.note)}</p><a href="screenshots/${picture}">Screenshot</a></li>`);
      const png = copy.prepare('SELECT path FROM objects WHERE hash=?').get(v.screenshot_hash) as Row;
      zip.file(join(dataDir, png.path), { name: `screenshots/${picture}` });
      zip.append(html, { name: `versions/${name}` });
    };
    zip.on('entry', entry => { if (entry.name.startsWith('versions/')) { writing = false; setImmediate(() => { void next().catch(error => zip.destroy(error)); }); } });
    zip.once('close', dispose);
    setImmediate(() => { void next().catch(error => zip.destroy(error)); });
    return zip;
  } catch (error) { dispose(); zip.abort(); throw error; }
}
