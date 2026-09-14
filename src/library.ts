import type { FastifyInstance } from 'fastify';
import { all, get, run, now, transaction, serializeVersion, type Row } from './db.js';

export const eventKinds: Record<string, string> = {
  discovered: 'Nuove pagine', captured: 'Prime copie', changed: 'Modifiche', returned: 'Versioni ritornate',
  missing: 'Pagine non raggiungibili', recovered: 'Pagine tornate online', sitemap_absent: 'Uscite dalla sitemap',
  sitemap_returned: 'Rientri nella sitemap', error: 'Errori', partial: 'Copie parziali', quality_restored: 'Copie completate',
};
const defaults = ['discovered', 'changed', 'returned', 'missing', 'recovered'];
const fail = (message = 'Filtri o annotazioni non validi'): never => { throw Object.assign(new Error(message), { statusCode: 400 }); };
function field(value: unknown, max: number) { if (typeof value !== 'string' || value.length > max) return fail(); return value.trim(); }
function dateBound(value: unknown, end = false) {
  const text = field(value, 30);
  if (text.length === 24 && Number.isFinite(Date.parse(text)) && new Date(text).toISOString() === text) return text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0,10) !== text) return fail();
  return text + (end ? 'T23:59:59.999Z' : 'T00:00:00.000Z');
}
export function filters(query: Row, dateColumn: string) {
  const clauses: string[] = [], params: any[] = [];
  if (query.site) { clauses.push('s.id=?'); params.push(field(query.site, 80)); }
  if (query.group && query.group !== 'all') { if (!['own','competitor'].includes(query.group)) fail(); clauses.push('s.kind=?'); params.push(query.group); }
  if (query.from) { clauses.push(`${dateColumn}>=?`); params.push(dateBound(query.from)); }
  if (query.to) { clauses.push(`${dateColumn}<=?`); params.push(dateBound(query.to, true)); }
  if (query.from && query.to && query.from > query.to) fail('La data iniziale deve precedere quella finale');
  const offset = Number(query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000) fail();
  return { clauses, params, offset };
}
const like = (value: string) => '%' + value.replace(/[\\%_]/g, '\\$&') + '%';
export function registerLibrary(app: FastifyInstance) {
  app.get('/api/inbox/preferences', async () => ({ kinds: JSON.parse(get("SELECT value FROM settings WHERE key='inbox_kinds'")?.value || JSON.stringify(defaults)), available: eventKinds }));
  app.put<{ Body: { kinds: string[] } }>('/api/inbox/preferences', async request => {
    const kinds = request.body?.kinds;
    if (!Array.isArray(kinds) || kinds.length > Object.keys(eventKinds).length || kinds.some(kind => !Object.hasOwn(eventKinds, kind))) fail();
    run("INSERT INTO settings VALUES ('inbox_kinds',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify([...new Set(kinds)]));
    return { ok: true };
  });
  app.get<{ Querystring: Row }>('/api/inbox', async request => {
    const { clauses, params, offset } = filters(request.query, 'e.created_at');
    if (request.query.unread === 'true') clauses.push('r.event_id IS NULL');
    if (request.query.important !== 'false') {
      const kinds: string[] = JSON.parse(get("SELECT value FROM settings WHERE key='inbox_kinds'")?.value || JSON.stringify(defaults));
      clauses.push(`e.kind IN (${kinds.map(() => '?').join(',') || 'NULL'})`); params.push(...kinds);
    }
    const from = `FROM events e JOIN sites s ON s.id=e.site_id LEFT JOIN pages p ON p.id=e.page_id LEFT JOIN event_reads r ON r.event_id=e.id WHERE ${clauses.join(' AND ') || '1'}`;
    return { total: get(`SELECT COUNT(*) n ${from}`, ...params)!.n,
      unread: get(`SELECT COUNT(*) n ${from} AND r.event_id IS NULL`, ...params)!.n,
      events: all(`SELECT e.id,e.kind,e.created_at createdAt,e.message,e.site_id siteId,s.name siteName,p.url,e.page_id pageId,e.version_id versionId,r.read_at readAt ${from} ORDER BY e.created_at DESC,e.id DESC LIMIT 200 OFFSET ?`, ...params, offset), offset };
  });
  app.put<{ Body: { ids: string[]; read: boolean } }>('/api/inbox/read', async request => {
    const body = request.body;
    if (!body || !Array.isArray(body.ids) || body.ids.length > 200 || body.ids.some(id => typeof id !== 'string' || id.length > 80) || typeof body.read !== 'boolean') fail();
    transaction(() => { for (const id of new Set(body.ids)) {
      if (body.read) run('INSERT OR IGNORE INTO event_reads SELECT id,? FROM events WHERE id=?', now(), id);
      else run('DELETE FROM event_reads WHERE event_id=?', id);
    } });
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/versions/:id/annotation', async request => {
    if (!get('SELECT id FROM versions WHERE id=?', request.params.id)) throw Object.assign(new Error('Versione non trovata'), { statusCode: 404 });
    const row = get('SELECT * FROM version_notes WHERE version_id=?', request.params.id);
    return { note: row?.note || '', favorite: Boolean(row?.favorite), tags: all('SELECT tag FROM version_tags WHERE version_id=? ORDER BY tag', request.params.id).map(row => row.tag) };
  });
  app.put<{ Params: { id: string }; Body: Row }>('/api/versions/:id/annotation', async request => {
    if (!get('SELECT id FROM versions WHERE id=?', request.params.id)) throw Object.assign(new Error('Versione non trovata'), { statusCode: 404 });
    const body = request.body || {}, note = field(body.note, 20000);
    if (typeof body.favorite !== 'boolean' || !Array.isArray(body.tags) || body.tags.length > 12) fail();
    const tags = [...new Set<string>(body.tags.map((tag: unknown) => field(tag, 40).normalize('NFC').toLocaleLowerCase('it-IT')))];
    if (tags.some(tag => !tag || /[\x00-\x1f,]/.test(tag))) fail('Usa fino a 12 tag di 40 caratteri, separati da virgole');
    transaction(() => {
      run('INSERT INTO version_notes VALUES (?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET note=excluded.note,favorite=excluded.favorite,updated_at=excluded.updated_at', request.params.id, note, +body.favorite, now());
      run('DELETE FROM version_tags WHERE version_id=?', request.params.id);
      for (const tag of tags) run('INSERT INTO version_tags VALUES (?,?)', request.params.id, tag);
    });
    return { ok: true };
  });
  app.get<{ Querystring: Row }>('/api/library', async request => {
    const { clauses, params, offset } = filters(request.query, 'v.captured_at');
    clauses.push("(COALESCE(n.favorite,0)=1 OR COALESCE(n.note,'')<>'' OR EXISTS(SELECT 1 FROM version_tags t WHERE t.version_id=v.id))");
    if (request.query.favorite === 'true') clauses.push('n.favorite=1');
    if (request.query.tag) { clauses.push('EXISTS(SELECT 1 FROM version_tags t WHERE t.version_id=v.id AND t.tag=?)'); params.push(field(request.query.tag, 40).toLocaleLowerCase('it-IT')); }
    if (request.query.q) {
      clauses.push("(v.title LIKE ? ESCAPE '\\' OR p.url LIKE ? ESCAPE '\\' OR n.note LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM version_tags t WHERE t.version_id=v.id AND t.tag LIKE ? ESCAPE '\\'))");
      params.push(...Array(4).fill(like(field(request.query.q, 200))));
    }
    const from = `FROM versions v JOIN pages p ON p.id=v.page_id JOIN sites s ON s.id=p.site_id LEFT JOIN version_notes n ON n.version_id=v.id WHERE ${clauses.join(' AND ')}`;
    return { total: get(`SELECT COUNT(*) n ${from}`, ...params)!.n, offset,
      tags: all('SELECT DISTINCT tag FROM version_tags ORDER BY tag LIMIT 500').map(row => row.tag),
      versions: all(`SELECT v.*,s.name siteName,p.url,n.note,n.favorite ${from} ORDER BY v.captured_at DESC,v.id DESC LIMIT 100 OFFSET ?`, ...params, offset).map(row => ({ ...serializeVersion(row), siteName: row.siteName, url: row.url, note: row.note || '', favorite: Boolean(row.favorite), tags: all('SELECT tag FROM version_tags WHERE version_id=? ORDER BY tag', row.id).map(tag => tag.tag) })) };
  });
}
