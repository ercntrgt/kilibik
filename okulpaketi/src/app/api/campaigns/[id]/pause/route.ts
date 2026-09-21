import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';

export const runtime = 'nodejs';

/** Gonderimi duraklatir / devam ettirir. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { paused?: boolean };
    if (typeof body.paused !== 'boolean') return jsonError('paused alanı gerekli.', 400);

    const admin = createSupabaseAdminClient();
    const { data: campaign } = await admin.from('campaigns').select('status').eq('id', id).maybeSingle();
    if (!campaign) return jsonError('Gönderim bulunamadı.', 404);

    if (body.paused) {
      if (!['sending', 'ready'].includes(campaign.status)) {
        return jsonError('Bu gönderim duraklatılamaz.', 409);
      }
      await admin.from('campaigns').update({ status: 'paused' }).eq('id', id);
      return jsonOk({ status: 'paused' });
    }

    if (campaign.status !== 'paused') return jsonError('Gönderim duraklatılmış değil.', 409);
    const { data: status } = await admin.rpc('refresh_campaign_status', { p_campaign_id: id });
    return jsonOk({ status: String(status ?? 'sending') });
  } catch (error) {
    return handleApiError(error);
  }
}
