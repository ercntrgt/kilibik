/**
 * Konum izni durumuna göre uygulama modu. Kırmızı çizgi / kabul kriteri:
 * arka plan izni reddedilse bile uygulamanın geri kalanı çalışır.
 */
export type LocationPermission = 'always' | 'whenInUse' | 'denied' | 'blocked' | 'unknown';

export interface AppCapabilities {
  requests: true; // her zaman
  nudge: true; // her zaman
  map: true; // harita ekranı her zaman açılır; partner paylaşıyorsa görünür
  canSeePartner: true; // partnerin konumunu görmek kendi izninden bağımsızdır
  ownSharing: 'background' | 'foreground_only' | 'unavailable';
}

export function capabilitiesFor(p: LocationPermission): AppCapabilities {
  const base = { requests: true, nudge: true, map: true, canSeePartner: true } as const;
  switch (p) {
    case 'always':
      return { ...base, ownSharing: 'background' };
    case 'whenInUse':
      return { ...base, ownSharing: 'foreground_only' };
    default:
      return { ...base, ownSharing: 'unavailable' };
  }
}

/** İzin yoksa sunucudaki paylaşım durumu da kapalı olmalı (tutarlılık, sessizce). */
export function effectiveSharing(serverEnabled: boolean, p: LocationPermission): boolean {
  return serverEnabled && capabilitiesFor(p).ownSharing !== 'unavailable';
}
