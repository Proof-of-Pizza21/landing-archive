import { createHash } from 'node:crypto';
import { detectionFields, importantSignature } from './detection.js';
import { normalized } from './content-fields.js';
import type { CaptureQuality, DetectionData, PageContent } from './types.js';

export type Evidence = {
  policy?: 1; kind?: 'unchanged' | 'incomplete' | 'pending' | 'change' | 'first' | 'returned' | 'baseline' | 'reviewed';
  referenceVersionId?: string; signals?: string[]; fingerprint?: string; semanticSignature?: string; confirmationCount?: number; retryCount?: number;
  visualDifference?: number; diagnosticId?: string; originalVersionId?: string; originalCapturedAt?: string; originalFilesRemoved?: boolean;
};
export function validateEvidence(value: unknown): asserts value is Evidence {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 32768) throw new Error('Dati del confronto non validi.');
  const allowed = new Set(['policy','kind','referenceVersionId','signals','fingerprint','semanticSignature','confirmationCount','retryCount','visualDifference','diagnosticId','originalVersionId','originalCapturedAt','originalFilesRemoved']);
  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key)) throw new Error('Campo del confronto non valido.');
    if (key === 'policy' && item !== 1) throw new Error('Versione del confronto non valida.');
    if (key === 'kind' && !['unchanged','incomplete','pending','change','first','returned','baseline','reviewed'].includes(item as string)) throw new Error('Tipo del confronto non valido.');
    if (['referenceVersionId','diagnosticId','originalVersionId'].includes(key) && (typeof item !== 'string' || !item.length || item.length > 80)) throw new Error('Riferimento del confronto non valido.');
    if (key === 'signals' && (!Array.isArray(item) || item.length > 16 || item.some(s => typeof s !== 'string' || s.length > 400))) throw new Error('Segnali del confronto non validi.');
    if (['fingerprint','semanticSignature'].includes(key) && (typeof item !== 'string' || !/^[a-f0-9]{64}$/.test(item))) throw new Error('Impronta del confronto non valida.');
    if (['confirmationCount','retryCount'].includes(key) && (!Number.isInteger(item) || item < 0 || item > 1000000)) throw new Error('Contatore del confronto non valido.');
    if (key === 'visualDifference' && (typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > 1)) throw new Error('Differenza visiva non valida.');
    if (key === 'originalCapturedAt' && (typeof item !== 'string' || item.length > 40 || !Number.isFinite(Date.parse(item)))) throw new Error('Data del confronto non valida.');
    if (key === 'originalFilesRemoved' && typeof item !== 'boolean') throw new Error('Stato del confronto non valido.');
  }
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type PolicyContent = PageContent & { finalUrl: string };
export function semanticFields(content: PolicyContent, data?: DetectionData | null, assets = true) {
  const fields = detectionFields(content);
  if (assets && data?.assets) fields.images = [...new Set(data.assets.map(a => a.status === 'loaded' && a.hash ? `${a.kind}:${a.hash}` : `${a.kind}:unavailable:${a.url}`))].sort();
  return { ...fields, ...(data?.important.length ? { important: JSON.parse(importantSignature(data)) } : {}) };
}
export const semanticSignature = (content: PolicyContent, data?: DetectionData | null) => digest(semanticFields(content, data));
export function isReliable(quality?: CaptureQuality | null) {
  return !!quality && quality.status === 'complete' && quality.stable !== false && quality.renderStatus !== 'partial' && quality.archiveStatus !== 'partial';
}
export function canConfirmAbsence(quality?: CaptureQuality | null) {
  return isReliable(quality) && quality?.version === 2 && quality.stable === true && quality.renderStatus === 'complete';
}
function tokens(text: string) { return normalized(text).match(/[\p{L}\p{N}]+(?:[.,][\p{N}]+)?|[^\s\p{L}\p{N}]/gu) || []; }
function addedText(before: string, after: string) {
  before = normalized(before); after = normalized(after);
  if (!after || before.includes(after)) return false;
  const counts = new Map<string, number>();
  for (const token of tokens(before)) counts.set(token, (counts.get(token) || 0) + 1);
  return tokens(after).some(token => { const count = counts.get(token) || 0; counts.set(token, count - 1); return count === 0; });
}
export function retainedTextRatio(before: string, after: string) {
  const withoutNumbers = (text: string) => normalized(text).replace(/\p{N}+(?:[.,]\p{N}+)?/gu, '#');
  if (withoutNumbers(before) === withoutNumbers(after)) return 1;
  const previous = tokens(before), counts = new Map<string, number>();
  if (!previous.length) return 1;
  for (const token of tokens(after)) counts.set(token, (counts.get(token) || 0) + 1);
  let retained = 0;
  for (const token of previous) { const count = counts.get(token) || 0; if (count > 0) { retained++; counts.set(token, count - 1); } }
  return retained / previous.length;
}
export function compareContent(before: PolicyContent, beforeData: DetectionData | null, after: PolicyContent, afterData?: DetectionData | null) {
  const compareAssets = !!beforeData?.assets && !!afterData?.assets;
  const a = semanticFields(before, beforeData, compareAssets), b = semanticFields(after, afterData, compareAssets);
  const changed = digest(a) !== digest(b);
  const signals: string[] = [];
  if (a.title !== b.title && addedText(a.title, b.title)) signals.push('Titolo nuovo o modificato');
  if (a.text !== b.text && addedText(a.text, b.text)) signals.push('Testo nuovo o modificato');
  if (b.headings.some(t => !a.headings.includes(t) && addedText(a.headings.join(' '), t))) signals.push('Intestazione nuova o modificata');
  const oldLinks = new Set(a.links.map(l => JSON.stringify(l)));
  if (b.links.some(l => !oldLinks.has(JSON.stringify(l)))) signals.push('Collegamento o pulsante nuovo');
  if (compareAssets) {
    const oldHashes = new Set(beforeData!.assets!.filter(v => v.status === 'loaded' && v.hash).map(v => `${v.kind}:${v.hash}`));
    if (afterData!.assets!.some(v => v.status === 'loaded' && v.hash && !oldHashes.has(`${v.kind}:${v.hash}`))) signals.push('Contenuto di un’immagine modificato');
  } else if (b.images.some(url => !a.images.includes(url))) signals.push('Nuova immagine osservata');
  const oldImportant = new Map((beforeData?.important || []).map(i => [i.selector, i]));
  if (afterData?.important.some(i => { const old = oldImportant.get(i.selector); return i.text && (!old || addedText(old.text, i.text)); })) signals.push('Modifica in una zona importante');
  if (a.finalUrl !== b.finalUrl) signals.push('Destinazione della pagina modificata');
  return { changed, novel: signals.length > 0, absenceOnly: changed && !signals.length, signals: signals.slice(0, 16) };
}
// Candidate identity never decodes a PNG in the coordinator process.
// Perceptual comparisons remain in the bounded disposable image worker.
export const visualFingerprint = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
export const candidateFingerprint = (signature: string, visual?: string) => digest({ signature, visual: visual || '' });
