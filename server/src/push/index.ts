import type { PushKind } from '../../../shared/src/index.js';
import type { Config } from '../config.js';
import type { Db } from '../db.js';
import { ApnsPushProvider } from './apns.js';
import { FcmPushProvider } from './fcm.js';
import { LogPushProvider } from './log.js';
import type { PushProvider, PushTarget } from './types.js';

export type { PushProvider, PushTarget } from './types.js';

class MultiProvider implements PushProvider {
  constructor(private providers: PushProvider[]) {}
  async send(target: PushTarget, kind: PushKind) {
    await Promise.all(this.providers.map((p) => p.send(target, kind)));
  }
}

export function createPushProvider(cfg: Config, log: (m: string) => void = console.log): PushProvider {
  switch (cfg.pushProvider) {
    case 'apns':
      return new ApnsPushProvider(cfg.apns);
    case 'fcm':
      return new FcmPushProvider(cfg.fcm);
    case 'both':
      return new MultiProvider([new ApnsPushProvider(cfg.apns), new FcmPushProvider(cfg.fcm)]);
    default:
      return new LogPushProvider(log);
  }
}

/**
 * Kullanıcıya push gönderir. Hata fırlatmaz (push, iş mantığını asla bloke etmez).
 * DİKKAT: Konum paylaşımının kapatılması bu fonksiyonu ÇAĞIRMAZ — kırmızı çizgi.
 */
export function createNotifier(db: Db, provider: PushProvider, log: (m: string) => void = console.error) {
  return async function notify(userId: string, kind: PushKind): Promise<void> {
    try {
      const { rows } = await db.query<{ push_token: string | null; push_platform: 'ios' | 'android' | null }>(
        'select push_token, push_platform from users where id = $1 and deleted_at is null',
        [userId],
      );
      const u = rows[0];
      if (!u?.push_token || !u.push_platform) return;
      await provider.send({ token: u.push_token, platform: u.push_platform }, kind);
    } catch (e) {
      log(`[push] failed: ${(e as Error).message}`);
    }
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
