import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
import type { PushKind } from '../../../shared/src/index.js';
import { SILENT_KINDS, type PushProvider, type PushTarget } from './types.js';

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyP8: string;
  production: boolean;
}

/**
 * APNs (HTTP/2, token tabanlı). Uyarı metni `loc-key` ile cihazdaki
 * Localizable.strings'ten üretilir; payload içerik taşımaz.
 * `interruption-level` hiçbir zaman "critical" değildir; Critical Alerts yetkisi istenmez.
 */
export class ApnsPushProvider implements PushProvider {
  private jwt: { token: string; issuedAt: number } | null = null;
  constructor(private cfg: ApnsConfig) {}

  private async bearer(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.jwt && now - this.jwt.issuedAt < 45 * 60) return this.jwt.token;
    const key = await importPKCS8(this.cfg.privateKeyP8, 'ES256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.cfg.keyId })
      .setIssuer(this.cfg.teamId)
      .setIssuedAt(now)
      .sign(key);
    this.jwt = { token, issuedAt: now };
    return token;
  }

  static payloadFor(kind: PushKind): { body: Record<string, unknown>; pushType: 'alert' | 'background'; priority: '5' | '10' } {
    if (SILENT_KINDS.has(kind)) {
      return { body: { aps: { 'content-available': 1 }, kind }, pushType: 'background', priority: '5' };
    }
    // Metin cihazda: PUSH_NUDGE, PUSH_REQUEST, PUSH_REQUEST_RESPONSE, PUSH_PAIR
    return {
      body: {
        aps: { alert: { 'loc-key': `PUSH_${kind.toUpperCase()}` }, sound: 'default', 'mutable-content': 1 },
        kind,
      },
      pushType: 'alert',
      priority: '10',
    };
  }

  async send(target: PushTarget, kind: PushKind): Promise<void> {
    if (target.platform !== 'ios') return;
    const { body, pushType, priority } = ApnsPushProvider.payloadFor(kind);
    const host = this.cfg.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
    const auth = await this.bearer();
    await new Promise<void>((resolve, reject) => {
      const client = http2.connect(host);
      client.on('error', reject);
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${target.token}`,
        authorization: `bearer ${auth}`,
        'apns-topic': this.cfg.bundleId,
        'apns-push-type': pushType,
        'apns-priority': priority,
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 300),
      });
      let status = 0;
      let data = '';
      req.on('response', (h) => (status = Number(h[':status'])));
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        client.close();
        status >= 200 && status < 300 ? resolve() : reject(new Error(`apns ${status}: ${data}`));
      });
      req.on('error', (e) => {
        client.close();
        reject(e);
      });
      req.end(JSON.stringify(body));
    });
  }
}
