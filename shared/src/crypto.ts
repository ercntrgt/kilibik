/**
 * Uçtan uca şifreleme yardımcıları.
 *
 * Hem react-native-libsodium hem libsodium-wrappers aynı fonksiyon adlarını
 * sunduğu için sodium nesnesi dışarıdan verilir; bu modül ortama bağımlı değildir.
 *
 * Anahtar değişimi: X25519 (crypto_box anahtar çifti + crypto_scalarmult).
 * Ortak sır = BLAKE2b( scalarmult(priv, theirPub) || min(pubA,pubB) || max(pubA,pubB) ).
 * Şifreleme: XChaCha20-Poly1305 (IETF), 24 baytlık rastgele nonce.
 *
 * Zarf biçimi (bayt): [versiyon=1][nonce 24][ciphertext+tag]
 * AAD: bağlam dizesi ("kilibik:location:v1" vb.) — bir bağlamın blob'u başka bağlamda çözülmez.
 */

export interface SodiumLike {
  crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_scalarmult(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_generichash(hashLength: number, message: Uint8Array, key?: Uint8Array | null): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretNonce: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: Uint8Array | null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  randombytes_buf(length: number): Uint8Array;
}

export const ENVELOPE_VERSION = 1;
export const NONCE_BYTES = 24;
export const KEY_BYTES = 32;

export const AAD_LOCATION = 'kilibik:location:v1';
export const AAD_REQUEST = 'kilibik:request:v1';

// UTF-8 kodlama: TextEncoder/TextDecoder her RN/Hermes sürümünde yok; saf JS.
export function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    let n: number;
    if (b < 0x80) [cp, n] = [b, 1];
    else if ((b & 0xe0) === 0xc0) [cp, n] = [b & 0x1f, 2];
    else if ((b & 0xf0) === 0xe0) [cp, n] = [b & 0x0f, 3];
    else if ((b & 0xf8) === 0xf0) [cp, n] = [b & 0x07, 4];
    else throw new Error('invalid utf-8');
    if (i + n > bytes.length) throw new Error('invalid utf-8');
    for (let k = 1; k < n; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) throw new Error('invalid utf-8');
      cp = (cp << 6) | (c & 0x3f);
    }
    i += n;
    if (cp > 0xffff) {
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else s += String.fromCharCode(cp);
  }
  return s;
}

const enc = { encode: utf8Encode };
const dec = { decode: utf8Decode };

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function generateKeyPair(sodium: SodiumLike): KeyPair {
  return sodium.crypto_box_keypair();
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Her iki cihazda da aynı 32 baytlık anahtarı üretir. Sunucu yalnızca açık
 * anahtarları taşır; özel anahtar cihazdan çıkmaz.
 */
export function deriveSharedKey(
  sodium: SodiumLike,
  myPrivateKey: Uint8Array,
  myPublicKey: Uint8Array,
  theirPublicKey: Uint8Array,
): Uint8Array {
  const shared = sodium.crypto_scalarmult(myPrivateKey, theirPublicKey);
  const [lo, hi] =
    compareBytes(myPublicKey, theirPublicKey) <= 0
      ? [myPublicKey, theirPublicKey]
      : [theirPublicKey, myPublicKey];
  const material = new Uint8Array(shared.length + lo.length + hi.length);
  material.set(shared, 0);
  material.set(lo, shared.length);
  material.set(hi, shared.length + lo.length);
  return sodium.crypto_generichash(KEY_BYTES, material);
}

export function seal(sodium: SodiumLike, key: Uint8Array, plaintext: Uint8Array, aad: string): Uint8Array {
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, enc.encode(aad), null, nonce, key);
  const out = new Uint8Array(1 + NONCE_BYTES + ct.length);
  out[0] = ENVELOPE_VERSION;
  out.set(nonce, 1);
  out.set(ct, 1 + NONCE_BYTES);
  return out;
}

export function open(sodium: SodiumLike, key: Uint8Array, envelope: Uint8Array, aad: string): Uint8Array {
  if (envelope.length < 1 + NONCE_BYTES + 16) throw new Error('envelope too short');
  if (envelope[0] !== ENVELOPE_VERSION) throw new Error(`unsupported envelope version ${envelope[0]}`);
  const nonce = envelope.subarray(1, 1 + NONCE_BYTES);
  const ct = envelope.subarray(1 + NONCE_BYTES);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, enc.encode(aad), nonce, key);
}

export function sealJson(sodium: SodiumLike, key: Uint8Array, value: unknown, aad: string): Uint8Array {
  return seal(sodium, key, enc.encode(JSON.stringify(value)), aad);
}

export function openJson<T = unknown>(sodium: SodiumLike, key: Uint8Array, envelope: Uint8Array, aad: string): T {
  return JSON.parse(dec.decode(open(sodium, key, envelope, aad))) as T;
}

export function sealText(sodium: SodiumLike, key: Uint8Array, text: string, aad: string): Uint8Array {
  return seal(sodium, key, enc.encode(text), aad);
}

export function openText(sodium: SodiumLike, key: Uint8Array, envelope: Uint8Array, aad: string): string {
  return dec.decode(open(sodium, key, envelope, aad));
}

// --- base64 (ortamdan bağımsız, sodium'a ihtiyaç duymaz) ---
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const rem = bytes.length - i;
    const n = (bytes[i] << 16) | (rem === 2 ? bytes[i + 1] << 8 : 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (rem === 2 ? B64[(n >> 6) & 63] : '=') + '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : 0));
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length && o < out.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length && o < out.length) out[o++] = n & 255;
  }
  return out;
}
