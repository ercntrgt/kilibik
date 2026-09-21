import { createHmac, timingSafeEqual } from 'node:crypto';
import { WEBHOOK_STATUS_MAP, type WebhookStatusKey } from './types';

/** Meta'nin X-Hub-Signature-256 basligini ham govde uzerinden dogrular. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [algorithm, signature] = signatureHeader.split('=');
  if (algorithm !== 'sha256' || !signature) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type StatusEvent = {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  occurredAt: string;
  recipientId: string | null;
  errorCode: string | null;
  errorTitle: string | null;
  errorDetail: string | null;
};

type WebhookBody = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        statuses?: {
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          errors?: {
            code?: number | string;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }[];
        }[];
      };
    }[];
  }[];
};

function toIso(timestamp: string | undefined): string {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

/**
 * Webhook govdesinden durum olaylarini cikarir.
 * Gelen kullanici mesajlari (value.messages) bu sistemde islenmez; yok sayilir.
 */
export function extractStatusEvents(body: unknown): StatusEvent[] {
  const payload = body as WebhookBody;
  if (!payload || payload.object !== 'whatsapp_business_account') return [];

  const events: StatusEvent[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== 'messages') continue;
      for (const status of change.value?.statuses ?? []) {
        const wamid = status.id;
        const key = status.status as WebhookStatusKey | undefined;
        if (!wamid || !key || !(key in WEBHOOK_STATUS_MAP)) continue;

        const error = status.errors?.[0];
        events.push({
          wamid,
          status: WEBHOOK_STATUS_MAP[key],
          occurredAt: toIso(status.timestamp),
          recipientId: status.recipient_id ?? null,
          errorCode: error?.code !== undefined ? String(error.code) : null,
          errorTitle: error?.title ?? null,
          errorDetail: error?.error_data?.details ?? error?.message ?? null,
        });
      }
    }
  }

  return events;
}
