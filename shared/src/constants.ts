/**
 * Ürün genelinde geçerli sabitler. Bunların çoğu KIRMIZI ÇİZGİLER'den türer;
 * değiştirmeden önce docs/RED_LINES.md okunmalı.
 */
export const LOCATION_TTL_SECONDS_DEFAULT = 300; // "son konum" en fazla 5 dk yaşar
export const LOCATION_MIN_DISTANCE_METERS = 150; // hareket eşiği (cihaz tarafı)
export const LOCATION_MIN_INTERVAL_MS = 2 * 60 * 1000; // en fazla 2 dakikada bir (cihaz tarafı)
export const LOCATION_SERVER_MIN_INTERVAL_SECONDS = 20; // sunucu: sürekli akışı engelleyen üst sınır
export const LOCATION_BLOB_MAX_BYTES = 512;

export const REQUESTS_PER_HOUR = 10;
export const REQUEST_BODY_MAX_BYTES = 2048;
export const REQUEST_RETENTION_DAYS_DEFAULT = 90;

export const NUDGE_COOLDOWN_SECONDS = 15 * 60;

export const INVITE_CODE_TTL_SECONDS = 10 * 60;
export const OTP_TTL_SECONDS = 5 * 60;
export const MIN_AGE_YEARS = 18;
export const ACCOUNT_PURGE_DAYS_DEFAULT = 30;

/** Her isteğin en az üç yanıtı vardır (kırmızı çizgi). */
export const REQUEST_RESPONSES = ['accepted', 'declined', 'snoozed'] as const;
export type RequestResponse = (typeof REQUEST_RESPONSES)[number];
export type RequestStatus = 'pending' | RequestResponse;

/** Aydınlatma / açık rıza metinlerinin sürümü. Metin değişirse artır. */
export const PRIVACY_NOTICE_VERSION = 1;
export const LOCATION_CONSENT_VERSION = 1;
