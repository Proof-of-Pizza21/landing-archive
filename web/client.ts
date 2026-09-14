export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired'));
    throw new Error(data.error || 'Non è stato possibile completare la richiesta.');
  }
  return data as T;
}
export const post = <T,>(path: string, body = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
