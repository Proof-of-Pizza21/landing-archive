import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { htmlLimit, htmlMaxBytes, htmlMaxOutputBytes } from './html-bounds.js';
import type { OfflineTarget } from './offline.js';

export const htmlTransformLimits = { concurrency: 1, waiting: 2, timeoutMs: 8000, heapMiB: 256 } as const;
type Options = { signal?: AbortSignal };
type Input = { mode: 'offline' | 'archive'; html: string; base: string; targets: OfflineTarget[]; localFiles?: Map<string, string> };
let active = 0;
const queue: { start: () => void }[] = [];

function transform(input: Input, options: Options): Promise<string> {
  // Reject before IPC allocates a serialized copy or the request joins the
  // queue. All parsing, structural checks and serialization run in the child.
  if (typeof input.html !== 'string' || Buffer.byteLength(input.html) > htmlMaxBytes || input.base.length > 8192 || input.targets.length > 500 || options.signal?.aborted) return Promise.reject(htmlLimit());
  if (active >= htmlTransformLimits.concurrency && queue.length >= htmlTransformLimits.waiting) return Promise.reject(Object.assign(new Error('Sono già in elaborazione altre copie. Riprova tra pochi secondi.'), { statusCode: 503, code: 'HTML_BUSY' }));
  const targets = input.targets.map(target => ({ id: target.id, url: target.url, finalUrl: target.finalUrl, title: '', capturedAt: '', later: false }));
  if (targets.some(target => target.id.length > 200 || target.url.length > 8192 || target.finalUrl.length > 8192)) return Promise.reject(htmlLimit());
  const localFiles = input.localFiles ? new Map(targets.flatMap(target => { const name = input.localFiles!.get(target.id); return name && /^[0-9]{1,10}\.html$/.test(name) ? [[target.id, name] as [string, string]] : []; })) : undefined;
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof fork> | undefined, settled = false, running = false;
    const release = () => {
      if (!running) return;
      running = false; active--;
      while (active < htmlTransformLimits.concurrency && queue.length) queue.shift()!.start();
    };
    const item = { start: () => {
      if (settled) return;
      running = true; active++;
      try {
        const built = new URL('./html-worker.js', import.meta.url), production = existsSync(built);
        child = fork(production ? built : new URL('./html-worker.ts', import.meta.url), [], {
          execArgv: [`--max-old-space-size=${htmlTransformLimits.heapMiB}`, ...(production ? [] : ['--import', 'tsx'])],
          serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        });
        child.once('message', (message: unknown) => {
          const html = message && typeof message === 'object' && 'html' in message ? message.html : undefined;
          finish(typeof html === 'string' && Buffer.byteLength(html) <= htmlMaxOutputBytes ? html : undefined);
        });
        child.once('error', () => { finish(); if (child?.pid === undefined) release(); });
        child.once('exit', () => { finish(); release(); });
        child.send({ ...input, targets, localFiles }, error => { if (error) finish(); });
      } catch { finish(); if (!child || child.pid === undefined) release(); }
    } };
    const finish = (html?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer); options.signal?.removeEventListener('abort', aborted);
      child?.kill('SIGKILL');
      const index = queue.indexOf(item);
      if (index >= 0) queue.splice(index, 1);
      if (html === undefined) reject(htmlLimit()); else resolve(html);
      // kill() requests termination; only exit confirms it. Keep the slot until
      // that event so repeated cancellations cannot overlap disposable parsers.
      if (!child) release();
    };
    const aborted = () => finish();
    // This deadline includes time spent waiting. It belongs to the parent and
    // remains runnable even if native/parser code in the child stops yielding.
    const timer = setTimeout(() => finish(), htmlTransformLimits.timeoutMs);
    options.signal?.addEventListener('abort', aborted, { once: true });
    if (active < htmlTransformLimits.concurrency) item.start(); else queue.push(item);
  });
}

export function offlineDocumentIsolated(html: string, base: string, targets: OfflineTarget[], localFiles?: Map<string, string>, options: Options = {}) {
  return transform({ mode: 'offline', html, base, targets, localFiles }, options);
}

export function sanitizeArchiveDocument(html: string, base: string, options: Options = {}) {
  return transform({ mode: 'archive', html, base, targets: [] }, options);
}
