import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fork, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, renameSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { appendFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { db, all, get, run, id, transaction, type Row } from './db.js';
import { dataDir } from './config.js';
import { checkSpace, storageStatus } from './storage.js';
import { archiveTables, saveSafetyBackup } from './backup.js';
import { passwordMatches, sessionUser } from './auth.js';
import { suspendJobs } from './jobs.js';

export type ArchiveState = { exporting: boolean; restoring: boolean };
const maxUpload = 32 * 1024 ** 3, chunkBytes = 1024 ** 2;
const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
type Pending = { id: string; owner: string; directory: string; bytes: number; received: number; expires: number; busy: boolean; preview?: Row; child?: ChildProcess };

export function registerRestore(app: FastifyInstance, state: ArchiveState, clearCache: () => void) {
  const root = join(dataDir, 'tmp', 'restore'); mkdirSync(root, { recursive: true, mode: 0o700 });
  // A restart discards unfinished uploads, never the live database or safety copy.
  for (const name of readdirSync(root)) rmSync(join(root, name), { recursive: true, force: true });
  const safety = join(dataDir, 'backups', 'before-restore.zip');
  let pending: Pending | undefined, activeWrites = 0;
  const writing = new WeakSet<FastifyRequest>();
  const cleanup = () => { if (!pending || pending.busy) return; rmSync(pending.directory, { recursive: true, force: true }); pending = undefined; };
  const expiry = setInterval(() => { if (pending && pending.expires < Date.now()) cleanup(); }, 60000); expiry.unref();
  app.addHook('onClose', async () => { clearInterval(expiry); if (pending?.child) { const child = pending.child; await new Promise<void>(resolve => { child.once('exit', () => resolve()); child.kill('SIGKILL'); }); } if (pending) pending.busy = false; cleanup(); });
  app.addHook('onRequest', async (request, reply) => {
    if (state.restoring && request.routeOptions.url?.startsWith('/api/') && !['/api/restore/status','/api/auth/status'].includes(request.routeOptions.url)) return reply.code(503).send({ error: 'Ripristino in corso. Attendi il completamento prima di usare l’archivio.' });
    if (!['GET','HEAD','OPTIONS'].includes(request.method) && !request.routeOptions.url?.startsWith('/api/restore')) { activeWrites++; writing.add(request); }
  });
  app.addHook('onResponse', async request => { if (writing.delete(request)) activeWrites--; });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: chunkBytes }, (_request, body, done) => done(null, body));
  const owned = (request: FastifyRequest, value: string) => {
    if (!pending || pending.id !== value || pending.owner !== sessionUser(request)?.id || pending.expires < Date.now()) return fail('Caricamento scaduto o non disponibile. Seleziona nuovamente il backup.', 404);
    return pending;
  };
  app.get('/api/restore/status', async request => ({ applying: state.restoring, safetyAvailable: existsSync(safety), maxUploadBytes: maxUpload, chunkBytes, upload: pending && pending.owner === sessionUser(request)?.id ? { id: pending.id, bytes: pending.bytes, received: pending.received, busy: pending.busy, preview: pending.preview } : null }));
  app.get('/api/restore/safety', async (_request, reply) => {
    if (!existsSync(safety)) fail('Nessuna copia di sicurezza disponibile', 404);
    return reply.type('application/zip').header('Content-Disposition', 'attachment; filename="landing-archive-before-restore.zip"').send(createReadStream(safety));
  });
  app.post<{ Body: { bytes: number } }>('/api/restore/uploads', async request => {
    if (pending && pending.expires < Date.now()) cleanup();
    if (pending) fail('Un caricamento è già in corso. Annullalo oppure attendi un’ora dalla sua ultima attività.', 409);
    const bytes = request.body?.bytes;
    if (!Number.isSafeInteger(bytes) || bytes < 22 || bytes > maxUpload) fail('Seleziona un backup ZIP completo, fino a 32 GB.');
    checkSpace(bytes * 2 + 1024 ** 3);
    const token = id(), directory = join(root, token); mkdirSync(directory, { mode: 0o700 });
    writeFileSync(join(directory, 'upload.zip'), '', { flag: 'wx', mode: 0o600 });
    pending = { id: token, owner: sessionUser(request)!.id, directory, bytes, received: 0, expires: Date.now() + 3600000, busy: false };
    return { id: token, chunkBytes };
  });
  app.put<{ Params: { id: string }; Querystring: { offset: string } }>('/api/restore/uploads/:id', { bodyLimit: chunkBytes }, async request => {
    const item = owned(request, request.params.id), body = request.body as Buffer;
    if (item.busy || item.preview) fail('Caricamento già in verifica', 409);
    if (!Buffer.isBuffer(body) || !body.length || body.length > chunkBytes || Number(request.query.offset) !== item.received || item.received + body.length > item.bytes) fail('Blocco del caricamento non valido');
    item.busy = true;
    try { checkSpace(body.length); await appendFile(join(item.directory, 'upload.zip'), body); item.received += body.length; item.expires = Date.now() + 3600000; return { received: item.received }; }
    finally { item.busy = false; }
  });
  app.delete<{ Params: { id: string } }>('/api/restore/uploads/:id', async request => {
    const item = owned(request, request.params.id);
    if (item.busy) fail('La verifica è in corso. Attendi che termini prima di annullare.', 409);
    cleanup(); return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/restore/uploads/:id/verify', async request => {
    const item = owned(request, request.params.id);
    if (item.busy || item.received !== item.bytes || item.preview) fail('Completa prima il caricamento', 409);
    item.busy = true;
    try {
      const available = storageStatus(), maxExpanded = Math.floor(Math.min(64 * 1024 ** 3, (available.freeBytes - available.minFreeBytes) / 2));
      const built = new URL('./restore-worker.js', import.meta.url), production = existsSync(built);
      const child = fork(production ? built : new URL('./restore-worker.ts', import.meta.url), [item.directory, String(maxExpanded)], {
        env: { ...process.env, DATA_DIR: join(item.directory, 'canonical') }, execArgv: ['--max-old-space-size=256', ...(production ? [] : ['--import','tsx'])], stdio: ['ignore','ignore','ignore','ipc'],
      }); item.child = child;
      const preview = await new Promise<Row>((resolve, reject) => {
        let result: Row | undefined, done = false;
        const finish = (error?: unknown) => { if (done) return; done = true; clearTimeout(timer); if (error || !result) reject(Object.assign(new Error('Il backup non è valido, è incompleto oppure supera i limiti del ripristino guidato. L’archivio attuale è intatto.'), { statusCode: 422 })); else resolve(result); };
        const timer = setTimeout(() => { child.kill('SIGKILL'); }, 10 * 60000);
        child.once('message', (message: any) => { if (message?.ok === true) result = message.result; });
        child.once('error', finish); child.once('exit', () => finish());
      });
      item.preview = preview; item.expires = Date.now() + 3600000;
      return { ...preview, currentSites: get('SELECT COUNT(*) n FROM sites')!.n, currentVersions: get('SELECT COUNT(*) n FROM versions')!.n };
    } catch (error) { item.busy = false; cleanup(); throw error; }
    finally { item.busy = false; item.child = undefined; }
  });
  app.post<{ Params: { id: string }; Body: { confirmId: string; password: string } }>('/api/restore/uploads/:id/apply', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    const item = owned(request, request.params.id), body = request.body;
    if (!item.preview || item.busy || state.exporting) fail('Completa la verifica e attendi che le esportazioni siano terminate.', 409);
    if (body?.confirmId !== item.id || typeof body.password !== 'string' || body.password.length > 200 || !passwordMatches(body.password, get('SELECT password FROM users WHERE id=?', item.owner)!.password)) fail('Conferma il ripristino con la password del tuo accesso attuale.', 403);
    item.busy = true; state.restoring = true;
    let resume: (() => void) | undefined;
    const safetyTemp = join(dataDir, 'backups', `${id()}.zip`);
    try {
      const deadline = Date.now() + 10000;
      while (activeWrites && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      if (activeWrites) fail('Un’altra operazione è ancora in corso. Attendi e riprova.', 409);
      resume = await suspendJobs();
      const oldObjects = all('SELECT hash,path FROM objects');
      const oldBytes = get('SELECT COALESCE(SUM(bytes),0) n FROM objects')!.n;
      checkSpace(oldBytes * 1.02 + item.preview!.bytes + item.preview!.databaseBytes * 3 + statSync(join(dataDir, 'archive.sqlite')).size * 3 + 16 * 1024 ** 2);
      mkdirSync(dirname(safety), { recursive: true, mode: 0o700 });
      await saveSafetyBackup(safetyTemp);
      // Install immutable, hash-verified files before committing any row. A crash
      // here leaves only unreferenced files; the previous database stays usable.
      const canonical = join(item.directory, 'canonical/archive.sqlite');
      db.prepare('ATTACH DATABASE ? AS restored').run(canonical);
      try {
        for (const object of all('SELECT path FROM restored.objects')) {
          const target = join(dataDir, object.path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
          const temp = join(dataDir, 'tmp', `${id()}.object`);
          try { await copyFile(join(item.directory, 'extracted', object.path), temp); renameSync(temp, target); }
          finally { rmSync(temp, { force: true }); }
        }
        // Keep the safety copy durable and downloadable before replacing rows.
        renameSync(safetyTemp, safety);
        transaction(() => {
          run('DELETE FROM jobs');
          for (const table of [...archiveTables].reverse()) run(`DELETE FROM ${table}`);
          for (const table of archiveTables) run(`INSERT INTO ${table} SELECT * FROM restored.${table}`);
          run("DELETE FROM settings WHERE key='inbox_kinds'");
          run("INSERT INTO settings SELECT * FROM restored.settings WHERE key='inbox_kinds'");
          // All sites are paused by the validator; discard stale scheduled jobs.
        });
        clearCache();
      } finally { db.exec('DETACH DATABASE restored'); }
      for (const object of oldObjects) if (!get('SELECT hash FROM objects WHERE hash=?', object.hash)) { try { rmSync(join(dataDir, object.path), { force: true }); } catch { /* The safety ZIP already preserves these files. */ } }
      item.busy = false; cleanup();
      return { ok: true, safetyAvailable: true, message: 'Archivio ripristinato. Il tuo accesso è invariato. Tutti i siti sono in pausa: riattivali dalle loro impostazioni quando vuoi.' };
    } finally { state.restoring = false; item.busy = false; resume?.(); rmSync(safetyTemp, { force: true }); }
  });
}
