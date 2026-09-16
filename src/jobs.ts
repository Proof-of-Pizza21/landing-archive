import { all, get, run, id, now, later, transaction, addEvent, addPage, enqueue, type Row } from './db.js';
import { workerUrl, getWorkerToken, schedulerEnabled } from './config.js';
import { checkSpace } from './storage.js';
import { recordCapture, recordFailure } from './history.js';
import type { CaptureResult, DiscoveryResult } from './types.js';
import { decodeCaptureResult, readWorkerJson, validateDiscoveryResult } from './capture-limits.js';
import { abortable } from './abort.js';
import { isUrlInScope, normalizeUrl } from './network.js';
import { matchesDiscoveryPaths } from './discovery.js';
import { appVersion, captureProtocol } from './version.js';

let busy = false;
let stopped = false;
let tickTimer: ReturnType<typeof setInterval> | undefined;
let controller: AbortController | undefined;
let activeJob: Row | undefined;
let lastWorkerError = '';
let healthTime = 0, healthy = true;
let engineVersion: string | undefined, engineProtocol: number | undefined;
export async function workerState() {
  if (workerUrl && Date.now() - healthTime > 10000) {
    healthTime = Date.now();
    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(2000) });
      healthy = response.ok;
      const info = healthy ? await readWorkerJson(response, 4096) : undefined;
      engineVersion = typeof info?.version === 'string' && /^\d+\.\d+\.\d+$/.test(info.version) ? info.version : undefined;
      engineProtocol = Number.isInteger(info?.captureProtocol) ? info.captureProtocol : undefined;
    }
    catch { healthy = false; }
  }
  const compatible = !workerUrl || (engineVersion === appVersion && engineProtocol === captureProtocol);
  return { available: workerUrl ? healthy : true, version: workerUrl ? engineVersion : appVersion, expectedVersion: appVersion,
    captureProtocol: workerUrl ? engineProtocol : captureProtocol, compatible,
    message: workerUrl && !healthy ? 'Il motore non risponde. Controlla lo stato dell’app in Umbrel e riavviala se il servizio è fermo.' : !compatible ? 'Il motore di acquisizione deve essere aggiornato insieme all’app. Aggiorna Landing Archive dallo store Umbrel e riavviala: le copie precedenti sono conservate.' : lastWorkerError || undefined, schedulerEnabled };
}

async function remote<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${workerUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getWorkerToken()}` },
    body: JSON.stringify(body), signal,
  });
  const result = await readWorkerJson(response, response.ok ? undefined : 16 * 1024);
  if (!response.ok) throw Object.assign(new Error(typeof result?.error === 'string' ? result.error.slice(0, 1500) : 'Il motore di acquisizione non risponde'), { code: typeof result?.code === 'string' ? result.code.slice(0, 100) : 'INVALID_RESULT', statusCode: Number(result?.statusCode) || undefined });
  return result;
}

async function doCapture(page: Row, site: Row, signal: AbortSignal) {
  const input = { url: page.url, ignoreSelectors: [...JSON.parse(site.ignore_selectors), ...JSON.parse(page.ignore_rules).map((rule: any) => rule.selector)].slice(0, 30), importantSelectors: JSON.parse(page.important_rules).map((rule: any) => rule.selector), timeoutMs: 90000 };
  let result: CaptureResult;
  if (workerUrl) {
    const json: any = await remote('/capture', input, signal);
    result = decodeCaptureResult(json);
    if (result.quality?.version !== captureProtocol) throw Object.assign(new Error('Il motore usa controlli di qualità precedenti. Aggiorna e riavvia Landing Archive in Umbrel prima di acquisire nuove copie.'), { code: 'INVALID_RESULT' });
  } else {
    const { capturePage } = await import('./capture.js');
    result = await capturePage({ ...input, signal });
  }
  signal.throwIfAborted();
  if (result.statusCode >= 400) throw Object.assign(new Error(`Il sito ha risposto con errore ${result.statusCode}`), { statusCode: result.statusCode });
  if (!result.screenshot?.length || !result.html?.length) throw new Error('La cattura non contiene tutti i file richiesti');
  await recordCapture(page, site, result, signal);

}

async function doDiscovery(site: Row, signal: AbortSignal, manual: boolean) {
  // Pass observed browser links through the same scope/robots filters as sitemap URLs.
  const candidateUrls: string[] = [];
  let candidateBytes = 0;
  for (const row of all('SELECT v.links FROM pages p JOIN versions v ON v.id=p.last_version_id WHERE p.site_id=?', site.id)) {
    for (const link of JSON.parse(row.links)) {
      if (typeof link.url !== 'string' || !isUrlInScope(link.url, site.url, Boolean(site.include_subdomains)) || candidateUrls.includes(link.url)) continue;
      if (candidateUrls.length >= 200 || candidateBytes + link.url.length > 16000) break;
      candidateUrls.push(link.url); candidateBytes += link.url.length;
    }
  }
  const input = { url: site.url, includeSubdomains: Boolean(site.include_subdomains), maxPages: site.max_pages, candidateUrls, includePaths: JSON.parse(site.include_paths), excludePaths: JSON.parse(site.exclude_paths) };
  let result: DiscoveryResult;
  if (workerUrl) result = await remote('/discover', input, signal);
  else {
    const { discoverSite } = await import('./discovery.js');
    result = await discoverSite({ ...input, signal });
  }
  validateDiscoveryResult(result);
  signal.throwIfAborted();
  const current = get('SELECT * FROM sites WHERE id=?', site.id);
  if (!current || current.include_paths !== site.include_paths || current.exclude_paths !== site.exclude_paths || current.include_subdomains !== site.include_subdomains) throw new Error('Le impostazioni di scoperta sono cambiate: la ricerca sarà ripetuta.');
  site = current;
  recordDiscovery(site, result, manual);
}

export function recordDiscovery(site: Row, result: DiscoveryResult, manual = false) {
  validateDiscoveryResult(result);
  let count = get('SELECT COUNT(*) n FROM pages WHERE site_id=?', site.id)!.n;
  let addedCount = 0;
  for (const candidate of result.urls) {
    let url: string;
    try { url = normalizeUrl(candidate.url); } catch { continue; }
    if (!isUrlInScope(url, site.url, Boolean(site.include_subdomains))) continue;
    if (!matchesDiscoveryPaths(url, JSON.parse(site.include_paths), JSON.parse(site.exclude_paths)) && url !== site.url) continue;
    if (count >= site.max_pages && !get('SELECT id FROM pages WHERE site_id=? AND url=?', site.id, url)) continue;
    const added = addPage(site.id, url, candidate.source);
    if (added.added) { count++; addedCount++; enqueue(site.id, added.page.id, 'capture', manual); }
  }
  const sitemap = result.sitemap;
  if (sitemap) {
    const urls = new Set(sitemap.urls);
    const sources = JSON.stringify([...new Set(sitemap.sources)].sort());
    const comparable = sitemap.complete && sources === site.sitemap_sources;
    for (const page of all('SELECT * FROM pages WHERE site_id=?', site.id)) {
      if (urls.has(page.url)) {
        if (page.sitemap_state === 'absent') addEvent(site.id, page.id, 'sitemap_returned', 'Indirizzo nuovamente presente nella sitemap');
        run("UPDATE pages SET sitemap_state='present',sitemap_seen_at=? WHERE id=?", now(), page.id);
      } else if (comparable && page.sitemap_state === 'present') {
        run("UPDATE pages SET sitemap_state='absent' WHERE id=?", page.id);
        addEvent(site.id, page.id, 'sitemap_absent', 'Indirizzo non più presente nella sitemap. La raggiungibilità viene verificata separatamente.');
      }
    }
    if (sitemap.complete) run('UPDATE sites SET sitemap_sources=? WHERE id=?', sources, site.id);
  }
  run('UPDATE sites SET next_discovery_at=?,last_discovery_at=? WHERE id=?', later(site.discovery_interval_hours), now(), site.id);
  if (count >= site.max_pages) result.warnings.push('Limite del sito raggiunto: aumenta il limite per archiviare ulteriori landing.');
  addEvent(site.id, null, 'discovery', `Ricerca completata: ${addedCount} nuove pagine${result.warnings.length ? '. ' + result.warnings.join(' ').slice(0, 1000) : ''}`);
}

/** Called synchronously before removing a site or replacing its current job. */
export function cancelSiteJobs(siteId: string, pageId?: string, deleting = false) {
  const rows = all(`SELECT * FROM jobs WHERE site_id=? AND status='running'${pageId ? ' AND page_id=?' : ''}`, siteId, ...(pageId ? [pageId] : []));
  for (const job of rows) {
    const message = 'Controllo interrotto per avviare un nuovo tentativo manuale.';
    run("UPDATE jobs SET status='cancelled',finished_at=?,lease_until=NULL,error=? WHERE id=?", now(), message, job.id);
    if (!deleting) {
      if (job.page_id) {
        const page = get('SELECT * FROM pages WHERE id=?', job.page_id);
        if (page) run('INSERT INTO checks (id,page_id,created_at,status,message,version_id) VALUES (?,?,?,?,?,?)', id(), page.id, now(), 'cancelled', message, page.last_version_id);
      }
      addEvent(siteId, job.page_id, 'cancelled', message);
    }
  }
  if (activeJob?.site_id === siteId && (!pageId || activeJob.page_id === pageId)) {
    controller?.abort(Object.assign(new Error(deleting ? 'Sito eliminato' : 'Nuovo controllo richiesto'), { code: 'CANCELLED' }));
  }
}

export function requestManualScan(siteId: string, options: { pageId?: string; restart?: boolean; discover?: boolean } = {}) {
  const site = get('SELECT * FROM sites WHERE id=?', siteId)!;
  const jobIds = transaction(() => {
    if (options.restart) cancelSiteJobs(siteId, options.pageId);
    const pages = all(`SELECT id FROM pages WHERE site_id=?${options.pageId ? ' AND id=?' : ''}`, siteId, ...(options.pageId ? [options.pageId] : []));
    const jobs = pages.map(page => enqueue(siteId, page.id, 'capture', true)!);
    if (!options.pageId && options.discover && site.max_pages > 1) jobs.push(enqueue(siteId, null, 'discover', true)!);
    return jobs;
  });
  // Wake an already started coordinator; createApp() alone does not start jobs.
  wakeJobs();
  return { ok: true, jobIds, paused: Boolean(site.paused), message: 'Controllo manuale prioritario richiesto. Le pagine saranno scaricate di nuovo; una nuova versione verrà conservata se cambia il contenuto.' };
}

export function wakeJobs() { if (tickTimer && !stopped) setImmediate(() => void processNextJob()); }

export function scheduleDue() {
  if (!schedulerEnabled) return;
  const timestamp = now();
  for (const p of all(`SELECT p.* FROM pages p JOIN sites s ON s.id=p.site_id WHERE s.paused=0 AND p.next_check_at<=?`, timestamp)) enqueue(p.site_id, p.id, 'capture');
  for (const site of all('SELECT * FROM sites WHERE paused=0 AND max_pages>1 AND next_discovery_at<=?', timestamp)) enqueue(site.id, null, 'discover');
}

export function recoverInterruptedJobs(force = false) {
  const interrupted = force ? all("SELECT * FROM jobs WHERE status='running'") : all("SELECT * FROM jobs WHERE status='running' AND lease_until<?", now());
  transaction(() => {
    for (const job of interrupted) {
      if (job.attempts >= 3) {
        const message = 'Monitoraggio in pausa: un lavoro è rimasto interrotto dopo tre tentativi. Controlla il sito prima di riattivarlo.';
        run("UPDATE jobs SET status='error',finished_at=?,lease_until=NULL,error=? WHERE id=?", now(), message, job.id);
        run('UPDATE sites SET paused=1,updated_at=? WHERE id=?', now(), job.site_id);
        addEvent(job.site_id, job.page_id, 'error', message);
      } else run("UPDATE jobs SET status='queued',available_at=?,lease_until=NULL WHERE id=?", now(), job.id);
    }
  });
}

export async function processNextJob() {
  if (busy || stopped) return;
  busy = true;
  let job: Row | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    recoverInterruptedJobs();
    scheduleDue();
    job = transaction(() => {
      const next = get(`SELECT j.* FROM jobs j JOIN sites s ON s.id=j.site_id WHERE j.status='queued' AND j.available_at<=? AND (s.paused=0 OR j.manual=1) ORDER BY j.manual DESC,CASE WHEN j.kind='capture' THEN 0 ELSE 1 END,j.created_at ASC LIMIT 1`, now());
      if (!next) return undefined;
      run(`UPDATE jobs SET status='running',started_at=?,lease_until=?,attempts=attempts+1 WHERE id=?`, now(), later(0.2), next.id);
      return { ...next, attempts: next.attempts + 1 };
    });
    if (!job) return;
    controller = new AbortController();
    activeJob = job;
    const currentController = controller;
    deadline = setTimeout(() => currentController.abort(Object.assign(new Error('Tempo massimo di acquisizione superato (3 minuti). Puoi riavviare il controllo.'), { code: 'TIMEOUT' })), 180000);
    checkSpace();
    const site = get('SELECT * FROM sites WHERE id=?', job.site_id)!;
    if (job.kind === 'capture') {
      const page = get('SELECT * FROM pages WHERE id=?', job.page_id)!;
      await abortable(doCapture(page, site, currentController.signal), currentController.signal);
    } else await abortable(doDiscovery(site, currentController.signal, Boolean(job.manual)), currentController.signal);
    currentController.signal.throwIfAborted();
    run(`UPDATE jobs SET status='done',finished_at=?,lease_until=NULL,error=NULL WHERE id=?`, now(), job.id);
    lastWorkerError = '';
  } catch (error: any) {
    const message = String(error.message || 'Errore di acquisizione').slice(0, 1500);
    if (job && get("SELECT id FROM jobs WHERE id=? AND status='running'", job.id)) {
      const site = get('SELECT * FROM sites WHERE id=?', job.site_id)!;
      const transient = ![404, 410, 401, 403].includes(error.statusCode) && !['CAPTCHA', 'DISK_FULL', 'SIZE_LIMIT', 'IMAGE_LIMIT', 'INVALID_RESULT', 'ROBOTS_LIMIT'].includes(error.code);
      const retry = transient && job.attempts < 3 && !stopped;
      run('UPDATE jobs SET status=?,finished_at=?,available_at=?,lease_until=NULL,error=? WHERE id=?', retry ? 'queued' : 'error', retry ? null : now(), later(Math.min(0.25, 0.02 * job.attempts)), message, job.id);
      if (job.page_id && error.code !== 'DISK_FULL') {
        const page = get('SELECT * FROM pages WHERE id=?', job.page_id)!;
        recordFailure(page, site, retry ? { ...error, statusCode: error.statusCode, code: error.code, message: `${message.replace(/[.\s]+$/, '')}. Nuovo tentativo programmato (${job.attempts}/3).` } : error);
      } else if (!retry) {
        addEvent(site.id, job.page_id, 'error', message);
        if (job.kind === 'discover') run('UPDATE sites SET next_discovery_at=? WHERE id=?', later(1), site.id);
        if (job.page_id) run('UPDATE pages SET next_check_at=? WHERE id=?', later(1), job.page_id);
      }
      lastWorkerError = message;
    }
  } finally {
    if (deadline) clearTimeout(deadline);
    controller = undefined;
    activeJob = undefined;
    busy = false;
  }
}

export function startJobs() {
  stopped = false;
  if (tickTimer) clearInterval(tickTimer);
  // Only one coordinator process is supported. Requeue jobs interrupted by its restart.
  recoverInterruptedJobs(true);
  void processNextJob();
  tickTimer = setInterval(() => void processNextJob(), 2000);
  tickTimer.unref();
}

export async function stopJobs() {
  stopped = true;
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = undefined;
  controller?.abort(new Error('Arresto del servizio'));
  if (!workerUrl) { try { const { closeBrowser } = await import('./capture.js'); await closeBrowser(); } catch {} }
  const deadline = Date.now() + 10000;
  while (busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
}

export async function suspendJobs() {
  const wasStopped = stopped, hadTimer = Boolean(tickTimer);
  const resume = () => { if (hadTimer) startJobs(); else stopped = wasStopped; };
  await stopJobs();
  if (busy) { resume(); throw new Error('Il controllo corrente non si è ancora arrestato'); }
  return resume;
}
