import { createHash } from 'node:crypto';
import type { CaptureAsset } from './types.js';
import type { readPageMetadata } from './page-metadata.js';

export type ResourceObservation = { status: number; hash?: string; kind: string };
export type PageMetadata = Awaited<ReturnType<typeof readPageMetadata>>;

/** Only recognized telemetry is optional. Unknown third-party scripts can supply
 * landing content and must not make their missing sections look intentional. */
export function isCriticalResource(url: string, kind: string, pageUrl: string, method = 'GET'): boolean {
  let target: URL, page: URL;
  try { target = new URL(url); page = new URL(pageUrl); } catch { return false; }
  if (/^(?:.*\.)?(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net|hotjar\.com|clarity\.ms|segment\.io|segment\.com|sentry\.io)$/.test(target.hostname) || /(?:^|\/)(?:analytics|telemetry|beacon|pixel|tracking)(?:[./_-]|$)/i.test(target.pathname)) return false;
  if (kind === 'stylesheet' || kind === 'font') return true;
  const sameOrigin = target.origin === page.origin;
  if (kind === 'script') return true;
  if (kind === 'xhr' || kind === 'fetch') return /(?:^|\/)(?:api|wp-json|graphql)(?:\/|$)/i.test(target.pathname) || (sameOrigin && ['GET', 'HEAD'].includes(method));
  return false;
}

export function packagingResourceRelevant(url: string, resources: Map<string, ResourceObservation>, visibleUrls: Set<string>, stylesheetUrls: Set<string>): boolean {
  if (visibleUrls.has(url) || stylesheetUrls.has(url)) return true;
  const kind = resources.get(url)?.kind;
  // Hidden alternatives and favicons are not essential to the visible offline copy.
  return kind === 'stylesheet' || kind === 'font';
}

/** The digest comes from the bounded, DNS-pinned response, never a second download. */
export function observedAssets(assets: CaptureAsset[], resources: Map<string, ResourceObservation>): CaptureAsset[] {
  return assets.map(asset => {
    const resource = resources.get(asset.url);
    let status = asset.status;
    if (resource && (resource.status < 200 || resource.status >= 300)) status = 'failed';
    return { ...asset, status, ...(status === 'loaded' && resource?.hash ? { hash: resource.hash } : {}) };
  });
}

/** Compare content and resource readiness; ignore harmless subpixel layout movement. */
export function readinessSignature(metadata: PageMetadata): string {
  return createHash('sha256').update(JSON.stringify({
    content: metadata.comparison,
    assets: metadata.assets.map(({ url, kind, status, hash }) => ({ url, kind, status, hash })),
    height: Math.round(metadata.height / 4), missingImages: metadata.missingImages,
    fontsPending: metadata.fontsPending, fontsFailed: metadata.fontsFailed,
    important: metadata.important.map(({ selector, count, text }) => ({ selector, count, text })),
  })).digest('hex');
}

export function renderProblems(metadata: PageMetadata, stable: boolean): string[] {
  const reasons: string[] = [];
  if (!stable) reasons.push('La pagina continua a cambiare durante il caricamento: acquisizione da verificare.');
  if (metadata.missingImages) reasons.push(`${metadata.missingImages} immagini visibili non sono state caricate completamente.`);
  const backgrounds = metadata.assets.filter(asset => asset.kind === 'background' && asset.status !== 'loaded').length;
  if (backgrounds) reasons.push(`${backgrounds} immagini di sfondo non sono state caricate completamente.`);
  if (metadata.fontsPending || metadata.fontsFailed) reasons.push('Uno o più caratteri della pagina non sono stati caricati completamente.');
  if (metadata.important.some(region => !region.count)) reasons.push('Una zona importante non è stata trovata: il contenuto potrebbe essere incompleto.');
  if (!metadata.text.trim() && !metadata.imageUrls.length && !metadata.assets.some(asset => asset.status === 'loaded')) reasons.push('La pagina non contiene testo o immagini riconoscibili.');
  return reasons;
}
