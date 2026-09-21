import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * "Gönderime Hazırla": gecerli alicilar icin mesaj kayitlarini olusturur.
 * Mesajlar 'pending' durumunda baslar; bu adim da mesaj GONDERMEZ.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: campaign } = await admin
      .from('campaigns')
      .select('id, status, valid_count')
      .eq('id', id)
      .maybeSingle();

    if (!campaign) return jsonError('Gönderim bulunamadı.', 404);
    if (!['draft', 'ready'].includes(campaign.status)) {
      return jsonError('Bu gönderim zaten başlatılmış.', 409);
    }

    const settings = await getSettings(admin);
    const isTest = settings.sendMode === 'test';

    if (isTest) {
      if (!settings.testPhoneE164) {
        return jsonError('TEST modu açık ancak test telefon numarası tanımlı değil. Ayarlar sayfasından ekleyin.', 422);
      }
      const check = normalizePhone(settings.testPhoneE164);
      if (!check.ok) return jsonError(`Test telefon numarası geçersiz: ${check.reason}`, 422);
    }

    const { data: recipients, error: recipientError } = await admin
      .from('recipients')
      .select('id, phone_e164')
      .eq('campaign_id', id)
      .eq('status', 'valid');

    if (recipientError) throw new Error(recipientError.message);
    if (!recipients || recipients.length === 0) {
      return jsonError('Gönderilebilecek geçerli kayıt yok.', 422);
    }

    const rows = recipients.map((recipient) => ({
      campaign_id: id,
      recipient_id: recipient.id,
      idempotency_key: `${id}:${recipient.id}`,
      to_phone_e164: isTest ? settings.testPhoneE164! : recipient.phone_e164!,
      is_test_redirect: isTest,
      status: 'pending' as const,
    }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      // Ayni butona iki kez basilirsa cakisma yok sayilir (idempotent).
      const { error } = await admin
        .from('messages')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'idempotency_key', ignoreDuplicates: true });
      if (error) throw new Error(`Mesaj kayıtları oluşturulamadı: ${error.message}`);
    }

    await admin
      .from('campaigns')
      .update({
        status: 'ready',
        send_mode: settings.sendMode,
        test_phone_e164: settings.testPhoneE164,
        template_name: settings.templateName,
        template_language: settings.templateLanguage,
      })
      .eq('id', id);

    const { count } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .in('status', ['pending', 'processing']);

    return jsonOk({
      ready: true,
      pending: count ?? rows.length,
      sendMode: settings.sendMode,
      testPhone: isTest ? settings.testPhoneE164 : null,
      templateName: settings.templateName,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
