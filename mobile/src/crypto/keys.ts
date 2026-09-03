import * as Keychain from 'react-native-keychain';
import { deriveSharedKey, fromBase64, generateKeyPair, toBase64, type KeyPair } from '../../../shared/src/crypto';
import { rnSodium, sodiumReady } from './sodium';

/**
 * Özel anahtar YALNIZCA cihazda: iOS Keychain / Android Keystore (react-native-keychain).
 * Sunucuya yalnızca açık anahtar gider.
 */
const KEYPAIR_SERVICE = 'kilibik.keypair';
const TOKEN_SERVICE = 'kilibik.token';

const secureOpts: Keychain.SetOptions = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
};

export async function loadOrCreateKeyPair(): Promise<KeyPair> {
  await sodiumReady();
  const existing = await Keychain.getGenericPassword({ service: KEYPAIR_SERVICE });
  if (existing) {
    return { publicKey: fromBase64(existing.username), privateKey: fromBase64(existing.password) };
  }
  const kp = generateKeyPair(rnSodium);
  await Keychain.setGenericPassword(toBase64(kp.publicKey), toBase64(kp.privateKey), { service: KEYPAIR_SERVICE, ...secureOpts });
  return kp;
}

export async function deleteKeyPair(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYPAIR_SERVICE });
}

export function sharedKeyWith(kp: KeyPair, partnerPublicKeyB64: string): Uint8Array {
  return deriveSharedKey(rnSodium, kp.privateKey, kp.publicKey, fromBase64(partnerPublicKeyB64));
}

export async function saveToken(token: string, userId: string): Promise<void> {
  await Keychain.setGenericPassword(userId, token, { service: TOKEN_SERVICE, ...secureOpts });
}

export async function loadToken(): Promise<{ token: string; userId: string } | null> {
  const c = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
  return c ? { token: c.password, userId: c.username } : null;
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
}
