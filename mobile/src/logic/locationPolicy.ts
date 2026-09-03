import {
  LOCATION_MIN_DISTANCE_METERS,
  LOCATION_MIN_INTERVAL_MS,
  LOCATION_TTL_SECONDS_DEFAULT,
} from '../../../shared/src/constants';

export interface Fix {
  lat: number;
  lng: number;
  at: number; // ms
}

/** Haversine (metre). */
export function distanceMeters(a: Fix, b: Fix): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Sabit dururken TTL'nin (5 dk) dolmaması için en geç bu sürede bir "hâlâ buradayım" gönderilir.
 * Yine de 2 dakikadan sık gönderim olmaz.
 */
export const KEEPALIVE_MS = Math.max(LOCATION_MIN_INTERVAL_MS, (LOCATION_TTL_SECONDS_DEFAULT - 60) * 1000);

export interface UploadDecision {
  upload: boolean;
  reason: 'first' | 'moved' | 'keepalive' | 'too_soon' | 'not_moved';
}

/**
 * Gönderim kararı: sürekli akış yok.
 * - ilk fix: gönder
 * - son gönderimden bu yana < 2 dk: gönderme
 * - ≥ 150 m hareket: gönder
 * - hareket yok ama keepalive süresi dolmuş: gönder
 */
export function shouldUpload(lastUploaded: Fix | null, next: Fix, now = next.at): UploadDecision {
  if (!lastUploaded) return { upload: true, reason: 'first' };
  const elapsed = now - lastUploaded.at;
  if (elapsed < LOCATION_MIN_INTERVAL_MS) return { upload: false, reason: 'too_soon' };
  if (distanceMeters(lastUploaded, next) >= LOCATION_MIN_DISTANCE_METERS) return { upload: true, reason: 'moved' };
  if (elapsed >= KEEPALIVE_MS) return { upload: true, reason: 'keepalive' };
  return { upload: false, reason: 'not_moved' };
}

/** Cihaz tarafında blob'a giren koordinat, ağa çıkmadan yuvarlanır (~1 m hassasiyet yeterli). */
export function roundCoord(v: number): number {
  return Math.round(v * 1e5) / 1e5;
}
