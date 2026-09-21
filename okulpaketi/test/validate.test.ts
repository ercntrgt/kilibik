import { describe, expect, it } from 'vitest';
import { validateRows, type ParsedRow } from '@/lib/import/validate';

function row(rowNumber: number, values: Partial<Record<string, string>>): ParsedRow {
  return {
    rowNumber,
    values: {
      telefon: '0532 123 45 67',
      alici_tipi: 'velimiz',
      set_adi: 'Speakout B1+',
      teslim_tarihi: '25.09.2026',
      teslim_saati: '10:00-16:00',
      teslim_noktasi: 'Denizli Koleji Ana Kampüs',
      ...values,
    } as ParsedRow['values'],
  };
}

describe('veri kontrolü', () => {
  it('geçerli satırı gönderime uygun sayar', () => {
    const { rows, summary } = validateRows([row(2, {})]);
    expect(rows[0].status).toBe('valid');
    expect(rows[0].phoneE164).toBe('905321234567');
    expect(summary).toEqual({ total: 1, valid: 1, invalid: 0, duplicate: 0 });
  });

  it('eksik zorunlu alanları hatalı işaretler', () => {
    const { rows, summary } = validateRows([row(2, { set_adi: '', teslim_saati: '  ' })]);
    expect(rows[0].status).toBe('invalid');
    expect(rows[0].issues.join(' ')).toContain('Set Adı boş');
    expect(rows[0].issues.join(' ')).toContain('Teslim Saati boş');
    expect(summary.invalid).toBe(1);
  });

  it('geçersiz telefonu gönderime almaz', () => {
    const { rows } = validateRows([row(2, { telefon: '123' })]);
    expect(rows[0].status).toBe('invalid');
    expect(rows[0].phoneE164).toBeNull();
  });

  it('dosya içindeki tekrar eden numarayı işaretler', () => {
    const { rows, summary } = validateRows([
      row(2, {}),
      row(3, { telefon: '+90 532 123 45 67' }),
    ]);
    expect(rows[0].status).toBe('valid');
    expect(rows[1].status).toBe('duplicate');
    expect(rows[1].issues.join(' ')).toContain('2. satırda');
    expect(summary).toEqual({ total: 2, valid: 1, invalid: 0, duplicate: 1 });
  });

  it('şablon parametrelerini WhatsApp kurallarına göre temizler', () => {
    const { rows } = validateRows([row(2, { teslim_noktasi: 'Ana\nKampüs    Giriş' })]);
    expect(rows[0].status).toBe('valid');
    expect(rows[0].teslimNoktasi).toBe('Ana Kampüs Giriş');
    expect(rows[0].issues.join(' ')).toContain('temizlendi');
  });

  it('tamamen boş satırları atlar', () => {
    const empty: ParsedRow = { rowNumber: 5, values: { telefon: '', set_adi: '' } };
    const { summary } = validateRows([row(2, {}), empty]);
    expect(summary.total).toBe(1);
  });
});
