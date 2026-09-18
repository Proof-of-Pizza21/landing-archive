import Fastify, { type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { ZipArchive } from 'archiver';
import { archiveVersion, snapshot, backupZip, portableZip } from './backup.js';
import { registerRestore, type ArchiveState } from './restore.js';
import { registerLibrary } from './library.js';
import { registerArchiveReview, historySummary } from './archive-review.js';
import { diagnosticsStatus, listPageDiagnostics, pruneDiagnostics, readDiagnostic, removePageDiagnostics } from './diagnostics.js';
import { createReadStream, existsSync, rmSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataDir, host, port } from './config.js';
import { all, get, run, db, id, now, later, transaction, addPage, enqueue, serializeSite, serializeVersion, listEvents, listPages, listJobs, type Row } from './db.js';
import { registerAuth } from './auth.js';
import { normalizeUrl, validatePublicUrl, CaptureError } from './network.js';
import { objectPath, storageStatus, checkSpace, removeUnusedObjects } from './storage.js';
import { startJobs, stopJobs, workerState, cancelSiteJobs, requestManualScan } from './jobs.js';
import { registerSiteReset } from './site-reset.js';
import { offlineMaxBytes, offlinePolicy, type OfflineTarget } from './offline.js';
import { offlineDocumentIsolated, sanitizeArchiveDocument } from './html-transform.js';
import { compareContent } from './comparison.js';
import { locateVisualChanges, type VisualRegions } from './image-regions.js';
import { captureLimits } from './capture-limits.js';

async function renderHtml(reply: FastifyReply, transform: (signal: AbortSignal) => Promise<string>) {
  const controller = new AbortController();
  const closed = () => { if (!reply.raw.writableFinished) controller.abort(); };
  reply.raw.once('close', closed);
  try { return await transform(controller.signal); }
  finally { reply.raw.off('close', closed); }
}

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
function pathFields(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(path => typeof path !== 'string' || path.length > 300 || !path.startsWith('/') || /[?#*\\\s]/.test(path) || path.startsWith('//'))) return fail('Inserisci fino a 20 percorsi, per esempio /offerte, senza indirizzi completi o caratteri jolly.');
  return [...new Set(value)];
}
function ruleFields(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return fail(`Sono consentite al massimo ${max} zone.`);
  return value.map(rule => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return fail('Zona non valida');
    return { selector: textField(rule.selector, 500, false), label: textField(rule.label, 120, false) };
  });
}
function siteFields(body: Row, previous?: Row) {
  const name = textField(body.name ?? previous?.name, 120, false);
  const url = normalizeUrl(textField(body.url ?? previous?.url, 4096, false));
  if (previous && previous.url !== url) fail('L’indirizzo iniziale è fisso. Aggiungi una pagina o un nuovo sito per seguire un altro indirizzo.');
  const kind = body.kind ?? previous?.kind ?? 'competitor';
  const interval = body.intervalHours ?? previous?.interval_hours ?? 6;
  const discoveryInterval = body.discoveryIntervalHours ?? previous?.discovery_interval_hours ?? 24;
  const includePaths = pathFields(body.includePaths ?? JSON.parse(previous?.include_paths || '[]'));
  const excludePaths = pathFields(body.excludePaths ?? JSON.parse(previous?.exclude_paths || '[]'));
  const maxPages = body.maxPages ?? previous?.max_pages ?? 30;
  const selectors = body.ignoreSelectors ?? JSON.parse(previous?.ignore_selectors || '[]');
  const subdomains = body.includeSubdomains ?? Boolean(previous?.include_subdomains);
  const paused = body.paused ?? Boolean(previous?.paused);
  const notes = textField(body.notes ?? previous?.notes ?? '', 20000);
  if (!['own', 'competitor'].includes(kind) || typeof interval !== 'number' || !Number.isFinite(interval) || interval < 1 || interval > 8760 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) fail('Frequenza o limite di pagine non valido');
  if (typeof discoveryInterval !== 'number' || !Number.isFinite(discoveryInterval) || discoveryInterval < 1 || discoveryInterval > 8760) fail('Frequenza di ricerca delle landing non valida');
  if (typeof subdomains !== 'boolean' || typeof paused !== 'boolean' || !Array.isArray(selectors) || selectors.length > 30 || selectors.some(s => typeof s !== 'string' || !s.trim() || s.length > 500)) fail('Opzioni del sito non valide');
  return { name, url, kind, interval, discoveryInterval, includePaths, excludePaths, maxPages, selectors, subdomains, paused, notes };
}

export async function createApp() {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024, requestTimeout: 30000 });
  const visualCache = new Map<string, VisualRegions>();
  let visualJob: AbortController | undefined;
  app.addHook('onClose', async () => { visualJob?.abort(); visualCache.clear(); });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const archiveState: ArchiveState = { exporting: false, restoring: false };
  registerRestore(app, archiveState, () => { visualJob?.abort(); visualCache.clear(); });
  registerAuth(app);
  registerLibrary(app);
  registerArchiveReview(app, archiveState, () => { visualJob?.abort(); visualCache.clear(); });
  registerSiteReset(app, archiveState, () => { visualJob?.abort(); visualCache.clear(); });
  pruneDiagnostics();
  const diagnosticTimer = setInterval(() => { if (!archiveState.restoring) pruneDiagnostics(); }, 60000); diagnosticTimer.unref();
  app.addHook('onClose', async () => { clearInterval(diagnosticTimer); });
  app.setErrorHandler((error: any, _request, reply) => {
    const status = error instanceof CaptureError ? 400 : error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : /UNIQUE constraint/.test(error.message) ? 409 : 500;
    reply.code(status).send({ error: status === 500 ? 'Operazione non completata. Controlla lo spazio disponibile e riprova.' : status === 429 ? 'Troppi tentativi. Attendi un minuto e riprova.' : /UNIQUE constraint/.test(error.message) ? 'Questo indirizzo è già presente nell’archivio' : error.message });
  });
  app.get('/api/health', { config: { publicAccess: true } }, async () => ({ ok: true }));
  app.get('/api/dashboard', async () => ({
    version: archiveVersion,
    stats: {
      sites: get('SELECT COUNT(*) n FROM sites')!.n, pages: get('SELECT COUNT(*) n FROM pages')!.n,
      versions: get('SELECT COUNT(*) n FROM versions')!.n, bytes: get('SELECT COALESCE(SUM(bytes),0) n FROM objects')!.n,
      queued: get("SELECT COUNT(*) n FROM jobs WHERE status='queued'")!.n, running: get("SELECT COUNT(*) n FROM jobs WHERE status='running'")!.n,
    }, storage: storageStatus(), diagnosticsStatus: diagnosticsStatus(), worker: await workerState(), events: listEvents(),
    queue: listJobs(),
  }));
  app.get('/api/sites', async () => ({ sites: all('SELECT * FROM sites ORDER BY created_at').map(serializeSite) }));
  app.post('/api/sites', async (request, reply) => {
    const fields = siteFields(bodyObject(request.body));
    await validatePublicUrl(fields.url);
    const siteId = id();
    transaction(() => {
      run(`INSERT INTO sites (id,name,url,kind,interval_hours,max_pages,include_subdomains,paused,ignore_selectors,notes,next_discovery_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, siteId, fields.name, fields.url, fields.kind, fields.interval, fields.maxPages, +fields.subdomains, +fields.paused, JSON.stringify(fields.selectors), fields.notes, later(24), now(), now());
      run('UPDATE sites SET discovery_interval_hours=?,include_paths=?,exclude_paths=?,next_discovery_at=? WHERE id=?', fields.discoveryInterval, JSON.stringify(fields.includePaths), JSON.stringify(fields.excludePaths), later(fields.discoveryInterval), siteId);
      const { page } = addPage(siteId, fields.url, 'seed');
      enqueue(siteId, page.id, 'capture');
      if (fields.maxPages > 1) enqueue(siteId, null, 'discover');
    });
    return reply.code(201).send({ site: serializeSite(required('sites', siteId)) });
  });
  app.get<{ Params: { id: string } }>('/api/sites/:id', async request => {
    const site = required('sites', request.params.id);
    return { site: serializeSite(site), pages: listPages(site.id), events: listEvents(site.id), jobs: listJobs(site.id) };
  });
  app.patch<{ Params: { id: string } }>('/api/sites/:id', async request => {
    const site = required('sites', request.params.id), f = siteFields(bodyObject(request.body), site);
    transaction(() => {
      for (const page of all('SELECT ignore_rules FROM pages WHERE site_id=?', site.id)) if (JSON.parse(page.ignore_rules).length + f.selectors.length > 30) fail('Le esclusioni del sito e di una pagina superano il limite complessivo di 30. Riduci prima le zone escluse.');
      run('UPDATE sites SET name=?,kind=?,interval_hours=?,max_pages=?,include_subdomains=?,paused=?,ignore_selectors=?,notes=?,updated_at=? WHERE id=?', f.name, f.kind, f.interval, f.maxPages, +f.subdomains, +f.paused, JSON.stringify(f.selectors), f.notes, now(), site.id);
      const scopeChanged = JSON.stringify(f.includePaths) !== site.include_paths || JSON.stringify(f.excludePaths) !== site.exclude_paths || +f.subdomains !== site.include_subdomains;
      const nextDiscovery = f.discoveryInterval !== site.discovery_interval_hours ? site.last_discovery_at ? new Date(Date.parse(site.last_discovery_at) + f.discoveryInterval * 3600000).toISOString() : now() : site.next_discovery_at;
      run('UPDATE sites SET discovery_interval_hours=?,include_paths=?,exclude_paths=?,next_discovery_at=?,sitemap_sources=? WHERE id=?', f.discoveryInterval, JSON.stringify(f.includePaths), JSON.stringify(f.excludePaths), scopeChanged ? now() : nextDiscovery, scopeChanged ? '[]' : site.sitemap_sources, site.id);
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
    const body = request.body ? bodyObject(request.body) : {};
    if (body.force !== undefined && typeof body.force !== 'boolean') fail('Opzione di riavvio non valida');
    return requestManualScan(site.id, { restart: body.force === true, discover: body.discover === true });
  });
  app.delete<{ Params: { id: string } }>('/api/sites/:id', async request => {
    const site = required('sites', request.params.id);
    if (bodyObject(request.body).confirmSiteId !== site.id) fail('Conferma il sito da eliminare');
    if (archiveState.exporting) fail('Un backup è in corso. Attendi che termini prima di eliminare il sito.', 409);
    const hashes = all('SELECT v.html_hash,v.screenshot_hash FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id=?', site.id)
      .flatMap(version => [version.html_hash, version.screenshot_hash]);
    const pageIds = all('SELECT id FROM pages WHERE site_id=?', site.id).map(page => page.id);
    transaction(() => {
      cancelSiteJobs(site.id, undefined, true);
      run('DELETE FROM jobs WHERE site_id=?', site.id);
      run('DELETE FROM events WHERE site_id=?', site.id);
      run('DELETE FROM checks WHERE page_id IN (SELECT id FROM pages WHERE site_id=?)', site.id);
      run('DELETE FROM versions WHERE page_id IN (SELECT id FROM pages WHERE site_id=?)', site.id);
      run('DELETE FROM pages WHERE site_id=?', site.id);
      run('DELETE FROM sites WHERE id=?', site.id);
    });
    for (const pageId of pageIds) removePageDiagnostics(pageId);
    return { ok: true, ...removeUnusedObjects(hashes) };
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
      versions: all('SELECT id,page_id,captured_at,title,final_url,status_code,bytes,reason,warnings,quality,review_state,variant_key,evidence FROM versions WHERE page_id=? ORDER BY captured_at DESC,id DESC', page.id).map(v => serializeVersion(v)),
      historySummary: historySummary(page.id), referenceVersionId: page.reference_version_id,
      diagnostics: listPageDiagnostics(page.id),
      jobs: listJobs(site.id, page.id),
      checks: all('SELECT id,created_at createdAt,status,message,version_id versionId,quality,evidence FROM checks WHERE page_id=? ORDER BY created_at DESC,id DESC LIMIT 1000', page.id).map(check => ({ ...check, quality: JSON.parse(check.quality), evidence: JSON.parse(check.evidence) })) };
  });
  app.get<{ Params: { id: string; sample: string } }>('/api/pages/:id/diagnostics/:sample/screenshot', async (request, reply) => {
    required('pages', request.params.id);
    return reply.type('image/png').send(readDiagnostic(request.params.id, request.params.sample));
  });
  app.get<{ Params: { id: string }; Querystring: { before?: string; beforeId?: string } }>('/api/pages/:id/checks', async request => {
    required('pages', request.params.id);
    const { before, beforeId } = request.query;
    if (before !== undefined && (typeof before !== 'string' || before.length !== 24 || !Number.isFinite(Date.parse(before)) || new Date(before).toISOString() !== before || typeof beforeId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(beforeId))) fail('Data del controllo non valida');
    const checks = all(`SELECT id,created_at createdAt,status,message,version_id versionId,quality,evidence FROM checks WHERE page_id=?${before ? ' AND (created_at<? OR (created_at=? AND id<?))' : ''} ORDER BY created_at DESC,id DESC LIMIT 1001`, request.params.id, ...(before ? [before,before,beforeId] : []));
    return { hasMore: checks.length > 1000, checks: checks.slice(0,1000).map(check => ({ ...check, quality: JSON.parse(check.quality), evidence: JSON.parse(check.evidence) })) };
  });
  app.patch<{ Params: { id: string } }>('/api/pages/:id', async request => {
    const page = required('pages', request.params.id), notes = textField(bodyObject(request.body).notes, 20000);
    run('UPDATE pages SET notes=? WHERE id=?', notes, page.id); return { ok: true };
  });
  app.patch<{ Params: { id: string } }>('/api/pages/:id/rules', async request => {
    const page = required('pages', request.params.id), site = required('sites', page.site_id), body = bodyObject(request.body);
    const ignore = ruleFields(body.ignoreRules, 30), important = ruleFields(body.importantRules, 20);
    if (JSON.parse(site.ignore_selectors).length + ignore.length > 30) fail('Le esclusioni della pagina e del sito possono essere al massimo 30 in totale.');
    run('UPDATE pages SET ignore_rules=?,important_rules=? WHERE id=?', JSON.stringify(ignore), JSON.stringify(important), page.id);
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/pages/:id/scan', async request => {
    const page = required('pages', request.params.id);
    const body = request.body ? bodyObject(request.body) : {};
    if (body.force !== undefined && typeof body.force !== 'boolean') fail('Opzione di riavvio non valida');
    return requestManualScan(page.site_id, { pageId: page.id, restart: body.force === true });
  });
  app.get<{ Params: { id: string } }>('/api/versions/:id', async request => ({ version: serializeVersion(required('versions', request.params.id), true) }));
  for (const document of [false, true]) app.get<{ Params: { id: string }; Querystring: { at?: string } }>(`/api/versions/:id/offline${document ? '/html' : ''}`, async (request, reply) => {
    const version = required('versions', request.params.id), page = required('pages', version.page_id);
    const at = request.query.at ?? version.captured_at;
    if (typeof at !== 'string' || at.length > 30 || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail('Data di consultazione non valida');
    const rows = all(`SELECT p.url,v.id,v.final_url,v.title,v.captured_at FROM pages p JOIN versions v ON v.id=COALESCE(
      (SELECT c.version_id FROM checks c JOIN versions cv ON cv.id=c.version_id WHERE c.page_id=p.id AND c.created_at<=? AND
        (c.status IN ('ok','unchanged') OR (cv.review_state='observed' AND json_extract(c.evidence,'$.kind') IN ('first','change')))
        ORDER BY c.created_at DESC,c.id DESC LIMIT 1),
      (SELECT id FROM versions WHERE page_id=p.id AND captured_at<=? ORDER BY captured_at DESC,id DESC LIMIT 1),
      (SELECT id FROM versions WHERE page_id=p.id ORDER BY captured_at ASC,id ASC LIMIT 1))
      WHERE p.site_id=? ORDER BY p.first_seen_at,p.id LIMIT 1000`, at, at, page.site_id);
    const targets: OfflineTarget[] = rows.map(row => ({ id: row.id, url: row.url, finalUrl: row.final_url, title: row.title, capturedAt: row.captured_at, later: row.captured_at > at }));
    const previewUrl = `/api/versions/${encodeURIComponent(version.id)}/offline/html?at=${encodeURIComponent(at)}`;
    if (!document) return { version: serializeVersion(version), at, targets, previewUrl };
    const path = objectPath(version.html_hash);
    if (statSync(path).size > offlineMaxBytes) fail('Questa copia supera il limite di elaborazione sicura. Puoi consultare lo screenshot conservato.', 413);
    const html = await renderHtml(reply, signal => offlineDocumentIsolated(readFileSync(path, 'utf8'), version.final_url, targets, undefined, { signal }));
    reply.type('text/html; charset=utf-8').header('Content-Security-Policy', offlinePolicy)
      .header('X-Frame-Options', 'SAMEORIGIN').header('Referrer-Policy', 'no-referrer')
      .header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    return reply.send(html);
  });
  for (const kind of ['screenshot', 'html'] as const) app.get<{ Params: { id: string } }>(`/api/versions/:id/${kind}`, async (request, reply) => {
    const v = required('versions', request.params.id), isHtml = kind === 'html';
    reply.type(isHtml ? 'text/html; charset=utf-8' : 'image/png');
    if (isHtml) reply.header('Content-Disposition', `attachment; filename="landing-${v.captured_at.slice(0, 10)}-${v.id}.html"`).header('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:");
    if (isHtml) {
      const path = objectPath(v.html_hash);
      if (statSync(path).size > offlineMaxBytes) fail('Questa copia supera il limite di elaborazione sicura. Puoi consultare lo screenshot conservato.', 413);
      return reply.send(await renderHtml(reply, signal => sanitizeArchiveDocument(readFileSync(path, 'utf8'), v.final_url, { signal })));
    }
    return reply.send(createReadStream(objectPath(v.screenshot_hash)));
  });
  app.get<{ Querystring: { left: string; right: string } }>('/api/compare', async request => {
    const left = required('versions', request.query.left), right = required('versions', request.query.right);
    if (left.page_id !== right.page_id) fail('Scegli due versioni della stessa pagina');
    return { left: serializeVersion(left), right: serializeVersion(right), ...compareContent(left, right) };
  });
  app.get<{ Querystring: { left: string; right: string } }>('/api/compare/visual', { exposeHeadRoute: false, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const left = required('versions', request.query.left), right = required('versions', request.query.right);
    if (left.page_id !== right.page_id) fail('Scegli due versioni della stessa pagina');
    const key = `${left.screenshot_hash}:${right.screenshot_hash}`;
    const cached = visualCache.get(key);
    if (cached) return cached;
    if (visualJob) return reply.code(409).send({ error: 'È già in preparazione un’evidenziazione. Attendi qualche secondo e riprova.' });
    const controller = new AbortController(); visualJob = controller;
    const closed = () => { if (!reply.raw.writableFinished) controller.abort(); };
    reply.raw.once('close', closed);
    try {
      const readImage = (hash: string) => {
        const path = objectPath(hash);
        if (statSync(path).size > captureLimits.screenshotBytes) fail('Questa vecchia copia supera il limite dell’evidenziazione. Puoi consultare lo screenshot originale.', 413);
        return readFileSync(path);
      };
      const result = await locateVisualChanges(readImage(left.screenshot_hash), readImage(right.screenshot_hash), controller.signal);
      // Only small derived coordinates are cached; no new archive files.
      visualCache.set(key, result);
      if (visualCache.size > 8) visualCache.delete(visualCache.keys().next().value!);
      return result;
    } finally {
      reply.raw.removeListener('close', closed);
      if (visualJob === controller) visualJob = undefined;
    }
  });
  app.get<{ Querystring: { q?: string } }>('/api/search', async request => {
    const q = textField(request.query.q ?? '', 200);
    if (!q) return { pages: [] };
    const value = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    return { pages: all(`SELECT p.id,p.url,p.title,s.name siteName FROM pages p JOIN sites s ON s.id=p.site_id WHERE p.url LIKE ? ESCAPE '\\' OR p.title LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM versions v WHERE v.page_id=p.id AND v.text LIKE ? ESCAPE '\\') LIMIT 100`, value, value, value) };
  });
  for (const portable of [false, true]) app.get<{ Params: { id: string } }>(portable ? '/api/sites/:id/export' : '/api/export', { exposeHeadRoute: false }, async (request, reply) => {
    if (portable) required('sites', request.params.id);
    if (archiveState.exporting) return reply.code(409).send({ error: 'Un’esportazione è già in corso' });
    archiveState.exporting = true;
    let destination: string | undefined;
    try {
      destination = snapshot();
      const zip = portable ? portableZip(destination, request.params.id) : backupZip(destination);
      let cleaned = false;
      const cleanup = () => { if (cleaned) return; cleaned = true; archiveState.exporting = false; rmSync(destination!, { force: true }); };
      zip.once('close', cleanup); zip.once('error', cleanup);
      zip.on('warning', error => zip.destroy(error));
      reply.raw.once('close', () => { if (!reply.raw.writableFinished) zip.abort(); cleanup(); });
      reply.header('Content-Disposition', `attachment; filename="landing-archive-${portable ? 'site-' : ''}${now().slice(0, 10)}.zip"`).type('application/zip');
      if (!portable) void zip.finalize().catch(error => zip.destroy(error));
      return reply.send(zip);
    } catch (error) { archiveState.exporting = false; if (destination) rmSync(destination, { force: true }); throw error; }
  });
  // Corresponding application source is available to authenticated network users (AGPL).
  app.get('/api/source', async (_request, reply) => {
    const root = existsSync(resolve('source/src')) ? resolve('source') : resolve('.');
    const zip = new ZipArchive({ zlib: { level: 3 } });
    zip.directory(join(root, 'src'), 'src'); zip.directory(join(root, 'web'), 'web');
    zip.directory(join(root, 'tests'), 'tests');
    zip.directory(join(root, 'scripts'), 'scripts');
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
