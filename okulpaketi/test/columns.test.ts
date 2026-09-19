import { describe, expect, it } from 'vitest';
import { mapHeaders, normalizeHeader } from '@/lib/import/columns';

describe('kolon eşleştirme', () => {
  it('Türkçe karakter ve boşluk farklarını yok sayar', () => {
    expect(normalizeHeader('Teslim Noktası')).toBe('teslimnoktasi');
    expect(normalizeHeader('CEP TELEFONU')).toBe('ceptelefonu');
    expect(normalizeHeader('Set Adı ')).toBe('setadi');
  });

  it('farklı yazımlardaki başlıkları doğru alanlara eşler', () => {
    const { mapping, missing } = mapHeaders([
      'Telefon No', 'Alıcı Tipi', 'Kitap Adı', 'Tarih', 'Saat Aralığı', 'Teslim Adresi',
    ]);
    expect(mapping).toEqual({
      telefon: 0, alici_tipi: 1, set_adi: 2, teslim_tarihi: 3, teslim_saati: 4, teslim_noktasi: 5,
    });
    expect(missing).toEqual([]);
  });

  it('beklenen başlıklarla birebir çalışır', () => {
    const { mapping, unmatched } = mapHeaders([
      'telefon', 'alici_tipi', 'set_adi', 'teslim_tarihi', 'teslim_saati', 'teslim_noktasi', 'notlar',
    ]);
    expect(mapping.telefon).toBe(0);
    expect(mapping.teslim_noktasi).toBe(5);
    expect(unmatched).toEqual(['notlar']);
  });

  it('eksik kolonları bildirir', () => {
    const { missing } = mapHeaders(['Telefon', 'Set Adı']);
    expect(missing).toContain('teslim_tarihi');
    expect(missing).toContain('teslim_noktasi');
  });
});
