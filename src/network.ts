import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';

export class CaptureError extends Error {
  constructor(message: string, public code: string, public statusCode?: number) {
    super(message);
    this.name = 'CaptureError';
  }
}

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(address, prefix, 'ipv4');
const allowedV6 = new BlockList();
allowedV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
blockedV6.addSubnet('2001::', 23, 'ipv6');
blockedV6.addSubnet('2001:db8::', 32, 'ipv6');
blockedV6.addSubnet('2002::', 16, 'ipv6');
blockedV6.addSubnet('3fff::', 20, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const plain = address.replace(/^\[|\]$/g, '');
  const family = isIP(plain);
  if (family === 4) return !blockedV4.check(plain, 'ipv4');
  if (family === 6) return allowedV6.check(plain, 'ipv6') && !blockedV6.check(plain, 'ipv6');
  return false;
}

export function normalizeUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new CaptureError('Indirizzo web non valido.', 'INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new CaptureError('Sono consentiti soltanto URL HTTP/HTTPS senza credenziali.', 'INVALID_URL');
  }
  if (url.href.length > 4096) throw new CaptureError('Indirizzo troppo lungo.', 'INVALID_URL');
  url.hash = '';
  // Keep campaign, variant and ordering parameters: they may identify different landings.
  return url.href;
}

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
const systemResolver: Resolver = hostname => lookup(hostname, { all: true, verbatim: true });

export async function resolvePublicAddress(raw: string, resolver: Resolver = systemResolver): Promise<{ url: URL; address: Address }> {
  const url = new URL(normalizeUrl(raw));
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new CaptureError('Sono consentite soltanto le porte web 80 e 443.', 'BLOCKED_URL');
  }
  if (hostname === 'localhost' || /\.(localhost|local|internal|lan|home|onion|test|invalid)$/.test(hostname) || (!hostname.includes('.') && !isIP(hostname))) {
    throw new CaptureError('Gli indirizzi di rete locale non sono consentiti.', 'BLOCKED_URL');
  }
  let addresses: Address[];
  try {
    addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new CaptureError('Risoluzione DNS scaduta.', 'DNS_ERROR')), 5000); timer.unref(); }),
    ]);
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    throw new CaptureError('Impossibile risolvere il dominio.', 'DNS_ERROR');
  }
  // A mixed public/private answer is rejected as well; no second DNS lookup is made by the socket.
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw new CaptureError('Il dominio punta a una rete privata o riservata.', 'BLOCKED_URL');
  }
  return { url, address: addresses.find(item => item.family === 4) ?? addresses[0] };
}

export async function validatePublicUrl(raw: string): Promise<URL> {
  return (await resolvePublicAddress(raw)).url;
}

export function isUrlInScope(candidate: string, seed: string, includeSubdomains = false): boolean {
  try {
    const current = new URL(normalizeUrl(candidate));
    const root = new URL(normalizeUrl(seed));
    const rootHost = root.hostname.toLowerCase().replace(/^www\./, '');
    const candidateHost = current.hostname.toLowerCase().replace(/^www\./, '');
    return candidateHost === rootHost || (includeSubdomains && candidateHost.endsWith(`.${rootHost}`));
  } catch { return false; }
}

export type RequestBudget = { bytes: number; requests: number; maxBytes: number; maxRequests: number };
export type SafeResponse = { url: string; status: number; headers: Record<string, string>; body: Buffer };
export type RequestOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  method?: 'GET' | 'HEAD';
  budget?: RequestBudget;
};

/** One HTTP hop only. The connected address is the exact public IP validated above. */
export async function safeRequest(raw: string, options: RequestOptions = {}): Promise<SafeResponse> {
  options.signal?.throwIfAborted();
  if (options.budget && ++options.budget.requests > options.budget.maxRequests) throw new CaptureError('Limite di richieste raggiunto.', 'REQUEST_LIMIT');
  const { url, address } = await resolvePublicAddress(raw);
  options.signal?.throwIfAborted();
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = { 'user-agent': 'LandingArchive/0.1 (+local personal archive)', accept: '*/*', 'accept-encoding': 'identity' };
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (['accept', 'accept-language', 'user-agent', 'referer', 'cookie', 'origin', 'range'].includes(key.toLowerCase())) headers[key.toLowerCase()] = value;
    }
    const request = transport.request(url, {
      method: options.method ?? 'GET', headers, agent: false, signal: options.signal,
      lookup: (_hostname, lookupOptions, callback) => {
        if ((lookupOptions as { all?: boolean }).all) (callback as (...args: unknown[]) => void)(null, [address]);
        else callback(null, address.address, address.family);
      },
    });
    const timer = setTimeout(() => request.destroy(new CaptureError('Tempo di download esaurito.', 'TIMEOUT')), Math.min(options.timeoutMs ?? 15_000, 30_000));
    const fail = (error: Error) => { clearTimeout(timer); request.destroy(); reject(error); };
    request.on('error', fail);
    request.on('response', response => {
      const declared = Number(response.headers['content-length'] ?? 0);
      if (declared > maxBytes) return fail(new CaptureError('Risorsa troppo grande.', 'SIZE_LIMIT'));
      let stream: Readable = response;
      const encoding = response.headers['content-encoding'];
      if (encoding === 'gzip') stream = response.pipe(createGunzip());
      else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
      else if (encoding === 'deflate') stream = response.pipe(createInflate());
      const chunks: Buffer[] = [];
      let length = 0;
      stream.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (options.budget) options.budget.bytes += chunk.length;
        if (length > maxBytes || (options.budget && options.budget.bytes > options.budget.maxBytes)) {
          stream.destroy(); response.destroy();
          return fail(new CaptureError('Limite di download raggiunto.', 'SIZE_LIMIT'));
        }
        chunks.push(chunk);
      });
      stream.on('error', fail);
      response.on('aborted', () => fail(new CaptureError('Download interrotto dal sito.', 'NETWORK_ERROR')));
      stream.on('end', () => {
        clearTimeout(timer);
        const responseHeaders: Record<string, string> = {};
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined && !['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name)) responseHeaders[name] = Array.isArray(value) ? value.join('\n') : value;
        }
        resolve({ url: url.href, status: response.statusCode ?? 502, headers: responseHeaders, body: Buffer.concat(chunks) });
      });
    });
    request.end();
  });
}

export async function safeFetch(raw: string, options: RequestOptions = {}, requestHop = safeRequest): Promise<SafeResponse> {
  let current = normalizeUrl(raw);
  let headers = options.headers;
  for (let hop = 0; hop < 6; hop++) {
    const response = await requestHop(current, { ...options, headers });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
      const next = normalizeUrl(new URL(response.headers.location, current).href);
      if (new URL(next).origin !== new URL(current).origin) {
        headers = Object.fromEntries(Object.entries(headers ?? {}).filter(([key]) => !['cookie', 'authorization', 'proxy-authorization', 'origin', 'referer'].includes(key.toLowerCase())));
      }
      current = next;
      continue;
    }
    return response;
  }
  throw new CaptureError('Troppi reindirizzamenti.', 'REDIRECT_LIMIT');
}
