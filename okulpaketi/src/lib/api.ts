import { NextResponse } from 'next/server';
import { ApiAuthError } from '@/lib/auth';
import { ImportError } from '@/lib/import/parse';
import { WhatsAppConfigError } from '@/lib/whatsapp/client';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Hatalari kullaniciya anlasilir, sunucuya ayrintili verir; sir sizdirmaz. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiAuthError) return jsonError(error.message, error.status);
  if (error instanceof ImportError) return jsonError(error.message, 422);
  if (error instanceof WhatsAppConfigError) {
    return jsonError(`WhatsApp yapılandırması eksik: ${error.message}`, 503);
  }
  console.error('[api] beklenmeyen hata:', error instanceof Error ? error.message : error);
  return jsonError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.', 500);
}
