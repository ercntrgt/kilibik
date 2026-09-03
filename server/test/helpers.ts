import type { FastifyInstance } from 'fastify';
import _sodium from 'libsodium-wrappers';
import {
  AAD_LOCATION,
  AAD_REQUEST,
  LOCATION_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  deriveSharedKey,
  fromBase64,
  generateKeyPair,
  openJson,
  openText,
  sealJson,
  sealText,
  toBase64,
  type KeyPair,
  type LocationPlain,
  type PartnerLocationView,
  type RequestView,
} from '../../shared/src/index.js';
import { buildApp } from '../src/app.js';
import { TestOtpProvider } from '../src/auth/otp.js';
import { loadConfig, type Config } from '../src/config.js';
import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { createNotifier } from '../src/push/index.js';
import { RecordingPushProvider } from '../src/push/log.js';
import { createRedis } from '../src/redis.js';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/kilibik_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/9';

export interface TestEnv {
  app: FastifyInstance;
  db: ReturnType<typeof createPool>;
  redis: ReturnType<typeof createRedis>;
  push: RecordingPushProvider;
  config: Config;
  /** Tüm JSON yanıtlarında görülen anahtar adları (türetilmiş metrik denetimi için). */
  seenKeys: Set<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function setupEnv(overrides: Partial<Config> = {}): Promise<TestEnv> {
  process.env.NODE_ENV = 'test';
  const config = loadConfig({ env: 'test', databaseUrl: TEST_DB_URL, redisUrl: TEST_REDIS_URL, otpProvider: 'test', ...overrides });
  const db = createPool(config.databaseUrl);
  const redis = createRedis(config.redisUrl);
  await migrate(db);
  const push = new RecordingPushProvider();
  const app = await buildApp({ config, db, redis, otp: new TestOtpProvider(), notify: createNotifier(db, push, () => {}) }, { logger: false });
  const seenKeys = new Set<string>();
  const env: TestEnv = {
    app,
    db,
    redis,
    push,
    config,
    seenKeys,
    async reset() {
      await db.query('truncate users cascade');
      await redis.flushdb();
      push.reset();
    },
    async close() {
      await app.close();
      await db.end();
      redis.disconnect();
    },
  };
  await env.reset();
  return env;
}

export async function sodium() {
  await _sodium.ready;
  return _sodium;
}

export interface ApiResult<T = any> {
  status: number;
  json: T;
}

function collectKeys(v: unknown, into: Set<string>) {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, into));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      into.add(k);
      collectKeys(x, into);
    }
  }
}

let phoneSeq = 1000;

/** Sanal cihaz: gerçek libsodium ile anahtar üretir, şifreler, çözer. Özel anahtar buradan çıkmaz. */
export class Device {
  token = '';
  userId = '';
  phone: string;
  keys!: KeyPair;
  sharedKey: Uint8Array | null = null;
  partnerPublicKey: Uint8Array | null = null;

  constructor(
    private env: TestEnv,
    phone?: string,
  ) {
    this.phone = phone ?? `+9055500${String(phoneSeq++).padStart(5, '0')}`;
  }

  async api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, auth = true): Promise<ApiResult<T>> {
    const res = await this.env.app.inject({
      method,
      url,
      payload: body === undefined ? undefined : (body as Record<string, unknown>),
      headers: auth && this.token ? { authorization: `Bearer ${this.token}` } : {},
    });
    let json: any = null;
    const ct = res.headers['content-type'] ?? '';
    if (typeof ct === 'string' && ct.includes('application/json')) {
      json = res.json();
      collectKeys(json, this.env.seenKeys);
    } else json = res.body;
    return { status: res.statusCode, json };
  }

  /** Telefon + OTP ile kayıt / giriş. Doğum tarihi yalnızca ilk kayıtta. */
  async login(birthDate = '1990-05-15'): Promise<this> {
    const r1 = await this.api('POST', '/auth/otp/request', { phone: this.phone }, false);
    if (r1.status !== 200) throw new Error(`otp request failed ${r1.status} ${JSON.stringify(r1.json)}`);
    const r2 = await this.api('POST', '/auth/otp/verify', { phone: this.phone, code: TestOtpProvider.CODE, birth_date: birthDate }, false);
    if (r2.status !== 200) throw new Error(`otp verify failed ${r2.status} ${JSON.stringify(r2.json)}`);
    this.token = r2.json.token;
    this.userId = r2.json.user_id;
    return this;
  }

  async generateKeys(): Promise<this> {
    this.keys = generateKeyPair(await sodium());
    const r = await this.api('PUT', '/me/public-key', { public_key: toBase64(this.keys.publicKey) });
    if (r.status !== 200) throw new Error(`public key upload failed ${r.status}`);
    return this;
  }

  async consentAll(): Promise<this> {
    await this.api('POST', '/me/consents', { kind: 'privacy_notice', version: PRIVACY_NOTICE_VERSION });
    await this.api('POST', '/me/consents', { kind: 'location', version: LOCATION_CONSENT_VERSION });
    return this;
  }

  async setPushToken(platform: 'ios' | 'android' = 'ios'): Promise<this> {
    await this.api('PUT', '/me/push-token', { token: `tok-${this.userId}`, platform });
    return this;
  }

  /** Bootstrapped device: logged in, keys uploaded, consents given, push token set. */
  async ready(birthDate?: string): Promise<this> {
    await this.login(birthDate);
    await this.generateKeys();
    await this.consentAll();
    await this.setPushToken();
    return this;
  }

  async invite(): Promise<string> {
    const r = await this.api('POST', '/pair/invite');
    if (r.status !== 200) throw new Error(`invite failed ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.code;
  }

  async accept(code: string): Promise<void> {
    const r = await this.api('POST', '/pair/accept', { code });
    if (r.status !== 200) throw new Error(`accept failed ${r.status} ${JSON.stringify(r.json)}`);
    await this.adoptPartnerKey(r.json.partner_public_key);
  }

  async syncPair(): Promise<void> {
    const r = await this.api('GET', '/pair');
    if (r.status !== 200 || !r.json) throw new Error('not paired');
    await this.adoptPartnerKey(r.json.partner_public_key);
  }

  private async adoptPartnerKey(b64: string) {
    this.partnerPublicKey = fromBase64(b64);
    this.sharedKey = deriveSharedKey(await sodium(), this.keys.privateKey, this.keys.publicKey, this.partnerPublicKey);
  }

  async enableSharing(enabled = true) {
    return this.api('PUT', '/sharing', { location_sharing_enabled: enabled });
  }

  async sendRequest(text: string) {
    const body = sealText(await sodium(), this.sharedKey!, text, AAD_REQUEST);
    return this.api<RequestView>('POST', '/requests', { body_encrypted: toBase64(body) });
  }

  async readRequest(view: RequestView): Promise<string> {
    return openText(await sodium(), this.sharedKey!, fromBase64(view.body_encrypted), AAD_REQUEST);
  }

  async putLocation(loc: LocationPlain) {
    const blob = sealJson(await sodium(), this.sharedKey!, loc, AAD_LOCATION);
    return this.api('PUT', '/location', { blob: toBase64(blob) });
  }

  async getPartnerLocation(): Promise<{ view: PartnerLocationView; plain: LocationPlain | null }> {
    const r = await this.api<PartnerLocationView>('GET', '/location/partner');
    if (r.status !== 200) throw new Error(`partner location ${r.status} ${JSON.stringify(r.json)}`);
    const view = r.json;
    const plain = view.state === 'fresh' ? openJson<LocationPlain>(await sodium(), this.sharedKey!, fromBase64(view.blob), AAD_LOCATION) : null;
    return { view, plain };
  }
}

/** İki cihazı eşleştirir ve her ikisinde de ortak sırrı türetir. */
export async function pairedDevices(env: TestEnv): Promise<[Device, Device]> {
  const a = await new Device(env).ready();
  const b = await new Device(env).ready();
  const code = await a.invite();
  await b.accept(code);
  await a.syncPair();
  return [a, b];
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
