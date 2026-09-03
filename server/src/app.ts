import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppDeps } from './deps.js';
import { HttpError } from './errors.js';
import { makeAuthenticate } from './plugins/auth.js';
import { accountRoutes } from './routes/account.js';
import { authRoutes } from './routes/auth.js';
import { legalRoutes } from './routes/legal.js';
import { locationRoutes } from './routes/location.js';
import { meRoutes } from './routes/me.js';
import { nudgeRoutes } from './routes/nudge.js';
import { pairRoutes } from './routes/pair.js';
import { requestRoutes } from './routes/requests.js';

export async function buildApp(deps: AppDeps, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? deps.config.env !== 'test',
    bodyLimit: 16 * 1024,
    trustProxy: true,
  });
  await app.register(cors, { origin: false });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message, ...error.extra });
    }
    const e = error as { validation?: unknown; message?: string };
    if (e.validation) {
      return reply.code(400).send({ error: 'validation', message: e.message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'internal' });
  });

  // Konum blob'u ve istek gövdesi asla loglanmaz: request body loglama kapalı (Fastify varsayılanı).
  app.get('/health', async () => ({ ok: true }));

  const authenticate = makeAuthenticate(deps);
  await authRoutes(app, deps);
  await legalRoutes(app);
  await meRoutes(app, deps, authenticate);
  await pairRoutes(app, deps, authenticate);
  await requestRoutes(app, deps, authenticate);
  await locationRoutes(app, deps, authenticate);
  await nudgeRoutes(app, deps, authenticate);
  await accountRoutes(app, deps, authenticate);
  return app;
}
