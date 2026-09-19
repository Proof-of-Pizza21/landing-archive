import { useSyncExternalStore } from 'react';
import { interpolate, localize, supportedLanguage, type Language } from '../src/localization';
export type { Language } from '../src/localization';
export const languageStorageKey = 'landing-archive.language';
const listeners = new Set<() => void>();
function readPreference(): Language {
  try { return typeof window === 'undefined' ? 'en' : supportedLanguage(window.localStorage.getItem(languageStorageKey)); }
  catch { return 'en'; }
}
let current = readPreference();
export const getLanguage = () => current;
export const locale = () => current === 'it' ? 'it-IT' : 'en-US';
function apply(language: Language) {
  current = language;
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  for (const notify of listeners) notify();
}
export function setLanguage(language: Language) {
  if (language !== 'en' && language !== 'it') return;
  try { window.localStorage.setItem(languageStorageKey, language); } catch { /* Keep a working in-memory preference when storage is blocked. */ }
  apply(language);
}
if (typeof window !== 'undefined') {
  document.documentElement.lang = current;
  window.addEventListener('storage', event => { if (event.key === languageStorageKey || event.key === null) apply(readPreference()); });
}
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };
export function useLanguage() { return { language: useSyncExternalStore(subscribe, getLanguage, () => 'en'), setLanguage }; }
export const t = (english: string, params?: Record<string, string | number>) => interpolate(current === 'en' ? english : localize(english, current), params);
export const message = (value?: string | null) => localize(value || '', current);
