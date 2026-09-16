import { visualDifference } from './image-compare.js';
import { captureLimits, validateCaptureResult } from './capture-limits.js';
export { visualDifference } from './image-compare.js';
import type { CaptureResult, DetectionData, CaptureQuality } from './types.js';
import { addEvent, all, get, id, later, now, run, transaction, type Row } from './db.js';
import { hash, putObject, readObject } from './storage.js';
import { detectionFields, importantSignature, monitoringKey, comparisonUrl } from './detection.js';
import { schedulerEnabled } from './config.js';
import { candidateFingerprint, compareContent, isReliable, canConfirmAbsence, retainedTextRatio, semanticSignature, visualFingerprint, type Evidence } from './detection-policy.js';
import { recordDiagnostic, readDiagnostic } from './diagnostics.js';

export function contentSignature(result: CaptureResult) {
  return hash(JSON.stringify(signatureFields({ ...(result.detection?.content || result), finalUrl: result.finalUrl }, result.detection)));
}
const signatureFields = (content: Parameters<typeof detectionFields>[0], data?: DetectionData | null) => ({ ...detectionFields(content), ...(data?.important.length ? { important: JSON.parse(importantSignature(data)) } : {}) });
const storedContent = (version: Row) => ({ title: version.title, text: version.text, headings: JSON.parse(version.headings), links: JSON.parse(version.links), imageUrls: JSON.parse(version.images), finalUrl: version.final_url });
const dataOf = (version?: Row) => version ? JSON.parse(version.detection || 'null') as DetectionData | null : null;
const qualityOf = (version?: Row) => version ? JSON.parse(version.quality || 'null') as CaptureQuality | null : null;
const contentOf = (version: Row) => ({ ...(dataOf(version)?.content || storedContent(version)), finalUrl: version.final_url });
const missingQuality = (): CaptureQuality => ({ status: 'partial', missingImages: 0, reasons: ['Il motore non ha fornito i dati di qualità di questa acquisizione.'] });

export async function recordCapture(page: Row, site: Row, result: CaptureResult, signal?: AbortSignal) {
  signal?.throwIfAborted(); validateCaptureResult(result);
  const initialPage = get('SELECT * FROM pages WHERE id=?', page.id);
  if (!initialPage) throw new Error('Pagina rimossa durante il controllo.');
  page = initialPage;
  const last = page.last_version_id ? get('SELECT * FROM versions WHERE id=? AND page_id=?', page.last_version_id, page.id) : undefined;
  let reference = page.reference_version_id ? get('SELECT * FROM versions WHERE id=? AND page_id=?', page.reference_version_id, page.id) : undefined;
  if (!reference || !isReliable(qualityOf(reference))) reference = get(`SELECT * FROM versions WHERE page_id=? AND json_extract(quality,'$.status')='complete' ORDER BY captured_at DESC,id DESC LIMIT 1`, page.id);
  // A first partial copy remains evidence, not a trusted reference.
  const baseline = reference || get('SELECT * FROM versions WHERE page_id=? ORDER BY captured_at,id LIMIT 1', page.id);
  const previousData = dataOf(baseline), currentContent = { ...(result.detection?.content || result), finalUrl: result.finalUrl };
  const quality = result.quality ? { ...result.quality, reasons: [...result.quality.reasons] } : missingQuality();
  const reliable = isReliable(quality), signature = semanticSignature(currentContent, result.detection);
  const rulesChanged = !!baseline && !!result.detection && result.detection.rulesKey !== (previousData?.rulesKey || monitoringKey([], []));
  const comparison = baseline ? compareContent(contentOf(baseline), previousData, currentContent, result.detection) : { changed: true, novel: true, absenceOnly: false, signals: ['Prima osservazione della pagina'] };
  const importantChanged = !!previousData && importantSignature(previousData) !== importantSignature(result.detection);
  const options = { ignored: [...(previousData?.ignored || []), ...(result.detection?.ignored || [])].slice(0, 600), important: [...(previousData?.important.flatMap(item => item.rectangles) || []), ...(result.detection?.important.flatMap(item => item.rectangles) || [])].slice(0, 600) };
  let visualChange = 0;
  if (baseline && reliable && !comparison.changed && !rulesChanged) {
    const object = get('SELECT bytes FROM objects WHERE hash=?', baseline.screenshot_hash);
    visualChange = object && object.bytes <= captureLimits.screenshotBytes ? await visualDifference(readObject(baseline.screenshot_hash), result.screenshot, options) : 1;
  }
  const visualChanged = visualChange > 0.005;
  const needsConfirmation = !!baseline && !rulesChanged && (comparison.absenceOnly || (!comparison.changed && visualChanged));
  let fingerprint = candidateFingerprint(signature, visualChanged ? visualFingerprint(result.screenshot) : undefined);
  if (visualChanged && !comparison.changed && page.candidate_fingerprint) {
    const previousCheck = get('SELECT evidence FROM checks WHERE page_id=? ORDER BY created_at DESC,id DESC LIMIT 1', page.id);
    const previousEvidence: Evidence = JSON.parse(previousCheck?.evidence || '{}');
    if (previousEvidence.fingerprint === page.candidate_fingerprint && previousEvidence.semanticSignature === signature && previousEvidence.diagnosticId) {
      try {
        const sample = readDiagnostic(page.id, previousEvidence.diagnosticId);
        if (await visualDifference(sample, result.screenshot, options) <= 0.005) fingerprint = page.candidate_fingerprint;
      } catch { /* Expired diagnostics cannot confirm a difference. */ }
    }
  }
  const sameCandidate = page.candidate_fingerprint === fingerprint, capturedAt = result.capturedAt || now();
  const separated = !sameCandidate || !page.candidate_last_at || Date.parse(capturedAt) - Date.parse(page.candidate_last_at) >= 30000;
  const cleanCount = canConfirmAbsence(quality) ? (sameCandidate ? page.candidate_clean_count + (separated ? 1 : 0) : 1) : 0;
  const confirmed = needsConfirmation && cleanCount >= 2;
  // Text seen during a still-changing render needs another visit, too. A stable
  // new offer can be retained even if an unrelated image failed to load.
  const stableContent = quality.stable !== false && (!baseline || quality.renderStatus === 'complete' || retainedTextRatio(contentOf(baseline).text, currentContent.text) >= 0.75);
  const novel = comparison.novel && stableContent;
  const shouldKeep = !baseline || (rulesChanged && reliable) || (!rulesChanged && novel) || confirmed;
  // Returned variants reuse archived files; checks keep each occurrence's date.
  const candidates = baseline ? all(`SELECT * FROM versions WHERE page_id=? AND (signature=? OR signature=? OR variant_key=?) ORDER BY captured_at DESC,id DESC LIMIT 16`, page.id, signature, contentSignature(result), signature) : [];
  if (baseline && !candidates.some(row => row.id === baseline.id)) candidates.push(baseline);
  for (const row of all("SELECT * FROM versions WHERE page_id=? AND review_state='observed' ORDER BY captured_at DESC,id DESC LIMIT 8", page.id)) if (!candidates.some(candidate => candidate.id === row.id)) candidates.push(row);
  let known: Row | undefined, improved: Row | undefined;
  for (const candidate of candidates) {
    const diff = compareContent(contentOf(candidate), dataOf(candidate), currentContent, result.detection);
    const previousQuality = qualityOf(candidate);
    if (diff.changed) {
      // Recovering an image after a partial first sighting is an improved copy
      // of that offer, provided no text, links or known asset bytes changed.
      if (reliable && !isReliable(previousQuality)) {
        const withoutAssets = (data?: DetectionData | null) => data ? { ...data, assets: undefined } : data;
        const oldData = dataOf(candidate);
        const sameContent = !compareContent(contentOf(candidate), withoutAssets(oldData) || null, currentContent, withoutAssets(result.detection)).changed;
        const assetsUnchanged = (oldData?.assets || []).every(asset => asset.status !== 'loaded' || !asset.hash || result.detection?.assets?.some(current => current.kind === asset.kind && current.hash === asset.hash));
        if (sameContent && assetsUnchanged) improved ||= candidate;
      }
      continue;
    }
    if (reliable && !isReliable(previousQuality)) { improved ||= candidate; continue; }
    if (!reliable && !comparison.novel && candidate.id !== baseline?.id) continue;
    if (!reliable && isReliable(previousQuality)) continue;
    const object = get('SELECT bytes FROM objects WHERE hash=?', candidate.screenshot_hash);
    if (!object || object.bytes > captureLimits.screenshotBytes) continue;
    const candidateData = dataOf(candidate);
    if (await visualDifference(readObject(candidate.screenshot_hash), result.screenshot, { ignored: [...(candidateData?.ignored || []), ...(result.detection?.ignored || [])].slice(0,600), important: [...(candidateData?.important.flatMap(item => item.rectangles) || []), ...(result.detection?.important.flatMap(item => item.rectangles) || [])].slice(0,600) }) <= 0.005) { known = candidate; break; }
  }
  signal?.throwIfAborted();
  const currentPage = get('SELECT * FROM pages WHERE id=?', page.id), currentSite = get('SELECT * FROM sites WHERE id=?', site.id);
  if (!currentPage || !currentSite) throw new Error('Pagina rimossa durante il controllo.');
  if (currentPage.last_version_id !== page.last_version_id || currentPage.reference_version_id !== page.reference_version_id || currentPage.candidate_fingerprint !== page.candidate_fingerprint || currentPage.candidate_last_at !== page.candidate_last_at) throw new Error('Un altro controllo ha aggiornato il riferimento: ripetere la visita.');
  if (result.detection) {
    const key = monitoringKey([...JSON.parse(currentSite.ignore_selectors), ...JSON.parse(currentPage.ignore_rules).map((r: any) => r.selector)].slice(0, 30), JSON.parse(currentPage.important_rules).map((r: any) => r.selector));
    if (key !== result.detection.rulesKey) throw new Error('Le regole sono state aggiornate durante il controllo. Il tentativo sarà ripetuto.');
  }
  site = currentSite; page = currentPage;
  const accepted = shouldKeep || (!!known && reliable) || (!!baseline && reliable && !comparison.changed && !visualChanged && !rulesChanged);
  const pending = !reliable || (needsConfirmation && !confirmed && !known);
  const retries = pending ? Math.min(2, Number(page.candidate_retry_count) + 1) : 0;
  const evidence: Evidence = { policy: 1, kind: !baseline ? 'first' : pending && !shouldKeep ? reliable ? 'pending' : 'incomplete' : rulesChanged ? 'baseline' : comparison.changed || visualChanged ? 'change' : 'unchanged',
    ...(reference ? { referenceVersionId: reference.id } : {}), signals: comparison.signals, fingerprint, semanticSignature: signature,
    confirmationCount: sameCandidate ? Math.min(1000000, page.candidate_count + 1) : 1, retryCount: retries, visualDifference: visualChange };
  if (needsConfirmation && !comparison.signals.length) evidence.signals = [comparison.absenceOnly ? 'Una parte del contenuto è assente o ha cambiato ordine: verifica in corso.' : 'Aspetto diverso senza nuovo contenuto riconosciuto: verifica in corso.'];
  if (pending && !shouldKeep) evidence.diagnosticId = recordDiagnostic(page.id, result, evidence);
  if (!evidence.diagnosticId) delete evidence.diagnosticId;
  return transaction(() => {
    let versionId: string = last?.id || baseline?.id || '', kind = 'unchanged', changed = false;
    let message = 'Nessuna modifica significativa';
    if (known && !rulesChanged && (accepted || shouldKeep)) {
      versionId = known.id;
      evidence.kind = pending ? 'incomplete' : 'unchanged';
      if (last && last.id !== known.id) {
        kind = 'returned'; changed = true; evidence.kind = 'returned';
        message = 'Ritorno a una variante già osservata · file esistenti riutilizzati';
        addEvent(site.id, page.id, kind, message, versionId);
      }
    } else if (shouldKeep || (reliable && !reference && !needsConfirmation)) {
      const html = putObject(result.html, 'html'), screenshot = putObject(result.screenshot, 'png');
      versionId = id(); changed = true;
      kind = !baseline ? 'captured' : rulesChanged ? 'baseline' : improved ? 'quality_restored' : !reliable ? 'observed' : 'changed';
      message = !baseline ? reliable ? 'Prima versione archiviata' : 'Prima evidenza conservata · acquisizione da verificare'
        : rulesChanged ? 'Riferimento aggiornato alle nuove regole di confronto'
        : improved ? 'Copia completa conservata dopo un’osservazione da verificare'
        : !reliable ? 'Nuovo contenuto conservato · qualità da verificare'
        : importantChanged ? 'Modifica in una zona importante'
        : comparison.novel ? comparison.signals.join(' · ')
        : comparison.absenceOnly ? 'Variazione del contenuto confermata in due caricamenti verificati' : 'Modifica visiva confermata in due caricamenti verificati';
      const variantKey = improved?.variant_key || (visualChanged && !comparison.changed ? fingerprint : signature);
      run(`INSERT INTO versions(id,page_id,captured_at,title,final_url,status_code,text,links,headings,images,signature,html_hash,screenshot_hash,bytes,reason,warnings,quality,detection,review_state,variant_key,evidence) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        versionId,page.id,capturedAt,result.title,result.finalUrl,result.statusCode,result.text,JSON.stringify(result.links),JSON.stringify(result.headings),JSON.stringify(result.imageUrls),signature,html.hash,screenshot.hash,html.bytes+screenshot.bytes,message,JSON.stringify(result.warnings),JSON.stringify(quality),JSON.stringify(result.detection||null),reliable?'confirmed':'observed',variantKey,JSON.stringify(evidence));
      addEvent(site.id,page.id,kind,message,versionId);
    }
    if (pending && !changed) message = reliable ? 'Differenza da verificare: il riferimento affidabile è conservato.' : `Caricamento da verificare: ${quality.reasons.join(' ')} Nessuna nuova versione confermata.`;
    const retryDelay = pending && page.candidate_retry_count < 2 ? page.candidate_retry_count === 0 ? 1 / 60 : 5 / 60 : site.interval_hours;
    if (pending) message += site.paused || !schedulerEnabled ? ' Il monitoraggio automatico è sospeso; puoi ripetere manualmente il controllo.' : page.candidate_retry_count < 2 ? ` Nuovo controllo tra ${page.candidate_retry_count === 0 ? '1 minuto' : '5 minuti'}.` : ' I prossimi controlli seguiranno la frequenza del sito.';
    const nextReference = reliable && accepted && versionId ? versionId : reference?.id || null;
    const status = pending ? 'partial' : changed ? 'ok' : 'unchanged';
    run('INSERT INTO checks(id,page_id,created_at,status,message,version_id,status_code,final_url,quality,evidence) VALUES(?,?,?,?,?,?,?,?,?,?)', id(),page.id,capturedAt,status,message.slice(0,2000),versionId||null,result.statusCode,result.finalUrl,JSON.stringify(quality),JSON.stringify(evidence));
    if (['missing','unavailable','error','blocked'].includes(page.last_status)) addEvent(site.id,page.id,'recovered','Pagina nuovamente raggiungibile',versionId||null);
    if (baseline && comparisonUrl(baseline.final_url) !== comparisonUrl(result.finalUrl) && accepted && !pending) addEvent(site.id,page.id,'redirect',`Destinazione aggiornata: ${result.finalUrl}`,versionId);
    run(`UPDATE pages SET title=?,last_checked_at=?,last_status=?,last_version_id=?,reference_version_id=?,missing_count=0,next_check_at=?,quality_retry_count=?,candidate_fingerprint=?,candidate_count=?,candidate_first_at=?,candidate_last_at=?,candidate_clean_count=?,candidate_retry_count=? WHERE id=?`,
      accepted ? result.title : page.title,capturedAt,status,versionId||null,nextReference,later(Math.min(retryDelay,site.interval_hours)),pending?1:0,pending?fingerprint:null,pending?(sameCandidate?Math.min(1000000,page.candidate_count+1):1):0,pending?(sameCandidate?page.candidate_first_at:capturedAt):null,pending?capturedAt:null,pending?Math.min(1000000,cleanCount):0,retries,page.id);
    return { changed,kind,versionId,message };
  });
}

export function recordFailure(page: Row, site: Row, error: any) {
  const code = Number(error.statusCode) || null, missing = code === 404 || code === 410;
  const missingCount = missing ? page.missing_count + 1 : 0;
  const status = missing ? missingCount >= 2 ? 'missing' : 'unavailable' : error.code === 'CAPTCHA' ? 'blocked' : 'error';
  const message = String(error.message || 'Acquisizione non riuscita').slice(0,1000);
  transaction(() => {
    run('INSERT INTO checks(id,page_id,created_at,status,message,version_id,status_code,final_url) VALUES(?,?,?,?,?,?,?,?)',id(),page.id,now(),status,message,page.last_version_id,code,null);
    run('UPDATE pages SET last_checked_at=?,last_status=?,missing_count=?,next_check_at=?,candidate_clean_count=0 WHERE id=?',now(),status,missingCount,later(missingCount===1?Math.min(1,site.interval_hours):site.interval_hours),page.id);
    if(status!==page.last_status) addEvent(site.id,page.id,status,status==='missing'?'Pagina non trovata in due controlli consecutivi; copie precedenti conservate':message,page.last_version_id);
  });
}
