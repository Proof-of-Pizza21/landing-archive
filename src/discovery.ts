import { XMLParser } from 'fast-xml-parser';
import type { DiscoveryInput, DiscoveryResult } from './types.js';
import { CaptureError, isUrlInScope, normalizeUrl, safeFetch, validatePublicUrl, type RequestBudget } from './network.js';

const NON_PAGE = /\.(?:pdf|jpe?g|png|webp|gif|svg|ico|mp[34]|webm|woff2?|ttf|zip|gz|css|js|json|xml)(?:$|\?)/i;
const ACTION_PATH = /\/(?:wp-admin|wp-json|logout|log-out|signout|checkout|cart|carrello)(?:\/|$)/i;
export function isDiscoverablePage(url: string) { return !NON_PAGE.test(url) && !ACTION_PATH.test(new URL(url).pathname) && !/[?&](?:action|add-to-cart|delete|remove|logout)=/i.test(url); }
function decodeHtml(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|[0-9]+);/gi, entity => {
    const names: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (entity.toLowerCase() in names) return names[entity.toLowerCase()];
    const hex = /^&#x/i.test(entity);
    const value = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
  });
}

export function extractPageLinks(html: string, base: string): string[] {
  const clean = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  const urls = new Set<string>();
  for (const tag of clean.matchAll(/<a\b[^>]*>/gi)) {
    const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag[0]);
    if (!match) continue;
    try {
      const candidate = normalizeUrl(new URL(decodeHtml(match[1] ?? match[2] ?? match[3]), base).href);
      if (isDiscoverablePage(candidate)) urls.add(candidate);
    } catch { /* Non-HTTP links are not crawl targets. */ }
    if (urls.size >= 2000) break;
  }
  return [...urls];
}

type RobotsRule = { path: string; allow: boolean };
export type RobotsBudget = { remaining: number };
const robotsLimit = () => new CaptureError('Le regole robots.txt superano i limiti di elaborazione. La scoperta è stata interrotta.', 'ROBOTS_LIMIT');
export function parseRobots(text: string): { rules: RobotsRule[]; sitemaps: string[] } {
  if (Buffer.byteLength(text) > 128 * 1024) throw robotsLimit();
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  const sitemaps: string[] = [];
  let group: { agents: string[]; rules: RobotsRule[] } | undefined;
  let hasRules = false;
  let ruleCount = 0, agentCount = 0, lineCount = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (++lineCount > 4096) throw robotsLimit();
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'sitemap') { if (value.length <= 4096 && sitemaps.length < 12) sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (++agentCount > 512 || value.length > 200 || groups.length >= 128) throw robotsLimit();
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow'].includes(key)) {
      hasRules = true;
      if (value) {
        if (++ruleCount > 256 || value.length > 512) throw robotsLimit();
        group.rules.push({ path: value, allow: key === 'allow' });
      }
    }
  }
  const dedicated = groups.filter(item => item.agents.some(agent => 'landingarchive'.startsWith(agent) && agent !== '*'));
  return { rules: (dedicated.length ? dedicated : groups.filter(item => item.agents.includes('*'))).flatMap(item => item.rules), sitemaps };
}

type Literal = { text: string; prefix: number[] };
const compiledRules = new WeakMap<RobotsRule, { source: string; terminal: boolean; parts: Literal[] }>();
function literal(text: string): Literal {
  const prefix = new Array<number>(text.length).fill(0);
  for (let i = 1, j = 0; i < text.length; i++) {
    while (j && text[i] !== text[j]) j = prefix[j - 1];
    if (text[i] === text[j]) j++;
    prefix[i] = j;
  }
  return { text, prefix };
}
// KMP searches each literal once, moving only forwards through the target.
// Wildcards never generate a regular expression or recursive backtracking.
function findLiteral(target: string, part: Literal, start: number) {
  if (!part.text.length) return start;
  for (let i = start, j = 0; i < target.length; i++) {
    while (j && target[i] !== part.text[j]) j = part.prefix[j - 1];
    if (target[i] === part.text[j]) j++;
    if (j === part.text.length) return i - j + 1;
  }
  return -1;
}
function matchesRobots(target: string, rule: RobotsRule) {
  let pattern = compiledRules.get(rule);
  if (!pattern || pattern.source !== rule.path) {
    const terminal = rule.path.endsWith('$');
    pattern = { source: rule.path, terminal, parts: (terminal ? rule.path.slice(0, -1) : rule.path).split('*').map(literal) };
    compiledRules.set(rule, pattern);
  }
  const { parts, terminal } = pattern;
  if (!target.startsWith(parts[0].text)) return false;
  let cursor = parts[0].text.length;
  if (parts.length === 1) return !terminal || cursor === target.length;
  for (let i = 1; i < parts.length; i++) {
    if (terminal && i === parts.length - 1) return target.length - parts[i].text.length >= cursor && target.endsWith(parts[i].text);
    const position = findLiteral(target, parts[i], cursor);
    if (position < 0) return false;
    cursor = position + parts[i].text.length;
  }
  return true;
}
export function allowedByRobots(url: string, rules: RobotsRule[], budget: RobotsBudget = { remaining: 2_000_000 }): boolean {
  const target = new URL(url).pathname + new URL(url).search;
  if (target.length > 4096 || rules.length > 256) throw robotsLimit();
  let best: RobotsRule | undefined;
  for (const rule of rules) {
    budget.remaining -= target.length + rule.path.length;
    if (rule.path.length > 512 || budget.remaining < 0) throw robotsLimit();
    if (matchesRobots(target, rule) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  }
  return best?.allow ?? true;
}

export function parseSitemap(xml: string): { pages: string[]; indexes: string[] } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new CaptureError('Sitemap con dichiarazioni non consentite.', 'INVALID_SITEMAP');
  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, processEntities: false });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const collect = (parent: unknown, key: string): string[] => {
    if (!parent || typeof parent !== 'object') return [];
    const value = (parent as Record<string, unknown>)[key];
    return (Array.isArray(value) ? value : value ? [value] : []).slice(0, 10_000).flatMap(item => {
      const loc = item && typeof item === 'object' ? (item as Record<string, unknown>).loc : undefined;
      return typeof loc === 'string' ? [decodeHtml(loc.trim())] : [];
    });
  };
  return { pages: collect(parsed.urlset, 'url'), indexes: collect(parsed.sitemapindex, 'sitemap') };
}

export async function discoverSite(input: DiscoveryInput): Promise<DiscoveryResult> {
  const seed = (await validatePublicUrl(input.url)).href;
  const maxPages = Math.max(1, Math.min(input.maxPages ?? 50, 500));
  const urls = new Map<string, 'seed' | 'sitemap' | 'link'>([[seed, 'seed']]);
  const warnings = new Set<string>();
  const budget: RequestBudget = { bytes: 0, requests: 0, maxBytes: 20 * 1024 * 1024, maxRequests: 40 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new CaptureError('Tempo di scoperta pagine esaurito.', 'TIMEOUT')), 90_000);
  const abort = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener('abort', abort, { once: true });
  if (input.signal?.aborted) abort();
  const request = (url: string) => safeFetch(url, { signal: controller.signal, budget, maxBytes: 3 * 1024 * 1024, timeoutMs: 8000 });
  let robots: ReturnType<typeof parseRobots> = { rules: [], sitemaps: [] };
  const robotsBudget: RobotsBudget = { remaining: 20_000_000 };
  const add = (raw: string, source: 'sitemap' | 'link') => {
    if (urls.size >= maxPages) return;
    try {
      const url = normalizeUrl(raw);
      if (isUrlInScope(url, seed, input.includeSubdomains) && isDiscoverablePage(url) && allowedByRobots(url, robots.rules, robotsBudget) && !urls.has(url)) urls.set(url, source);
    } catch (error) { if (error instanceof CaptureError && error.code === 'ROBOTS_LIMIT') throw error; /* Ignore malformed URLs. */ }
  };
  try {
    try {
      const result = await safeFetch(new URL('/robots.txt', seed).href, { signal: controller.signal, budget, maxBytes: 128 * 1024, timeoutMs: 8000 });
      if (result.status === 200) robots = parseRobots(result.body.toString('utf8'));
      else if (result.status >= 500) warnings.add('robots.txt non disponibile; riprovare per verificare le regole del sito.');
    } catch (error) {
      if (error instanceof CaptureError && ['ROBOTS_LIMIT', 'SIZE_LIMIT'].includes(error.code)) throw error;
      warnings.add('robots.txt non è stato letto.');
    }
    for (const url of (input.candidateUrls ?? []).slice(0, 200)) add(url, 'link');
    const sitemapQueue = [...robots.sitemaps, new URL('/sitemap.xml', seed).href, new URL('/sitemap_index.xml', seed).href];
    const sitemapSeen = new Set<string>();
    while (sitemapQueue.length && sitemapSeen.size < 12 && urls.size < maxPages && !controller.signal.aborted) {
      const raw = sitemapQueue.shift()!;
      let sitemap: string;
      try { sitemap = normalizeUrl(new URL(raw, seed).href); } catch { continue; }
      if (sitemapSeen.has(sitemap) || !isUrlInScope(sitemap, seed, input.includeSubdomains)) continue;
      sitemapSeen.add(sitemap);
      try {
        const result = await request(sitemap);
        if (result.status !== 200 || !isUrlInScope(result.url, seed, input.includeSubdomains)) continue;
        const entries = parseSitemap(result.body.toString('utf8'));
        for (const url of entries.pages) add(url, 'sitemap');
        sitemapQueue.push(...entries.indexes.slice(0, 12));
      } catch (error) { if (error instanceof CaptureError && error.code === 'ROBOTS_LIMIT') throw error; warnings.add('Una sitemap non è stata letta completamente.'); }
    }
    // A small breadth-first crawl finds landings omitted from the sitemap.
    const pageQueue = [seed];
    const pageSeen = new Set<string>();
    while (pageQueue.length && pageSeen.size < 8 && urls.size < maxPages && !controller.signal.aborted) {
      const url = pageQueue.shift()!;
      if (pageSeen.has(url) || !allowedByRobots(url, robots.rules, robotsBudget)) continue;
      pageSeen.add(url);
      try {
        const result = await request(url);
        if (result.status !== 200 || !isUrlInScope(result.url, seed, input.includeSubdomains) || !/html/i.test(result.headers['content-type'] ?? 'text/html')) continue;
        for (const link of extractPageLinks(result.body.toString('utf8'), result.url)) {
          add(link, 'link');
          if (urls.has(link) && !pageSeen.has(link) && pageQueue.length < 30) pageQueue.push(link);
        }
      } catch (error) { if (error instanceof CaptureError && error.code === 'ROBOTS_LIMIT') throw error; warnings.add('Alcune pagine non sono state raggiunte durante la scoperta.'); }
    }
    if (!allowedByRobots(seed, robots.rules, robotsBudget)) warnings.add('La pagina iniziale è esclusa da robots.txt: la scoperta dei suoi collegamenti è stata saltata.');
    if (urls.size >= maxPages) warnings.add(`Raggiunto il limite di ${maxPages} pagine; è possibile aumentarlo nelle impostazioni del sito.`);
    if (controller.signal.aborted) warnings.add('Scoperta interrotta al limite di tempo; i risultati parziali sono conservati.');
    return { urls: [...urls].map(([url, source]) => ({ url, source })), warnings: [...warnings] };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', abort);
  }
}
