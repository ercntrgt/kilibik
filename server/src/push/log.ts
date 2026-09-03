import type { PushKind } from '../../../shared/src/index.js';
import type { PushProvider, PushTarget } from './types.js';

export class LogPushProvider implements PushProvider {
  constructor(private log: (msg: string) => void = console.log) {}
  async send(target: PushTarget, kind: PushKind) {
    this.log(`[push:${target.platform}] ${kind} -> ${target.token.slice(0, 8)}…`);
  }
}

/** Testlerde gönderilen push'ları kaydeder. */
export class RecordingPushProvider implements PushProvider {
  sent: { token: string; platform: string; kind: PushKind }[] = [];
  async send(target: PushTarget, kind: PushKind) {
    this.sent.push({ token: target.token, platform: target.platform, kind });
  }
  reset() {
    this.sent = [];
  }
}
