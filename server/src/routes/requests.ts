import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import {
  REQUESTS_PER_HOUR,
  REQUEST_BODY_MAX_BYTES,
  REQUEST_RESPONSES,
  fromBase64,
  toBase64,
  type RequestView,
} from '../../../shared/src/index.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { getActivePair } from '../pairs.js';
import { hitCounter } from '../rate.js';
import { keys } from '../redis.js';

interface Row {
  id: string;
  sender_id: string;
  body_encrypted: Buffer;
  status: RequestView['status'];
  created_at: Date;
  responded_at: Date | null;
}

function view(r: Row): RequestView {
  return {
    id: r.id,
    sender_id: r.sender_id,
    body_encrypted: toBase64(new Uint8Array(r.body_encrypted)),
    status: r.status,
    created_at: r.created_at.toISOString(),
    responded_at: r.responded_at ? r.responded_at.toISOString() : null,
  };
}

export async function requestRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis, notify, config } = deps;

  /** İstek gönder. Sınır: saatte 10 (spam ve baskı aracına dönüşmesini engeller). */
  app.post(
    '/requests',
    { preHandler: authenticate, schema: { body: Type.Object({ body_encrypted: Type.String({ minLength: 56, maxLength: 4096 }) }) } },
    async (req, reply): Promise<RequestView> => {
      const pair = await getActivePair(db, req.userId);
      if (!pair) throw err.conflict('not_paired');
      const body = fromBase64((req.body as { body_encrypted: string }).body_encrypted);
      if (body.length < 1 + 24 + 16 || body.length > REQUEST_BODY_MAX_BYTES) throw err.badRequest('invalid_body');
      if (body[0] !== 1) throw err.badRequest('invalid_body');
      const rate = await hitCounter(redis, keys.requestRate(req.userId), REQUESTS_PER_HOUR, 3600);
      if (!rate.allowed) throw err.tooMany('request_rate_limited', rate.retryAfter);
      const { rows } = await db.query<Row>(
        `insert into requests (pair_id, sender_id, body_encrypted) values ($1, $2, $3)
         returning id, sender_id, body_encrypted, status, created_at, responded_at`,
        [pair.id, req.userId, Buffer.from(body)],
      );
      await notify(pair.partnerId, 'request');
      reply.code(201);
      return view(rows[0]);
    },
  );

  /** Tek liste: gönderdiklerin ve sana gelenler birlikte, yeniden eskiye. */
  app.get(
    '/requests',
    {
      preHandler: authenticate,
      schema: { querystring: Type.Object({ since: Type.Optional(Type.String()), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })) }) },
    },
    async (req): Promise<{ requests: RequestView[] }> => {
      const pair = await getActivePair(db, req.userId);
      if (!pair) return { requests: [] };
      const { since, limit = 100 } = req.query as { since?: string; limit?: number };
      const { rows } = await db.query<Row>(
        `select id, sender_id, body_encrypted, status, created_at, responded_at from requests
         where pair_id = $1 and created_at > now() - ($2 || ' days')::interval
           and ($3::timestamptz is null or created_at > $3::timestamptz or responded_at > $3::timestamptz)
         order by created_at desc limit $4`,
        [pair.id, String(config.requestRetentionDays), since ?? null, limit],
      );
      return { requests: rows.map(view) };
    },
  );

  /** Yanıt: Tamam / Olmaz / Sonra. Yalnızca alıcı yanıtlar; erteleneni sonra tekrar yanıtlayabilir. */
  app.post(
    '/requests/:id/respond',
    {
      preHandler: authenticate,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({ status: Type.Union(REQUEST_RESPONSES.map((s) => Type.Literal(s))) }),
      },
    },
    async (req): Promise<RequestView> => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: (typeof REQUEST_RESPONSES)[number] };
      const pair = await getActivePair(db, req.userId);
      if (!pair) throw err.conflict('not_paired');
      const { rows } = await db.query<Row>(
        `update requests set status = $3, responded_at = now()
         where id = $1 and pair_id = $2 and sender_id <> $4 and status in ('pending', 'snoozed')
         returning id, sender_id, body_encrypted, status, created_at, responded_at`,
        [id, pair.id, status, req.userId],
      );
      if (!rows[0]) throw err.notFound('request_not_found');
      await notify(rows[0].sender_id, 'request_response');
      return view(rows[0]);
    },
  );
}
