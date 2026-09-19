import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError } from '@/lib/api';
import { safeFileName, toCsv, toXlsx } from '@/lib/export';
import { MESSAGE_STATUS_LABELS, RECIPIENT_STATUS_LABELS, formatDateTime } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 120;

const HEADERS = [
  'Satır', 'Telefon', 'Alıcı Tipi', 'Set Adı', 'Teslim Tarihi', 'Teslim Saati', 'Teslim Noktası',
  'Kayıt Durumu', 'Mesaj Durumu', 'Gönderildi', 'Teslim Edildi', 'Okundu', 'Hata Kodu', 'Hata Açıklaması', 'Notlar',
];

type Row = {
  row_number: number;
  phone_e164: string | null;
  raw_phone: string | null;
  alici_tipi: string | null;
  set_adi: string | null;
  teslim_tarihi: string | null;
  teslim_saati: string | null;
  teslim_noktasi: string | null;
  status: string;
  issues: string[] | null;
  messages: {
    status: string; sent_at: string | null; delivered_at: string | null;
    read_at: string | null; error_code: string | null; error_detail: string | null;
  }[] | null;
};

/** Gonderim sonuclarini CSV veya XLSX olarak disari aktarir. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const format = request.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

    const admin = createSupabaseAdminClient();
    const { data: campaign } = await admin.from('campaigns').select('name').eq('id', id).maybeSingle();
    if (!campaign) return jsonError('Gönderim bulunamadı.', 404);

    const { data, error } = await admin
      .from('recipients')
      .select(
        'row_number, phone_e164, raw_phone, alici_tipi, set_adi, teslim_tarihi, teslim_saati, teslim_noktasi, status, issues, messages(status, sent_at, delivered_at, read_at, error_code, error_detail)',
      )
      .eq('campaign_id', id)
      .order('row_number');

    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as Row[]).map((row) => {
      const message = row.messages?.[0];
      return [
        row.row_number,
        row.phone_e164 ?? row.raw_phone ?? '',
        row.alici_tipi ?? '',
        row.set_adi ?? '',
        row.teslim_tarihi ?? '',
        row.teslim_saati ?? '',
        row.teslim_noktasi ?? '',
        RECIPIENT_STATUS_LABELS[row.status] ?? row.status,
        message ? (MESSAGE_STATUS_LABELS[message.status] ?? message.status) : 'Gönderilmedi',
        formatDateTime(message?.sent_at),
        formatDateTime(message?.delivered_at),
        formatDateTime(message?.read_at),
        message?.error_code ?? '',
        message?.error_detail ?? '',
        (row.issues ?? []).join(' | '),
      ];
    });

    const base = safeFileName(campaign.name);

    if (format === 'xlsx') {
      const buffer = await toXlsx('Gönderim', HEADERS, rows);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${base}.xlsx"; filename*=UTF-8''${encodeURIComponent(base)}.xlsx`,
        },
      });
    }

    return new Response(toCsv(HEADERS, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"; filename*=UTF-8''${encodeURIComponent(base)}.csv`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
