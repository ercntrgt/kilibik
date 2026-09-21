# Kilibik

Çiftler için **karşılıklı** istek listesi, anlık son konum ve "beni ara". İki kişilik. Sunucu kördür: konum ve istek metinleri cihazda şifrelenir, sunucu içeriği hiçbir zaman okuyamaz. Konum geçmişi yoktur; yalnızca son konum, en fazla 5 dakika.

> Bir tarafın diğerini gözetlediği değil, iki tarafın da aynı şeyi paylaştığı bir araç. Bu ayrım ürünün tamamını belirler. Bkz. [docs/RED_LINES.md](docs/RED_LINES.md).

## Dizinler

| Dizin | İçerik |
|---|---|
| `server/` | Fastify + PostgreSQL + Redis API, push sağlayıcıları, saklama işleri, entegrasyon testleri |
| `shared/` | Ortamdan bağımsız kripto zarfı (X25519 + XChaCha20-Poly1305), sabitler, API tipleri |
| `mobile/` | React Native (bare) uygulama: onboarding, istekler, harita, dürtme, ayarlar |
| `docs/` | Mimari, kırmızı çizgiler, test rehberi, faz durumu |
| `docs/compliance/` | Aydınlatma metni, açık rıza, gizlilik politikası, saklama tablosu, veri işleyen sözleşmesi, store metni, Play Data Safety, Apple App Privacy |
| `okulpaketi/` | **Ayrı ürün:** AtlasELT – OkulPaketi WhatsApp toplu teslimat bilgilendirme paneli (Next.js + Supabase + Meta WhatsApp Cloud API). Kendi bağımlılıkları ve testleri vardır; bkz. [okulpaketi/README.md](okulpaketi/README.md) |

## Hızlı başlangıç

```bash
docker compose up -d            # Postgres + Redis (veya yerel kurulum)
npm install
cp .env.example .env
npm run migrate
npm run dev:server              # http://localhost:3000 — OTP kodları konsola yazılır
npm test                        # gerçek DB/Redis ile ~50 entegrasyon testi
npm run redlines                # §7 kabul kriterleri
```

Mobil: `mobile/README.md`. Test rehberi: `docs/TESTING.md`.

## Kırmızı çizgiler (özet)
Konum geçmişi yok · asimetrik görünürlük yok · tepki istatistiği yok · gizli geofence yok · rızayı geri almanın cezası yok (bildirim gitmez) · her isteğin üç yanıtı var · sessiz modu delen bildirim yok · reklam/analitik SDK yok · 18 yaş altı yok.
