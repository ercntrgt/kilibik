import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toBase64 } from '../../shared/src/index.js';
import { Device, pairedDevices, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

describe('pairing + key exchange', () => {
  it('pairs via one-time invite code and exchanges public keys through the server', async () => {
    const [a, b] = await pairedDevices(env);
    expect(toBase64(a.partnerPublicKey!)).toBe(toBase64(b.keys.publicKey));
    expect(toBase64(b.partnerPublicKey!)).toBe(toBase64(a.keys.publicKey));
    expect(toBase64(a.sharedKey!)).toBe(toBase64(b.sharedKey!));
    // Sunucu yalnızca açık anahtarları bilir
    const { rows } = await env.db.query('select public_key from users order by created_at');
    expect(rows.map((r) => toBase64(new Uint8Array(r.public_key)))).toEqual([toBase64(a.keys.publicKey), toBase64(b.keys.publicKey)]);
    expect(env.push.sent.map((p) => p.kind)).toContain('pair');
  });

  it('invite code is single-use and requires a public key', async () => {
    const a = await new Device(env).ready();
    const b = await new Device(env).ready();
    const c = await new Device(env).ready();
    const code = await a.invite();
    await b.accept(code);
    const r = await c.api('POST', '/pair/accept', { code });
    expect(r.status).toBe(404);
    const noKey = await new Device(env).login();
    expect((await noKey.api('POST', '/pair/invite')).json.error).toBe('public_key_required');
  });

  it('a user can only be in one active pair; cannot pair with self', async () => {
    const [a] = await pairedDevices(env);
    const c = await new Device(env).ready();
    expect((await a.api('POST', '/pair/invite')).json.error).toBe('already_paired');
    const code = await c.invite();
    expect((await a.api('POST', '/pair/accept', { code })).json.error).toBe('already_paired');
    expect((await c.api('POST', '/pair/accept', { code })).json.error).toBe('cannot_pair_with_self');
  });

  it('dissolving the pair removes requests and location blobs for both', async () => {
    const [a, b] = await pairedDevices(env);
    await a.enableSharing();
    await b.enableSharing();
    await a.sendRequest('ekmek al');
    await a.putLocation({ lat: 41, lng: 29, acc: 5, at: Date.now() });
    await b.putLocation({ lat: 41.1, lng: 29.1, acc: 5, at: Date.now() });
    expect((await b.api('DELETE', '/pair')).status).toBe(200);
    expect((await a.api('GET', '/pair')).json).toBeNull();
    expect((await env.db.query('select count(*)::int as n from requests')).rows[0].n).toBe(0);
    expect(await env.redis.keys('loc:*')).toEqual([]);
    expect(env.push.sent.at(-1)).toMatchObject({ kind: 'pair_dissolved', token: `tok-${a.userId}` });
    // Ayrıldıktan sonra tekrar eşleşebilirler
    const code = await a.invite();
    await b.accept(code);
  });

  it('public key cannot be swapped while paired', async () => {
    const [a] = await pairedDevices(env);
    const r = await a.api('PUT', '/me/public-key', { public_key: toBase64(new Uint8Array(32).fill(7)) });
    expect(r.json.error).toBe('key_locked_by_pair');
  });
});
