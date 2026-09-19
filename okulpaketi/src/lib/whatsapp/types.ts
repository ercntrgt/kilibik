export type WhatsAppSendSuccess = {
  ok: true;
  wamid: string;
  waId: string | null;
};

export type WhatsAppSendFailure = {
  ok: false;
  error: {
    code: string;
    title: string;
    detail: string;
    /** Gecici hata: "Başarısızları yeniden gönder" ile tekrar denenebilir. */
    retryable: boolean;
    httpStatus: number | null;
  };
};

export type WhatsAppSendResult = WhatsAppSendSuccess | WhatsAppSendFailure;

export type TemplateStatus = {
  name: string;
  language: string;
  status: string;
  category: string | null;
};

export type PhoneNumberInfo = {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
};

/** Meta webhook durum degerleri -> ic durumlarimiz */
export const WEBHOOK_STATUS_MAP = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  deleted: 'failed',
} as const;

export type WebhookStatusKey = keyof typeof WEBHOOK_STATUS_MAP;
