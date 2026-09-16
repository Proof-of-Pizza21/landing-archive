import { diffWordsWithSpace } from 'diff';
import { contentFields, normalized } from './content-fields.js';
import type { Row } from './db.js';
import type { DetectionData } from './types.js';

type Link = { url: string; text: string };
function subtract<T>(left: T[], right: T[], key: (value: T) => string): T[] {
  const remaining = new Map<string, number>();
  for (const item of right) remaining.set(key(item), (remaining.get(key(item)) ?? 0) + 1);
  return left.filter(item => {
    const k = key(item), count = remaining.get(k) ?? 0;
    if (!count) return true;
    remaining.set(k, count - 1); return false;
  });
}

export function compareContent(left: Row, right: Row) {
  const fields = (row: Row) => contentFields({ title: row.title, text: row.text, finalUrl: row.final_url, headings: JSON.parse(row.headings), links: JSON.parse(row.links), imageUrls: JSON.parse(row.images) });
  const a = fields(left), b = fields(right);
  const definitions = [
    ['title', 'Titolo della pagina'], ['text', 'Testo'], ['headings', 'Intestazioni'],
    ['links', 'Collegamenti'], ['images', 'Indirizzi delle immagini'], ['finalUrl', 'Destinazione della pagina'],
  ] as const;
  const changes: { kind: string; label: string }[] = definitions.filter(([key]) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(([kind, label]) => ({ kind, label }));
  const assets = (row: Row): NonNullable<DetectionData['assets']> => JSON.parse(row.detection || 'null')?.assets || [];
  const beforeAssets = assets(left), afterAssets = assets(right);
  const previousAssets = new Map(beforeAssets.map(asset => [asset.url, asset]));
  const nextAssets = new Map(afterAssets.map(asset => [asset.url, asset]));
  const resourceChanges = {
    replaced: afterAssets.filter(asset => asset.status === 'loaded' && asset.hash && previousAssets.get(asset.url)?.status === 'loaded' && previousAssets.get(asset.url)?.hash && previousAssets.get(asset.url)?.hash !== asset.hash).map(asset => asset.url),
    unavailable: afterAssets.filter(asset => asset.status !== 'loaded' && previousAssets.get(asset.url)?.status === 'loaded').map(asset => asset.url),
    recovered: afterAssets.filter(asset => asset.status === 'loaded' && previousAssets.has(asset.url) && previousAssets.get(asset.url)?.status !== 'loaded').map(asset => asset.url),
    relocated: afterAssets.flatMap(asset => {
      if (!asset.hash || asset.status !== 'loaded' || previousAssets.has(asset.url)) return [];
      const previous = beforeAssets.find(value => value.status === 'loaded' && value.hash === asset.hash && !nextAssets.has(value.url));
      return previous ? [{ before: previous.url, after: asset.url }] : [];
    }),
  };
  if (resourceChanges.replaced.length) changes.push({ kind: 'asset_content', label: 'Contenuto delle immagini' });
  if (resourceChanges.unavailable.length || resourceChanges.recovered.length) changes.push({ kind: 'asset_quality', label: 'Differenze di caricamento' });
  const blocks = (row: Row): NonNullable<DetectionData['blocks']> => JSON.parse(row.detection || 'null')?.blocks || [];
  const oldBlocks = blocks(left), newBlocks = blocks(right);
  const regions = newBlocks.flatMap(block => {
    const candidates = oldBlocks.filter(old => old.key === block.key);
    if (candidates.length !== 1 || newBlocks.filter(next => next.key === block.key).length !== 1) return [];
    const previous = candidates[0], before = normalized(previous.text), after = normalized(block.text);
    const from = previous.rectangles[0], to = block.rectangles[0];
    if (before !== after) return [{ kind: 'text', before, after }];
    if (from && to && (Math.abs(from.x - to.x) > 3 || Math.abs(from.y - to.y) > 3)) return [{ kind: 'position', before, after }];
    return [];
  }).slice(0, 50);
  const l: Link[] = JSON.parse(left.links), r: Link[] = JSON.parse(right.links);
  const key = (link: Link) => JSON.stringify([link.url, normalized(link.text)]);
  const textDiff = diffWordsWithSpace(left.text, right.text, { timeout: 500, maxEditLength: 10000 }) ?? [{ value: left.text, removed: true }, { value: right.text, added: true }];
  return {
    changes, textDiff, resourceChanges, regions,
    changedLinks: { added: subtract(r, l, key), removed: subtract(l, r, key) },
    changedImages: { added: b.images.filter(url => !a.images.includes(url)), removed: a.images.filter(url => !b.images.includes(url)) },
    details: definitions.filter(([kind]) => ['title', 'headings', 'finalUrl'].includes(kind) && JSON.stringify(a[kind]) !== JSON.stringify(b[kind])).map(([kind, label]) => ({
      label, before: Array.isArray(a[kind]) ? a[kind] as string[] : [a[kind] as string], after: Array.isArray(b[kind]) ? b[kind] as string[] : [b[kind] as string],
    })),
  };
}
