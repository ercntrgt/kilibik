import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';

export const runtime = 'nodejs';

/** "Başarısızları yeniden gönder": failed kayitlari tekrar kuyruga alir. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('messages')
      .update({
        status: 'pending',
        wamid: null,
        claimed_at: null,
        failed_at: null,
        error_code: null,
        error_title: null,
        error_detail: null,
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', id)
      .eq('status', 'failed')
      .select('id');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return jsonError('Yeniden gönderilecek başarısız kayıt yok.', 422);

    await admin.from('campaigns').update({ status: 'sending', completed_at: null }).eq('id', id);

    return jsonOk({ requeued: data.length });
  } catch (error) {
    return handleApiError(error);
  }
}
