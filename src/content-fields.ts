import type { CaptureResult } from './types.js';

export const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();

// Shared by the detector and its explanation: keep the existing signature format.
export function contentFields(result: Pick<CaptureResult, 'title' | 'text' | 'headings' | 'links' | 'imageUrls' | 'finalUrl'>) {
  return {
    title: normalized(result.title), text: normalized(result.text),
    headings: result.headings.map(normalized),
    links: result.links.map(l => [l.url, normalized(l.text)]).sort((a, b) => a.join('|').localeCompare(b.join('|'))),
    images: [...new Set(result.imageUrls)].sort(), finalUrl: result.finalUrl,
  };
}
