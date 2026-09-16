import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { all, get, run, id, transaction, type Row } from './db.js';
import { removeUnusedObjects } from './storage.js';
import { normalized } from './content-fields.js';
import { comparisonUrl } from './detection.js';
import type { ArchiveState } from './restore.js';

const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parsed = (value: string | undefined) => JSON.parse(value || '{}');

export function historySummary(pageId: string) {
  const versions = get(`SELECT COUNT(*) totalVersions,
    COALESCE(SUM(review_state='confirmed'),0) confirmed, COALESCE(SUM(review_state='observed'),0) observed,
    COALESCE(SUM(review_state='legacy'),0) legacy,
    COUNT(DISTINCT CASE WHEN variant_key<>'' THEN variant_key ELSE signature END) variants
    FROM versions WHERE page_id=?`, pageId)!;
  const checks = get(`SELECT COUNT(*) checks,COALESCE(SUM(status IN ('partial','error','blocked','unavailable','cancelled')),0) anomalies FROM checks WHERE page_id=?`, pageId)!;
  return { ...versions, ...checks };
}

// Only propose an incomplete historical sample when all of its words still
// occur in order in the surrounding complete state. Reordering, replacement
// and even one new price digit prevent this classification.
function hasNoNewContent(candidate: Row, complete: Row) {
  if (normalized(candidate.title) !== normalized(complete.title) || comparisonUrl(candidate.final_url) !== comparisonUrl(complete.final_url)) return false;
  const small = normalized(candidate.text).split(' '), large = normalized(complete.text).split(' ');
  let index = 0;
  for (const word of small) {
    if (!word) continue;
    while (index < large.length && large[index] !== word) index++;
    if (index++ >= large.length) return false;
  }
  const subset = (left: unknown[], right: unknown[]) => {
    const keys = new Set(right.map(value => JSON.stringify(value)));
    return left.every(value => keys.has(JSON.stringify(value)));
  };
  return subset(JSON.parse(candidate.headings).map(normalized), JSON.parse(complete.headings).map(normalized)) &&
    subset(JSON.parse(candidate.images).map(comparisonUrl), JSON.parse(complete.images).map(comparisonUrl)) &&
    subset(JSON.parse(candidate.links).map((link: Row) => [comparisonUrl(link.url), normalized(link.text)]), JSON.parse(complete.links).map((link: Row) => [comparisonUrl(link.url), normalized(link.text)]));
}

export function cleanupPreview(pageId: string) {
  const page = get('SELECT * FROM pages WHERE id=?', pageId) || fail('Pagina non trovata', 404);
  // Preview is bounded and contains no HTML, screenshot buffers or page text.
  const rows = all(`SELECT v.id,v.captured_at,v.signature,v.html_hash,v.screenshot_hash,v.quality,v.review_state,v.bytes,
    COALESCE(n.favorite,0) favorite,COALESCE(n.note,'') note,n.updated_at,
    (SELECT COUNT(*) FROM version_tags t WHERE t.version_id=v.id) tags
    FROM versions v LEFT JOIN version_notes n ON n.version_id=v.id
    WHERE v.page_id=? ORDER BY v.captured_at,v.id LIMIT 20001`, pageId);
  if (rows.length > 20000) fail('Questa pagina supera 20.000 versioni: conserva il backup prima di una revisione dedicata.', 413);
  const protectedIds = new Set(rows.filter((row, index) => !index || row.id === page.last_version_id || row.id === page.reference_version_id || row.review_state === 'observed' || row.favorite || row.note || row.tags).map(row => row.id));
  const candidates: Row[] = [], groups = new Map<string, Row>();
  const complete = (row: Row) => parsed(row.quality)?.status === 'complete';
  let previousComplete: Row | undefined;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], key = `${row.signature}:${row.html_hash}:${row.screenshot_hash}`;
    const keeper = groups.get(key);
    if (!keeper) groups.set(key, row);
    if (!protectedIds.has(row.id) && candidates.length < 100) {
      if (keeper) candidates.push({ id: row.id, capturedAt: row.captured_at, bytes: row.bytes, keepVersionId: keeper.id, kind: 'identical', reason: 'Stesso contenuto e stessi file di una copia già conservata.' });
      else if (row.review_state === 'legacy' && parsed(row.quality)?.status === 'partial' && previousComplete) {
        const next = rows.slice(index + 1).find(complete);
        // The incomplete file is only a proposed candidate: explicit per-row
        // selection remains required because an actual removal may look similar.
        if (next && next.signature === previousComplete.signature && next.screenshot_hash === previousComplete.screenshot_hash) {
          const candidate = get('SELECT * FROM versions WHERE id=?', row.id)!;
          const reference = get('SELECT * FROM versions WHERE id=?', previousComplete.id)!;
          if (hasNoNewContent(candidate, reference)) candidates.push({ id: row.id, capturedAt: row.captured_at, bytes: row.bytes, keepVersionId: previousComplete.id, kind: 'partial', reason: 'Copia incompleta fra due versioni uguali: verifica le immagini prima di eliminarla.' });
        }
      }
    }
    if (complete(row)) previousComplete = row;
  }
  // A proposed keeper must survive even when several candidates form a group.
  const keeping = new Set(candidates.map(row => row.keepVersionId));
  const safeCandidates = candidates.filter(row => !keeping.has(row.id));
  const reclaimableBytes = reclaimable(safeCandidates.map(row => row.id));
  return { pageId, token: digest({ rows, last: page.last_version_id, reference: page.reference_version_id }), candidates: safeCandidates,
    protectedCount: protectedIds.size, reclaimableBytes, totalVersions: rows.length, limited: candidates.length === 100 };
}

function reclaimable(ids: string[]) {
  if (!ids.length) return 0;
  const marks = ids.map(() => '?').join(',');
  return get(`SELECT COALESCE(SUM(o.bytes),0) bytes FROM objects o
    WHERE EXISTS(SELECT 1 FROM versions v WHERE v.id IN (${marks}) AND (v.html_hash=o.hash OR v.screenshot_hash=o.hash))
    AND NOT EXISTS(SELECT 1 FROM versions v WHERE v.id NOT IN (${marks}) AND (v.html_hash=o.hash OR v.screenshot_hash=o.hash))`, ...ids, ...ids)!.bytes;
}

export function registerArchiveReview(app: FastifyInstance, state: ArchiveState, clearCache: () => void) {
  app.get<{ Params: { id: string } }>('/api/pages/:id/cleanup', async request => cleanupPreview(request.params.id));
  app.post<{ Params: { id: string }; Body: { token: string; confirmPageId: string; ids: string[] } }>('/api/pages/:id/cleanup', async request => {
    const body = request.body;
    if (!body || body.confirmPageId !== request.params.id || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token) || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 || body.ids.some(value => typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))) fail('Seleziona e conferma le copie da eliminare dall’anteprima.');
    if (state.exporting || state.restoring) fail('Attendi il termine del backup o del ripristino prima di eliminare copie.', 409);
    const selected = new Set(body.ids), hashes: string[] = [];
    transaction(() => {
      const preview = cleanupPreview(request.params.id);
      if (preview.token !== body.token) fail('L’archivio è cambiato. Riapri l’anteprima prima di confermare.', 409);
      if ([...selected].some(value => !preview.candidates.some(row => row.id === value))) fail('La selezione include una versione protetta o non presente nell’anteprima.', 409);
      for (const candidate of preview.candidates.filter(row => selected.has(row.id))) {
        const version = get('SELECT * FROM versions WHERE id=?', candidate.id)!;
        hashes.push(version.html_hash, version.screenshot_hash);
        const checks = all('SELECT id,evidence FROM checks WHERE version_id=?', version.id);
        if (!checks.length) run('INSERT INTO checks (id,page_id,created_at,status,message,version_id,quality,evidence) VALUES (?,?,?,?,?,?,?,?)',
          id(), request.params.id, version.captured_at, 'unchanged', 'File rimossi dalla revisione; osservazione conservata.', candidate.keepVersionId, version.quality,
          JSON.stringify({ kind: 'reviewed', originalVersionId: version.id, originalCapturedAt: version.captured_at, originalFilesRemoved: true }));
        for (const check of checks) run('UPDATE checks SET version_id=?,evidence=? WHERE id=?', candidate.keepVersionId,
          JSON.stringify({ ...parsed(check.evidence), originalVersionId: version.id, originalCapturedAt: version.captured_at, originalFilesRemoved: true }), check.id);
        run('UPDATE events SET version_id=? WHERE version_id=?', candidate.keepVersionId, version.id);
        run('DELETE FROM versions WHERE id=?', version.id);
      }
    });
    clearCache();
    return { ok: true, deletedVersions: selected.size, ...removeUnusedObjects(hashes), message: 'Copie selezionate eliminate. Le date dei controlli e delle ricorrenze sono conservate.' };
  });
}
