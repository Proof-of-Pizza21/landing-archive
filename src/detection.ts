import { createHash } from 'node:crypto';
import { contentFields, normalized } from './content-fields.js';
import type { CaptureResult, DetectionData } from './types.js';

// Only established advertising identifiers. Product, price, language, experiment
// and asset revision parameters deliberately keep their meaning.
export function comparisonUrl(value: string) {
  try {
    const url = new URL(value);
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_(source|medium|campaign|term|content|id|source_platform|creative_format|marketing_tactic)|gclid|dclid|fbclid|msclkid|ttclid)$/i.test(key)) {
        url.searchParams.delete(key); changed = true;
      }
    }
    return changed ? url.href : value;
  } catch { return value; }
}

export const monitoringKey = (ignore: string[], important: string[]) => createHash('sha256').update(JSON.stringify({ ignore: [...new Set(ignore)].sort(), important: [...new Set(important)].sort() })).digest('hex');

export function detectionFields(result: Pick<CaptureResult, 'title' | 'text' | 'headings' | 'links' | 'imageUrls' | 'finalUrl'>) {
  return contentFields({ ...result, finalUrl: comparisonUrl(result.finalUrl),
    links: result.links.map(link => ({ ...link, url: comparisonUrl(link.url) })),
    imageUrls: result.imageUrls.map(comparisonUrl) });
}

export function importantSignature(data?: DetectionData) {
  return JSON.stringify((data?.important || []).map(item => ({ selector: item.selector, count: item.count,
    text: normalized(item.text), links: item.links.map(link => [comparisonUrl(link.url), normalized(link.text)]).sort(),
    images: [...new Set(item.imageUrls.map(comparisonUrl))].sort() })));
}
