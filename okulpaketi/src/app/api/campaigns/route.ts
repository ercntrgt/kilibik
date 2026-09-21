import { NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { handleApiError, jsonOk } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Gonderim listesi (panelde canli yenileme icin). */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20, 100);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('campaigns')
      .select('id, name, file_name, status, send_mode, total_rows, valid_count, created_at, started_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return jsonOk({ campaigns: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
