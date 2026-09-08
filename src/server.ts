import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { ZipArchive } from 'archiver';
import { diffWordsWithSpace } from 'diff';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataDir, host, port } from './config.js';
import { all, get, run, db, id, now, later, transaction, addPage, enqueue, serializeSite, serializeVersion, listEvents, listPages, type Row } from './db.js';
import { registerAuth } from './auth.js';
import { normalizeUrl, validatePublicUrl, CaptureError } from './network.js';
import { objectPath, storageStatus, checkSpace } from './storage.js';
import { startJobs, stopJobs, workerState } from './jobs.js';

const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
const required = (table: 'sites' | 'pages' | 'versions', value: unknown) => {
  if (typeof value !== 'string') return fail('Identificatore non valido');
  return get(`SELECT * FROM ${table} WHERE id=?`, value) || fail('Contenuto non trovato', 404);
};
function bodyObject(body: unknown): Row {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Dati non validi');
  return body as Row;
}
function textField(value: unknown, max: number, empty = true) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) return fail('Testo non valido o troppo lungo');
  return value.trim();
}
function siteFields(body: Row, previous?: Row) {
  const name = textField(body.name ?? previous?.name, 120, false);
  const url = normalizeUrl(textField(body.url ?? previous?.url, 4096, false));
  if (previous && previous.url !== url) fail('L’indirizzo iniziale è fisso. Aggiungi una pagina o un nuovo sito per seguire un altro indirizzo.');
  const kind = body.kind ?? previous?.kind ?? 'competitor';
  const interval = body.intervalHours ?? previous?.interval_hours ?? 6;
  const maxPages = body.maxPages ?? previous?.max_pages ?? 30;
  const selectors = body.ignoreSelectors ?? JSON.parse(previous?.ignore_selectors || '[]');
  const subdomains = body.includeSubdomains ?? Boolean(previous?.include_subdomains);
  const paused = body.paused ?? Boolean(previous?.paused);
  const notes = textField(body.notes ?? previous?.notes ?? '', 20000);
  if (!['own', 'competitor'].includes(kind) || typeof interval !== 'number' || !Number.isFinite(interval) || interval < 1 || interval > 8760 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) fail('Frequenza o limite di pagine non valido');
  if (typeof subdomains !== 'boolean' || typeof paused !== 'boolean' || !Array.isArray(selectors) || selectors.length > 30 || selectors.some(s => typeof s !== 'string' || !s.trim() || s.length > 500)) fail('Opzioni del sito non valide');
  return { name, url, kind, interval, maxPages, selectors, subdomains, paused, notes };
}

export async function createApp() {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024, requestTimeout: 30000 });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerAuth(app);
  app.setErrorHandler((error: any, _request, reply) => {
    const status = error instanceof CaptureError ? 400 : error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : /UNIQUE constraint/.test(error.message) ? 409 : 500;
    reply.code(status).send({ error: status === 500 ? 'Operazione non completata. Controlla lo spazio disponibile e riprova.' : status === 429 ? 'Troppi tentativi. Attendi un minuto e riprova.' : status === 409 ? 'Questo indirizzo è già presente nell’archivio' : error.message });
  });
  app.get('/api/health', { config: { publicAccess: true } }, async () => ({ ok: true }));
  app.get('/api/dashboard', async () => ({
    stats: {
      sites: get('SELECT COUNT(*) n FROM sites')!.n, pages: get('SELECT COUNT(*) n FROM pages')!.n,
      versions: get('SELECT COUNT(*) n FROM versions')!.n, bytes: get('SELECT COALESCE(SUM(bytes),0) n FROM objects')!.n,
      queued: get("SELECT COUNT(*) n FROM jobs WHERE status='queued'")!.n, running: get("SELECT COUNT(*) n FROM jobs WHERE status='running'")!.n,
    }, storage: storageStatus(), worker: await workerState(), events: listEvents(),
    queue: all("SELECT j.id,j.kind,j.status,j.created_at createdAt,s.name siteName,COALESCE(p.url,s.url) url FROM jobs j JOIN sites s ON s.id=j.site_id LEFT JOIN pages p ON p.id=j.page_id WHERE j.status IN ('queued','running') ORDER BY j.created_at LIMIT 100"),
  }));
  app.get('/api/sites', async () => ({ sites: all('SELECT * FROM sites ORDER BY created_at').map(serializeSite) }));
  app.post('/api/sites', async (request, reply) => {
    const fields = siteFields(bodyObject(request.body));
    await validatePublicUrl(fields.url);
    const siteId = id();
    transaction(() => {
      run(`INSERT INTO sites (id,name,url,kind,interval_hours,max_pages,include_subdomains,paused,ignore_selectors,notes,next_discovery_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, siteId, fields.name, fields.url, fields.kind, fields.interval, fields.maxPages, +fields.subdomains, +fields.paused, JSON.stringify(fields.selectors), fields.notes, later(24), now(), now());
      const { page } = addPage(siteId, fields.url, 'seed');
      enqueue(siteId, page.id, 'capture');
      if (fields.maxPages > 1) enqueue(siteId, null, 'discover');
    });
    return reply.code(201).send({ site: serializeSite(required('sites', siteId)) });
  });
  app.get<{ Params: { id: string } }>('/api/sites/:id', async request => {
    const site = required('sites', request.params.id);
    return { site: serializeSite(site), pages: listPages(site.id), events: listEvents(site.id) };
  });
  app.patch<{ Params: { id: string } }>('/api/sites/:id', async request => {
    const site = required('sites', request.params.id), f = siteFields(bodyObject(request.body), site);
    transaction(() => {
      run('UPDATE sites SET name=?,kind=?,interval_hours=?,max_pages=?,include_subdomains=?,paused=?,ignore_selectors=?,notes=?,updated_at=? WHERE id=?', f.name, f.kind, f.interval, f.maxPages, +f.subdomains, +f.paused, JSON.stringify(f.selectors), f.notes, now(), site.id);
      if (f.interval !== site.interval_hours) {
        for (const page of all('SELECT id,last_checked_at FROM pages WHERE site_id=?', site.id)) {
          const next = page.last_checked_at ? new Date(new Date(page.last_checked_at).getTime() + f.interval * 3600000).toISOString() : now();
          run('UPDATE pages SET next_check_at=? WHERE id=?', next, page.id);
        }
      }
    });
    return { site: serializeSite(required('sites', site.id)) };
  });
  app.post<{ Params: { id: string } }>('/api/sites/:id/scan', async request => {
    const site = required('sites', request.params.id);
    if (site.paused) fail('Riattiva il monitoraggio dalle impostazioni prima di avviare una scansione');
    const body = request.body ? bodyObject(request.body) : {};
    transaction(() => {
      for (const page of all('SELECT id FROM pages WHERE site_id=?', site.id)) enqueue(site.id, page.id, 'capture');
      if (body.discover === true && site.max_pages > 1) enqueue(site.id, null, 'discover');
    });
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/sites/:id/pages', async (request, reply) => {
    const site = required('sites', request.params.id), url = normalizeUrl(textField(bodyObject(request.body).url, 4096, false));
    await validatePublicUrl(url);
    // Explicitly supplied landing URLs may be on a campaign provider's domain.
    const { page, added } = transaction(() => {
      const value = addPage(site.id, url); enqueue(site.id, value.page.id, 'capture'); return value;
    });
    return reply.code(added ? 201 : 200).send({ page: { id: page.id, url: page.url }, paused: Boolean(site.paused) });
  });
  app.get<{ Params: { id: string } }>('/api/pages/:id', async request => {
    const page = required('pages', request.params.id), site = required('sites', page.site_id);
    return { page: listPages(site.id).find(p => p.id === page.id), site: serializeSite(site), notes: page.notes,
      versions: all('SELECT * FROM versions WHERE page_id=? ORDER BY captured_at DESC', page.id).map(v => serializeVersion(v)),
      checks: all('SELECT id,created_at createdAt,status,message,version_id versionId FROM checks WHERE page_id=? ORDER BY created_at DESC LIMIT 1000', page.id) };
  });
  app.patch<{ Params: { id: string } }>('/api/pages/:id', async request => {
    const page = required('pages', request.params.id), notes = textField(bodyObject(request.body).notes, 20000);
    run('UPDATE pages SET notes=? WHERE id=?', notes, page.id); return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/scan', async request => {
    const page = required('pages', request.params.id);
    if (required('sites', page.site_id).paused) fail('Riattiva il monitoraggio dalle impostazioni prima di avviare una scansione');
    enqueue(page.site_id, page.id, 'capture'); return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/versions/:id', async request => ({ version: serializeVersion(required('versions', request.params.id), true) }));
  for (const kind of ['screenshot', 'html'] as const) app.get<{ Params: { id: string } }>(`/api/versions/:id/${kind}`, async (request, reply) => {
    const v = required('versions', request.params.id), isHtml = kind === 'html';
    reply.type(isHtml ? 'text/html; charset=utf-8' : 'image/png');
    if (isHtml) reply.header('Content-Disposition', `attachment; filename="landing-${v.captured_at.slice(0, 10)}-${v.id}.html"`).header('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:");
    return reply.send(createReadStream(objectPath(isHtml ? v.html_hash : v.screenshot_hash)));
  });
  app.get<{ Querystring: { left: string; right: string } }>('/api/compare', async request => {
    const left = required('versions', request.query.left), right = required('versions', request.query.right);
    if (left.page_id !== right.page_id) fail('Scegli due versioni della stessa pagina');
    const l = JSON.parse(left.links), r = JSON.parse(right.links);
    const key = (link: any) => JSON.stringify([link.url, link.text]);
    const leftSet = new Set(l.map(key)), rightSet = new Set(r.map(key));
    const textDiff = diffWordsWithSpace(left.text, right.text, { timeout: 500, maxEditLength: 10000 }) ?? [{ value: left.text, removed: true }, { value: right.text, added: true }];
    return { left: serializeVersion(left), right: serializeVersion(right), textDiff, changedLinks: { added: r.filter((v: any) => !leftSet.has(key(v))), removed: l.filter((v: any) => !rightSet.has(key(v))) } };
  });
  app.get<{ Querystring: { q?: string } }>('/api/search', async request => {
    const q = textField(request.query.q ?? '', 200);
    if (!q) return { pages: [] };
    const value = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    return { pages: all(`SELECT p.id,p.url,p.title,s.name siteName FROM pages p JOIN sites s ON s.id=p.site_id WHERE p.url LIKE ? ESCAPE '\\' OR p.title LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM versions v WHERE v.page_id=p.id AND v.text LIKE ? ESCAPE '\\') LIMIT 100`, value, value, value) };
  });
  let exporting = false;
  app.get('/api/export', async (_request, reply) => {
    if (exporting) return reply.code(409).send({ error: 'Un’esportazione è già in corso' });
    const destination = join(dataDir, 'tmp', `${id()}.sqlite`);
    exporting = true;
    try {
      checkSpace(Number(get('SELECT page_count * page_size n FROM pragma_page_count(),pragma_page_size()')!.n));
      // VACUUM INTO is an atomic SQLite snapshot. Object files are immutable and never deleted.
      db.prepare('VACUUM INTO ?').run(destination);
      const copy = new DatabaseSync(destination);
      let objects: Row[];
      try { objects = copy.prepare('SELECT path FROM objects').all() as Row[]; copy.exec('DELETE FROM sessions;'); } finally { copy.close(); }
      const zip = new ZipArchive({ zlib: { level: 3 } });
      const cleanup = () => { exporting = false; rmSync(destination, { force: true }); };
      zip.once('close', cleanup); zip.once('error', cleanup);
      reply.raw.once('close', () => { if (!reply.raw.writableFinished) zip.abort(); cleanup(); });
      zip.file(destination, { name: 'archive.sqlite' });
      for (const object of objects) zip.file(join(dataDir, object.path), { name: object.path });
      zip.append(JSON.stringify({ app: 'Landing Archive', version: '0.1.1', schema: 1, createdAt: now(), restore: 'Arresta i servizi, ripristina archive.sqlite e objects nella directory dati vuota, assegna UID/GID 1000:1000. La password è conservata, le sessioni sono revocate. Il token interno verrà rigenerato.' }, null, 2), { name: 'manifest.json' });
      reply.header('Content-Disposition', `attachment; filename="landing-archive-${now().slice(0, 10)}.zip"`).type('application/zip');
      void zip.finalize().catch(error => zip.destroy(error));
      return reply.send(zip);
    } catch (error) { exporting = false; rmSync(destination, { force: true }); throw error; }
  });
  // Corresponding application source is available to authenticated network users (AGPL).
  app.get('/api/source', async (_request, reply) => {
    const root = existsSync(resolve('source/src')) ? resolve('source') : resolve('.');
    const zip = new ZipArchive({ zlib: { level: 3 } });
    zip.directory(join(root, 'src'), 'src'); zip.directory(join(root, 'web'), 'web');
    zip.directory(join(root, 'tests'), 'tests');
    for (const name of ['package.json', 'package-lock.json', 'tsconfig.server.json', 'tsconfig.web.json', 'vite.config.ts', 'Dockerfile', 'README.md', 'compose.yaml', '.dockerignore']) zip.file(join(root, name), { name });
    zip.directory(join(root, 'docs'), 'docs');
    zip.glob('**/*', { cwd: join(root, 'umbrel-community-store'), ignore: ['**/data/**'] }, { prefix: 'umbrel-community-store' });
    zip.append('', { name: 'umbrel-community-store/proof-of-pizza21-landing-archive/data/.gitkeep' });
    for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) zip.file(resolve(name), { name });
    reply.raw.once('close', () => { if (!reply.raw.writableFinished) zip.abort(); });
    reply.type('application/zip').header('Content-Disposition', 'attachment; filename="landing-archive-source.zip"');
    void zip.finalize().catch(error => zip.destroy(error)); return reply.send(zip);
  });
  const web = resolve('web-dist');
  if (existsSync(web)) {
    await app.register(async publicFiles => {
      publicFiles.addHook('onRoute', options => { options.config = { ...options.config, publicAccess: true }; });
      await publicFiles.register(serveStatic, { root: web, wildcard: false, index: false });
      publicFiles.get('/', async (_request, reply) => reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'").sendFile('index.html'));
    });
  }
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await createApp();
  await app.listen({ host, port }); startJobs();
  console.log(`Landing Archive pronta sulla porta ${port}`);
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await stopJobs(); await app.close(); db.close(); };
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown());
}
