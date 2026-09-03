/**
 * KABUL KRİTERLERİ — spesifikasyon §7. Bu dosya kırmızı çizgileri kanıtlar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REQUEST_RESPONSES } from '../../shared/src/index.js';
import { pairedDevices, setupEnv, type TestEnv } from './helpers.js';

const ROOT = path.resolve(__dirname, '..', '..');
let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (['node_modules', 'dist', 'build', 'Pods', '.git'].includes(f)) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const LAT = 41.0082;
const LNG = 28.9784;
const SECRET_TEXT = 'dönerken ekmek al lütfen';
const PHONE_A = '+905551234567';

async function fullDump(): Promise<string> {
  // 1) SQL: her tablonun her satırı
  const tables = await env.db.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public'`);
  let dump = '';
  for (const { table_name } of tables.rows) {
    const { rows } = await env.db.query(`select * from ${table_name}`);
    for (const r of rows) {
      for (const v of Object.values(r as Record<string, unknown>)) {
        dump += Buffer.isBuffer(v) ? v.toString('latin1') + v.toString('hex') + v.toString('base64') : String(v);
        dump += '\n';
      }
    }
  }
  // 2) pg_dump varsa gerçek döküm
  for (const bin of ['/usr/lib/postgresql/16/bin/pg_dump', 'pg_dump']) {
    try {
      dump += execFileSync(bin, ['--dbname', env.config.databaseUrl, '--data-only', '--inserts'], { encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'] });
      break;
    } catch {
      /* yok */
    }
  }
  // 3) Redis: tüm anahtar + değerler
  for (const k of await env.redis.keys('*')) {
    dump += k + '\n' + String(await env.redis.get(k)) + '\n';
  }
  return dump;
}

describe('§7 kabul kriterleri', () => {
  it('1. tam veritabanı dökümünde hiçbir okunabilir koordinat, istek metni veya telefon yok', async () => {
    const [a, b] = await pairedDevices(env);
    a.phone = PHONE_A; // helper zaten farklı numara kullandı; dump kontrolü için gerçek kaydı da test edelim
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation({ lat: LAT, lng: LNG, acc: 8, at: Date.now() });
    await b.putLocation({ lat: LAT + 0.01, lng: LNG + 0.01, acc: 8, at: Date.now() });
    await a.sendRequest(SECRET_TEXT);
    const { plain } = await b.getPartnerLocation();
    expect(plain?.lat).toBe(LAT);

    const dump = await fullDump();
    expect(dump.length).toBeGreaterThan(100);
    for (const needle of ['41.0082', '28.9784', '41.008', '28.978', '"lat"', '"lng"', 'lat:', 'ekmek', 'dönerken', 'lütfen']) {
      expect(dump, `dump contains ${needle}`).not.toContain(needle);
    }
    for (const d of [a, b]) expect(dump).not.toContain(d.phone.replace('+', ''));
    // Konum yalnızca Redis'te, TTL'li
    const keys = await env.redis.keys('loc:*');
    expect(keys.sort()).toEqual([`loc:${a.userId}`, `loc:${b.userId}`].sort());
    for (const k of keys) expect(await env.redis.ttl(k)).toBeGreaterThan(0);
  });

  it('2. Redis TTL dolunca konum kaydı yok (LOCATION_TTL_SECONDS ≤ 300; şema sabit 300)', async () => {
    expect(env.config.locationTtlSeconds).toBe(300);
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation({ lat: 1, lng: 1, acc: null, at: 1 });
    expect(await env.redis.ttl(`loc:${a.userId}`)).toBeLessThanOrEqual(300);
    await env.redis.pexpire(`loc:${a.userId}`, 50);
    await new Promise((r) => setTimeout(r, 120));
    expect(await env.redis.exists(`loc:${a.userId}`)).toBe(0);
    expect((await b.getPartnerLocation()).view).toEqual({ state: 'stale' });
  });

  it('3. konum paylaşımı kapatılınca partnere hiçbir push gitmiyor', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation({ lat: 1, lng: 1, acc: null, at: 1 });
    env.push.reset();
    await a.enableSharing(false);
    await a.api('DELETE', '/me/consents/location');
    expect(env.push.sent).toEqual([]);
    expect((await b.api('GET', '/partner')).json).toEqual({ location_sharing_enabled: false });
  });

  it('4. A’nın B hakkında görebildiği veri kümesi B’nin A hakkında görebildiğiyle birebir aynı', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation({ lat: 1, lng: 1, acc: null, at: 1 });
    await b.putLocation({ lat: 2, lng: 2, acc: null, at: 2 });
    await a.sendRequest('a→b');
    await b.sendRequest('b→a');
    await a.api('POST', '/nudge');
    await b.api('POST', '/nudge');

    const shape = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(shape);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort().map(([k, x]) => [k, shape(x)]));
      return typeof v;
    };
    const about = async (viewer: typeof a) => ({
      partner: shape((await viewer.api('GET', '/partner')).json),
      location: shape((await viewer.api('GET', '/location/partner')).json),
      pair: shape((await viewer.api('GET', '/pair')).json),
      requests: shape((await viewer.api('GET', '/requests')).json),
      nudge: shape((await viewer.api('GET', '/nudge/status')).json),
      me: shape((await viewer.api('GET', '/me')).json),
    });
    expect(await about(a)).toEqual(await about(b));
    // Görülebilen alanlar kapalı bir liste: partner hakkında yalnızca bunlar
    expect(Object.keys((await a.api('GET', '/partner')).json)).toEqual(['location_sharing_enabled']);
    expect(Object.keys((await a.api('GET', '/location/partner')).json).sort()).toEqual(['blob', 'expires_in', 'state', 'updated_at']);
  });

  it('5. hiçbir endpoint yanıt süresi ortalaması, uyum skoru veya türetilmiş metrik dönmüyor', async () => {
    // Çalışma zamanı: tüm test akışlarında görülen JSON anahtarları
    const [a, b] = await pairedDevices(env);
    await a.sendRequest('x');
    const id = (await b.api('GET', '/requests')).json.requests[0].id;
    await b.api('POST', `/requests/${id}/respond`, { status: 'accepted' });
    await a.api('GET', '/requests');
    await a.api('GET', '/me');
    await a.api('GET', '/nudge/status');
    const forbidden = /avg|average|mean|median|score|percent|ratio|response_time|latency|missed|streak|stats|metric|count$|total|karne|puan/i;
    for (const k of env.seenKeys) expect(k, `response key "${k}" looks like a derived metric`).not.toMatch(forbidden);
    // Statik: sunucu kaynağında toplulaştırma yok
    const src = walk(path.join(ROOT, 'server', 'src')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(src).not.toMatch(/\b(avg|percentile|stddev)\s*\(/i);
    expect(src).not.toMatch(/responded_at\s*-\s*created_at|created_at\s*-\s*responded_at|extract\s*\(\s*epoch/i);
  });

  it('6. sessiz mod: critical alert / full-screen intent yok, standart bildirim', () => {
    const mobileFiles = walk(path.join(ROOT, 'mobile')).filter((f) => /\.(ts|tsx|json|xml|plist|entitlements|gradle|java|kt|m|mm|swift)$/.test(f));
    expect(mobileFiles.length).toBeGreaterThan(0);
    const mobileSrc = mobileFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(mobileSrc).not.toMatch(/USE_FULL_SCREEN_INTENT|fullScreenIntent|fullScreenAction/);
    expect(mobileSrc).not.toMatch(/critical-alerts|criticalAlert|interruptionLevel:\s*['"]critical|IMPORTANCE_MAX|AndroidImportance\.MAX/);
    const serverSrc = walk(path.join(ROOT, 'server', 'src')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(serverSrc).not.toMatch(/interruption-level|critical-alerts|['"]critical['"]/i);
  });

  it('7. her isteğin en az üç yanıtı var; tek yönlü/gizli mod, geofence, konum tablosu yok', async () => {
    expect([...REQUEST_RESPONSES]).toEqual(['accepted', 'declined', 'snoozed']);
    const src = walk(path.join(ROOT, 'server', 'src')).concat(walk(path.join(ROOT, 'mobile', 'src'))).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(src).not.toMatch(/ghost|invisible|stealth|gizli_mod|geofence|red_zone|redzone/i);
    const tables = await env.db.query(`select table_name from information_schema.tables where table_schema = 'public'`);
    expect(tables.rows.map((r) => r.table_name).sort()).toEqual(['consents', 'pairs', 'requests', 'schema_migrations', 'sharing_state', 'users']);
  });

  it('8. üçüncü taraf izleyici / reklam / analytics SDK yok; store metni nötr', () => {
    const pkgs = [path.join(ROOT, 'server', 'package.json'), path.join(ROOT, 'mobile', 'package.json')]
      .filter(existsSync)
      .map((f) => JSON.parse(readFileSync(f, 'utf8')))
      .flatMap((p) => Object.keys({ ...p.dependencies, ...p.devDependencies }));
    expect(pkgs.filter((d) => /analytics|admob|adjust|appsflyer|amplitude|mixpanel|segment|sentry|crashlytics|facebook|branch\.io/i.test(d))).toEqual([]);
    const store = readFileSync(path.join(ROOT, 'docs', 'compliance', 'store-aciklamasi.md'), 'utf8');
    const body = store.split('<!-- METİN BAŞI -->')[1] ?? store;
    expect(body).not.toMatch(/\btakip|\bizle|kontrol et|yakala|\btrack|\bmonitor|\bspy/i);
  });
});
