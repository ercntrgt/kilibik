import Papa from 'papaparse';
import { mapHeaders, type CanonicalField, type HeaderMapping } from './columns';
import type { ParsedRow } from './validate';

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_ROWS = 20_000;

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.csv'] as const;

export class ImportError extends Error {}

/** Excel hucre degerini metne cevirir (tarih/saat/formul/zengin metin dahil). */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (value instanceof Date) return formatDateCell(value);

  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.richText)) {
    return (obj.richText as { text?: string }[]).map((part) => part.text ?? '').join('').trim();
  }
  if ('result' in obj) return cellToText(obj.result);
  if ('text' in obj) return cellToText(obj.text);
  if ('error' in obj) return '';
  return String(value).trim();
}

/**
 * Excel'de saat hucreleri 1899-12-30 tabanli gelir; tarih hucreleri UTC gece yarisi.
 * Saat ise "HH:mm", tarih ise "GG.AA.YYYY" uretilir.
 */
export function formatDateCell(date: Date): string {
  const year = date.getUTCFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (year < 1901) return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${year}`;
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('�')) {
    // Excel'in Turkce CSV ciktisi cogunlukla windows-1254'tur.
    try {
      text = new TextDecoder('windows-1254').decode(bytes);
    } catch {
      /* ICU yoksa UTF-8 sonucuyla devam */
    }
  }
  return text.replace(/^﻿/, '');
}

function toParsedRows(matrix: unknown[][]): {
  headers: string[];
  rows: ParsedRow[];
  mapping: HeaderMapping;
} {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cellToText(cell) !== ''));
  if (headerIndex === -1) throw new ImportError('Dosya boş görünüyor.');

  const headers = matrix[headerIndex].map(cellToText);
  const mapping = mapHeaders(headers);

  if (mapping.mapping.telefon === undefined) {
    throw new ImportError(
      'Telefon kolonu bulunamadı. Başlık satırında "telefon" / "cep telefonu" gibi bir kolon olmalı.',
    );
  }

  const dataRows = matrix.slice(headerIndex + 1);
  if (dataRows.length > MAX_ROWS) {
    throw new ImportError(`Dosyada ${dataRows.length} satır var; en fazla ${MAX_ROWS} satır işlenebilir.`);
  }

  const rows: ParsedRow[] = dataRows.map((cells, offset) => {
    const values: Partial<Record<CanonicalField, string>> = {};
    for (const [field, index] of Object.entries(mapping.mapping) as [CanonicalField, number][]) {
      values[field] = cellToText(cells[index]);
    }
    // Excel satir numarasi (1 tabanli, baslik satiri dahil)
    return { rowNumber: headerIndex + 2 + offset, values };
  });

  return { headers, rows, mapping };
}

async function parseXlsx(buffer: ArrayBuffer) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportError('Excel dosyasında sayfa bulunamadı.');

  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    // exceljs 1 tabanli dizi dondurur
    matrix.push(Array.isArray(values) ? values.slice(1) : []);
  });

  return toParsedRows(matrix);
}

function parseCsv(buffer: ArrayBuffer) {
  const text = decodeText(buffer);
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter');
    if (fatal) throw new ImportError('CSV ayırıcısı tespit edilemedi. Dosyayı virgül veya noktalı virgül ile kaydedin.');
  }
  return toParsedRows(result.data as unknown[][]);
}

export async function parseSpreadsheet(fileName: string, buffer: ArrayBuffer) {
  if (buffer.byteLength === 0) throw new ImportError('Dosya boş.');
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ImportError(`Dosya çok büyük (en fazla ${MAX_FILE_BYTES / 1024 / 1024} MB).`);
  }

  const lower = fileName.toLowerCase();
  const extension = ACCEPTED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (!extension) {
    throw new ImportError('Yalnızca .xlsx, .xlsm ve .csv dosyaları yüklenebilir.');
  }

  return extension === '.csv' ? parseCsv(buffer) : parseXlsx(buffer);
}
