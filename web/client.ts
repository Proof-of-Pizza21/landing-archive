import { t, message } from './i18n';
export const sessionStorageKey = 'landing-archive.session.v2';
const sessionTokenPattern = /^la2_[a-f0-9]{64}$/;
let memoryToken: string | undefined;
function token() {
  try {
    const stored = sessionStorage.getItem(sessionStorageKey);
    if (stored && sessionTokenPattern.test(stored)) return stored;
  } catch { /* The current tab can still work when storage is unavailable. */ }
  return memoryToken;
}
function setToken(value?: string) {
  memoryToken = value;
  try { if (value) sessionStorage.setItem(sessionStorageKey, value); else sessionStorage.removeItem(sessionStorageKey); } catch { /* Memory-only session. */ }
}
function privatePath(path: string) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || url.hash) throw new Error(t("Request address not allowed."));
  return url.pathname + url.search;
}
/** Only this origin receives the bearer credential; redirects cannot forward it. */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const target = privatePath(path), headers = new Headers(options.headers);
  const value = token();
  headers.delete('Authorization');
  if (value) headers.set('Authorization', `Bearer ${value}`);
  // Umbrel's proxy needs its own cookie before forwarding the request. The app
  // still authenticates exclusively with its origin-scoped Bearer credential.
  const response = await fetch(target, { ...options, headers, credentials: 'same-origin', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (response.status === 401) { setToken(); window.dispatchEvent(new CustomEvent('session-expired')); }
  return response;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const target = privatePath(path), headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await authFetch(target, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(message(data.error) || t("The request could not be completed."));
  if ((target === '/api/auth/login' || target === '/api/auth/setup') && sessionTokenPattern.test(data.token)) setToken(data.token);
  if (target === '/api/auth/logout') setToken();
  return data as T;
}
export const post = <T,>(path: string, body = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
/** Short-lived, exact-resource URL for native image/frame/streaming downloads. */
export async function resourceUrl(path: string): Promise<string> {
  const { url } = await post<{ url: string; expiresAt: string }>('/api/auth/resource-ticket', { path: privatePath(path) });
  return url;
}
