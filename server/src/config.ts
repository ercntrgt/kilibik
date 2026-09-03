import {
  ACCOUNT_PURGE_DAYS_DEFAULT,
  LOCATION_TTL_SECONDS_DEFAULT,
  REQUEST_RETENTION_DAYS_DEFAULT,
} from '../../shared/src/index.js';

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  phoneHashSecret: string;
  otpProvider: 'log' | 'test';
  pushProvider: 'log' | 'apns' | 'fcm' | 'both';
  apns: { keyId: string; teamId: string; bundleId: string; privateKeyP8: string; production: boolean };
  fcm: { projectId: string; clientEmail: string; privateKey: string };
  locationTtlSeconds: number;
  requestRetentionDays: number;
  accountPurgeDays: number;
}

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const env = (process.env.NODE_ENV as Config['env']) || 'development';
  const isProd = env === 'production';
  const cfg: Config = {
    env,
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: req('DATABASE_URL', isProd ? undefined : 'postgres://postgres:postgres@127.0.0.1:5432/kilibik'),
    redisUrl: req('REDIS_URL', isProd ? undefined : 'redis://127.0.0.1:6379'),
    jwtSecret: req('JWT_SECRET', isProd ? undefined : 'dev-secret-dev-secret-dev-secret-dev-secret'),
    phoneHashSecret: req('PHONE_HASH_SECRET', isProd ? undefined : 'dev-phone-secret-dev-phone-secret-dev'),
    otpProvider: (process.env.OTP_PROVIDER as Config['otpProvider']) ?? (env === 'test' ? 'test' : 'log'),
    pushProvider: (process.env.PUSH_PROVIDER as Config['pushProvider']) ?? 'log',
    apns: {
      keyId: process.env.APNS_KEY_ID ?? '',
      teamId: process.env.APNS_TEAM_ID ?? '',
      bundleId: process.env.APNS_BUNDLE_ID ?? '',
      privateKeyP8: (process.env.APNS_PRIVATE_KEY_P8 ?? '').replace(/\\n/g, '\n'),
      production: process.env.APNS_PRODUCTION === 'true',
    },
    fcm: {
      projectId: process.env.FCM_PROJECT_ID ?? '',
      clientEmail: process.env.FCM_CLIENT_EMAIL ?? '',
      privateKey: (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    locationTtlSeconds: Number(process.env.LOCATION_TTL_SECONDS ?? LOCATION_TTL_SECONDS_DEFAULT),
    requestRetentionDays: Number(process.env.REQUEST_RETENTION_DAYS ?? REQUEST_RETENTION_DAYS_DEFAULT),
    accountPurgeDays: Number(process.env.ACCOUNT_PURGE_DAYS ?? ACCOUNT_PURGE_DAYS_DEFAULT),
    ...overrides,
  };
  if (cfg.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  if (cfg.phoneHashSecret.length < 32) throw new Error('PHONE_HASH_SECRET must be at least 32 chars');
  if (isProd && cfg.otpProvider === 'test') throw new Error('OTP_PROVIDER=test is not allowed in production');
  // Kırmızı çizgi: konum TTL'si kısa kalmalı. 10 dakikanın üstü kabul edilmez.
  if (cfg.locationTtlSeconds < 1 || cfg.locationTtlSeconds > 600) throw new Error('LOCATION_TTL_SECONDS must be 1..600');
  return cfg;
}
