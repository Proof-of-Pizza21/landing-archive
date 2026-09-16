import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { all, get, run, now, id, later, transaction, enqueue, addEvent } from './db.js';
import { cancelSiteJobs, wakeJobs } from './jobs.js';
import { removeUnusedObjects } from './storage.js';
import { removePageDiagnostics } from './diagnostics.js';
import type { ArchiveState } from './restore.js';

const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
function preview(siteId: string) {
  const site = get('SELECT id,name,updated_at FROM sites WHERE id=?', siteId) || fail('Sito non trovato', 404);
  const pages = all('SELECT id,last_version_id,reference_version_id,last_checked_at FROM pages WHERE site_id=? ORDER BY id', siteId);
  const versions = all(`SELECT v.id,v.captured_at,v.html_hash,v.screenshot_hash,COALESCE(n.note,'') note,COALESCE(n.favorite,0) favorite,n.updated_at,
    (SELECT COUNT(*) FROM version_tags t WHERE t.version_id=v.id) tags
    FROM versions v JOIN pages p ON p.id=v.page_id LEFT JOIN version_notes n ON n.version_id=v.id WHERE p.site_id=? ORDER BY v.id`, siteId);
  const reclaimableBytes = get(`SELECT COALESCE(SUM(o.bytes),0) bytes FROM objects o
    WHERE EXISTS(SELECT 1 FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id=? AND (v.html_hash=o.hash OR v.screenshot_hash=o.hash))
    AND NOT EXISTS(SELECT 1 FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id<>? AND (v.html_hash=o.hash OR v.screenshot_hash=o.hash))`, siteId, siteId)!.bytes;
  return { siteId, siteName: site.name, pages: pages.length, versions: versions.length,
    annotatedVersions: versions.filter(version => version.note || version.favorite || version.tags).length, reclaimableBytes,
    token: createHash('sha256').update(JSON.stringify({ site, pages, versions })).digest('hex') };
}

export function registerSiteReset(app: FastifyInstance, state: ArchiveState, clearCache: () => void) {
  app.get<{ Params: { id: string } }>('/api/sites/:id/reset', async request => preview(request.params.id));
  app.post<{ Params: { id: string }; Body: { token: string; confirmSiteId: string } }>('/api/sites/:id/reset', async request => {
    const body = request.body;
    if (!body || body.confirmSiteId !== request.params.id || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) fail('Conferma il sito e l’anteprima prima di azzerare le copie.');
    if (state.exporting || state.restoring) fail('Attendi il termine del backup o del ripristino prima di azzerare le copie.', 409);
    const site = get('SELECT * FROM sites WHERE id=?', request.params.id) || fail('Sito non trovato', 404);
    const hashes = all('SELECT v.html_hash,v.screenshot_hash FROM versions v JOIN pages p ON p.id=v.page_id WHERE p.site_id=?', site.id).flatMap(version => [version.html_hash, version.screenshot_hash]);
    const pages = all('SELECT id FROM pages WHERE site_id=?', site.id);
    const result = transaction(() => {
      const current = preview(site.id);
      if (body.token !== current.token) fail('Le copie o i controlli sono cambiati. Aggiorna l’anteprima prima di confermare.', 409);
      cancelSiteJobs(site.id);
      run("UPDATE jobs SET status='cancelled',finished_at=?,error='Archivio del sito azzerato.' WHERE site_id=? AND status='queued'", now(), site.id);
      // Keep check dates, making it explicit that their original files no longer exist.
      for (const version of all(`SELECT v.id,v.page_id,v.captured_at,v.quality FROM versions v JOIN pages p ON p.id=v.page_id
        WHERE p.site_id=? AND NOT EXISTS(SELECT 1 FROM checks c WHERE c.version_id=v.id)`, site.id)) {
        run('INSERT INTO checks(id,page_id,created_at,status,message,version_id,quality) VALUES(?,?,?,?,?,?,?)', id(),version.page_id,version.captured_at,'unchanged','Copia rimossa durante l’azzeramento del sito; data conservata.',version.id,version.quality);
      }
      run(`UPDATE checks SET evidence=json_set(evidence,'$.originalVersionId',version_id,
        '$.originalCapturedAt',(SELECT captured_at FROM versions WHERE id=checks.version_id),'$.originalFilesRemoved',json('true')),version_id=NULL
        WHERE page_id IN(SELECT id FROM pages WHERE site_id=?) AND version_id IS NOT NULL`, site.id);
      run('UPDATE events SET version_id=NULL WHERE site_id=?', site.id);
      run(`UPDATE pages SET last_version_id=NULL,reference_version_id=NULL,last_checked_at=NULL,last_status=NULL,missing_count=0,
        quality_retry_count=0,candidate_fingerprint=NULL,candidate_count=0,candidate_first_at=NULL,candidate_last_at=NULL,candidate_clean_count=0,candidate_retry_count=0,
        next_check_at=? WHERE site_id=?`, now(), site.id);
      run('DELETE FROM versions WHERE page_id IN(SELECT id FROM pages WHERE site_id=?)', site.id);
      run('UPDATE sites SET updated_at=?,next_discovery_at=? WHERE id=?', now(), later(site.discovery_interval_hours), site.id);
      const jobIds = pages.map(page => enqueue(site.id, page.id, 'capture', true));
      if (site.max_pages > 1) jobIds.push(enqueue(site.id, null, 'discover', true));
      addEvent(site.id, null, 'archive_reset', 'Copie del sito azzerate su richiesta. Nuova scansione avviata senza riferimenti precedenti.');
      return { deletedVersions: current.versions, jobIds };
    });
    clearCache();
    for (const page of pages) removePageDiagnostics(page.id);
    const removed = removeUnusedObjects(hashes);
    wakeJobs();
    return { ok: true, ...result, ...removed, paused: Boolean(site.paused), message: 'Copie azzerate. Nuova scansione in coda; sito, pagine e impostazioni conservati.' };
  });
}
