import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonError, jsonOk } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Gonderim sirasinda ilerleme cubugu icin sayaclar. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const [{ data: campaign }, { data: stats }] = await Promise.all([
      admin.from('campaigns').select('id, name, status, send_mode, valid_count').eq('id', id).maybeSingle(),
      admin.from('campaign_stats').select('*').eq('campaign_id', id).maybeSingle(),
    ]);

    if (!campaign) return jsonError('Gönderim bulunamadı.', 404);

    return jsonOk({
      campaign,
      stats: stats ?? {
        total_messages: 0, pending_count: 0, sent_count: 0,
        delivered_count: 0, read_count: 0, failed_count: 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
