import type { RedisClient } from './redis.js';

/**
 * Basit sabit pencereli sayaç. Dönüş: { allowed, remaining, retryAfter }.
 * Sayaçlar yalnızca kötüye kullanımı engellemek içindir; asla raporlanmaz.
 */
export async function hitCounter(
  redis: RedisClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSeconds);
  if (n > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, remaining: 0, retryAfter: Math.max(ttl, 1) };
  }
  return { allowed: true, remaining: limit - n, retryAfter: 0 };
}

/** Cooldown: NX ile yazılır. Var ise kalan süre döner. */
export async function acquireCooldown(
  redis: RedisClient,
  key: string,
  seconds: number,
): Promise<{ acquired: boolean; retryAfter: number }> {
  const ok = await redis.set(key, '1', 'EX', seconds, 'NX');
  if (ok === 'OK') return { acquired: true, retryAfter: 0 };
  const ttl = await redis.ttl(key);
  return { acquired: false, retryAfter: Math.max(ttl, 1) };
}
