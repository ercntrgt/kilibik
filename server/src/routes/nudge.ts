import type { FastifyInstance } from 'fastify';
import { NUDGE_COOLDOWN_SECONDS } from '../../../shared/src/index.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { getActivePair } from '../pairs.js';
import { acquireCooldown } from '../rate.js';
import { keys } from '../redis.js';

/** Dürtme: "Beni ara". Tek dokunuş, 15 dk cooldown. Payload içerik taşımaz. */
export async function nudgeRoutes(app: FastifyInstance, deps: AppDeps, authenticate: any) {
  const { db, redis, notify } = deps;

  app.post('/nudge', { preHandler: authenticate }, async (req) => {
    const pair = await getActivePair(db, req.userId);
    if (!pair) throw err.conflict('not_paired');
    const cd = await acquireCooldown(redis, keys.nudgeCooldown(req.userId), NUDGE_COOLDOWN_SECONDS);
    if (!cd.acquired) throw err.tooMany('nudge_cooldown', cd.retryAfter);
    // Push kaçarsa cihaz açılınca görebilsin diye kısa ömürlü bayrak (içerik yok, sadece "var").
    await redis.set(keys.nudgePending(pair.partnerId), (deps.now?.() ?? new Date()).toISOString(), 'EX', NUDGE_COOLDOWN_SECONDS);
    await notify(pair.partnerId, 'nudge');
    return { ok: true, cooldown: NUDGE_COOLDOWN_SECONDS };
  });

  app.get('/nudge/status', { preHandler: authenticate }, async (req) => {
    const [ttl, pending] = await Promise.all([redis.ttl(keys.nudgeCooldown(req.userId)), redis.get(keys.nudgePending(req.userId))]);
    return { cooldown_remaining: Math.max(ttl, 0), pending_at: pending };
  });

  /** Dürtmeyi görüldü olarak işaretle. */
  app.delete('/nudge/pending', { preHandler: authenticate }, async (req) => {
    await redis.del(keys.nudgePending(req.userId));
    return { ok: true };
  });
}
