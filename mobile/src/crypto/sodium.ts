import sodium from 'react-native-libsodium';
import type { SodiumLike } from '../../../shared/src/crypto';

/** react-native-libsodium, libsodium-wrappers ile aynı fonksiyon adlarını sunar. */
export const rnSodium: SodiumLike = sodium as unknown as SodiumLike;

export async function sodiumReady(): Promise<void> {
  await (sodium as unknown as { ready: Promise<void> }).ready;
}
