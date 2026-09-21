import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { extractStatusEvents, verifyWebhookSignature } from '@/lib/whatsapp/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Meta webhook dogrulamasi (Verify and save). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!expected) {
    console.error('[webhook] META_WEBHOOK_VERIFY_TOKEN tanımlı değil');
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (mode === 'subscribe' && token && safeEquals(token, expected) && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Meta durum bildirimleri: sent / delivered / read / failed.
 * Imza dogrulanmadan hicbir veri islenmez. Islem hatalarinda bile 200 doneriz;
 * aksi halde Meta ayni olayi tekrar tekrar gonderir.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error('[webhook] META_APP_SECRET tanımlı değil, istek reddedildi');
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('[webhook] geçersiz imza');
    return new NextResponse('Forbidden', { status: 403 });
  }

  let events: ReturnType<typeof extractStatusEvents> = [];
  try {
    events = extractStatusEvents(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ received: true, processed: 0 });
  }

  if (events.length === 0) return NextResponse.json({ received: true, processed: 0 });

  try {
    const admin = createSupabaseAdminClient();
    const messageIds: string[] = [];

    for (const event of events) {
      const { data, error } = await admin.rpc('apply_message_status', {
        p_wamid: event.wamid,
        p_status: event.status,
        p_occurred_at: event.occurredAt,
        p_error_code: event.errorCode,
        p_error_title: event.errorTitle,
        p_error_detail: event.errorDetail,
        p_raw: null,
      });
      if (error) console.error('[webhook] durum yazılamadı:', error.message);
      else if (data) messageIds.push(String(data));
    }

    if (messageIds.length > 0) {
      const { data: rows } = await admin
        .from('messages')
        .select('campaign_id')
        .in('id', messageIds);

      const campaignIds = [...new Set((rows ?? []).map((r) => r.campaign_id as string))];
      await Promise.all(
        campaignIds.map((campaignId) => admin.rpc('refresh_campaign_status', { p_campaign_id: campaignId })),
      );
    }

    return NextResponse.json({ received: true, processed: events.length });
  } catch (error) {
    console.error('[webhook] işleme hatası:', error instanceof Error ? error.message : error);
    return NextResponse.json({ received: true, processed: 0 });
  }
}
