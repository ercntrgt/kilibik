import { createHmac, randomInt } from 'node:crypto';

export interface OtpProvider {
  /** Kodu kullanıcıya iletir (SMS). */
  deliver(phone: string, code: string): Promise<void>;
}

export class LogOtpProvider implements OtpProvider {
  constructor(private log: (msg: string) => void = console.log) {}
  async deliver(phone: string, code: string) {
    this.log(`[otp] ${phone.slice(0, 4)}***: ${code}`);
  }
}

/** Test sağlayıcısı: kod her zaman 000000. Üretimde yasak (config kontrol eder). */
export class TestOtpProvider implements OtpProvider {
  static readonly CODE = '000000';
  async deliver() {}
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Telefon numarası veritabanına düz yazılmaz; HMAC özeti saklanır. */
export function hashPhone(secret: string, phone: string): string {
  return createHmac('sha256', secret).update(normalizePhone(phone)).digest('hex');
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!/^\+\d{8,15}$/.test(digits)) throw new Error('invalid_phone');
  return digits;
}

/** 18 yaş kontrolü. Doğum tarihi saklanmaz, yalnızca sonuç bayrağı. */
export function isAdult(birthDateIso: string, now = new Date(), minAge = 18): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateIso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const bd = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(bd.getTime()) || bd.getUTCMonth() !== mo - 1) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate()));
  return bd.getTime() <= cutoff.getTime();
}
