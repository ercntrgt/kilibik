import { randomInt } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { INVITE_CODE_TTL_SECONDS, toBase64, type PairView } from '../../../shared/src/index.js';
import { withTx } from '../db.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { dissolvePair, getActivePair } from '../pairs.js';
import { keys } from '../redis.js';

// Karıştırılması kolay karakterler (0/O, 1/I) dışarıda.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function inviteCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export async function pairRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis, notify } = deps;

  async function requirePublicKey(userId: string) {
    const { rows } = await db.query<{ public_key: Buffer | null }>('select public_key from users where id = $1', [userId]);
    if (!rows[0]?.public_key) throw err.conflict('public_key_required', 'Önce açık anahtar yüklenmeli');
    return rows[0].public_key;
  }

  /** Tek kullanımlık davet kodu üretir (QR aynı kodu taşır). */
  app.post('/pair/invite', { preHandler: authenticate }, async (req) => {
    if (await getActivePair(db, req.userId)) throw err.conflict('already_paired');
    await requirePublicKey(req.userId);
    const old = await redis.get(keys.inviteByUser(req.userId));
    if (old) await redis.del(keys.invite(old));
    const code = inviteCode();
    await redis.set(keys.invite(code), req.userId, 'EX', INVITE_CODE_TTL_SECONDS);
    await redis.set(keys.inviteByUser(req.userId), code, 'EX', INVITE_CODE_TTL_SECONDS);
    return { code, expires_in: INVITE_CODE_TTL_SECONDS };
  });

  app.post(
    '/pair/accept',
    { preHandler: authenticate, schema: { body: Type.Object({ code: Type.String({ minLength: 8, maxLength: 8 }) }) } },
    async (req): Promise<PairView> => {
      const code = (req.body as { code: string }).code.toUpperCase();
      const uid = req.userId;
      if (await getActivePair(db, uid)) throw err.conflict('already_paired');
      await requirePublicKey(uid);
      const inviterId = await redis.get(keys.invite(code));
      if (!inviterId) throw err.notFound('invite_not_found');
      if (inviterId === uid) throw err.badRequest('cannot_pair_with_self');
      // Kod tek kullanımlık: atomik sil; yarışta ikinci kabul edici kaybeder.
      if ((await redis.del(keys.invite(code))) !== 1) throw err.notFound('invite_not_found');
      await redis.del(keys.inviteByUser(inviterId));

      const inviterPk = await requirePublicKey(inviterId);
      const pair = await withTx(db, async (tx) => {
        // Her iki kullanıcıyı kilitle; aynı anda ikinci eşleşmeyi engelle.
        await tx.query('select id from users where id = any($1::uuid[]) and deleted_at is null for update', [[inviterId, uid]]);
        if ((await getActivePair(tx, inviterId)) || (await getActivePair(tx, uid))) throw err.conflict('already_paired');
        const { rows } = await tx.query<{ id: string; created_at: Date }>(
          'insert into pairs (user_a_id, user_b_id) values ($1, $2) returning id, created_at',
          [inviterId, uid],
        );
        return rows[0];
      });
      await notify(inviterId, 'pair');
      return {
        id: pair.id,
        partner_id: inviterId,
        partner_public_key: toBase64(new Uint8Array(inviterPk)),
        created_at: pair.created_at.toISOString(),
      };
    },
  );

  app.get('/pair', { preHandler: authenticate }, async (req): Promise<PairView | null> => {
    const pair = await getActivePair(db, req.userId);
    if (!pair) return null;
    const pk = await db.query<{ public_key: Buffer | null }>('select public_key from users where id = $1', [pair.partnerId]);
    return {
      id: pair.id,
      partner_id: pair.partnerId,
      partner_public_key: pk.rows[0]?.public_key ? toBase64(new Uint8Array(pk.rows[0].public_key)) : null,
      created_at: pair.createdAt.toISOString(),
    };
  });

  /** Eşleşmeyi sonlandırır: istekler silinir, iki tarafın konum blob'u silinir. */
  app.delete('/pair', { preHandler: authenticate }, async (req) => {
    const pair = await getActivePair(db, req.userId);
    if (!pair) throw err.notFound('not_paired');
    await withTx(db, (tx) => dissolvePair(tx, pair.id));
    await redis.del(keys.location(req.userId), keys.location(pair.partnerId));
    await notify(pair.partnerId, 'pair_dissolved');
    return { ok: true };
  });
}
