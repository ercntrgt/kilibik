# Mimari

## Temel ilke: sunucu kördür

```
Cihaz A                          Sunucu (Fastify)                    Cihaz B
───────                          ────────────────                    ───────
X25519 anahtar çifti                                                 X25519 anahtar çifti
  (özel anahtar Keychain/Keystore'da, asla çıkmaz)
        │ PUT /me/public-key ───▶ users.public_key ◀── PUT /me/public-key │
        │ POST /pair/invite ────▶ Redis invite:CODE (10 dk)               │
        │                        ◀──────────── POST /pair/accept {CODE} ──┤
        │ GET /pair ◀─ partner_public_key      partner_public_key ────────┤
  shared = BLAKE2b(scalarmult(privA,pubB) ‖ min(pub) ‖ max(pub))   aynı shared
```

### Konum akışı

```
A: {lat,lng,acc,at} ──XChaCha20-Poly1305(shared, AAD="kilibik:location:v1")──▶ blob
   PUT /location {blob}
Sunucu: sharing_state[A] açık mı? ─▶ Redis SET loc:A {b,at} EX 300 (üzerine yaz)
        push(B, kind="location")  (content-available, içerik yok)
B: GET /location/partner ─▶ {state:"fresh", blob, updated_at, expires_in}
   çöz ─▶ haritada göster
TTL dolunca: {state:"stale"}. A paylaşımı kapatınca: {state:"off"} — push YOK.
```

- Konum için PostgreSQL tablosu yoktur. Redis kalıcılığı kapalıdır (`save ""`, `appendonly no`).
- Sunucu tarafı üst sınır: kullanıcı başına 20 sn'de 1 yükleme (sürekli akışı engeller). Cihaz: 150 m + 2 dk (+ 4 dk keepalive).

### İstek akışı
`sealText(shared, metin, AAD="kilibik:request:v1")` → `POST /requests {body_encrypted}` → `requests.body_encrypted` (bytea) → partner `GET /requests` → çözer. Yanıt: `POST /requests/:id/respond {status}`; yalnızca alıcı, yalnızca `accepted|declined|snoozed`.

### Dürtme
`POST /nudge` → Redis `SET nudge:A 1 EX 900 NX` (cooldown) → `nudgein:B` (15 dk, "bekleyen var" bayrağı; içerik yok) → push(B, "nudge"). Cihaz "Beni ara" metnini yerelde üretir.

## Bileşenler

| Katman | Teknoloji | Dizin |
|---|---|---|
| Mobil | React Native (bare, TypeScript), react-native-libsodium, react-native-keychain, react-native-maps, @react-native-community/geolocation, @notifee/react-native, @react-native-firebase/messaging (yalnızca FCM, analytics kapalı) | `mobile/` |
| Paylaşılan | Kripto zarfı, sabitler, API tipleri (ortamdan bağımsız TS) | `shared/` |
| Sunucu | Node 20+, Fastify 5, PostgreSQL 16, Redis 7, jose (JWT/APNs/FCM imzaları) | `server/` |
| Push | APNs HTTP/2 token auth; FCM HTTP v1 servis hesabı | `server/src/push/` |

## Veri modeli (PostgreSQL)

`users`, `pairs`, `requests`, `sharing_state`, `consents`, `schema_migrations`. Tam şema: `server/migrations/001_init.sql`. Spesifikasyondaki modele eklenenler: `users.auth_provider` (kaynak), `users.push_platform`, `consents` (KVKK ispat). `birth_date` alanı **yok**, yalnızca `birth_date_verified`.

## API özeti

| Yöntem | Yol | Açıklama |
|---|---|---|
| POST | `/auth/otp/request` | SMS kodu (3/15 dk numara başına) |
| POST | `/auth/otp/verify` | Kod + ilk kayıtta `birth_date` → JWT (30 gün) |
| GET | `/me` | Kimlik, anahtar durumu, paylaşım, rızalar, eşleşme |
| PUT | `/me/public-key` | X25519 açık anahtar (eşleşme varken kilitli) |
| PUT/DELETE | `/me/push-token` | Push jetonu |
| POST | `/me/consents` | `privacy_notice` / `location` rızası (sürümlü) |
| DELETE | `/me/consents/location` | Rızayı geri al (sessiz) |
| POST | `/pair/invite` | 8 haneli tek kullanımlık kod (QR aynı kod) |
| POST | `/pair/accept` | Kodla eşleş → partner açık anahtarı |
| GET/DELETE | `/pair` | Eşleşme görüntüle / sonlandır |
| POST/GET | `/requests` | Gönder (10/saat) / listele (tek liste, iki yön) |
| POST | `/requests/:id/respond` | `accepted` / `declined` / `snoozed` |
| PUT | `/location` | Şifreli blob (paylaşım açıksa) |
| GET | `/location/partner` | `off` / `stale` / `fresh` |
| GET | `/partner` | `{location_sharing_enabled}` — partner hakkında görülebilen tek alan |
| PUT | `/sharing` | Paylaşımı aç/kapat — kapatınca push yok |
| POST | `/nudge` | Dürt (15 dk cooldown) |
| GET | `/nudge/status`, DELETE `/nudge/pending` | Cooldown / bekleyen dürtme |
| DELETE | `/account` | Hesabı sil (anında anonimleştir, ≤30 gün purge) |
| GET | `/legal`, `/legal/:slug` | Uyum metinleri (kimlik gerektirmez) |

Hata biçimi: `{error: "kod", message?, retry_after?}`. 429'larda `retry_after` saniye.

## Yerler (v2, uygulanmadı)
"Eve vardım" istenirse: yerler iki cihazda birlikte tanımlanır ve iki tarafa da görünür; koordinatlar telefondan çıkmaz; sunucuya yalnızca şifreli bir olay zarfı gider (`kilibik:place-event:v1`). Tek taraflı yer tanımı ve gizli geofence kırmızı çizgidir.

## Kimlik
v1: telefon + OTP. Apple / Google Sign-In `users.auth_provider` alanıyla şemaya hazır, uygulanmadı.
