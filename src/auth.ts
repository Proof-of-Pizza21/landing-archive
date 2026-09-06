import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { all, get, id, now, run, transaction } from './db.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'landing_archive_session';
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
  const token = request.cookies[cookieName];
  if (!token || token.length > 200) return undefined;
  return get('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?', digest(token), now());
}
function establishSession(request: FastifyRequest, reply: FastifyReply, userId: string) {
  run('DELETE FROM sessions WHERE expires_at<=?', now());
  const token = randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 3600;
  run('INSERT INTO sessions VALUES (?,?,?)', digest(token), userId, new Date(Date.now() + maxAge * 1000).toISOString());
  reply.setCookie(cookieName, token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge, secure: request.protocol === 'https' });
}
export function registerAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin').header('X-Frame-Options', 'DENY');
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== request.headers.host) return reply.code(403).send({ error: 'Origine della richiesta non consentita' }); }
        catch { return reply.code(403).send({ error: 'Origine della richiesta non valida' }); }
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).send({ error: 'Richiesta esterna non consentita' });
    }
    const path = request.url.split('?')[0];
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/') && path !== '/api/health' && !sessionUser(request)) {
      return reply.code(401).send({ error: 'Accedi per consultare l’archivio' });
    }
  });
  app.get('/api/auth/status', async request => ({ setupRequired: setupRequired(), authenticated: !!sessionUser(request) }));
  const rateLimit = { max: 8, timeWindow: '1 minute' };
  app.post('/api/auth/setup', { config: { rateLimit } }, async (request, reply) => {
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
    establishSession(request, reply, userId);
    return { ok: true };
  });
  app.post('/api/auth/login', { config: { rateLimit } }, async (request, reply) => {
    const { username, password } = (request.body || {}) as any;
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) return reply.code(400).send({ error: 'Credenziali non valide' });
    const user = get('SELECT * FROM users WHERE username=?', username);
    if (!user || !passwordMatches(password, user.password)) {
      if (!user) scryptSync(password, 'missing-user-timing', 64);
      return reply.code(401).send({ error: 'Nome utente o password non corretti' });
    }
    establishSession(request, reply, user.id);
    return { ok: true };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token) run('DELETE FROM sessions WHERE hash=?', digest(token));
    reply.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  });
}
