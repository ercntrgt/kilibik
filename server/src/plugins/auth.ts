import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../auth/jwt.js';
import { err } from '../errors.js';
import type { AppDeps } from '../deps.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function makeAuthenticate(deps: AppDeps) {
  return async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw err.unauthorized();
    const claims = await verifyAccessToken(deps.config.jwtSecret, h.slice(7));
    if (!claims) throw err.unauthorized();
    const { rows } = await deps.db.query('select 1 from users where id = $1 and deleted_at is null', [claims.sub]);
    if (!rows.length) throw err.unauthorized('account_deleted');
    req.userId = claims.sub;
  };
}
