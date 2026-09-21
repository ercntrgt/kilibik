import { normalizePhone } from '@/lib/phone';
import { MAX_PARAM_LENGTH, sanitizeParam } from '@/lib/message';
import { FIELD_LABELS, type CanonicalField } from './columns';

export type ParsedRow = {
  rowNumber: number;
  values: Partial<Record<CanonicalField, string>>;
};

export type RecipientStatus = 'valid' | 'invalid' | 'duplicate';

export type ValidatedRow = {
  rowNumber: number;
  rawPhone: string;
  phoneE164: string | null;
  aliciTipi: string;
  setAdi: string;
  teslimTarihi: string;
  teslimSaati: string;
  teslimNoktasi: string;
  status: RecipientStatus;
  issues: string[];
};

export type ValidationSummary = {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
};

const REQUIRED_TEXT_FIELDS: Exclude<CanonicalField, 'telefon'>[] = [
  'alici_tipi',
  'set_adi',
  'teslim_tarihi',
  'teslim_saati',
  'teslim_noktasi',
];

/** Tamamen bos satirlar (Excel'in kuyrugundaki bosluklar) atlanir. */
export function isEmptyRow(row: ParsedRow): boolean {
  return Object.values(row.values).every((v) => !String(v ?? '').trim());
}

export function validateRows(rows: ParsedRow[]): {
  rows: ValidatedRow[];
  summary: ValidationSummary;
} {
  const seenPhones = new Map<string, number>(); // e164 -> ilk gorulen satir
  const result: ValidatedRow[] = [];

  for (const row of rows) {
    if (isEmptyRow(row)) continue;

    const issues: string[] = [];
    const rawPhone = String(row.values.telefon ?? '').trim();
    const phone = normalizePhone(rawPhone);
    let phoneE164: string | null = null;

    if (phone.ok) {
      phoneE164 = phone.e164;
    } else {
      issues.push(`Telefon: ${phone.reason}`);
    }

    const text: Record<string, string> = {};
    for (const field of REQUIRED_TEXT_FIELDS) {
      const original = String(row.values[field] ?? '').trim();
      if (!original) {
        issues.push(`${FIELD_LABELS[field]} boş`);
        text[field] = '';
        continue;
      }
      const safe = sanitizeParam(original);
      if (safe.length > MAX_PARAM_LENGTH) {
        issues.push(`${FIELD_LABELS[field]} çok uzun (en fazla ${MAX_PARAM_LENGTH} karakter)`);
      }
      if (safe !== original) {
        issues.push(`${FIELD_LABELS[field]} içindeki satır sonu/fazla boşluk temizlendi`);
      }
      text[field] = safe.slice(0, MAX_PARAM_LENGTH);
    }

    let status: RecipientStatus = issues.some((i) => !i.includes('temizlendi')) ? 'invalid' : 'valid';

    if (status === 'valid' && phoneE164) {
      const firstRow = seenPhones.get(phoneE164);
      if (firstRow !== undefined) {
        status = 'duplicate';
        issues.push(`Aynı numara ${firstRow}. satırda da var (tekrar gönderilmeyecek)`);
      } else {
        seenPhones.set(phoneE164, row.rowNumber);
      }
    }

    result.push({
      rowNumber: row.rowNumber,
      rawPhone,
      phoneE164,
      aliciTipi: text.alici_tipi ?? '',
      setAdi: text.set_adi ?? '',
      teslimTarihi: text.teslim_tarihi ?? '',
      teslimSaati: text.teslim_saati ?? '',
      teslimNoktasi: text.teslim_noktasi ?? '',
      status,
      issues,
    });
  }

  return {
    rows: result,
    summary: {
      total: result.length,
      valid: result.filter((r) => r.status === 'valid').length,
      invalid: result.filter((r) => r.status === 'invalid').length,
      duplicate: result.filter((r) => r.status === 'duplicate').length,
    },
  };
}
