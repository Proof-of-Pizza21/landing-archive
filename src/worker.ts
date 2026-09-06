import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { host, getWorkerToken } from './config.js';
import { capturePage, closeBrowser, CaptureError } from './capture.js';
import { discoverSite } from './discovery.js';

export function createWorker() {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024, requestTimeout: 200000 });
  let busy = false;
  app.get('/api/health', async () => ({ ok: true, busy }));
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/health') return;
    let expected: Buffer;
    try { expected = Buffer.from(`Bearer ${getWorkerToken()}`); } catch { return reply.code(503).send({ error: 'Configurazione del servizio non pronta' }); }
    const actual = Buffer.from(request.headers.authorization || '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply.code(401).send({ error: 'Accesso al servizio non consentito' });
  });
  for (const operation of ['capture', 'discover'] as const) app.post(`/${operation}`, async (request, reply) => {
    if (busy) return reply.code(503).send({ error: 'Un’acquisizione è già in corso', code: 'WORKER_BUSY' });
    const body = request.body as any;
    if (!body || typeof body.url !== 'string' || (body.ignoreSelectors !== undefined && (!Array.isArray(body.ignoreSelectors) || body.ignoreSelectors.some((v: unknown) => typeof v !== 'string')))) return reply.code(400).send({ error: 'Parametri non validi', code: 'INVALID_INPUT' });
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    const disconnected = () => { if (!reply.raw.writableFinished) controller.abort(); };
    reply.raw.once('close', disconnected);
    try {
      if (operation === 'capture') {
        const result = await capturePage({ ...body, signal: controller.signal });
        return { ...result, screenshot: result.screenshot.toString('base64') };
      }
      return await discoverSite({ ...body, signal: controller.signal });
    } catch (error) {
      return reply.code(422).send(error instanceof CaptureError ? { error: error.message, code: error.code, statusCode: error.statusCode } : { error: 'Acquisizione non completata', code: 'CAPTURE_FAILED' });
    } finally { clearTimeout(timer); reply.raw.off('close', disconnected); busy = false; }
  });
  app.addHook('onClose', async () => { await closeBrowser(); });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createWorker(), port = Number(process.env.PORT || 4311);
  await app.listen({ host, port });
  console.log(`Servizio acquisizioni pronto sulla porta ${port}`);
  process.once('SIGTERM', () => void app.close()); process.once('SIGINT', () => void app.close());
}
