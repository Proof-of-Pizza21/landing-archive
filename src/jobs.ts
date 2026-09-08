import { all, get, run, id, now, later, transaction, addEvent, addPage, enqueue, type Row } from './db.js';
import { workerUrl, getWorkerToken, schedulerEnabled } from './config.js';
import { checkSpace } from './storage.js';
import { recordCapture, recordFailure } from './history.js';
import type { CaptureResult, DiscoveryResult } from './types.js';
import { decodeCaptureResult, readWorkerJson, validateDiscoveryResult } from './capture-limits.js';

let busy = false;
let stopped = false;
let tickTimer: ReturnType<typeof setInterval> | undefined;
let controller: AbortController | undefined;
let lastWorkerError = '';
let healthTime = 0, healthy = true;
export async function workerState() {
  if (workerUrl && Date.now() - healthTime > 10000) {
    healthTime = Date.now();
    try { healthy = (await fetch(`${workerUrl.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(2000) })).ok; }
    catch { healthy = false; }
  }
  return { available: workerUrl ? healthy : !lastWorkerError, message: lastWorkerError || undefined, schedulerEnabled };
}

async function remote<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${workerUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getWorkerToken()}` },
    body: JSON.stringify(body), signal: controller?.signal,
  });
  const result = await readWorkerJson(response, response.ok ? undefined : 16 * 1024);
  if (!response.ok) throw Object.assign(new Error(typeof result?.error === 'string' ? result.error.slice(0, 1500) : 'Il motore di acquisizione non risponde'), { code: typeof result?.code === 'string' ? result.code.slice(0, 100) : 'INVALID_RESULT', statusCode: Number(result?.statusCode) || undefined });
  return result;
}

async function doCapture(page: Row, site: Row) {
  const input = { url: page.url, ignoreSelectors: JSON.parse(site.ignore_selectors), timeoutMs: 90000 };
  let result: CaptureResult;
  if (workerUrl) {
    const json: any = await remote('/capture', input);
    result = decodeCaptureResult(json);
  } else {
    const { capturePage } = await import('./capture.js');
    result = await capturePage({ ...input, signal: controller?.signal });
  }
  if (result.statusCode >= 400) throw Object.assign(new Error(`Il sito ha risposto con errore ${result.statusCode}`), { statusCode: result.statusCode });
  if (!result.screenshot?.length || !result.html?.length) throw new Error('La cattura non contiene tutti i file richiesti');
  await recordCapture(page, site, result);

}

async function doDiscovery(site: Row) {
  // Pass observed browser links through the same scope/robots filters as sitemap URLs.
  const { isUrlInScope } = await import('./network.js');
  const candidateUrls: string[] = [];
  let candidateBytes = 0;
  for (const row of all('SELECT v.links FROM pages p JOIN versions v ON v.id=p.last_version_id WHERE p.site_id=?', site.id)) {
    for (const link of JSON.parse(row.links)) {
      if (typeof link.url !== 'string' || !isUrlInScope(link.url, site.url, Boolean(site.include_subdomains)) || candidateUrls.includes(link.url)) continue;
      if (candidateUrls.length >= 200 || candidateBytes + link.url.length > 16000) break;
      candidateUrls.push(link.url); candidateBytes += link.url.length;
    }
  }
  const input = { url: site.url, includeSubdomains: Boolean(site.include_subdomains), maxPages: site.max_pages, candidateUrls };
  let result: DiscoveryResult;
  if (workerUrl) result = await remote('/discover', input);
  else {
    const { discoverSite } = await import('./discovery.js');
    result = await discoverSite({ ...input, signal: controller?.signal });
  }
  validateDiscoveryResult(result);
  const { normalizeUrl } = await import('./network.js');
  let count = get('SELECT COUNT(*) n FROM pages WHERE site_id=?', site.id)!.n;
  let addedCount = 0;
  for (const candidate of result.urls) {
    if (count >= site.max_pages) break;
    try {
      const url = normalizeUrl(candidate.url);
      if (!isUrlInScope(url, site.url, Boolean(site.include_subdomains))) continue;
      const added = addPage(site.id, url, candidate.source);
      if (added.added) { count++; addedCount++; enqueue(site.id, added.page.id, 'capture'); }
    } catch {}
  }
  run('UPDATE sites SET next_discovery_at=? WHERE id=?', later(24), site.id);
  addEvent(site.id, null, 'discovery', `Ricerca completata: ${addedCount} nuove pagine${result.warnings.length ? '. ' + result.warnings.join(' ').slice(0, 1000) : ''}`);
}

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
      const next = get(`SELECT j.* FROM jobs j JOIN sites s ON s.id=j.site_id WHERE j.status='queued' AND j.available_at<=? AND s.paused=0 ORDER BY CASE WHEN j.kind='capture' THEN 0 ELSE 1 END,j.created_at ASC LIMIT 1`, now());
      if (!next) return undefined;
      run(`UPDATE jobs SET status='running',started_at=?,lease_until=?,attempts=attempts+1 WHERE id=?`, now(), later(0.2), next.id);
      return { ...next, attempts: next.attempts + 1 };
    });
    if (!job) return;
    controller = new AbortController();
    deadline = setTimeout(() => controller?.abort(new Error('Tempo massimo di acquisizione superato')), 180000);
    checkSpace();
    const site = get('SELECT * FROM sites WHERE id=?', job.site_id)!;
    if (job.kind === 'capture') {
      const page = get('SELECT * FROM pages WHERE id=?', job.page_id)!;
      await doCapture(page, site);
    } else await doDiscovery(site);
    run(`UPDATE jobs SET status='done',finished_at=?,lease_until=NULL,error=NULL WHERE id=?`, now(), job.id);
    lastWorkerError = '';
  } catch (error: any) {
    const message = String(error.message || 'Errore di acquisizione').slice(0, 1500);
    if (job) {
      const site = get('SELECT * FROM sites WHERE id=?', job.site_id)!;
      const transient = ![404, 410, 401, 403].includes(error.statusCode) && !['CAPTCHA', 'DISK_FULL', 'SIZE_LIMIT', 'IMAGE_LIMIT', 'INVALID_RESULT', 'ROBOTS_LIMIT'].includes(error.code);
      const retry = transient && job.attempts < 3 && !stopped;
      run('UPDATE jobs SET status=?,finished_at=?,available_at=?,lease_until=NULL,error=? WHERE id=?', retry ? 'queued' : 'error', retry ? null : now(), later(Math.min(0.25, 0.02 * job.attempts)), message, job.id);
      if (job.page_id && error.code !== 'DISK_FULL') {
        const page = get('SELECT * FROM pages WHERE id=?', job.page_id)!;
        recordFailure(page, site, retry ? { ...error, statusCode: error.statusCode, code: error.code, message: `${message}. Nuovo tentativo programmato (${job.attempts}/3).` } : error);
      } else if (!retry) {
        addEvent(site.id, job.page_id, 'error', message);
        if (job.kind === 'discover') run('UPDATE sites SET next_discovery_at=? WHERE id=?', later(1), site.id);
        if (job.page_id) run('UPDATE pages SET next_check_at=? WHERE id=?', later(1), job.page_id);
      }
      if (error.code === 'DISK_FULL' || /ECONNREFUSED|fetch failed|browser.*not|executable/i.test(message)) lastWorkerError = message;
    }
  } finally {
    if (deadline) clearTimeout(deadline);
    controller = undefined;
    busy = false;
  }
}

export function startJobs() {
  stopped = false;
  // Only one coordinator process is supported. Requeue jobs interrupted by its restart.
  recoverInterruptedJobs(true);
  void processNextJob();
  tickTimer = setInterval(() => void processNextJob(), 2000);
  tickTimer.unref();
}

export async function stopJobs() {
  stopped = true;
  if (tickTimer) clearInterval(tickTimer);
  controller?.abort(new Error('Arresto del servizio'));
  if (!workerUrl) { try { const { closeBrowser } = await import('./capture.js'); await closeBrowser(); } catch {} }
  const deadline = Date.now() + 10000;
  while (busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
}
