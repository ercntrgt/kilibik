import type { RequestStatus } from './constants.js';

/** Push veri yükü. Bilerek içerik taşımaz; cihaz kind'e göre ne çekeceğini bilir. */
export type PushKind = 'location' | 'request' | 'request_response' | 'nudge' | 'pair' | 'pair_dissolved';

export interface PairView {
  id: string;
  partner_id: string;
  partner_public_key: string | null; // base64
  created_at: string;
}

export interface MeView {
  id: string;
  has_public_key: boolean;
  location_sharing_enabled: boolean;
  consents: { privacy_notice_version: number | null; location_consent_version: number | null };
  pair: PairView | null;
}

export interface RequestView {
  id: string;
  sender_id: string;
  body_encrypted: string; // base64, sunucu içeriği okuyamaz
  status: RequestStatus;
  created_at: string;
  responded_at: string | null; // yalnızca "yanıtlandı" göstermek için; hiçbir yerde toplulaştırılmaz
}

/** Partnerin konumu hakkında görülebilen her şey. İki yönde de aynı şekil. */
export type PartnerLocationView =
  | { state: 'off' } // partner paylaşımı kapatmış — nötr durum, bildirim yok
  | { state: 'stale' } // TTL dolmuş, kayıt yok
  | { state: 'fresh'; blob: string; updated_at: string; expires_in: number };

export interface PartnerView {
  location_sharing_enabled: boolean;
}

/** Şifre çözüldükten sonra cihazda oluşan konum. Sunucu bunu asla görmez. */
export interface LocationPlain {
  lat: number;
  lng: number;
  acc: number | null; // metre
  at: number; // cihaz zaman damgası (ms)
}
