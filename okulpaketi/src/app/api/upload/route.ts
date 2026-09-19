import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';
import { ACCEPTED_EXTENSIONS, ImportError, MAX_FILE_BYTES, parseSpreadsheet } from '@/lib/import/parse';
import { validateRows } from '@/lib/import/validate';
import { dedupeKey, findRecentlySent } from '@/lib/import/dedupe';
import { getSettings } from '@/lib/settings';
import { FIELD_LABELS } from '@/lib/import/columns';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Excel/CSV yukler, dogrular ve TASLAK gonderim olusturur.
 * Bu adimda hicbir mesaj gonderilmez, mesaj kaydi bile olusturulmaz.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const file = form.get('file');
    const providedName = String(form.get('name') ?? '').trim();

    if (!(file instanceof File)) return jsonError('Dosya bulunamadı.', 400);
    if (file.size === 0) return jsonError('Dosya boş.', 400);
    if (file.size > MAX_FILE_BYTES) {
      return jsonError(`Dosya çok büyük (en fazla ${MAX_FILE_BYTES / 1024 / 1024} MB).`, 413);
    }
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return jsonError('Yalnızca .xlsx, .xlsm ve .csv dosyaları yüklenebilir.', 415);
    }

    const parsed = await parseSpreadsheet(file.name, await file.arrayBuffer());
    const { rows, summary } = validateRows(parsed.rows);
    if (rows.length === 0) throw new ImportError('Dosyada işlenebilecek satır bulunamadı.');

    const admin = createSupabaseAdminClient();
    const settings = await getSettings(admin);

    // Yakin gecmiste ayni icerikle gonderilmis kayitlari isaretle
    const validPhones = rows.filter((r) => r.status === 'valid' && r.phoneE164).map((r) => r.phoneE164!);
    const recentlySent = await findRecentlySent(admin, validPhones, settings.dedupeWindowHours);

    let duplicatePrevious = 0;
    const finalRows = rows.map((row) => {
      if (
        row.status === 'valid' &&
        row.phoneE164 &&
        recentlySent.has(dedupeKey(row.phoneE164, row.setAdi, row.teslimTarihi))
      ) {
        duplicatePrevious += 1;
        return {
          ...row,
          status: 'duplicate_previous' as const,
          issues: [
            ...row.issues,
            `Son ${settings.dedupeWindowHours} saat içinde aynı numaraya aynı set/tarih ile mesaj gönderilmiş`,
          ],
        };
      }
      return row;
    });

    const validCount = summary.valid - duplicatePrevious;
    const duplicateCount = summary.duplicate + duplicatePrevious;
    const name = providedName || `${file.name.replace(/\.[^.]+$/, '')} — ${new Date().toLocaleDateString('tr-TR')}`;

    const { data: campaign, error: campaignError } = await admin
      .from('campaigns')
      .insert({
        name: name.slice(0, 200),
        file_name: file.name.slice(0, 255),
        created_by: user.id,
        template_name: settings.templateName,
        template_language: settings.templateLanguage,
        send_mode: settings.sendMode,
        test_phone_e164: settings.testPhoneE164,
        status: 'draft',
        total_rows: summary.total,
        valid_count: validCount,
        invalid_count: summary.invalid,
        duplicate_count: duplicateCount,
      })
      .select('id')
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Gönderim kaydı oluşturulamadı: ${campaignError?.message}`);
    }

    const payload = finalRows.map((row) => ({
      campaign_id: campaign.id,
      row_number: row.rowNumber,
      raw_phone: row.rawPhone.slice(0, 64),
      phone_e164: row.phoneE164,
      alici_tipi: row.aliciTipi,
      set_adi: row.setAdi,
      teslim_tarihi: row.teslimTarihi,
      teslim_saati: row.teslimSaati,
      teslim_noktasi: row.teslimNoktasi,
      status: row.status,
      issues: row.issues,
    }));

    const CHUNK = 500;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const { error } = await admin.from('recipients').insert(payload.slice(i, i + CHUNK));
      if (error) {
        await admin.from('campaigns').delete().eq('id', campaign.id);
        throw new Error(`Kayıtlar yazılamadı: ${error.message}`);
      }
    }

    return jsonOk({
      campaignId: campaign.id,
      summary: {
        total: summary.total,
        valid: validCount,
        invalid: summary.invalid,
        duplicate: duplicateCount,
      },
      columns: {
        matched: Object.keys(parsed.mapping.mapping),
        missing: parsed.mapping.missing.map((field) => FIELD_LABELS[field]),
        unmatched: parsed.mapping.unmatched,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
