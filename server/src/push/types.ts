import type { PushKind } from '../../../shared/src/index.js';

export interface PushTarget {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Push sağlayıcı sözleşmesi. Payload YALNIZCA `kind` taşır; metin, konum, istek
 * içeriği vb. asla bildirimde yolculuk etmez — içerik cihazda üretilir.
 * Kırmızı çizgi: critical alert / full-screen intent yok; standart öncelik.
 */
export interface PushProvider {
  send(target: PushTarget, kind: PushKind): Promise<void>;
}

/** Sessiz (arka plan) push'lar: kullanıcıya görünmez, cihaz veri çeker. */
export const SILENT_KINDS: ReadonlySet<PushKind> = new Set(['location', 'pair_dissolved']);
