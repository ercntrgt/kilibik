import { NextRequest } from 'next/server';
import { requireApiAdmin, requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireApiUser();
    const admin = createSupabaseAdminClient();
    return jsonOk(await getSettings(admin));
  } catch (error) {
    return handleApiError(error);
  }
}

const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
const LANGUAGE_CODE = /^[a-z]{2}(_[A-Z]{2})?$/;

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if (body.templateName !== undefined) {
      const value = String(body.templateName).trim();
      if (!TEMPLATE_NAME.test(value)) {
        return jsonError('Şablon adı yalnızca küçük harf, rakam ve alt çizgi içerebilir.', 422);
      }
      update.template_name = value;
    }

    if (body.templateLanguage !== undefined) {
      const value = String(body.templateLanguage).trim();
      if (!LANGUAGE_CODE.test(value)) return jsonError('Dil kodu geçersiz (örn. tr, en_US).', 422);
      update.template_language = value;
    }

    if (body.sendMode !== undefined) {
      const value = String(body.sendMode);
      if (value !== 'test' && value !== 'live') return jsonError('Gönderim modu geçersiz.', 422);
      update.send_mode = value;
    }

    if (body.testPhone !== undefined) {
      const raw = String(body.testPhone ?? '').trim();
      if (!raw) {
        update.test_phone_e164 = null;
      } else {
        const phone = normalizePhone(raw);
        if (!phone.ok) return jsonError(`Test telefon numarası geçersiz: ${phone.reason}`, 422);
        update.test_phone_e164 = phone.e164;
      }
    }

    const numeric: [string, string, number, number][] = [
      ['batchSize', 'batch_size', 1, 200],
      ['throttlePerSecond', 'throttle_per_second', 1, 80],
      ['dedupeWindowHours', 'dedupe_window_hours', 0, 8760],
    ];
    for (const [key, column, min, max] of numeric) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (!Number.isInteger(value) || value < min || value > max) {
        return jsonError(`${key} ${min}-${max} aralığında bir tam sayı olmalı.`, 422);
      }
      update[column] = value;
    }

    if (Object.keys(update).length === 0) return jsonError('Güncellenecek alan yok.', 400);

    // TEST -> CANLI gecisi acik bir karardir; numarasiz canli moda gecilebilir
    // ama test moduna gecerken numara zorunlu tutulur.
    const admin = createSupabaseAdminClient();
    const current = await getSettings(admin);
    const nextMode = (update.send_mode as string) ?? current.sendMode;
    const nextPhone = update.test_phone_e164 !== undefined
      ? (update.test_phone_e164 as string | null)
      : current.testPhoneE164;

    if (nextMode === 'test' && !nextPhone) {
      return jsonError('TEST modu için bir test telefon numarası girmelisiniz.', 422);
    }

    update.updated_at = new Date().toISOString();
    update.updated_by = user.id;

    const { error } = await admin.from('settings').update(update).eq('id', true);
    if (error) throw new Error(error.message);

    return jsonOk(await getSettings(admin));
  } catch (error) {
    return handleApiError(error);
  }
}
