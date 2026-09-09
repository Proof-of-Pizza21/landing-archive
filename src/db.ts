import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { dataDir, initializeData } from './config.js';

export type Row = Record<string, any>;
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

initializeData();
export const db = new DatabaseSync(join(dataDir, 'archive.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'competitor',
    interval_hours REAL NOT NULL DEFAULT 6, max_pages INTEGER NOT NULL DEFAULT 100,
    include_subdomains INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0,
    ignore_selectors TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '',
    next_discovery_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual',
    first_seen_at TEXT NOT NULL, last_checked_at TEXT, last_status TEXT,
    last_version_id TEXT, missing_count INTEGER NOT NULL DEFAULT 0, next_check_at TEXT NOT NULL,
    UNIQUE(site_id,url)
  );
  CREATE TABLE IF NOT EXISTS objects (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, bytes INTEGER NOT NULL, path TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id), captured_at TEXT NOT NULL,
    title TEXT NOT NULL, final_url TEXT NOT NULL, status_code INTEGER NOT NULL,
    text TEXT NOT NULL, links TEXT NOT NULL DEFAULT '[]', headings TEXT NOT NULL DEFAULT '[]', images TEXT NOT NULL DEFAULT '[]',
    signature TEXT NOT NULL, html_hash TEXT NOT NULL REFERENCES objects(hash), screenshot_hash TEXT NOT NULL REFERENCES objects(hash),
    bytes INTEGER NOT NULL, reason TEXT NOT NULL, warnings TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS versions_page_date ON versions(page_id,captured_at DESC);
  CREATE INDEX IF NOT EXISTS versions_page_signature ON versions(page_id,signature);
  CREATE INDEX IF NOT EXISTS versions_html_object ON versions(html_hash);
  CREATE INDEX IF NOT EXISTS versions_screenshot_object ON versions(screenshot_hash);
  CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id), created_at TEXT NOT NULL,
    status TEXT NOT NULL, message TEXT NOT NULL, version_id TEXT REFERENCES versions(id), status_code INTEGER, final_url TEXT
  );
  CREATE INDEX IF NOT EXISTS checks_page_date ON checks(page_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), page_id TEXT REFERENCES pages(id),
    kind TEXT NOT NULL, created_at TEXT NOT NULL, message TEXT NOT NULL, version_id TEXT REFERENCES versions(id)
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), page_id TEXT REFERENCES pages(id),
    kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL,
    started_at TEXT, finished_at TEXT, available_at TEXT NOT NULL, lease_until TEXT,
    attempts INTEGER NOT NULL DEFAULT 0, error TEXT
  );
  CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status,available_at);
  CREATE UNIQUE INDEX IF NOT EXISTS jobs_unique_page_active ON jobs(page_id) WHERE kind='capture' AND status IN ('queued','running');
  CREATE UNIQUE INDEX IF NOT EXISTS jobs_unique_site_discovery ON jobs(site_id) WHERE kind='discover' AND status IN ('queued','running');
`);
// Additive migration: retain existing archives and queued jobs from 0.1.0/0.1.1.
if (!(db.prepare('PRAGMA table_info(jobs)').all() as Row[]).some(column => column.name === 'manual')) {
  db.exec('ALTER TABLE jobs ADD COLUMN manual INTEGER NOT NULL DEFAULT 0');
}
db.exec('PRAGMA user_version=2');

export const get = (sql: string, ...params: any[]) => db.prepare(sql).get(...params) as Row | undefined;
export const all = (sql: string, ...params: any[]) => db.prepare(sql).all(...params) as Row[];
export const run = (sql: string, ...params: any[]) => db.prepare(sql).run(...params);
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function addEvent(siteId: string, pageId: string | null, kind: string, message: string, versionId: string | null = null) {
  run('INSERT INTO events VALUES (?,?,?,?,?,?,?)', id(), siteId, pageId, kind, now(), message, versionId);
}

export function enqueue(siteId: string, pageId: string | null, kind: 'capture' | 'discover', manual = false) {
  const jobId = id();
  if (manual) {
    const existing = get("SELECT * FROM jobs WHERE site_id=? AND page_id IS ? AND kind=? AND status IN ('queued','running')", siteId, pageId, kind);
    if (existing) {
      if (existing.status === 'queued') run('UPDATE jobs SET manual=1,available_at=?,attempts=0,error=NULL WHERE id=?', now(), existing.id);
      return existing.id as string;
    }
  }
  const result = run('INSERT OR IGNORE INTO jobs (id,site_id,page_id,kind,created_at,available_at,manual) VALUES (?,?,?,?,?,?,?)', jobId, siteId, pageId, kind, now(), now(), +manual);
  return result.changes ? jobId : null;
}

export function addPage(siteId: string, url: string, source = 'manual') {
  const existing = get('SELECT * FROM pages WHERE site_id=? AND url=?', siteId, url);
  if (existing) return { page: existing, added: false };
  const pageId = id();
  run('INSERT INTO pages (id,site_id,url,source,first_seen_at,next_check_at) VALUES (?,?,?,?,?,?)', pageId, siteId, url, source, now(), now());
  addEvent(siteId, pageId, 'discovered', 'Nuova pagina individuata');
  return { page: get('SELECT * FROM pages WHERE id=?', pageId)!, added: true };
}

export function serializeSite(site: Row) {
  const counts = get(`SELECT COUNT(*) pageCount, MAX(last_checked_at) lastCheckedAt, MIN(next_check_at) nextCheckAt FROM pages WHERE site_id=?`, site.id)!;
  const versionCount = get('SELECT COUNT(*) n FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id=?', site.id)!.n;
  return {
    id: site.id, name: site.name, url: site.url, kind: site.kind,
    intervalHours: site.interval_hours, maxPages: site.max_pages,
    includeSubdomains: Boolean(site.include_subdomains), paused: Boolean(site.paused),
    ignoreSelectors: JSON.parse(site.ignore_selectors), notes: site.notes,
    nextDiscoveryAt: site.next_discovery_at, ...counts, versionCount,
  };
}

export function serializeVersion(v: Row, detailed = false) {
  const value: Row = {
    id: v.id, pageId: v.page_id, capturedAt: v.captured_at, title: v.title,
    finalUrl: v.final_url, statusCode: v.status_code, bytes: v.bytes, reason: v.reason,
    warnings: JSON.parse(v.warnings), screenshotUrl: `/api/versions/${v.id}/screenshot`,
    htmlUrl: `/api/versions/${v.id}/html`,
  };
  if (detailed) Object.assign(value, { text: v.text, links: JSON.parse(v.links), headings: JSON.parse(v.headings), imageUrls: JSON.parse(v.images) });
  return value;
}

export function listEvents(siteId?: string, limit = 60) {
  return all(`SELECT e.*,p.url,s.name siteName FROM events e JOIN sites s ON s.id=e.site_id LEFT JOIN pages p ON p.id=e.page_id ${siteId ? 'WHERE e.site_id=?' : ''} ORDER BY e.created_at DESC LIMIT ?`, ...(siteId ? [siteId] : []), limit)
    .map(e => ({ id: e.id, kind: e.kind, url: e.url || '', pageId: e.page_id, siteId: e.site_id, siteName: e.siteName, createdAt: e.created_at, message: e.message, versionId: e.version_id }));
}

export function listPages(siteId: string) {
  return all(`SELECT p.*,
      (SELECT COUNT(*) FROM versions v WHERE v.page_id=p.id) versionCount,
      (SELECT id FROM checks c WHERE c.page_id=p.id ORDER BY created_at DESC LIMIT 1) latestCheckId,
      (SELECT MAX(created_at) FROM events e WHERE e.page_id=p.id AND e.kind IN ('changed','captured','returned')) lastChangeAt
      FROM pages p WHERE site_id=? ORDER BY p.first_seen_at ASC`, siteId)
    .map(p => ({ id: p.id, url: p.url, title: p.title, notes: p.notes, source: p.source, lastCheckedAt: p.last_checked_at, lastStatus: p.last_status, versionCount: p.versionCount, latestVersionId: p.last_version_id, latestCheckId: p.latestCheckId, lastChangeAt: p.lastChangeAt }));
}

export function listJobs(siteId?: string, pageId?: string) {
  const conditions = ["j.status IN ('queued','running')"];
  const params: string[] = [];
  if (siteId) { conditions.push('j.site_id=?'); params.push(siteId); }
  if (pageId) { conditions.push('j.page_id=?'); params.push(pageId); }
  return all(`SELECT j.id,j.site_id siteId,j.page_id pageId,j.kind,j.status,j.manual,j.attempts,j.error,
    j.created_at createdAt,j.started_at startedAt,j.available_at availableAt,
    s.name siteName,s.paused,COALESCE(p.url,s.url) url FROM jobs j JOIN sites s ON s.id=j.site_id
    LEFT JOIN pages p ON p.id=j.page_id WHERE ${conditions.join(' AND ')}
    ORDER BY CASE WHEN j.status='running' THEN 0 ELSE 1 END,j.manual DESC,
    CASE WHEN j.kind='capture' THEN 0 ELSE 1 END,j.created_at LIMIT 100`, ...params);
}
