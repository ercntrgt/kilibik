import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestOtpProvider, isAdult } from '../src/auth/otp.js';
import { Device, setupEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => (env = await setupEnv()));
afterAll(() => env.close());
beforeEach(() => env.reset());

describe('auth: phone + OTP, 18+', () => {
  it('registers with birth date and stores only the verified flag, phone hashed', async () => {
    const d = await new Device(env, '+905551112233').login('1995-01-01');
    expect(d.token).toBeTruthy();
    const { rows } = await env.db.query('select auth_provider_id, birth_date_verified from users');
    expect(rows).toHaveLength(1);
    expect(rows[0].birth_date_verified).toBe(true);
    expect(rows[0].auth_provider_id).not.toContain('5551112233');
    const cols = await env.db.query(`select column_name from information_schema.columns where table_name = 'users'`);
    expect(cols.rows.map((r) => r.column_name)).not.toContain('birth_date');
  });

  it('rejects users under 18', async () => {
    const d = new Device(env);
    await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    const r = await d.api('POST', '/auth/otp/verify', { phone: d.phone, code: TestOtpProvider.CODE, birth_date: '2015-01-01' }, false);
    expect(r.status).toBe(403);
    expect(r.json.error).toBe('underage');
    expect((await env.db.query('select count(*)::int as n from users')).rows[0].n).toBe(0);
  });

  it('requires birth date on first registration, not on later logins', async () => {
    const d = new Device(env);
    await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    const r = await d.api('POST', '/auth/otp/verify', { phone: d.phone, code: TestOtpProvider.CODE }, false);
    expect(r.json.error).toBe('birth_date_required');
    await d.login('1990-01-01');
    const again = new Device(env, d.phone);
    await again.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    const r2 = await again.api('POST', '/auth/otp/verify', { phone: d.phone, code: TestOtpProvider.CODE }, false);
    expect(r2.status).toBe(200);
    expect(r2.json.user_id).toBe(d.userId);
  });

  it('rejects wrong code and rate limits OTP requests', async () => {
    const d = new Device(env);
    await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    const bad = await d.api('POST', '/auth/otp/verify', { phone: d.phone, code: '123456', birth_date: '1990-01-01' }, false);
    expect(bad.status).toBe(401);
    await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    const limited = await d.api('POST', '/auth/otp/request', { phone: d.phone }, false);
    expect(limited.status).toBe(429);
    expect(limited.json.retry_after).toBeGreaterThan(0);
  });

  it('protects authenticated routes', async () => {
    const d = new Device(env);
    expect((await d.api('GET', '/me')).status).toBe(401);
  });

  it('isAdult edge cases', () => {
    const now = new Date('2026-09-03T00:00:00Z');
    expect(isAdult('2008-09-03', now)).toBe(true);
    expect(isAdult('2008-09-04', now)).toBe(false);
    expect(isAdult('2008-13-01', now)).toBe(false);
    expect(isAdult('nope', now)).toBe(false);
  });
});
