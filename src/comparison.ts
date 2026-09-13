import { diffWordsWithSpace } from 'diff';
import { contentFields, normalized } from './content-fields.js';
import type { Row } from './db.js';

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
  const changes = definitions.filter(([key]) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(([kind, label]) => ({ kind, label }));
  const l: Link[] = JSON.parse(left.links), r: Link[] = JSON.parse(right.links);
  const key = (link: Link) => JSON.stringify([link.url, normalized(link.text)]);
  const textDiff = diffWordsWithSpace(left.text, right.text, { timeout: 500, maxEditLength: 10000 }) ?? [{ value: left.text, removed: true }, { value: right.text, added: true }];
  return {
    changes, textDiff,
    changedLinks: { added: subtract(r, l, key), removed: subtract(l, r, key) },
    changedImages: { added: b.images.filter(url => !a.images.includes(url)), removed: a.images.filter(url => !b.images.includes(url)) },
    details: changes.filter(({ kind }) => ['title', 'headings', 'finalUrl'].includes(kind)).map(({ kind, label }) => ({
      label, before: Array.isArray(a[kind]) ? a[kind] as string[] : [a[kind] as string], after: Array.isArray(b[kind]) ? b[kind] as string[] : [b[kind] as string],
    })),
  };
}
