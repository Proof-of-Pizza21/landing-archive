import { visualDifference } from './image-compare.js';
import { captureLimits, validateCaptureResult } from './capture-limits.js';
export { visualDifference } from './image-compare.js';
import type { CaptureResult } from './types.js';
import { addEvent, get, id, later, now, run, transaction, type Row } from './db.js';
import { hash, putObject, readObject } from './storage.js';

function normalized(value: string) { return value.normalize('NFKC').replace(/\s+/g, ' ').trim(); }
export function contentSignature(result: CaptureResult) {
  return hash(JSON.stringify({
    title: normalized(result.title), text: normalized(result.text),
    headings: result.headings.map(normalized),
    links: result.links.map(l => [l.url, normalized(l.text)]).sort((a, b) => a.join('|').localeCompare(b.join('|'))),
    images: [...new Set(result.imageUrls)].sort(), finalUrl: result.finalUrl,
  }));
}

export async function recordCapture(page: Row, site: Row, result: CaptureResult, signal?: AbortSignal) {
  signal?.throwIfAborted();
  validateCaptureResult(result);
  const signature = contentSignature(result);
  const previous = page.last_version_id ? get('SELECT * FROM versions WHERE id=?', page.last_version_id) : undefined;
  const previousImage = previous && get('SELECT bytes FROM objects WHERE hash=?', previous.screenshot_hash);
  const visualChange = previous && previous.signature === signature && previousImage?.bytes <= captureLimits.screenshotBytes
    ? await visualDifference(readObject(previous.screenshot_hash), result.screenshot) : 1;
  // A site may be removed or its running check restarted during comparison.
  signal?.throwIfAborted();
  const changed = !previous || previous.signature !== signature || visualChange > 0.005;
  const recovered = page.last_status && !['ok', 'unchanged'].includes(page.last_status);
  let versionId: string = previous?.id || '';
  const capturedAt = result.capturedAt || now();

  return transaction(() => {
    let kind = 'unchanged', message = 'Nessuna modifica significativa';
    if (changed) {
      const html = putObject(result.html, 'html');
      const screenshot = putObject(result.screenshot, 'png');
      const returned = get('SELECT id FROM versions WHERE page_id=? AND signature=? AND screenshot_hash=? ORDER BY captured_at DESC LIMIT 1', page.id, signature, screenshot.hash);
      kind = !previous ? 'captured' : returned ? 'returned' : 'changed';
      message = !previous ? 'Prima versione archiviata' : returned ? 'Ritorno a una versione già osservata' : previous.signature === signature ? 'Modifica visiva rilevata' : 'Contenuto della pagina modificato';
      versionId = id();
      run(`INSERT INTO versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        versionId, page.id, capturedAt, result.title, result.finalUrl, result.statusCode,
        result.text, JSON.stringify(result.links), JSON.stringify(result.headings), JSON.stringify(result.imageUrls),
        signature, html.hash, screenshot.hash, html.bytes + screenshot.bytes, message, JSON.stringify(result.warnings));
      addEvent(site.id, page.id, kind, message, versionId);
    }
    if (previous && previous.final_url !== result.finalUrl) addEvent(site.id, page.id, 'redirect', `Destinazione aggiornata: ${result.finalUrl}`, versionId);
    else if (!previous && page.url !== result.finalUrl) addEvent(site.id, page.id, 'redirect', `La pagina reindirizza a ${result.finalUrl}`, versionId);
    if (recovered) addEvent(site.id, page.id, 'recovered', 'Pagina nuovamente raggiungibile', versionId);
    const status = changed ? 'ok' : 'unchanged';
    run('INSERT INTO checks VALUES (?,?,?,?,?,?,?,?)', id(), page.id, capturedAt, status, message, versionId, result.statusCode, result.finalUrl);
    run('UPDATE pages SET title=?,last_checked_at=?,last_status=?,last_version_id=?,missing_count=0,next_check_at=? WHERE id=?', result.title, capturedAt, status, versionId, later(site.interval_hours), page.id);
    return { changed, kind, versionId, message };
  });
}

export function recordFailure(page: Row, site: Row, error: any) {
  const code = Number(error.statusCode) || null;
  const missing = code === 404 || code === 410;
  const missingCount = missing ? page.missing_count + 1 : 0;
  const status = missing ? (missingCount >= 2 ? 'missing' : 'unavailable') : error.code === 'CAPTCHA' ? 'blocked' : 'error';
  const message = String(error.message || 'Acquisizione non riuscita').slice(0, 1000);
  transaction(() => {
    run('INSERT INTO checks (id,page_id,created_at,status,message,version_id,status_code,final_url) VALUES (?,?,?,?,?,?,?,?)', id(), page.id, now(), status, message, page.last_version_id, code, null);
    run('UPDATE pages SET last_checked_at=?,last_status=?,missing_count=?,next_check_at=? WHERE id=?', now(), status, missingCount, later(missingCount === 1 ? Math.min(1, site.interval_hours) : site.interval_hours), page.id);
    if (status !== page.last_status) addEvent(site.id, page.id, status, status === 'missing' ? 'Pagina non trovata in due controlli consecutivi; copie precedenti conservate' : message, page.last_version_id);
  });
}
