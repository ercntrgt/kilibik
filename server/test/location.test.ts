import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Device, pairedDevices, setupEnv, sleep, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

const IST = { lat: 41.0082, lng: 28.9784, acc: 12, at: 1_700_000_000_000 };

describe('encrypted last-location (Faz 2)', () => {
  it('partner decrypts the location; server holds only an opaque blob with TTL', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    const put = await a.putLocation(IST);
    expect(put.status).toBe(200);
    expect(put.json.expires_in).toBe(300);

    const { view, plain } = await b.getPartnerLocation();
    expect(view.state).toBe('fresh');
    expect(plain).toEqual(IST);
    expect((view as any).expires_in).toBeLessThanOrEqual(300);

    const ttl = await env.redis.ttl(`loc:${a.userId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
    const raw = (await env.redis.get(`loc:${a.userId}`)) ?? '';
    expect(raw).not.toContain('41.0082');
    expect(raw).not.toContain('28.9784');
    expect(env.push.sent.at(-1)).toMatchObject({ kind: 'location', token: `tok-${b.userId}` });
  });

  it('overwrites the same key: never more than one record per user', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation(IST);
    await env.redis.del(`locrate:${a.userId}`);
    await a.putLocation({ ...IST, lat: 41.1 });
    expect(await env.redis.keys('loc:*')).toEqual([`loc:${a.userId}`]);
    expect((await b.getPartnerLocation()).plain?.lat).toBe(41.1);
  });

  it('reports "stale" after TTL expiry and nothing remains in Redis', async () => {
    const short = await setupEnv({ locationTtlSeconds: 1 });
    try {
      const [a, b] = await pairedDevices(short);
      await a.enableSharing();
      await b.enableSharing();
      await a.putLocation(IST);
      expect((await b.getPartnerLocation()).view.state).toBe('fresh');
      await sleep(1600);
      expect(await short.redis.exists(`loc:${a.userId}`)).toBe(0);
      expect((await b.getPartnerLocation()).view).toEqual({ state: 'stale' });
    } finally {
      await short.close();
    }
  });

  it('disabling sharing deletes the blob, shows neutral "off" and sends NO push', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.putLocation(IST);
    env.push.reset();

    const r = await a.enableSharing(false);
    expect(r.status).toBe(200);
    expect(env.push.sent).toEqual([]);
    expect(await env.redis.exists(`loc:${a.userId}`)).toBe(0);
    expect((await b.getPartnerLocation()).view).toEqual({ state: 'off' });
    expect((await b.api('GET', '/partner')).json).toEqual({ location_sharing_enabled: false });
    // Kapatan taraf, partner paylaşıyorsa onu görmeye devam eder (rızayı geri almanın cezası yok)
    await b.putLocation(IST);
    expect((await a.getPartnerLocation()).view.state).toBe('fresh');
    // Kapalıyken konum gönderilemez
    expect((await a.putLocation(IST)).json.error).toBe('sharing_disabled');
    expect(env.push.sent.map((p) => p.kind)).toEqual(['location']);
  });

  it('sharing_state keeps no history', async () => {
    const [a] = await pairedDevices(env);
    for (const on of [true, false, true, false]) await a.enableSharing(on);
    const { rows } = await env.db.query('select * from sharing_state where user_id = $1', [a.userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].location_sharing_enabled).toBe(false);
    const tables = await env.db.query(`select table_name from information_schema.tables where table_schema = 'public'`);
    const names = tables.rows.map((r) => r.table_name);
    expect(names.some((n: string) => /log|history|audit|location/i.test(n))).toBe(false);
  });

  it('requires separate explicit location consent before sharing can be enabled', async () => {
    const a = await new Device(env).login();
    await a.generateKeys();
    expect((await a.enableSharing(true)).json.error).toBe('location_consent_required');
    await a.consentAll();
    expect((await a.enableSharing(true)).status).toBe(200);
    // Rızayı geri alma: sessiz, paylaşım kapanır
    env.push.reset();
    await a.api('DELETE', '/me/consents/location');
    expect((await a.api('GET', '/me')).json.location_sharing_enabled).toBe(false);
    expect((await a.api('GET', '/me')).json.consents.location_consent_version).toBeNull();
    expect(env.push.sent).toEqual([]);
  });

  it('server caps upload frequency (no continuous stream)', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    expect((await a.putLocation(IST)).status).toBe(200);
    const r = await a.putLocation(IST);
    expect(r.status).toBe(429);
    expect(r.json.error).toBe('location_rate_limited');
  });

  it('rejects location when unpaired or blob malformed', async () => {
    const solo = await new Device(env).ready();
    await solo.enableSharing();
    expect((await solo.api('PUT', '/location', { blob: 'A'.repeat(80) })).json.error).toBe('not_paired');
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    expect((await a.api('PUT', '/location', { blob: 'A'.repeat(80) })).status).toBe(400);
  });
});
