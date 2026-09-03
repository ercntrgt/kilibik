# Test Rehberi — "sabah test edeceğim"

## 1. Sunucu (tam otomatik, 5 dakika)

Gereksinim: Node 20+, PostgreSQL 16, Redis 7 (Docker varsa `docker compose up -d`).

```bash
npm install
# Test veritabanı (bir kez)
psql -h 127.0.0.1 -U postgres -c "create database kilibik_test;"
npm test                 # 8 dosya, ~50 test, gerçek Postgres + Redis
npm run redlines         # yalnızca §7 kabul kriterleri
```

Ortam değişkenleri: `TEST_DATABASE_URL` (varsayılan `postgres://postgres:postgres@127.0.0.1:5432/kilibik_test`), `TEST_REDIS_URL` (varsayılan `redis://127.0.0.1:6379/9`).

### Kabul kriterleri → test eşlemesi

| §7 kriteri | Test |
|---|---|
| DB dökümünde okunabilir koordinat yok | `redlines.test.ts` › 1 (SQL satırları + `pg_dump` + Redis) |
| TTL sonrası Redis'te konum yok | `redlines.test.ts` › 2, `location.test.ts` › stale |
| Paylaşım kapatılınca push yok | `redlines.test.ts` › 3, `location.test.ts` › disabling |
| A→B veri kümesi = B→A | `redlines.test.ts` › 4 |
| Türetilmiş metrik dönen endpoint yok | `redlines.test.ts` › 5 |
| Sessiz mod standart dışına çıkmıyor | `redlines.test.ts` › 6, `nudge.test.ts` › payload |
| Hesap silme 3 dokunuş + tüm veri | `mobile-logic.test.ts` › deletion, `account.test.ts` |
| Arka plan izni reddedilse de çalışıyor | `mobile-logic.test.ts` › permissions |

## 2. Sunucuyu elle kurcalamak

```bash
cp .env.example .env
npm run migrate
npm run dev:server        # http://localhost:3000, OTP kodu konsola yazılır
```

Hızlı akış (iki terminal veya iki telefon numarası):

```bash
# A kaydolur
curl -s localhost:3000/auth/otp/request -H 'content-type: application/json' -d '{"phone":"+905550000001"}'
curl -s localhost:3000/auth/otp/verify  -H 'content-type: application/json' -d '{"phone":"+905550000001","code":"<konsoldaki kod>","birth_date":"1990-01-01"}'
# → {"token":"...","user_id":"..."}
```

Anahtar üretimi ve şifreleme cihazda yapıldığından tam akışı elle kurmak yerine `server/test/helpers.ts` içindeki `Device` sınıfı kullanılabilir (`npx tsx` ile bir betik yazıp import edin).

## 3. Mobil

```bash
cd mobile
npm install
npx tsc --noEmit          # tip denetimi
npm run android           # veya npm run ios (macOS + Xcode + pod install)
```

Uygulama `mobile/src/config.ts` içindeki `API_BASE_URL`'e bağlanır (Android emülatör: `http://10.0.2.2:3000`). OTP kodu sunucu konsolunda görünür. İki cihaz/emülatörle: A "Davet kodu üret", B kodu girer.

Kontrol listesi:
- [ ] Onboarding: yaş < 18 reddediliyor; aydınlatma ekranı ayrı; konum rıza kutusu boş geliyor; rıza vermeden devam edilebiliyor.
- [ ] Ana ekran: istek gönder → karşı tarafta Tamam/Olmaz/Sonra; 11. istek "saatte 10" hatasıyla dönüyor.
- [ ] Harita: iki avatar, iki zaman damgası; A paylaşımı kapatınca B'de gri avatar + "Konum paylaşımı kapalı", **bildirim yok**.
- [ ] Dürt: ikinci basışta kalan süre görünüyor.
- [ ] Ayarlar: paylaşımı kapat tek dokunuş; eşleşmeyi sonlandır; hesabı sil 3 dokunuş.
- [ ] Konum iznini reddet: istekler, dürtme, harita (partner görünür) çalışmaya devam ediyor.

## 4. Bilinen sınırlar

- Push sağlayıcıları (APNs/FCM) gerçek kimlik bilgileriyle test edilmedi; `PUSH_PROVIDER=log` varsayılandır. Payload yapısı birim testle doğrulandı.
- Mobil uygulama bu ortamda cihaz/emülatörde çalıştırılamadı; tip denetiminden geçti, saf mantık modülleri test edildi. Native kurulum adımları `mobile/README.md`.
