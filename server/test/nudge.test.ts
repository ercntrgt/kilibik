import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApnsPushProvider } from '../src/push/apns.js';
import { FcmPushProvider } from '../src/push/fcm.js';
import { Device, pairedDevices, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

describe('nudge + push (Faz 3)', () => {
  it('nudges the partner once, then enforces a 15 minute cooldown', async () => {
    const [a, b] = await pairedDevices(env);
    const r = await a.api('POST', '/nudge');
    expect(r.status).toBe(200);
    expect(r.json.cooldown).toBe(900);
    expect(env.push.sent.at(-1)).toMatchObject({ kind: 'nudge', token: `tok-${b.userId}` });
    const again = await a.api('POST', '/nudge');
    expect(again.status).toBe(429);
    expect(again.json.error).toBe('nudge_cooldown');
    expect(again.json.retry_after).toBeGreaterThan(800);
    // Cooldown kişiye özel: partner hâlâ dürtebilir
    expect((await b.api('POST', '/nudge')).status).toBe(200);
    const st = await b.api('GET', '/nudge/status');
    expect(st.json.pending_at).toBeTruthy();
    expect(st.json.cooldown_remaining).toBeGreaterThan(0);
    await b.api('DELETE', '/nudge/pending');
    expect((await b.api('GET', '/nudge/status')).json.pending_at).toBeNull();
  });

  it('requires a pair', async () => {
    const solo = await new Device(env).ready();
    expect((await solo.api('POST', '/nudge')).json.error).toBe('not_paired');
  });

  it('push payloads carry only a kind — no content, no critical/full-screen flags', () => {
    for (const kind of ['nudge', 'request', 'request_response', 'pair', 'location', 'pair_dissolved'] as const) {
      const apns = ApnsPushProvider.payloadFor(kind);
      const s = JSON.stringify(apns.body);
      expect(Object.keys(apns.body).sort()).toEqual(['aps', 'kind']);
      expect(s).not.toMatch(/critical|interruption-level|lat|lng|body"/);
      const fcm = FcmPushProvider.messageFor('t', kind);
      expect(fcm.message.data).toEqual({ kind });
      expect(fcm.message).not.toHaveProperty('notification');
      const fs = JSON.stringify(fcm.message);
      expect(fs).not.toMatch(/critical|interruption-level|lat|lng|body"/);
      expect(fcm.message.apns.headers['apns-push-type']).toBe(apns.pushType);
    }
    expect(ApnsPushProvider.payloadFor('location').pushType).toBe('background');
    expect(ApnsPushProvider.payloadFor('nudge').pushType).toBe('alert');
  });

  it('users without a push token simply receive nothing (no error)', async () => {
    const [a, b] = await pairedDevices(env);
    await b.api('DELETE', '/me/push-token');
    env.push.reset();
    expect((await a.api('POST', '/nudge')).status).toBe(200);
    expect(env.push.sent).toEqual([]);
  });
});
