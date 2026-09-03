import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import {
  LOCATION_BLOB_MAX_BYTES,
  LOCATION_SERVER_MIN_INTERVAL_SECONDS,
  fromBase64,
  type PartnerLocationView,
  type PartnerView,
} from '../../../shared/src/index.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { getActivePair } from '../pairs.js';
import { hitCounter } from '../rate.js';
import { keys } from '../redis.js';

/**
 * KONUM — sunucu kördür.
 * - Blob opak: sunucu çözemez, çözmeye çalışmaz, loglamaz.
 * - Yalnızca Redis'te, TTL'li, aynı anahtarın üzerine yazılır. Kalıcı tablo YOK.
 * - Paylaşımı kapatmak partnere push GÖNDERMEZ.
 */
export async function locationRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis, notify, config } = deps;

  async function sharingEnabled(userId: string): Promise<boolean> {
    const { rows } = await db.query<{ location_sharing_enabled: boolean }>(
      'select location_sharing_enabled from sharing_state where user_id = $1',
      [userId],
    );
    return rows[0]?.location_sharing_enabled ?? false;
  }

  app.put(
    '/location',
    { preHandler: authenticate, schema: { body: Type.Object({ blob: Type.String({ minLength: 56, maxLength: 1024 }) }) } },
    async (req) => {
      const pair = await getActivePair(db, req.userId);
      if (!pair) throw err.conflict('not_paired');
      if (!(await sharingEnabled(req.userId))) throw err.conflict('sharing_disabled');
      const blob = fromBase64((req.body as { blob: string }).blob);
      if (blob.length > LOCATION_BLOB_MAX_BYTES || blob[0] !== 1) throw err.badRequest('invalid_blob');
      // Sürekli akışı engelleyen sunucu tarafı üst sınır (cihaz zaten 2 dk / 150 m ile kısıtlar).
      const rate = await hitCounter(redis, keys.locationRate(req.userId), 1, LOCATION_SERVER_MIN_INTERVAL_SECONDS);
      if (!rate.allowed) throw err.tooMany('location_rate_limited', rate.retryAfter);
      const now = (deps.now?.() ?? new Date()).toISOString();
      // Tek kayıt, üzerine yaz, TTL ile.
      await redis.set(keys.location(req.userId), JSON.stringify({ b: (req.body as { blob: string }).blob, at: now }), 'EX', config.locationTtlSeconds);
      await notify(pair.partnerId, 'location');
      return { ok: true, expires_in: config.locationTtlSeconds };
    },
  );

  /** Partnerin son konumu. Kapalıysa nötr "off"; TTL dolmuşsa "stale". */
  app.get('/location/partner', { preHandler: authenticate }, async (req): Promise<PartnerLocationView> => {
    const pair = await getActivePair(db, req.userId);
    if (!pair) throw err.conflict('not_paired');
    if (!(await sharingEnabled(pair.partnerId))) return { state: 'off' };
    const [raw, ttl] = await Promise.all([redis.get(keys.location(pair.partnerId)), redis.ttl(keys.location(pair.partnerId))]);
    if (!raw || ttl < 0) return { state: 'stale' };
    const { b, at } = JSON.parse(raw) as { b: string; at: string };
    return { state: 'fresh', blob: b, updated_at: at, expires_in: ttl };
  });

  /** Partner hakkında görülebilen durum. İki yönde de aynı şekil (simetri). */
  app.get('/partner', { preHandler: authenticate }, async (req): Promise<PartnerView> => {
    const pair = await getActivePair(db, req.userId);
    if (!pair) throw err.conflict('not_paired');
    return { location_sharing_enabled: await sharingEnabled(pair.partnerId) };
  });

  /**
   * Konum paylaşımını aç/kapat. Tek dokunuş, onay yok, gecikme yok.
   * Kapatınca blob silinir ve partnere HİÇBİR push gitmez (kırmızı çizgi).
   * Açmak için önce ayrı açık rıza verilmiş olmalı.
   */
  app.put(
    '/sharing',
    { preHandler: authenticate, schema: { body: Type.Object({ location_sharing_enabled: Type.Boolean() }) } },
    async (req) => {
      const enabled = (req.body as { location_sharing_enabled: boolean }).location_sharing_enabled;
      if (enabled) {
        const c = await db.query('select 1 from consents where user_id = $1 and kind = $2', [req.userId, 'location']);
        if (!c.rows.length) throw err.conflict('location_consent_required', 'Konum için açık rıza verilmemiş');
      }
      await db.query(
        `insert into sharing_state (user_id, location_sharing_enabled) values ($1, $2)
         on conflict (user_id) do update set location_sharing_enabled = excluded.location_sharing_enabled, updated_at = now()`,
        [req.userId, enabled],
      );
      if (!enabled) await redis.del(keys.location(req.userId));
      // Bilerek: notify() çağrısı yok.
      return { location_sharing_enabled: enabled };
    },
  );
}
