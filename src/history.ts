import { visualDifference } from './image-compare.js';
import { captureLimits, validateCaptureResult } from './capture-limits.js';
export { visualDifference } from './image-compare.js';
import type { CaptureResult, DetectionData, CaptureQuality } from './types.js';
import { addEvent, get, id, later, now, run, transaction, type Row } from './db.js';
import { hash, putObject, readObject } from './storage.js';
import { detectionFields, importantSignature, monitoringKey, comparisonUrl } from './detection.js';
import { schedulerEnabled } from './config.js';

export function contentSignature(result: CaptureResult) {
  return hash(JSON.stringify(signatureFields({ ...(result.detection?.content || result), finalUrl: result.finalUrl }, result.detection)));
}
const signatureFields = (content: Parameters<typeof detectionFields>[0], data?: DetectionData | null) => ({ ...detectionFields(content), ...(data?.important.length ? { important: JSON.parse(importantSignature(data)) } : {}) });
const storedContent = (version: Row) => ({ title: version.title, text: version.text, headings: JSON.parse(version.headings), links: JSON.parse(version.links), imageUrls: JSON.parse(version.images), finalUrl: version.final_url });

export async function recordCapture(page: Row, site: Row, result: CaptureResult, signal?: AbortSignal) {
  signal?.throwIfAborted();
  validateCaptureResult(result);
  const previous = page.last_version_id ? get('SELECT * FROM versions WHERE id=?', page.last_version_id) : undefined;
  const previousData = previous ? JSON.parse(previous.detection || 'null') as DetectionData | null : null;
  const previousQuality = previous ? JSON.parse(previous.quality || 'null') as CaptureQuality | null : null;
  const signature = contentSignature(result);
  const previousSignature = previous ? hash(JSON.stringify(signatureFields({ ...(previousData?.content || storedContent(previous)), finalUrl: previous.final_url }, previousData))) : '';
  const rulesChanged = !!previous && !!result.detection && (previousData ? previousData.rulesKey !== result.detection.rulesKey : result.detection.rulesKey !== monitoringKey([], []));
  const importantChanged = !!previousData && importantSignature(previousData) !== importantSignature(result.detection);
  const contentChanged = !previous || previousSignature !== signature || importantChanged;
  const quality: CaptureQuality = result.quality ? { ...result.quality, reasons: [...result.quality.reasons] } : { status: 'complete', missingImages: 0, reasons: [] };
  // A dramatic text loss may be an unfinished render. Confirm it once before
  // treating it as an intentional removal, while keeping every check visible.
  const textCollapsed = !!previous && !rulesChanged && previous.text.length > 300 && result.text.length < previous.text.length * 0.3 && !page.quality_retry_count;
  if (textCollapsed) { quality.status = 'partial'; quality.reasons.push('Il testo è molto più breve della copia precedente: serve un controllo di conferma.'); }
  const partial = quality.status === 'partial';
  const previousImage = previous && get('SELECT bytes FROM objects WHERE hash=?', previous.screenshot_hash);
  const visualChange = previous && !contentChanged && !rulesChanged && !partial && previousQuality?.status !== 'partial' && previousImage?.bytes <= captureLimits.screenshotBytes
    ? await visualDifference(readObject(previous.screenshot_hash), result.screenshot, {
      ignored: [...(previousData?.ignored || []), ...(result.detection?.ignored || [])].slice(0, 600),
      important: [...(previousData?.important.flatMap(item => item.rectangles) || []), ...(result.detection?.important.flatMap(item => item.rectangles) || [])].slice(0, 600),
    }) : 0;
  signal?.throwIfAborted();
  // Re-read settings after the asynchronous comparison; an edit in the UI must
  // never install a baseline measured with obsolete rules.
  const currentPage = get('SELECT * FROM pages WHERE id=?', page.id), currentSite = get('SELECT * FROM sites WHERE id=?', site.id);
  if (!currentPage || !currentSite) throw new Error('Pagina rimossa durante il controllo.');
  if (result.detection) {
    const key = monitoringKey([...JSON.parse(currentSite.ignore_selectors), ...JSON.parse(currentPage.ignore_rules).map((r: any) => r.selector)].slice(0, 30), JSON.parse(currentPage.important_rules).map((r: any) => r.selector));
    if (key !== result.detection.rulesKey) throw new Error('Le regole sono state aggiornate durante il controllo. Il tentativo sarà ripetuto.');
  }
  site = currentSite; page = currentPage;
  const improved = !partial && previousQuality?.status === 'partial';
  const changed = !previous || (!textCollapsed && (contentChanged || (!partial && (visualChange > 0.005 || rulesChanged || improved))));
  const recovered = ['missing','unavailable','error','blocked'].includes(page.last_status);
  let versionId: string = previous?.id || '';
  const capturedAt = result.capturedAt || now();
  return transaction(() => {
    let kind = 'unchanged', message = 'Nessuna modifica significativa';
    if (partial) message = `Acquisizione da verificare: ${quality.reasons.join(' ')} Le sole differenze visive non generano una nuova versione.`;
    if (changed) {
      const html = putObject(result.html, 'html'), screenshot = putObject(result.screenshot, 'png');
      const returned = get('SELECT id FROM versions WHERE page_id=? AND signature=? AND screenshot_hash=? ORDER BY captured_at DESC LIMIT 1', page.id, signature, screenshot.hash);
      kind = !previous ? 'captured' : partial ? 'partial' : rulesChanged ? 'baseline' : improved && !contentChanged ? 'quality_restored' : returned ? 'returned' : 'changed';
      message = !previous ? partial ? 'Prima copia conservata · acquisizione parziale' : 'Prima versione archiviata'
        : partial ? 'Nuovo contenuto conservato · acquisizione parziale'
        : rulesChanged ? 'Riferimento aggiornato alle nuove regole di confronto'
        : improved && !contentChanged ? 'Acquisizione completata dopo una copia parziale'
        : returned ? 'Ritorno a una versione già osservata'
        : importantChanged ? 'Modifica in una zona importante'
        : contentChanged ? 'Contenuto della pagina modificato' : 'Modifica visiva significativa';
      versionId = id();
      run(`INSERT INTO versions (id,page_id,captured_at,title,final_url,status_code,text,links,headings,images,signature,html_hash,screenshot_hash,bytes,reason,warnings,quality,detection) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        versionId, page.id, capturedAt, result.title, result.finalUrl, result.statusCode,
        result.text, JSON.stringify(result.links), JSON.stringify(result.headings), JSON.stringify(result.imageUrls),
        signature, html.hash, screenshot.hash, html.bytes + screenshot.bytes, message, JSON.stringify(result.warnings), JSON.stringify(quality), JSON.stringify(result.detection || null));
      addEvent(site.id, page.id, kind, message, versionId);
    }
    if (previous && comparisonUrl(previous.final_url) !== comparisonUrl(result.finalUrl)) addEvent(site.id, page.id, 'redirect', `Destinazione aggiornata: ${result.finalUrl}`, versionId);
    else if (!previous && page.url !== result.finalUrl) addEvent(site.id, page.id, 'redirect', `La pagina reindirizza a ${result.finalUrl}`, versionId);
    if (recovered) addEvent(site.id, page.id, 'recovered', 'Pagina nuovamente raggiungibile', versionId);
    const retry = partial && !page.quality_retry_count;
    if (partial) message += site.paused || !schedulerEnabled ? ' Il monitoraggio automatico è sospeso: puoi ripetere il controllo manualmente.' : retry ? ' Nuovo controllo di qualità tra 5 minuti.' : ' Il controllo successivo seguirà la frequenza del sito.';
    const status = partial ? 'partial' : changed ? 'ok' : 'unchanged';
    run('INSERT INTO checks (id,page_id,created_at,status,message,version_id,status_code,final_url,quality) VALUES (?,?,?,?,?,?,?,?,?)', id(), page.id, capturedAt, status, message.slice(0, 2000), versionId, result.statusCode, result.finalUrl, JSON.stringify(quality));
    run('UPDATE pages SET title=?,last_checked_at=?,last_status=?,last_version_id=?,missing_count=0,next_check_at=?,quality_retry_count=? WHERE id=?', result.title, capturedAt, status, versionId, later(retry ? Math.min(5 / 60, site.interval_hours) : site.interval_hours), partial ? 1 : 0, page.id);
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
