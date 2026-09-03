import Redis from 'ioredis';

export type RedisClient = Redis;

export function createRedis(url: string): Redis {
  return new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
}

/** Redis anahtar adları tek yerde; konum anahtarı her zaman TTL ile yazılır. */
export const keys = {
  location: (userId: string) => `loc:${userId}`,
  locationRate: (userId: string) => `locrate:${userId}`,
  otp: (phoneHash: string) => `otp:${phoneHash}`,
  otpRate: (phoneHash: string) => `otprate:${phoneHash}`,
  otpIpRate: (ip: string) => `otpip:${ip}`,
  invite: (code: string) => `invite:${code}`,
  inviteByUser: (userId: string) => `inviteby:${userId}`,
  requestRate: (userId: string) => `reqrate:${userId}`,
  nudgeCooldown: (userId: string) => `nudge:${userId}`,
  nudgePending: (userId: string) => `nudgein:${userId}`,
};

export async function deleteUserKeys(redis: Redis, userId: string): Promise<void> {
  await redis.del(
    keys.location(userId),
    keys.locationRate(userId),
    keys.inviteByUser(userId),
    keys.requestRate(userId),
    keys.nudgeCooldown(userId),
    keys.nudgePending(userId),
  );
}
