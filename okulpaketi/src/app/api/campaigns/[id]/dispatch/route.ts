import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';
import { dispatchCampaignBatch } from '@/lib/dispatch';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * "WhatsApp Mesajlarını Gönder": bir grup mesaj gonderir.
 * Tarayici `remaining > 0` oldugu surece bu ucu tekrar cagirir; boylece
 * 500-1000 kisilik dosyalar serverless zaman siniri icinde parca parca islenir.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;

    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (body.confirm !== true) {
      return jsonError('Gönderim onayı eksik.', 400);
    }

    const admin = createSupabaseAdminClient();
    const result = await dispatchCampaignBatch(admin, id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
