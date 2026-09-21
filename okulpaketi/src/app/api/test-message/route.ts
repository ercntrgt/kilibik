import { NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/phone';
import { sanitizeParam, templateParamList } from '@/lib/message';
import { sendWhatsAppTemplateMessage } from '@/lib/whatsapp/client';

export const runtime = 'nodejs';

/**
 * Tek bir deneme mesaji gonderir (kurulum dogrulamasi icin).
 * TEST modunda hedef daima ayarlardaki test numarasidir.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      phone?: string;
      aliciTipi?: string;
      setAdi?: string;
      teslimTarihi?: string;
      teslimSaati?: string;
      teslimNoktasi?: string;
    };

    const admin = createSupabaseAdminClient();
    const settings = await getSettings(admin);

    let target = settings.testPhoneE164;
    if (settings.sendMode === 'live' && body.phone) {
      const phone = normalizePhone(body.phone);
      if (!phone.ok) return jsonError(`Telefon numarası geçersiz: ${phone.reason}`, 422);
      target = phone.e164;
    }
    if (!target) {
      return jsonError('Test telefon numarası tanımlı değil. Ayarlar sayfasından ekleyin.', 422);
    }

    const parameters = templateParamList({
      aliciTipi: body.aliciTipi || 'velimiz',
      setAdi: body.setAdi || 'Speakout B1+',
      teslimTarihi: body.teslimTarihi || '25.09.2026',
      teslimSaati: body.teslimSaati || '10:00-16:00',
      teslimNoktasi: body.teslimNoktasi || 'Denizli Koleji Ana Kampüs',
    }).map(sanitizeParam);

    const result = await sendWhatsAppTemplateMessage({
      to: target,
      templateName: settings.templateName,
      languageCode: settings.templateLanguage,
      parameters,
    });

    if (!result.ok) {
      return jsonOk({ sent: false, to: target, error: result.error });
    }
    return jsonOk({ sent: true, to: target, wamid: result.wamid });
  } catch (error) {
    return handleApiError(error);
  }
}
