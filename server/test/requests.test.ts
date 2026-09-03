import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Device, pairedDevices, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

describe('encrypted request flow (Faz 1)', () => {
  it('sends an end-to-end encrypted request the partner can read but the server cannot', async () => {
    const [a, b] = await pairedDevices(env);
    const sent = await a.sendRequest('dönerken ekmek al');
    expect(sent.status).toBe(201);
    expect(sent.json.status).toBe('pending');

    const list = await b.api('GET', '/requests');
    expect(list.json.requests).toHaveLength(1);
    expect(await b.readRequest(list.json.requests[0])).toBe('dönerken ekmek al');

    const { rows } = await env.db.query('select body_encrypted from requests');
    expect(Buffer.from(rows[0].body_encrypted).toString('utf8')).not.toContain('ekmek');
    expect(env.push.sent.at(-1)).toMatchObject({ kind: 'request', token: `tok-${b.userId}` });
  });

  it('both directions appear in the same list, newest first', async () => {
    const [a, b] = await pairedDevices(env);
    await a.sendRequest('bir');
    await b.sendRequest('iki');
    const list = await a.api('GET', '/requests');
    expect(list.json.requests.map((r: any) => r.sender_id)).toEqual([b.userId, a.userId]);
    const listB = await b.api('GET', '/requests');
    expect(listB.json.requests.map((r: any) => r.id)).toEqual(list.json.requests.map((r: any) => r.id));
  });

  it('every request has three answers: accepted / declined / snoozed, and snoozed can be answered again', async () => {
    const [a, b] = await pairedDevices(env);
    const ids: string[] = [];
    for (const t of ['x', 'y', 'z']) ids.push((await a.sendRequest(t)).json.id);
    for (const [i, status] of ['accepted', 'declined', 'snoozed'].entries()) {
      const r = await b.api('POST', `/requests/${ids[i]}/respond`, { status });
      expect(r.status).toBe(200);
      expect(r.json.status).toBe(status);
      expect(r.json.responded_at).toBeTruthy();
    }
    expect(env.push.sent.filter((p) => p.kind === 'request_response')).toHaveLength(3);
    // Ertelenen sonra "olmaz" olabilir; kabul edilen kilitlenir
    expect((await b.api('POST', `/requests/${ids[2]}/respond`, { status: 'declined' })).status).toBe(200);
    expect((await b.api('POST', `/requests/${ids[0]}/respond`, { status: 'declined' })).status).toBe(404);
    // Geçersiz durum reddedilir
    expect((await b.api('POST', `/requests/${ids[1]}/respond`, { status: 'ignored' })).status).toBe(400);
  });

  it('sender cannot respond to their own request', async () => {
    const [a] = await pairedDevices(env);
    const id = (await a.sendRequest('x')).json.id;
    expect((await a.api('POST', `/requests/${id}/respond`, { status: 'accepted' })).status).toBe(404);
  });

  it('limits sending to 10 per hour', async () => {
    const [a] = await pairedDevices(env);
    for (let i = 0; i < 10; i++) expect((await a.sendRequest(`n${i}`)).status).toBe(201);
    const r = await a.sendRequest('n11');
    expect(r.status).toBe(429);
    expect(r.json.error).toBe('request_rate_limited');
    expect(r.json.retry_after).toBeGreaterThan(0);
  });

  it('rejects unpaired senders and malformed bodies', async () => {
    const solo = await new Device(env).ready();
    expect((await solo.api('POST', '/requests', { body_encrypted: 'A'.repeat(80) })).json.error).toBe('not_paired');
    const [a] = await pairedDevices(env);
    expect((await a.api('POST', '/requests', { body_encrypted: 'A'.repeat(80) })).status).toBe(400);
  });
});
