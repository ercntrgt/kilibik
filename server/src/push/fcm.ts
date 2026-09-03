import { SignJWT, importPKCS8 } from 'jose';
import type { PushKind } from '../../../shared/src/index.js';
import { SILENT_KINDS, type PushProvider, type PushTarget } from './types.js';

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * FCM HTTP v1. Her iki platforma da gönderebilir (iOS'ta APNs üzerinden yönlendirilir).
 * Yalnızca data mesajı ({kind}); Android'de bildirimi uygulama cihazda üretir,
 * iOS'ta uyarı metni `loc-key` ile cihazdaki yerelleştirme dosyasından gelir.
 * USE_FULL_SCREEN_INTENT kullanılmaz; kanal önemi standarttır; critical alert yok.
 */
export class FcmPushProvider implements PushProvider {
  private access: { token: string; exp: number } | null = null;
  constructor(private cfg: FcmConfig, private fetchImpl: typeof fetch = fetch) {}

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.access && this.access.exp - 60 > now) return this.access.token;
    const key = await importPKCS8(this.cfg.privateKey, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.cfg.clientEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`fcm oauth ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.access = { token: json.access_token, exp: now + json.expires_in };
    return json.access_token;
  }

  static messageFor(token: string, kind: PushKind) {
    const silent = SILENT_KINDS.has(kind);
    return {
      message: {
        token,
        data: { kind },
        android: { priority: 'high', ttl: '300s' },
        apns: {
          headers: { 'apns-push-type': silent ? 'background' : 'alert', 'apns-priority': silent ? '5' : '10' },
          payload: {
            aps: silent
              ? { 'content-available': 1 }
              : { alert: { 'loc-key': `PUSH_${kind.toUpperCase()}` }, sound: 'default', 'mutable-content': 1 },
          },
        },
      },
    };
  }

  async send(target: PushTarget, kind: PushKind): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(`https://fcm.googleapis.com/v1/projects/${this.cfg.projectId}/messages:send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(FcmPushProvider.messageFor(target.token, kind)),
    });
    if (!res.ok) throw new Error(`fcm ${res.status}: ${await res.text()}`);
  }
}
