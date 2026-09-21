import 'server-only';
import type { PhoneNumberInfo, TemplateStatus, WhatsAppSendResult } from './types';

/**
 * Meta WhatsApp Cloud API istemcisi.
 * Token yalnizca sunucu tarafinda okunur; hicbir yanitta / logda yer almaz.
 */

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
};

export class WhatsAppConfigError extends Error {}

export function getWhatsAppConfig(): WhatsAppConfig {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const wabaId = process.env.META_WABA_ID ?? '';
  const apiVersion = process.env.META_GRAPH_API_VERSION || 'v25.0';

  const missing: string[] = [];
  if (!token) missing.push('META_WHATSAPP_TOKEN');
  if (!phoneNumberId) missing.push('META_PHONE_NUMBER_ID');
  if (missing.length > 0) {
    throw new WhatsAppConfigError(`Eksik ortam değişkeni: ${missing.join(', ')}`);
  }

  return { token: token!, phoneNumberId: phoneNumberId!, wabaId, apiVersion };
}

export function isWhatsAppConfigured(): boolean {
  try {
    getWhatsAppConfig();
    return true;
  } catch {
    return false;
  }
}

const GRAPH_HOST = 'https://graph.facebook.com';
const REQUEST_TIMEOUT_MS = 20_000;

/** Gecici / tekrar denenebilir Meta hata kodlari */
const RETRYABLE_CODES = new Set([
  '0',      // bilinmeyen / gecici
  '1',      // API Unknown
  '2',      // API Service
  '4',      // uygulama istek limiti
  '80007',  // WABA hiz limiti
  '130429', // Cloud API hiz limiti
  '131016', // servis gecici olarak kullanilamiyor
  '131026', // mesaj su an teslim edilemiyor (kuyruk/gecici)
  '131048', // spam hiz limiti
  '131056', // ciftler arasi hiz limiti
  '133016', // gecici kilit
  '368',    // gecici olarak engellendi
  '500', '502', '503', '504',
]);

/** Kullaniciya gosterilecek Turkce aciklamalar */
const ERROR_HINTS: Record<string, string> = {
  '131026': 'Numara WhatsApp kullanmıyor olabilir veya mesaj şu an teslim edilemiyor.',
  '131047': 'Müşteri ile açık konuşma penceresi yok; yalnızca onaylı şablon gönderilebilir.',
  '131051': 'Bu mesaj tipi desteklenmiyor.',
  '132000': 'Şablondaki değişken sayısı ile gönderilen parametre sayısı uyuşmuyor.',
  '132001': 'Şablon bulunamadı. Şablon adı ve dili Meta panelindeki ile birebir aynı olmalı.',
  '132005': 'Şablon metni izin verilen uzunluğu aşıyor.',
  '132007': 'Şablon biçim kuralı ihlali (parametrede satır sonu, sekme veya 4+ ardışık boşluk olamaz).',
  '132012': 'Parametre biçimi şablonla uyuşmuyor.',
  '132015': 'Şablon duraklatılmış durumda.',
  '132016': 'Şablon kalite nedeniyle devre dışı bırakılmış.',
  '133010': 'Telefon numarası Cloud API için kayıtlı değil.',
  '190': 'Erişim token’ı geçersiz veya süresi dolmuş.',
  '10': 'Uygulamanın bu işlem için izni yok (whatsapp_business_messaging).',
  '130429': 'Gönderim hız limitine takıldı. Daha yavaş gönderin.',
  '80007': 'WhatsApp Business hesabı hız limitine takıldı.',
  '131031': 'Hesap kısıtlanmış veya askıya alınmış.',
};

type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number | string;
    error_subcode?: number | string;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
};

function toFailure(status: number | null, body: GraphErrorBody | null, fallback: string): WhatsAppSendResult {
  const error = body?.error;
  const code = String(error?.code ?? error?.error_subcode ?? status ?? 'unknown');
  const detail = error?.error_data?.details ?? error?.message ?? fallback;
  const hint = ERROR_HINTS[code];

  return {
    ok: false,
    error: {
      code,
      title: error?.message ?? fallback,
      detail: hint ? `${detail} — ${hint}` : detail,
      retryable: RETRYABLE_CODES.has(code) || (status !== null && status >= 500),
      httpStatus: status,
    },
  };
}

async function graphFetch(path: string, init: RequestInit, config: WhatsAppConfig) {
  return fetch(`${GRAPH_HOST}/${config.apiVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
}

export type SendTemplateInput = {
  /** E.164, basinda + olmadan: 905321234567 */
  to: string;
  templateName: string;
  languageCode: string;
  /** Sirali govde parametreleri: {{1}}..{{5}} */
  parameters: string[];
};

/**
 * Onayli bir sablonu tek bir numaraya gonderir.
 * Tekrar kullanilabilir tek nokta: toplu gonderim de, test gonderimi de bunu cagirir.
 */
export async function sendWhatsAppTemplateMessage(
  input: SendTemplateInput,
  config: WhatsAppConfig = getWhatsAppConfig(),
): Promise<WhatsAppSendResult> {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: 'body',
          parameters: input.parameters.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  let response: Response;
  try {
    response = await graphFetch(`${config.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, config);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    return {
      ok: false,
      error: {
        code: isTimeout ? 'timeout' : 'network',
        title: isTimeout ? 'Meta API zaman aşımı' : 'Meta API’ye ulaşılamadı',
        detail: error instanceof Error ? error.message : 'Bilinmeyen ağ hatası',
        retryable: true,
        httpStatus: null,
      },
    };
  }

  const body = (await response.json().catch(() => null)) as
    | (GraphErrorBody & { messages?: { id: string }[]; contacts?: { wa_id?: string }[] })
    | null;

  if (!response.ok || body?.error) {
    return toFailure(response.status, body, `Meta API hatası (HTTP ${response.status})`);
  }

  const wamid = body?.messages?.[0]?.id;
  if (!wamid) {
    return toFailure(response.status, null, 'Meta API yanıtında mesaj kimliği (wamid) yok');
  }

  return { ok: true, wamid, waId: body?.contacts?.[0]?.wa_id ?? null };
}

/** Ayarlar sayfasindaki "Bağlantıyı test et" icin numara bilgisi. */
export async function getPhoneNumberInfo(
  config: WhatsAppConfig = getWhatsAppConfig(),
): Promise<{ ok: true; info: PhoneNumberInfo } | { ok: false; message: string }> {
  try {
    const response = await graphFetch(
      `${config.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
      { method: 'GET' },
      config,
    );
    const body = (await response.json().catch(() => null)) as
      | (GraphErrorBody & {
          id?: string;
          display_phone_number?: string;
          verified_name?: string;
          quality_rating?: string;
          code_verification_status?: string;
        })
      | null;

    if (!response.ok || body?.error) {
      const code = String(body?.error?.code ?? response.status);
      const hint = ERROR_HINTS[code];
      return { ok: false, message: `${body?.error?.message ?? `HTTP ${response.status}`}${hint ? ` — ${hint}` : ''}` };
    }

    return {
      ok: true,
      info: {
        id: body?.id ?? config.phoneNumberId,
        displayPhoneNumber: body?.display_phone_number ?? null,
        verifiedName: body?.verified_name ?? null,
        qualityRating: body?.quality_rating ?? null,
        codeVerificationStatus: body?.code_verification_status ?? null,
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Bağlantı kurulamadı' };
  }
}

/** Secili sablonun Meta tarafindaki onay durumu. */
export async function getTemplateStatus(
  templateName: string,
  language: string,
  config: WhatsAppConfig = getWhatsAppConfig(),
): Promise<{ ok: true; template: TemplateStatus | null } | { ok: false; message: string }> {
  if (!config.wabaId) return { ok: false, message: 'META_WABA_ID tanımlı değil' };

  try {
    const params = new URLSearchParams({ fields: 'name,status,language,category', limit: '50', name: templateName });
    const response = await graphFetch(`${config.wabaId}/message_templates?${params}`, { method: 'GET' }, config);
    const body = (await response.json().catch(() => null)) as
      | (GraphErrorBody & { data?: { name: string; status: string; language: string; category?: string }[] })
      | null;

    if (!response.ok || body?.error) {
      return { ok: false, message: body?.error?.message ?? `HTTP ${response.status}` };
    }

    const match =
      body?.data?.find((t) => t.name === templateName && t.language === language) ??
      body?.data?.find((t) => t.name === templateName);

    return {
      ok: true,
      template: match
        ? { name: match.name, language: match.language, status: match.status, category: match.category ?? null }
        : null,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Bağlantı kurulamadı' };
  }
}
