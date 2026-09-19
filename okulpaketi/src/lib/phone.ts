/**
 * Telefon numarasi normalizasyonu.
 * Hedef bicim: E.164 (basinda + olmadan, Meta Cloud API'nin bekledigi sekilde) -> 905321234567
 */

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

/** Excel sayisal hucre / string / bos deger -> ham metin */
function toRawString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

const TR_MOBILE = /^5\d{9}$/;

/** 90 + 5XXXXXXXXX dogrulamasi */
function fromTurkishNational(digits: string): PhoneResult {
  if (TR_MOBILE.test(digits)) return { ok: true, e164: `90${digits}` };
  if (digits.length !== 10) {
    return { ok: false, reason: `Türkiye numarası 10 haneli olmalı (alan kodu ile), ${digits.length} hane bulundu` };
  }
  return { ok: false, reason: 'Türkiye cep numarası 5 ile başlamalı (sabit hat WhatsApp için uygun değil)' };
}

/**
 * Turkiye numaralarini otomatik E.164'e cevirir.
 * Kabul edilen girisler: "0532 123 45 67", "532 123 45 67", "+90 532 123 45 67",
 * "0090532...", "905321234567", 5321234567 (sayi).
 * Baska ulke kodlari yalnizca + veya 00 ile acikca yazildiysa kabul edilir.
 */
export function normalizePhone(value: unknown): PhoneResult {
  const raw = toRawString(value).trim();
  if (!raw) return { ok: false, reason: 'Telefon numarası boş' };

  const hasPlus = raw.startsWith('+');
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return { ok: false, reason: 'Telefon numarası rakam içermiyor' };
  if (/[a-zA-Z]/.test(raw.replace(/^\+/, ''))) {
    return { ok: false, reason: 'Telefon numarası harf içeriyor' };
  }

  let digits = cleaned;
  let international = hasPlus;

  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (international) {
    if (digits.startsWith('90')) return fromTurkishNational(digits.slice(2));
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, reason: 'Uluslararası numara uzunluğu geçersiz (8-15 hane olmalı)' };
    }
    return { ok: true, e164: digits };
  }

  // Yerel yazimlar
  if (digits.length === 10) return fromTurkishNational(digits);
  if (digits.length === 11 && digits.startsWith('0')) return fromTurkishNational(digits.slice(1));
  if (digits.length === 12 && digits.startsWith('90')) return fromTurkishNational(digits.slice(2));
  if (digits.length === 13 && digits.startsWith('090')) return fromTurkishNational(digits.slice(3));

  return {
    ok: false,
    reason: `Numara tanınamadı (${digits.length} hane). Örnek: 0532 123 45 67 veya 905321234567`,
  };
}

/** Panelde gosterim icin: 905321234567 -> +90 532 123 45 67 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '-';
  if (/^90\d{10}$/.test(e164)) {
    const n = e164.slice(2);
    return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8)}`;
  }
  return `+${e164}`;
}

/** Arama kutusundan gelen serbest metni numaraya cevirmeye calisir. */
export function phoneSearchTerm(input: string): string {
  const normalized = normalizePhone(input);
  if (normalized.ok) return normalized.e164;
  return input.replace(/[^\d]/g, '');
}
