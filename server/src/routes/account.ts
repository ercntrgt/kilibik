import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { withTx } from '../db.js';
import type { AppDeps } from '../deps.js';
import { dissolvePair, getActivePair } from '../pairs.js';
import { deleteUserKeys } from '../redis.js';

/**
 * Hesap silme — uygulama içinden, tam silme.
 * Anında: eşleşme sonlandırılır, istekler/rızalar/paylaşım durumu silinir, kullanıcı
 * anonimleştirilir (anahtar, push token, kimlik özeti kaldırılır), Redis anahtarları silinir.
 * En geç 30 gün: purge job satırı fiziksel olarak siler (docs/compliance/veri-saklama-tablosu.md).
 */
export async function accountRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis, notify } = deps;

  app.delete('/account', { preHandler: authenticate }, async (req) => {
    const uid = req.userId;
    const pair = await getActivePair(db, uid);
    await withTx(db, async (tx) => {
      if (pair) await dissolvePair(tx, pair.id);
      await tx.query('delete from requests where sender_id = $1', [uid]);
      await tx.query('delete from consents where user_id = $1', [uid]);
      await tx.query('delete from sharing_state where user_id = $1', [uid]);
      await tx.query(
        `update users set deleted_at = now(), public_key = null, push_token = null, push_platform = null,
           auth_provider_id = $2 where id = $1`,
        [uid, `deleted:${randomBytes(16).toString('hex')}`],
      );
    });
    await deleteUserKeys(redis, uid);
    if (pair) {
      await redis.del(`loc:${pair.partnerId}`);
      await notify(pair.partnerId, 'pair_dissolved');
    }
    return { ok: true, purge_within_days: deps.config.accountPurgeDays };
  });
}
