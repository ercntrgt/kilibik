import { describe, expect, it } from 'vitest';
import { cellToText, formatDateCell, parseSpreadsheet } from '@/lib/import/parse';

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe('CSV okuma', () => {
  it('başlıkları eşler ve satırları çıkarır', async () => {
    const csv = [
      'Telefon;Alıcı Tipi;Set Adı;Teslim Tarihi;Teslim Saati;Teslim Noktası',
      '905321234567;velimiz;Speakout B1+;25.09.2026;10:00-16:00;Denizli Koleji Ana Kampüs',
      '0533 000 00 00;öğrencimiz;Speakout A2;26.09.2026;09:00-12:00;Merkez Şube',
    ].join('\n');

    const result = await parseSpreadsheet('liste.csv', toBuffer(csv));
    expect(result.mapping.missing).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      values: { telefon: '905321234567', set_adi: 'Speakout B1+', teslim_noktasi: 'Denizli Koleji Ana Kampüs' },
    });
  });

  it('virgüllü CSV ve BOM ile çalışır', async () => {
    const csv = '﻿telefon,set_adi,alici_tipi,teslim_tarihi,teslim_saati,teslim_noktasi\n905321234567,Set,velimiz,25.09.2026,10:00,Okul\n';
    const result = await parseSpreadsheet('liste.csv', toBuffer(csv));
    expect(result.rows[0].values.telefon).toBe('905321234567');
  });

  it('telefon kolonu yoksa anlaşılır hata verir', async () => {
    await expect(parseSpreadsheet('liste.csv', toBuffer('ad;soyad\nAli;Veli\n'))).rejects.toThrow(/Telefon kolonu/);
  });

  it('desteklenmeyen uzantıyı reddeder', async () => {
    await expect(parseSpreadsheet('liste.txt', toBuffer('a;b'))).rejects.toThrow(/xlsx/);
  });
});

describe('hücre dönüşümü', () => {
  it('tarih ve saat hücrelerini biçimlendirir', () => {
    expect(formatDateCell(new Date(Date.UTC(2026, 8, 25)))).toBe('25.09.2026');
    expect(formatDateCell(new Date(Date.UTC(1899, 11, 30, 10, 30)))).toBe('10:30');
  });

  it('sayı, zengin metin ve formül sonucunu metne çevirir', () => {
    expect(cellToText(905321234567)).toBe('905321234567');
    expect(cellToText({ richText: [{ text: 'Speakout ' }, { text: 'B1+' }] })).toBe('Speakout B1+');
    expect(cellToText({ formula: 'A1&B1', result: 'Merkez Şube' })).toBe('Merkez Şube');
    expect(cellToText(null)).toBe('');
  });
});
