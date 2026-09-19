import { translations } from './translations.js';
export type Language = 'en' | 'it';
export const supportedLanguage = (value: unknown): Language => value === 'it' ? 'it' : 'en';
const english = new Map(translations.map(([en, it]) => [it, en]));
const italian = new Map(translations.map(([en, it]) => [en, it]));
const token = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
export function interpolate(value: string, params: Record<string, string | number> = {}) {
  return value.replace(token, (match, key: string) => Object.hasOwn(params, key) ? String(params[key]) : match);
}
// Match only fixed application templates. Literal scans avoid unbounded regex
// backtracking on historical messages or values received from the worker.
function templateParts(value: string) {
  const names: string[] = [], parts: string[] = []; let start = 0;
  for (const match of value.matchAll(token)) { parts.push(value.slice(start, match.index)); names.push(match[1]); start = match.index! + match[0].length; }
  parts.push(value.slice(start)); return { names, parts };
}
const patterns = translations.filter(([en]) => /\{p\d+\}/.test(en)).flatMap(([en, it]) => [
  { from: templateParts(it), to: en, language: 'en' as const },
  { from: templateParts(en), to: it, language: 'it' as const },
]).sort((a, b) => b.from.parts.join('').length - a.from.parts.join('').length);
function matchTemplate(value: string, parts: string[], names: string[]) {
  if (!value.startsWith(parts[0])) return;
  let offset = parts[0].length; const params: Record<string, string> = {};
  for (let i = 0; i < names.length; i++) {
    const next = parts[i + 1], last = i === names.length - 1;
    const end = last ? value.length - next.length : next ? value.indexOf(next, offset) : offset;
    if (end < offset || (last && !value.endsWith(next))) return;
    params[names[i]] = value.slice(offset, end); offset = end + next.length;
  }
  return offset === value.length ? params : undefined;
}
/** Use only for application messages, never page text, site names or user notes. */
export function localize(value: string, language: Language, depth = 0): string {
  if (!value || value.length > 16384 || depth > 3) return value;
  const direct = (language === 'en' ? english : italian).get(value);
  if (direct !== undefined) return direct;
  const trimmed = value.trim();
  if (trimmed !== value) return value.slice(0, value.indexOf(trimmed)) + localize(trimmed, language, depth + 1) + value.slice(value.indexOf(trimmed) + trimmed.length);
  for (const pattern of patterns) {
    if (pattern.language !== language) continue;
    const params = matchTemplate(value, pattern.from.parts, pattern.from.names);
    if (!params) continue;
    // These slots are other application messages, rather than user content.
    if (pattern.to.includes('New attempt scheduled') || pattern.to.includes('Nuovo tentativo programmato') || pattern.to.startsWith('Load needs review:') || pattern.to.startsWith('Caricamento da verificare:')) params.p0 = localize(params.p0, language, depth + 1);
    if (pattern.to.startsWith('Capture failed during:') || pattern.to.startsWith('Acquisizione non completata durante:')) for (const key of Object.keys(params)) params[key] = localize(params[key], language, depth + 1);
    return interpolate(pattern.to, params);
  }
  // Jobs can append independently generated sentences to a stored diagnostic.
  const pieces = value.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])|(?<=;)\s+| · /u);
  if (pieces.length > 1 && pieces.length <= 24) {
    let offset = 0, out = '';
    for (const part of pieces) { const start = value.indexOf(part, offset); out += value.slice(offset, start) + localize(part, language, depth + 1); offset = start + part.length; }
    return out + value.slice(offset);
  }
  return value;
}
