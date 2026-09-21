import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonOk } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { getPhoneNumberInfo, getTemplateStatus, isWhatsAppConfigured } from '@/lib/whatsapp/client';

export const runtime = 'nodejs';

/** "WhatsApp bağlantısını test et" — token ekrana yazilmaz. */
export async function POST() {
  try {
    await requireApiUser();

    if (!isWhatsAppConfigured()) {
      return jsonOk({
        connected: false,
        message: 'META_WHATSAPP_TOKEN veya META_PHONE_NUMBER_ID tanımlı değil.',
        phone: null,
        template: null,
      });
    }

    const settings = await getSettings(createSupabaseAdminClient());
    const [phone, template] = await Promise.all([
      getPhoneNumberInfo(),
      getTemplateStatus(settings.templateName, settings.templateLanguage),
    ]);

    return jsonOk({
      connected: phone.ok,
      message: phone.ok ? 'Bağlantı başarılı.' : phone.message,
      phone: phone.ok ? phone.info : null,
      template: template.ok
        ? (template.template ?? { status: 'NOT_FOUND', name: settings.templateName, language: settings.templateLanguage, category: null })
        : null,
      templateError: template.ok ? null : template.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
