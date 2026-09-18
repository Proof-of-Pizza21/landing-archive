import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { all, get, id, now, run, transaction } from './db.js';

declare module 'fastify' {
  interface FastifyContextConfig { publicAccess?: boolean }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const legacyCookieName = 'landing_archive_session';
const sessionPrefix = 'v2:';
const sessionTokenPattern = /^la2_[a-f0-9]{64}$/;
const resourceTicketLifetime = 60_000;
const maxResourceTickets = 2048;
const sessionHash = (token: string) => sessionPrefix + digest(token);
function bearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ') && sessionTokenPattern.test(authorization.slice(7)) ? authorization.slice(7) : undefined;
}
function userForSession(hash: string) {
  return get('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?', hash, now());
}
// Tickets authorize one native browser resource, never general API access. A token
// cannot be moved to another path, query, method, user session or application restart.
function ticketResourcePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/api/') || /[\\#\s]/.test(value)) return;
  const url = new URL(value, 'http://ticket.invalid');
  if (url.origin !== 'http://ticket.invalid' || url.pathname.includes('%') || url.pathname + url.search !== value) return;
  const key = '[a-zA-Z0-9_-]{1,80}';
  if (new RegExp(`^/api/versions/${key}/offline/html$`).test(url.pathname)) {
    const entries = [...url.searchParams.entries()];
    if (entries.length > 1 || entries.some(([name, at]) => name !== 'at' || at.length !== 24 || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at)) return;
  } else {
    if (url.search) return;
    if (!new RegExp(`^/api/(?:versions/${key}/(?:screenshot|html)|pages/${key}/diagnostics/${key}/screenshot|sites/${key}/export|export|restore/safety|source)$`).test(url.pathname)) return;
  }
  return value;
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password: string, stored: string) {
  try {
    const [salt, value] = stored.split(':');
    const expected = Buffer.from(value, 'hex'), actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
export const setupRequired = () => !get('SELECT id FROM users LIMIT 1');
export function sessionUser(request: FastifyRequest) {
  const token = bearerToken(request);
  return token ? userForSession(sessionHash(token)) : undefined;
}
function establishSession(userId: string) {
  run('DELETE FROM sessions WHERE expires_at<=?', now());
  const token = 'la2_' + randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 3600;
  run('INSERT INTO sessions VALUES (?,?,?)', sessionHash(token), userId, new Date(Date.now() + maxAge * 1000).toISOString());
  return token;
}
export function registerAuth(app: FastifyInstance) {
  // Pre-update cookies are irrevocably invalid even if another same-host app kept
  // a copy. The account and password are unchanged; the owner simply signs in again.
  run("DELETE FROM sessions WHERE hash NOT LIKE 'v2:%'");
  const tickets = new Map<string, { path: string; session: string; expires: number }>();
  app.addHook('onClose', async () => { tickets.clear(); });
  function ticketAllows(request: FastifyRequest) {
    if (request.method !== 'GET' || !request.raw.url?.startsWith('/api/')) return false;
    const url = new URL(request.raw.url, 'http://ticket.invalid');
    const values = url.searchParams.getAll('access_ticket');
    if (values.length !== 1 || !/^[a-f0-9]{64}$/.test(values[0])) return false;
    const ticket = tickets.get(digest(values[0]));
    if (!ticket || ticket.expires <= Date.now()) { tickets.delete(digest(values[0])); return false; }
    // Remove the appended ticket without reserializing the original query: paths
    // with different escaping or duplicate parameters must not become equivalent.
    const suffix = `${ticket.path.includes('?') ? '&' : '?'}access_ticket=${values[0]}`;
    if (request.raw.url !== ticket.path + suffix || !ticketResourcePath(ticket.path)) return false;
    if (!userForSession(ticket.session)) { tickets.delete(digest(values[0])); return false; }
    return true;
  }
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer').header('X-Frame-Options', 'DENY');
    if (request.cookies[legacyCookieName]) reply.clearCookie(legacyCookieName, { path: '/' });
    // Authorization belongs to the matched route, never to the raw request target.
    // New routes are private unless registration explicitly marks them public.
    if (request.routeOptions.url?.startsWith('/api/') || !request.routeOptions.config.publicAccess) reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== request.headers.host) return reply.code(403).send({ error: 'Origine della richiesta non consentita' }); }
        catch { return reply.code(403).send({ error: 'Origine della richiesta non valida' }); }
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).send({ error: 'Richiesta esterna non consentita' });
    }
    if (!request.routeOptions.config.publicAccess && !sessionUser(request) && !ticketAllows(request)) {
      return reply.code(401).send({ error: 'Accedi per consultare l’archivio' });
    }
  });
  app.get('/api/auth/status', { config: { publicAccess: true } }, async request => ({ setupRequired: setupRequired(), authenticated: !!sessionUser(request) }));
  const rateLimit = { max: 8, timeWindow: '1 minute' };
  app.post('/api/auth/setup', { config: { rateLimit, publicAccess: true } }, async (request, reply) => {
    if (!setupRequired()) return reply.code(409).send({ error: 'L’account è già stato creato' });
    const { username, password } = (request.body || {}) as any;
    if (typeof username !== 'string' || !/^[\p{L}\p{N}_.-]{3,40}$/u.test(username) || typeof password !== 'string' || password.length < 12 || password.length > 200) {
      return reply.code(400).send({ error: 'Scegli un nome di almeno 3 caratteri e una password di almeno 12 caratteri' });
    }
    const userId = id(), stored = passwordHash(password);
    transaction(() => {
      if (!setupRequired()) throw Object.assign(new Error('Account già creato'), { statusCode: 409 });
      run('INSERT INTO users VALUES (?,?,?,?)', userId, username, stored, now());
    });
    return { ok: true, token: establishSession(userId) };
  });
  app.post('/api/auth/login', { config: { rateLimit, publicAccess: true } }, async (request, reply) => {
    const { username, password } = (request.body || {}) as any;
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) return reply.code(400).send({ error: 'Credenziali non valide' });
    const user = get('SELECT * FROM users WHERE username=?', username);
    if (!user || !passwordMatches(password, user.password)) {
      if (!user) scryptSync(password, 'missing-user-timing', 64);
      return reply.code(401).send({ error: 'Nome utente o password non corretti' });
    }
    return { ok: true, token: establishSession(user.id) };
  });
  app.post('/api/auth/resource-ticket', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (request, reply) => {
    const path = ticketResourcePath((request.body as { path?: unknown } | null)?.path);
    const token = bearerToken(request);
    if (!path) return reply.code(400).send({ error: 'Risorsa non consentita' });
    if (!token || !sessionUser(request)) return reply.code(401).send({ error: 'Accedi per consultare l’archivio' });
    for (const [key, ticket] of tickets) if (ticket.expires <= Date.now()) tickets.delete(key);
    while (tickets.size >= maxResourceTickets) tickets.delete(tickets.keys().next().value!);
    const value = randomBytes(32).toString('hex'), expires = Date.now() + resourceTicketLifetime;
    tickets.set(digest(value), { path, session: sessionHash(token), expires });
    return { url: `${path}${path.includes('?') ? '&' : '?'}access_ticket=${value}`, expiresAt: new Date(expires).toISOString() };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    const token = bearerToken(request);
    if (token) {
      const hash = sessionHash(token);
      run('DELETE FROM sessions WHERE hash=?', hash);
      for (const [key, ticket] of tickets) if (ticket.session === hash) tickets.delete(key);
    }
    reply.clearCookie(legacyCookieName, { path: '/' });
    return { ok: true };
  });
}
