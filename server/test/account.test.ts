import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runRetention } from '../src/jobs/retention.js';
import { Device, pairedDevices, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

describe('account deletion + retention (Faz 4)', () => {
  it('deletes everything in-app: pair, requests, consents, sharing, keys, redis; then purges within 30 days', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.sendRequest('x');
    await b.sendRequest('y');
    await a.putLocation({ lat: 1, lng: 2, acc: null, at: 1 });
    await a.api('POST', '/nudge');

    const r = await a.api('DELETE', '/account');
    expect(r.status).toBe(200);
    expect(r.json.purge_within_days).toBe(30);
    expect((await a.api('GET', '/me')).status).toBe(401);

    const u = (await env.db.query('select * from users where id = $1', [a.userId])).rows[0];
    expect(u.deleted_at).toBeTruthy();
    expect(u.public_key).toBeNull();
    expect(u.push_token).toBeNull();
    expect(u.auth_provider_id).toMatch(/^deleted:/);
    expect((await env.db.query('select count(*)::int as n from requests')).rows[0].n).toBe(0);
    expect((await env.db.query('select count(*)::int as n from consents where user_id = $1', [a.userId])).rows[0].n).toBe(0);
    expect((await env.db.query('select count(*)::int as n from sharing_state where user_id = $1', [a.userId])).rows[0].n).toBe(0);
    expect((await env.db.query('select dissolved_at from pairs')).rows[0].dissolved_at).toBeTruthy();
    expect((await env.redis.keys('*')).filter((k) => k.includes(a.userId))).toEqual([]);
    expect((await b.api('GET', '/pair')).json).toBeNull();

    // Aynı numara yeniden kayıt olabilir: yeni, temiz kullanıcı
    const fresh = await new Device(env, a.phone).login('1990-01-01');
    expect(fresh.userId).not.toBe(a.userId);

    // 30 gün sonra fiziksel silme
    await env.db.query(`update users set deleted_at = now() - interval '31 days' where id = $1`, [a.userId]);
    const res = await runRetention(env.db, env.config);
    expect(res.users).toBe(1);
    expect((await env.db.query('select count(*)::int as n from users where id = $1', [a.userId])).rows[0].n).toBe(0);
  });

  it('requests older than 90 days are purged and hidden', async () => {
    const [a, b] = await pairedDevices(env);
    await a.sendRequest('old');
    await env.db.query(`update requests set created_at = now() - interval '91 days'`);
    expect((await b.api('GET', '/requests')).json.requests).toHaveLength(0);
    expect((await runRetention(env.db, env.config)).requests).toBe(1);
  });

  it('legal documents are reachable in-app without auth', async () => {
    const d = new Device(env);
    const idx = await d.api('GET', '/legal', undefined, false);
    expect(idx.json.documents.map((x: any) => x.slug)).toEqual(['privacy-notice', 'location-consent', 'privacy-policy', 'retention']);
    for (const slug of ['privacy-notice', 'location-consent', 'privacy-policy', 'retention']) {
      const doc = await d.api('GET', `/legal/${slug}`, undefined, false);
      expect(doc.status).toBe(200);
      expect(String(doc.json).length).toBeGreaterThan(200);
    }
  });
});
