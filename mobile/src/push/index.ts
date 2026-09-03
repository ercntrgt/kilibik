import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import type { PushKind } from '../../../shared/src/types';
import { api } from '../api/client';
import { t } from '../i18n/tr';

/**
 * Bildirimler.
 * - Payload yalnızca `kind` taşır; başlık/metin burada, cihazda üretilir.
 * - Standart kanal önemi; tam ekran intent veya critical alert YOK.
 * - Sessiz push'lar ('location', 'pair_dissolved') kullanıcıya gösterilmez; veri yenilenir.
 */
const CHANNEL_ID = 'kilibik-default';

export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Kilibik', importance: AndroidImportance.DEFAULT });
}

export async function registerPushToken(): Promise<void> {
  const perm = await messaging().requestPermission();
  if (perm === messaging.AuthorizationStatus.DENIED) return;
  await notifee.requestPermission();
  const token = await messaging().getToken();
  // FCM jetonu her iki platformda kullanılır (iOS'ta APNs üzerinden yönlendirilir).
  await api('PUT', '/me/push-token', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

export function kindOf(msg: FirebaseMessagingTypes.RemoteMessage): PushKind | null {
  const k = msg.data?.kind;
  return typeof k === 'string' ? (k as PushKind) : null;
}

/** Cihazda üretilen bildirim metinleri. */
export function textFor(kind: PushKind): { title: string; body: string } | null {
  switch (kind) {
    case 'request':
      return { title: t.pushRequestTitle, body: t.pushRequestBody };
    case 'request_response':
      return { title: t.pushResponseTitle, body: t.pushResponseBody };
    case 'nudge':
      return { title: t.pushNudgeTitle, body: t.pushNudgeBody };
    case 'pair':
      return { title: t.pushPairTitle, body: t.pushPairBody };
    default:
      return null; // location, pair_dissolved: sessiz
  }
}

export async function displayLocal(kind: PushKind) {
  const text = textFor(kind);
  if (!text) return;
  await ensureChannel();
  await notifee.displayNotification({
    title: text.title,
    body: text.body,
    android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
    ios: { sound: 'default' },
  });
}

/** Ön plan mesajları: sessiz türler için yenileme, diğerleri için yerel bildirim. */
export function subscribeForeground(onKind: (kind: PushKind) => void): () => void {
  return messaging().onMessage(async (msg) => {
    const kind = kindOf(msg);
    if (!kind) return;
    onKind(kind);
    if (kind === 'nudge') await displayLocal(kind);
  });
}
