import { describe, expect, it } from 'vitest';
import {
  AAD_LOCATION,
  AAD_REQUEST,
  deriveSharedKey,
  fromBase64,
  generateKeyPair,
  openJson,
  sealJson,
  toBase64,
  utf8Decode,
  utf8Encode,
} from '../../shared/src/index.js';
import { sodium } from './helpers.js';

describe('shared crypto', () => {
  it('both sides derive the same key from X25519 exchange', async () => {
    const s = await sodium();
    const a = generateKeyPair(s);
    const b = generateKeyPair(s);
    const ka = deriveSharedKey(s, a.privateKey, a.publicKey, b.publicKey);
    const kb = deriveSharedKey(s, b.privateKey, b.publicKey, a.publicKey);
    expect(toBase64(ka)).toBe(toBase64(kb));
    expect(ka.length).toBe(32);
    const c = generateKeyPair(s);
    expect(toBase64(deriveSharedKey(s, a.privateKey, a.publicKey, c.publicKey))).not.toBe(toBase64(ka));
  });

  it('round-trips and rejects tampering / wrong context', async () => {
    const s = await sodium();
    const a = generateKeyPair(s);
    const b = generateKeyPair(s);
    const k = deriveSharedKey(s, a.privateKey, a.publicKey, b.publicKey);
    const env = sealJson(s, k, { lat: 41.0082, lng: 28.9784, acc: 10, at: 1 }, AAD_LOCATION);
    expect(openJson(s, k, env, AAD_LOCATION)).toEqual({ lat: 41.0082, lng: 28.9784, acc: 10, at: 1 });
    expect(() => openJson(s, k, env, AAD_REQUEST)).toThrow();
    const tampered = new Uint8Array(env);
    tampered[tampered.length - 1] ^= 1;
    expect(() => openJson(s, k, tampered, AAD_LOCATION)).toThrow();
    // Şifreli zarf koordinatı içermez
    expect(Buffer.from(env).toString('latin1')).not.toContain('41.0082');
  });

  it('utf-8 helpers match TextEncoder/TextDecoder', () => {
    for (const str of ['dönerken ekmek al', 'İstanbul ğüşöçı', '🙂👍🏽', 'plain', '']) {
      expect(Buffer.from(utf8Encode(str))).toEqual(Buffer.from(new TextEncoder().encode(str)));
      expect(utf8Decode(utf8Encode(str))).toBe(str);
    }
  });

  it('base64 helpers round-trip arbitrary bytes', async () => {
    const s = await sodium();
    for (const n of [0, 1, 2, 3, 31, 32, 33, 100]) {
      const bytes = s.randombytes_buf(n);
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
      expect(Buffer.from(fromBase64(toBase64(bytes)))).toEqual(Buffer.from(bytes));
    }
  });
});
