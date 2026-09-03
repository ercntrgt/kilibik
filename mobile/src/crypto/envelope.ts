import {
  AAD_LOCATION,
  AAD_REQUEST,
  fromBase64,
  openJson,
  openText,
  sealJson,
  sealText,
  toBase64,
} from '../../../shared/src/crypto';
import type { LocationPlain } from '../../../shared/src/types';
import { rnSodium } from './sodium';

export const encryptRequest = (key: Uint8Array, text: string): string => toBase64(sealText(rnSodium, key, text, AAD_REQUEST));
export const decryptRequest = (key: Uint8Array, b64: string): string => openText(rnSodium, key, fromBase64(b64), AAD_REQUEST);
export const encryptLocation = (key: Uint8Array, loc: LocationPlain): string => toBase64(sealJson(rnSodium, key, loc, AAD_LOCATION));
export const decryptLocation = (key: Uint8Array, b64: string): LocationPlain => openJson<LocationPlain>(rnSodium, key, fromBase64(b64), AAD_LOCATION);
