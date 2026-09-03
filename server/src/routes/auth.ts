import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { MIN_AGE_YEARS, OTP_TTL_SECONDS } from '../../../shared/src/index.js';
import { signAccessToken } from '../auth/jwt.js';
import { TestOtpProvider, generateOtp, hashPhone, isAdult, normalizePhone } from '../auth/otp.js';
import type { AppDeps } from '../deps.js';
import { err } from '../errors.js';
import { hitCounter } from '../rate.js';
import { keys } from '../redis.js';

export async function authRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, redis, config } = deps;

  app.post(
    '/auth/otp/request',
    { schema: { body: Type.Object({ phone: Type.String({ minLength: 8, maxLength: 20 }) }) } },
    async (req, reply) => {
      const { phone } = req.body as { phone: string };
      let normalized: string;
      try {
        normalized = normalizePhone(phone);
      } catch {
        throw err.badRequest('invalid_phone', 'Telefon numarası +90... biçiminde olmalı');
      }
      const ph = hashPhone(config.phoneHashSecret, normalized);
      const byPhone = await hitCounter(redis, keys.otpRate(ph), 3, 15 * 60);
      if (!byPhone.allowed) throw err.tooMany('otp_rate_limited', byPhone.retryAfter);
      const byIp = await hitCounter(redis, keys.otpIpRate(req.ip), 20, 60 * 60);
      if (!byIp.allowed) throw err.tooMany('otp_rate_limited', byIp.retryAfter);

      const code = config.otpProvider === 'test' ? TestOtpProvider.CODE : generateOtp();
      await redis.set(keys.otp(ph), code, 'EX', OTP_TTL_SECONDS);
      await deps.otp.deliver(normalized, code);
      return reply.send({ ok: true, expires_in: OTP_TTL_SECONDS });
    },
  );

  app.post(
    '/auth/otp/verify',
    {
      schema: {
        body: Type.Object({
          phone: Type.String({ minLength: 8, maxLength: 20 }),
          code: Type.String({ minLength: 6, maxLength: 6 }),
          // Yalnızca ilk kayıtta gerekir. Saklanmaz; yalnızca 18+ sonucu saklanır.
          birth_date: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
        }),
      },
    },
    async (req, reply) => {
      const { phone, code, birth_date } = req.body as { phone: string; code: string; birth_date?: string };
      let normalized: string;
      try {
        normalized = normalizePhone(phone);
      } catch {
        throw err.badRequest('invalid_phone');
      }
      const ph = hashPhone(config.phoneHashSecret, normalized);
      const expected = await redis.get(keys.otp(ph));
      if (!expected || expected !== code) throw err.unauthorized('invalid_code');

      const existing = await db.query<{ id: string; birth_date_verified: boolean }>(
        `select id, birth_date_verified from users where auth_provider = 'phone' and auth_provider_id = $1 and deleted_at is null`,
        [ph],
      );
      let userId: string;
      if (existing.rows[0]) {
        userId = existing.rows[0].id;
      } else {
        if (!birth_date) throw err.badRequest('birth_date_required', 'Kayıt için doğum tarihi gerekli');
        if (!isAdult(birth_date, deps.now?.() ?? new Date(), MIN_AGE_YEARS)) {
          throw err.forbidden('underage', `Bu uygulama ${MIN_AGE_YEARS} yaş ve üzeri içindir`);
        }
        const ins = await db.query<{ id: string }>(
          `insert into users (auth_provider, auth_provider_id, birth_date_verified) values ('phone', $1, true) returning id`,
          [ph],
        );
        userId = ins.rows[0].id;
        await db.query('insert into sharing_state (user_id, location_sharing_enabled) values ($1, false)', [userId]);
      }
      await redis.del(keys.otp(ph));
      const token = await signAccessToken(config.jwtSecret, userId);
      return reply.send({ token, user_id: userId });
    },
  );
}
