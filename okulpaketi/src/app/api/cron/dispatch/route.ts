import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonOk } from '@/lib/api';
import { dispatchCampaignBatch } from '@/lib/dispatch';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Yarim kalan gonderimleri toparlar (tarayici kapandiysa, istek zaman asimina
 * ugradiysa). Vercel Cron 5 dakikada bir cagirir.
 */
export async function GET(request: NextRequest) {
  try {
    if (!authorized(request)) {
      return new Response('Forbidden', { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const { data: campaigns } = await admin
      .from('campaigns')
      .select('id')
      .eq('status', 'sending')
      .order('started_at', { ascending: true })
      .limit(3);

    const results = [];
    for (const campaign of campaigns ?? []) {
      results.push({ campaignId: campaign.id, ...(await dispatchCampaignBatch(admin, campaign.id)) });
    }

    return jsonOk({ processedCampaigns: results.length, results });
  } catch (error) {
    return handleApiError(error);
  }
}
