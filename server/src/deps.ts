import type { OtpProvider } from './auth/otp.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Notifier } from './push/index.js';
import type { RedisClient } from './redis.js';

export interface AppDeps {
  config: Config;
  db: Db;
  redis: RedisClient;
  otp: OtpProvider;
  notify: Notifier;
  now?: () => Date;
}
