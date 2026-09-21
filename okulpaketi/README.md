# AtlasELT – OkulPaketi · WhatsApp Toplu Bilgilendirme

Web sitesinden kitap/set satın alan öğrenci ve velilere, **Meta WhatsApp Cloud API** üzerinden
onaylı bir şablonla kişiselleştirilmiş teslimat bilgilendirmesi gönderen yönetim paneli.

> Bu sistem **yalnızca** resmî WhatsApp Cloud API kullanır. WhatsApp Web otomasyonu, Selenium,
> QR ile hesap bağlama, resmî olmayan kütüphaneler veya numara rotasyonu **yoktur ve eklenmeyecektir**.
> Mesajlar Utility (işlemsel bilgilendirme) niteliğindedir; yalnızca satın alma yapmış ve bu
> bilgilendirmeyi bekleyen müşterilere gönderilir.

## 1. Sistem mimarisi

```
Tarayıcı (Next.js panel, Türkçe)
  │  Supabase Auth (e-posta + şifre, httpOnly cookie)
  ▼
Next.js App Router (Vercel)
  ├── proxy.ts ............ oturum tazeleme + panel sayfalarını koruma
  ├── Server Components ... panel ekranları (veri doğrudan sunucuda okunur)
  └── API Routes (server-only)
        ├── /api/upload .................. Excel/CSV oku → doğrula → TASLAK gönderim
        ├── /api/campaigns/[id]/prepare .. "Gönderime Hazırla" (mesaj kayıtları, pending)
        ├── /api/campaigns/[id]/dispatch . grup grup gönderim (claim → Meta → durum yaz)
        ├── /api/campaigns/[id]/retry .... başarısızları yeniden kuyruğa al
        ├── /api/campaigns/[id]/export ... CSV / XLSX rapor
        ├── /api/settings ................ şablon, mod, hız ayarları
        ├── /api/webhooks/whatsapp ....... Meta durum bildirimleri (imza doğrulamalı)
        └── /api/cron/dispatch ........... yarım kalan gönderimleri toparlar (Vercel Cron)
  │
  ├──────────────► Meta Graph API  (POST /{phone-number-id}/messages)
  │                     ▲
  │                     └── webhook: sent / delivered / read / failed
  ▼
Supabase (PostgreSQL + RLS)
  profiles · settings · campaigns · recipients · messages · message_events
```

**Neden bu yapı?**

- Access token ve `service_role` anahtarı yalnızca sunucu tarafında; tarayıcıya hiç gitmez.
- Gönderim durumu tek doğruluk kaynağı olarak veritabanındadır; panel yalnızca onu okur.
- Kuyruk altyapısı (Redis/SQS) gerektirmeyen, veritabanı temelli `SKIP LOCKED` kuyruk:
  Vercel'de ek servis kurmadan 500–1000 kişilik dosyalar güvenle işlenir.

## 2. Klasör yapısı

```
okulpaketi/
├── src/
│   ├── proxy.ts                        # oturum + sayfa koruması (eski adıyla middleware)
│   ├── app/
│   │   ├── layout.tsx, globals.css, page.tsx
│   │   ├── giris/page.tsx              # giriş ekranı
│   │   ├── (panel)/
│   │   │   ├── layout.tsx              # kenar menü, mod rozeti, çıkış
│   │   │   ├── panel/page.tsx          # dashboard
│   │   │   ├── yukle/page.tsx          # Excel/CSV yükleme
│   │   │   ├── gonderimler/page.tsx    # gönderim listesi
│   │   │   ├── gonderimler/[id]/page.tsx  # önizleme + onay + sonuçlar + filtreler
│   │   │   └── ayarlar/page.tsx        # Meta ayarları, test modu, bağlantı testi
│   │   ├── actions.ts                  # çıkış (server action)
│   │   └── api/…                       # yukarıdaki uçlar
│   ├── components/                     # ui.tsx, LoginForm, UploadForm, CampaignRunner, SettingsForm
│   └── lib/
│       ├── phone.ts                    # TR telefon → E.164
│       ├── message.ts                  # şablon metni, parametre sırası, sanitizasyon
│       ├── dispatch.ts                 # toplu gönderim motoru
│       ├── settings.ts, auth.ts, api.ts, format.ts, export.ts
│       ├── import/ (columns, parse, validate, dedupe)
│       ├── whatsapp/ (client, webhook, types)
│       └── supabase/ (server, client)
├── supabase/migrations/0001_init.sql, 0002_rls.sql
├── supabase/seed.sql
├── test/                               # vitest birim testleri (30 test)
├── docs/ornek-liste.csv                # deneme dosyası (hatalı/tekrar eden satırlar dahil)
└── vercel.json                         # 5 dakikalık cron
```

## 3. Veritabanı şeması (Supabase / PostgreSQL)

| Tablo | Amaç | Önemli alanlar |
|---|---|---|
| `profiles` | `auth.users` uzantısı, personel hesapları | `role` (`admin`/`staff`), `is_active` |
| `settings` | tek satırlık sistem ayarı | `template_name`, `template_language`, `send_mode`, `test_phone_e164`, `batch_size`, `throttle_per_second`, `dedupe_window_hours` |
| `campaigns` | her dosya yüklemesi = bir gönderim | `name`, `file_name`, `status`, `send_mode`, sayaçlar |
| `recipients` | dosyadaki her satır | `phone_e164`, 5 şablon alanı, `status`, `issues[]` |
| `messages` | gönderilecek/gönderilen mesaj | `idempotency_key` (tekil), `to_phone_e164`, `status`, `wamid` (tekil), hata alanları, zaman damgaları |
| `message_events` | webhook + API olay geçmişi | `event_type`, `status`, `raw`, `occurred_at` |

İlişkiler: `campaigns 1—n recipients 1—1 messages 1—n message_events`.

Kritik kısıtlar ve yardımcılar:

- `recipients_campaign_phone_valid_uniq` — aynı kampanyada bir numara yalnızca bir kez *geçerli* olabilir.
- `messages.idempotency_key` tekil (`<campaign_id>:<recipient_id>`) — "Gönderime Hazırla"ya iki kez basmak mesajı ikiye katlamaz.
- `messages.wamid` tekil — webhook tekrarları çift kayıt üretmez.
- `claim_messages()` — `FOR UPDATE SKIP LOCKED` ile atomik kayıt kapma; **aynı kişiye iki mesaj gitmesini engeller**.
- `apply_message_status()` — durumu yalnızca ileri yönde günceller (`read` gelmişken `delivered` geri yazılmaz).
- `recent_send_exists()` / `dedupe` kontrolü — son N saatte aynı numaraya aynı set+tarih gittiyse satır `duplicate_previous` işaretlenir.
- `campaign_stats` görünümü ve `dashboard_stats()` — sayaçlar her zaman gerçek veriden hesaplanır.

RLS: tüm tablolarda açık. Tarayıcı istemcisi yalnızca **okur**; tüm yazma işlemleri kimliği
doğrulanmış API uçlarında `service_role` ile yapılır.

## 4. WhatsApp Cloud API entegrasyonu

Tek giriş noktası: `src/lib/whatsapp/client.ts → sendWhatsAppTemplateMessage()`

```
POST https://graph.facebook.com/{META_GRAPH_API_VERSION}/{META_PHONE_NUMBER_ID}/messages
Authorization: Bearer {META_WHATSAPP_TOKEN}

{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "905321234567",
  "type": "template",
  "template": {
    "name": "set_teslim_bildirimi",
    "language": { "code": "tr" },
    "components": [{
      "type": "body",
      "parameters": [
        { "type": "text", "text": "velimiz" },                    // {{1}} alici_tipi
        { "type": "text", "text": "Speakout B1+" },               // {{2}} set_adi
        { "type": "text", "text": "25.09.2026" },                 // {{3}} teslim_tarihi
        { "type": "text", "text": "10:00-16:00" },                // {{4}} teslim_saati
        { "type": "text", "text": "Denizli Koleji Ana Kampüs" }   // {{5}} teslim_noktasi
      ]
    }]
  }
}
```

Yanıt `messages[0].id` (wamid) veritabanına yazılır ve webhook güncellemeleri bu kimlikle eşleşir.
Hata yanıtları Türkçe açıklamaya çevrilir (`132001` şablon yok, `131026` teslim edilemiyor,
`190` token süresi dolmuş…) ve geçici olanlar `retryable` işaretlenir.

Meta tarafındaki şablon (Utility / dil `tr`, ad `set_teslim_bildirimi`) gövdesi birebir şu olmalıdır:

```
Merhaba değerli {{1}},

Sitemiz üzerinden satın almış olduğunuz {{2}} setinizi, {{3}} tarihinde {{4}} saatleri arasında {{5}} adresinden teslim alabilirsiniz.

İyi günler dileriz.

AtlasELT – OkulPaketi
```

## 5. Excel / CSV veri formatı

| Kolon | Örnek | Kabul edilen başlıklar (küçük farklar otomatik eşleşir) |
|---|---|---|
| `telefon` | `905321234567`, `0532 123 45 67` | Telefon, Telefon No, Cep Telefonu, GSM, Numara |
| `alici_tipi` | `velimiz` / `öğrencimiz` | Alıcı Tipi, Hitap, Kime |
| `set_adi` | `Speakout B1+` | Set Adı, Kitap, Kitap Adı, Ürün Adı |
| `teslim_tarihi` | `25.09.2026` | Teslim Tarihi, Tarih |
| `teslim_saati` | `10:00-16:00` | Teslim Saati, Saat Aralığı |
| `teslim_noktasi` | `Denizli Koleji Ana Kampüs` | Teslim Noktası, Adres, Teslim Yeri, Okul |

Yükleme sırasında yapılan kontroller:

1. Telefon boş mu / geçerli mi → TR numaraları **otomatik E.164**'e çevrilir (`0532 123 45 67 → 905321234567`).
2. Aynı numara dosyada birden fazla mı → ilki gönderilir, diğerleri `duplicate`.
3. Set adı / teslim tarihi / saati / noktası boş mu → satır `invalid`.
4. Şablon parametrelerinde satır sonu, sekme veya 4+ ardışık boşluk varsa temizlenir (Meta kuralı).
5. Son N saatte aynı numaraya aynı set+tarih gönderilmiş mi → `duplicate_previous`.

Geçersiz ve tekrar eden kayıtlar **gönderime dahil edilmez**, panelde sebebiyle birlikte listelenir.
Desteklenen dosyalar: `.xlsx`, `.xlsm`, `.csv` (UTF-8 veya windows-1254; `,` ve `;` ayırıcı).
Sınırlar: 8 MB, 20.000 satır.

## 6. Gönderim ve webhook akışı

```
Excel yükle ──► TASLAK gönderim (yalnızca recipients yazılır, MESAJ YOK)
                    │
             "Gönderime Hazırla"  ──► messages: pending  (hâlâ gönderim yok)
                    │
             Onay ekranı: "387 kişiye WhatsApp mesajı gönderilecek. Emin misiniz?"
                    │
             "WhatsApp Mesajlarını Gönder"
                    │
          ┌─────────▼──────────┐   her turda batch_size kadar kayıt
          │ claim_messages()   │   status: pending → processing (atomik)
          └─────────┬──────────┘
                    │  saniyede throttle_per_second istek
             Meta Cloud API ──► başarılı: status=sent + wamid
                              └─ hatalı : status=failed + hata kodu/açıklaması
                    │
             remaining > 0 ise bir sonraki tur (tarayıcı döngüsü + Vercel Cron yedeği)
                    │
   Meta webhook ────┴──► apply_message_status(): sent → delivered → read
                                                  (veya failed + hata)
```

Webhook güvenliği: `GET` doğrulaması `META_WEBHOOK_VERIFY_TOKEN` ile sabit zamanlı
karşılaştırma yapar; `POST` istekleri `X-Hub-Signature-256` HMAC-SHA256 imzası
(`META_APP_SECRET`) doğrulanmadan **hiç işlenmez**.

**Test modu:** `settings.send_mode = 'test'` iken dosyada 500 kişi olsa bile tüm mesajlar
yalnızca `test_phone_e164` numarasına gider (`messages.to_phone_e164` hazırlama anında
buna göre yazılır). Canlı gönderim için Ayarlar'dan açıkça "CANLI GÖNDERİM" seçilmeli ve
tarayıcıdaki uyarı onaylanmalıdır.

## 7. Kurulum

> Adım adım, kontrol noktalı kurulum rehberi: [docs/KURULUM.md](docs/KURULUM.md)

```bash
cd okulpaketi
npm install
cp .env.example .env.local     # değerleri doldurun
npm run dev                    # http://localhost:3000
```

### Supabase

1. Yeni proje oluşturun.
2. SQL Editor'da sırasıyla çalıştırın: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_rls.sql`, (opsiyonel) `supabase/seed.sql`.
3. Authentication → Users → **Add user** ile ilk hesabı açın (e-posta + şifre, "Auto confirm").
   İlk kullanıcı otomatik olarak `admin` rolünü alır; sonrakiler `staff` olur
   (`update public.profiles set role='admin' where email='…'` ile yükseltebilirsiniz).
4. Authentication → Providers → Email: "Confirm email" kapalı, "Enable signup" kapalı olsun
   (hesapları yalnızca yönetici açar).

### Meta

1. Meta for Developers → uygulama → WhatsApp ürünü ekleyin.
2. `set_teslim_bildirimi` şablonunu **Utility** kategorisinde, dil `tr` ile oluşturup onaya gönderin.
3. Kalıcı bir System User token'ı üretin (`whatsapp_business_messaging`, `whatsapp_business_management`).
4. Webhook: Callback URL `https://<alan-adınız>/api/webhooks/whatsapp`, Verify token
   `META_WEBHOOK_VERIFY_TOKEN`; `messages` alanına abone olun.

### Vercel

- Ortam değişkenlerini (bkz. `.env.example`) Production + Preview için tanımlayın.
- `vercel.json` içindeki cron, yarım kalan gönderimleri toparlar; `CRON_SECRET` zorunludur.
  Varsayılan olarak günde bir kez çalışır (Hobby planının sınırı). Pro planda sıklığı
  artırabilirsiniz (örn. `*/5 * * * *`). Asıl gönderimi tarayıcı sürdüğü için cron yalnızca
  emniyet ağıdır.
- API uçlarının `maxDuration` değeri 60 sn'dir (Hobby sınırı). Gönderim turlara bölündüğü
  için bu yeterlidir; daha büyük gruplar için Pro'da süre artırılabilir.

## 8. Her aşamayı nasıl test edersiniz?

| Aşama | Nasıl test edilir | Beklenen |
|---|---|---|
| Birim testler | `npm test` | 30 test yeşil (telefon, kolon eşleme, doğrulama, şablon, webhook imzası, CSV) |
| Derleme | `npm run build` | Hatasız |
| Giriş | `/giris` → e-posta/şifre | Başarılı girişte `/panel`; oturumsuz her sayfa `/giris`'e yönlenir |
| Yükleme | `/yukle` → `docs/ornek-liste.csv` | 7 satır: 3 geçerli, 1 tekrar, 3 hatalı (boş telefon, sabit hat, boş set) |
| Önizleme | Gönderim detayında | İlk kayıtların tam mesaj metni + hatalı satırlar sebepleriyle |
| Bağlantı | Ayarlar → "WhatsApp bağlantısını test et" | Numara, doğrulanmış isim, kalite ve şablon durumu (`APPROVED`) |
| Tek mesaj | Ayarlar → "Test mesajı gönder" | Test numarasına örnek mesaj ulaşır |
| Toplu gönderim | TEST modunda "Gönderime Hazırla" → onay → "Gönder" | Tüm mesajlar yalnızca test numarasına gider; ilerleme çubuğu ilerler |
| Webhook | Mesaj telefonda görüntülendikten sonra detay sayfasını yenileyin | Durum `Gönderildi → Teslim edildi → Okundu` ilerler |
| Hata yolu | Şablon adını bilerek yanlış yazıp gönderin | Kayıtlar `Başarısız` + `132001` açıklaması; "Başarısızları yeniden gönder" çalışır |
| Rapor | Detayda "Excel indir" / "CSV indir" | Kişi bazında durum, zaman damgaları ve hata sebepleri |

## 9. Güvenlik notları

- `META_WHATSAPP_TOKEN` ve `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda okunur, hiçbir yanıtta/ekranda/logda görünmez (Ayarlar sayfasında token maskelenir).
- Tüm API uçları oturum kontrolünden geçer; ayar değişikliği ve test mesajı yönetici gerektirir.
- Yükleme: uzantı, MIME, boyut (8 MB) ve satır (20.000) sınırı.
- Webhook: imza doğrulaması zorunlu, doğrulanmamış istek 403.
- SQL erişimi yalnızca parametreli Supabase istemcisi üzerinden; React varsayılan olarak çıktı kaçışı yapar (`dangerouslySetInnerHTML` kullanılmaz).
- Hata mesajları kullanıcıya sadeleştirilmiş, ayrıntı sunucu loglarında.
