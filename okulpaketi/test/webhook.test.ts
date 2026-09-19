import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { extractStatusEvents, verifyWebhookSignature } from '@/lib/whatsapp/webhook';

const SECRET = 'test_app_secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')}`;
}

describe('webhook imzası', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account' });

  it('doğru imzayı kabul eder', () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('yanlış imzayı reddeder', () => {
    expect(verifyWebhookSignature(body, sign('başka gövde'), SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=00', SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), '')).toBe(false);
  });
});

describe('durum olayları', () => {
  it('delivered olayını çıkarır', () => {
    const events = extractStatusEvents({
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            statuses: [{ id: 'wamid.ABC', status: 'delivered', timestamp: '1758240000', recipient_id: '905321234567' }],
          },
        }],
      }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ wamid: 'wamid.ABC', status: 'delivered', recipientId: '905321234567' });
    expect(events[0].occurredAt).toBe(new Date(1758240000 * 1000).toISOString());
  });

  it('failed olayının hata bilgisini taşır', () => {
    const [event] = extractStatusEvents({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            statuses: [{
              id: 'wamid.X', status: 'failed', timestamp: '1758240000',
              errors: [{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Receiver incapable' } }],
            }],
          },
        }],
      }],
    });

    expect(event.status).toBe('failed');
    expect(event.errorCode).toBe('131026');
    expect(event.errorDetail).toBe('Receiver incapable');
  });

  it('gelen kullanıcı mesajlarını ve yabancı gövdeleri yok sayar', () => {
    expect(extractStatusEvents({ object: 'page' })).toEqual([]);
    expect(extractStatusEvents({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { messages: [{ id: 'x' }] } }] }],
    })).toEqual([]);
  });
});
