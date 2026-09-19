import 'server-only';

/** Excel'in Turkce yerel ayarinda dogru acilmasi icin BOM + noktali virgul. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export async function toXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AtlasELT OkulPaketi';
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Dosya adinda kullanilamayacak karakterleri temizler. */
export function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}\-_. ]/gu, '_').slice(0, 80) || 'gonderim';
}
