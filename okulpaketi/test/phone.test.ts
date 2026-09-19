import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from '@/lib/phone';

describe('normalizePhone', () => {
  it('Türkiye yerel yazımlarını E.164 formatına çevirir', () => {
    const inputs = [
      '0532 123 45 67',
      '0532-123-45-67',
      '(0532) 123 45 67',
      '532 123 45 67',
      '+90 532 123 45 67',
      '00905321234567',
      '905321234567',
      '09005321234567'.replace('0900', '090'),
    ];
    for (const input of inputs) {
      const result = normalizePhone(input);
      expect(result.ok, `${input} çevrilemedi`).toBe(true);
      if (result.ok) expect(result.e164).toBe('905321234567');
    }
  });

  it('Excel sayısal hücresini kabul eder', () => {
    const result = normalizePhone(905321234567);
    expect(result).toEqual({ ok: true, e164: '905321234567' });
  });

  it('boş değeri reddeder', () => {
    expect(normalizePhone('')).toMatchObject({ ok: false });
    expect(normalizePhone(null)).toMatchObject({ ok: false });
    expect(normalizePhone(undefined)).toMatchObject({ ok: false });
  });

  it('sabit hat ve eksik haneli numaraları reddeder', () => {
    expect(normalizePhone('0212 123 45 67')).toMatchObject({ ok: false });
    expect(normalizePhone('0532 123 45')).toMatchObject({ ok: false });
    expect(normalizePhone('abc')).toMatchObject({ ok: false });
  });

  it('açıkça yazılmış yabancı numaraları kabul eder', () => {
    const result = normalizePhone('+49 151 23456789');
    expect(result).toEqual({ ok: true, e164: '4915123456789' });
  });

  it('gösterim biçimi üretir', () => {
    expect(formatPhone('905321234567')).toBe('+90 532 123 45 67');
  });
});
