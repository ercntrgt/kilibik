import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import {
  LOCATION_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  fromBase64,
  toBase64,
  type MeView,
} from '../../../shared/src/index.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { getActivePair } from '../pairs.js';
import { keys } from '../redis.js';

export async function meRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis } = deps;

  app.get('/me', { preHandler: authenticate }, async (req): Promise<MeView> => {
    const uid = req.userId;
    const [u, s, c, pair] = await Promise.all([
      db.query<{ public_key: Buffer | null }>('select public_key from users where id = $1', [uid]),
      db.query<{ location_sharing_enabled: boolean }>('select location_sharing_enabled from sharing_state where user_id = $1', [uid]),
      db.query<{ kind: string; version: number }>('select kind, version from consents where user_id = $1', [uid]),
      getActivePair(db, uid),
    ]);
    let pairView: MeView['pair'] = null;
    if (pair) {
      const pk = await db.query<{ public_key: Buffer | null }>('select public_key from users where id = $1', [pair.partnerId]);
      pairView = {
        id: pair.id,
        partner_id: pair.partnerId,
        partner_public_key: pk.rows[0]?.public_key ? toBase64(new Uint8Array(pk.rows[0].public_key)) : null,
        created_at: pair.createdAt.toISOString(),
      };
    }
    const consent = (k: string) => c.rows.find((r) => r.kind === k)?.version ?? null;
    return {
      id: uid,
      has_public_key: !!u.rows[0]?.public_key,
      location_sharing_enabled: s.rows[0]?.location_sharing_enabled ?? false,
      consents: { privacy_notice_version: consent('privacy_notice'), location_consent_version: consent('location') },
      pair: pairView,
    };
  });

  app.put(
    '/me/public-key',
    { preHandler: authenticate, schema: { body: Type.Object({ public_key: Type.String({ minLength: 40, maxLength: 48 }) }) } },
    async (req) => {
      const pk = fromBase64((req.body as { public_key: string }).public_key);
      if (pk.length !== 32) throw err.badRequest('invalid_public_key');
      // Aktif eşleşme varken anahtar değiştirmek partnerin şifresini bozar; önce eşleşme sonlandırılmalı.
      if (await getActivePair(db, req.userId)) {
        const cur = await db.query<{ public_key: Buffer | null }>('select public_key from users where id = $1', [req.userId]);
        if (cur.rows[0]?.public_key && !Buffer.from(pk).equals(cur.rows[0].public_key)) throw err.conflict('key_locked_by_pair');
      }
      await db.query('update users set public_key = $2 where id = $1', [req.userId, Buffer.from(pk)]);
      return { ok: true };
    },
  );

  app.put(
    '/me/push-token',
    {
      preHandler: authenticate,
      schema: {
        body: Type.Object({
          token: Type.String({ minLength: 8, maxLength: 4096 }),
          platform: Type.Union([Type.Literal('ios'), Type.Literal('android')]),
        }),
      },
    },
    async (req) => {
      const { token, platform } = req.body as { token: string; platform: 'ios' | 'android' };
      await db.query('update users set push_token = $2, push_platform = $3 where id = $1', [req.userId, token, platform]);
      return { ok: true };
    },
  );

  app.delete('/me/push-token', { preHandler: authenticate }, async (req) => {
    await db.query('update users set push_token = null, push_platform = null where id = $1', [req.userId]);
    return { ok: true };
  });

  /** Rıza kaydı. Aydınlatma metni "okudum" ve konum için AYRI açık rıza. */
  app.post(
    '/me/consents',
    {
      preHandler: authenticate,
      schema: {
        body: Type.Object({
          kind: Type.Union([Type.Literal('privacy_notice'), Type.Literal('location')]),
          version: Type.Integer({ minimum: 1 }),
        }),
      },
    },
    async (req) => {
      const { kind, version } = req.body as { kind: 'privacy_notice' | 'location'; version: number };
      const current = kind === 'privacy_notice' ? PRIVACY_NOTICE_VERSION : LOCATION_CONSENT_VERSION;
      if (version !== current) throw err.badRequest('consent_version_mismatch', undefined, { current });
      await db.query(
        `insert into consents (user_id, kind, version) values ($1, $2, $3)
         on conflict (user_id, kind) do update set version = excluded.version, given_at = now()`,
        [req.userId, kind, version],
      );
      return { ok: true };
    },
  );

  /**
   * Konum rızasını geri alma: paylaşımı kapatır, rıza kaydını siler.
   * Partnere hiçbir bildirim gitmez. Geçmiş tutulmaz.
   */
  app.delete('/me/consents/location', { preHandler: authenticate }, async (req) => {
    await db.query('delete from consents where user_id = $1 and kind = $2', [req.userId, 'location']);
    await db.query('update sharing_state set location_sharing_enabled = false, updated_at = now() where user_id = $1', [req.userId]);
    await redis.del(keys.location(req.userId));
    return { ok: true };
  });
}
