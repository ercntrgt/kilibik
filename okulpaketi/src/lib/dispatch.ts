import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '@/lib/settings';
import { sendWhatsAppTemplateMessage, getWhatsAppConfig } from '@/lib/whatsapp/client';
import { sanitizeParam, templateParamList } from '@/lib/message';

export type DispatchResult = {
  claimed: number;
  sent: number;
  failed: number;
  remaining: number;
  status: string;
  message?: string;
};

type ClaimedMessage = {
  id: string;
  recipient_id: string;
  to_phone_e164: string;
  attempt_count: number;
};

type RecipientRow = {
  id: string;
  alici_tipi: string | null;
  set_adi: string | null;
  teslim_tarihi: string | null;
  teslim_saati: string | null;
  teslim_noktasi: string | null;
};

type CampaignRow = {
  id: string;
  status: string;
  template_name: string;
  template_language: string;
  started_at: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function countPending(supabase: SupabaseClient, campaignId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'processing']);
  return count ?? 0;
}

/**
 * Bir kampanyanin bekleyen mesajlarindan bir grup alir ve gonderir.
 * - Kayitlar `claim_messages` ile atomik olarak kapilir: ayni anda iki istek
 *   calissa bile bir kisiye iki mesaj gitmez.
 * - Saniyede `throttle_per_second` kadar istek gonderilir.
 * Serverless ortamda istek basina bir grup islenir; cagiran taraf
 * `remaining > 0` oldugu surece tekrar cagirir.
 */
export async function dispatchCampaignBatch(
  supabase: SupabaseClient,
  campaignId: string,
  options: { maxBatch?: number } = {},
): Promise<DispatchResult> {
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, status, template_name, template_language, started_at')
    .eq('id', campaignId)
    .maybeSingle<CampaignRow>();

  if (campaignError || !campaign) {
    return { claimed: 0, sent: 0, failed: 0, remaining: 0, status: 'not_found', message: 'Gönderim bulunamadı.' };
  }
  if (campaign.status === 'paused' || campaign.status === 'cancelled') {
    return {
      claimed: 0, sent: 0, failed: 0,
      remaining: await countPending(supabase, campaignId),
      status: campaign.status,
      message: 'Gönderim duraklatıldı.',
    };
  }

  const settings = await getSettings(supabase);
  const config = getWhatsAppConfig();
  const batchSize = Math.min(options.maxBatch ?? settings.batchSize, settings.batchSize, 200);
  const perSecond = Math.max(1, Math.min(settings.throttlePerSecond, 80));

  const { data: claimed, error: claimError } = await supabase.rpc('claim_messages', {
    p_campaign_id: campaignId,
    p_limit: batchSize,
  });

  if (claimError) throw new Error(`Kayıtlar alınamadı: ${claimError.message}`);

  const batch = (claimed ?? []) as ClaimedMessage[];
  if (batch.length === 0) {
    const { data: status } = await supabase.rpc('refresh_campaign_status', { p_campaign_id: campaignId });
    return { claimed: 0, sent: 0, failed: 0, remaining: 0, status: String(status ?? 'completed') };
  }

  if (!campaign.started_at) {
    await supabase
      .from('campaigns')
      .update({ started_at: new Date().toISOString(), status: 'sending' })
      .eq('id', campaignId)
      .is('started_at', null);
  }

  const { data: recipientRows } = await supabase
    .from('recipients')
    .select('id, alici_tipi, set_adi, teslim_tarihi, teslim_saati, teslim_noktasi')
    .in('id', batch.map((m) => m.recipient_id));

  const recipients = new Map((recipientRows ?? []).map((r) => [r.id, r as RecipientRow]));

  let sent = 0;
  let failed = 0;
  const now = () => new Date().toISOString();

  for (let offset = 0; offset < batch.length; offset += perSecond) {
    const slice = batch.slice(offset, offset + perSecond);
    const startedAt = Date.now();

    await Promise.all(
      slice.map(async (message) => {
        const recipient = recipients.get(message.recipient_id);
        if (!recipient) {
          failed += 1;
          await supabase.from('messages').update({
            status: 'failed',
            failed_at: now(),
            error_code: 'missing_recipient',
            error_title: 'Alıcı kaydı bulunamadı',
            error_detail: 'Mesaja bağlı alıcı satırı silinmiş görünüyor.',
            updated_at: now(),
          }).eq('id', message.id);
          return;
        }

        const parameters = templateParamList({
          aliciTipi: recipient.alici_tipi ?? '',
          setAdi: recipient.set_adi ?? '',
          teslimTarihi: recipient.teslim_tarihi ?? '',
          teslimSaati: recipient.teslim_saati ?? '',
          teslimNoktasi: recipient.teslim_noktasi ?? '',
        }).map(sanitizeParam);

        const result = await sendWhatsAppTemplateMessage(
          {
            to: message.to_phone_e164,
            templateName: campaign.template_name,
            languageCode: campaign.template_language,
            parameters,
          },
          config,
        );

        if (result.ok) {
          sent += 1;
          await supabase.from('messages').update({
            status: 'sent',
            wamid: result.wamid,
            sent_at: now(),
            error_code: null,
            error_title: null,
            error_detail: null,
            updated_at: now(),
          }).eq('id', message.id);

          await supabase.from('message_events').insert({
            message_id: message.id,
            wamid: result.wamid,
            event_type: 'api:accepted',
            status: 'sent',
            occurred_at: now(),
          });
        } else {
          failed += 1;
          await supabase.from('messages').update({
            status: 'failed',
            failed_at: now(),
            error_code: result.error.code,
            error_title: result.error.title.slice(0, 500),
            error_detail: result.error.detail.slice(0, 2000),
            updated_at: now(),
          }).eq('id', message.id);

          await supabase.from('message_events').insert({
            message_id: message.id,
            event_type: 'api:error',
            status: 'failed',
            error_code: result.error.code,
            error_detail: result.error.detail.slice(0, 2000),
            occurred_at: now(),
          });
        }
      }),
    );

    const elapsed = Date.now() - startedAt;
    if (offset + perSecond < batch.length && elapsed < 1000) {
      await sleep(1000 - elapsed);
    }
  }

  const remaining = await countPending(supabase, campaignId);
  const { data: status } = await supabase.rpc('refresh_campaign_status', { p_campaign_id: campaignId });

  return { claimed: batch.length, sent, failed, remaining, status: String(status ?? 'sending') };
}
