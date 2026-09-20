# Kurulum rehberi — AtlasELT OkulPaketi

Sıfırdan canlıya alma adımları. Her aşamanın sonunda bir **kontrol noktası** var;
oradan geçmeden sonrakine geçmeyin.

## 0. Sıralama neden böyle?

En uzun süren işler (şablon onayı, iş doğrulaması) **beklemeli** olduğu için en önce
başlatılır; sistem kurulumu onları beklemeden paralel ilerler.

| # | İş | Bağımlılık | Süre |
|---|---|---|---|
| 1 | Meta uygulaması + test numarası | — | 15 dk |
| 2 | Şablonu onaya gönder | 1 | 5 dk + onay (saatler) |
| 3 | İş doğrulaması başlat | — | 10 dk + 2–14 gün |
| 4 | Kalıcı token | 1 | 10 dk |
| 5 | Supabase | — | 10 dk |
| 6 | Vercel deploy | 4, 5 | 10 dk |
| 7 | Webhook bağlama | 6 | 5 dk |
| 8 | Test gönderimi | 2, 7 | 5 dk |
| 9 | Kendi numarana geçiş + ödeme | 3 | sonra |

## 1. Meta uygulaması ve test numarası

1. `developers.facebook.com/apps` → **Create app**
   - Use case: *Connect with customers through WhatsApp*
   - Business portfolio: şirketin portfolyosu
2. **Kullanım durumları → Connect on WhatsApp → Özelleştir → Step 1. Try it out**
3. WhatsApp Business Account: **Create new**
4. **Recipient → Manage phone number list** → test alıcısı ekle, WhatsApp'tan gelen kodu gir
5. **Generate token** (24 saatlik) → **Send message**

**Kontrol noktası:** test alıcısına "Hello World" ulaşmalı.

Bu ekrandan alınacak değerler:

| Değer | Nerede | Gizli mi |
|---|---|---|
| Phone Number ID | Step 1 · Test number kutusu | hayır |
| WhatsApp Business Account ID | aynı kutu | hayır |
| Graph API sürümü | örnek curl'de görünür (örn. `v25.0`) | hayır |

## 2. Şablon (`set_teslim_bildirimi`)

`business.facebook.com/wa/manage/message-templates` → **Şablon oluşturun**

- **Kategori: Utility** — Marketing seçilirse hem pahalı olur hem kullanıcı pazarlama
  mesajlarını kapatmışsa iletilmez
- Ad: `set_teslim_bildirimi` · Dil: **Turkish**
- **Değişken türü: Numara** ⚠️ — "Ad" (isimli parametre) seçilirse kod çalışmaz,
  çünkü `sendWhatsAppTemplateMessage()` parametreleri sırayla gönderir
- **Başlık: Hiçbiri** · Alt bilgi: boş · Düğme: yok — kod yalnızca `body` bileşeni yollar
- Gövde:

```
Merhaba değerli {{1}},

Sitemiz üzerinden satın almış olduğunuz {{2}} setinizi, {{3}} tarihinde {{4}} saatleri arasında {{5}} adresinden teslim alabilirsiniz.

İyi günler dileriz.

AtlasELT – OkulPaketi
```

- Örnek değerler: `velimiz` · `Speakout B1+` · `25.09.2026` · `10:00-16:00` · `Denizli Koleji Ana Kampüs`

**Kontrol noktası:** durum *In review* → sonra *Approved*.

## 3. İş doğrulaması

Business settings → **Security Center → Start verification**

- İşletme türü: Ltd. Şti. / A.Ş. → **Özel Şirket**; şahıs işletmesi → **Şahıs Şirketi**
- Unvan, adres ve telefon **belgedeki ile birebir** aynı olmalı (en sık ret sebebi)
- Belge: vergi levhası, ticaret sicil gazetesi veya faaliyet belgesi

Doğrulanmadan önce numara başına 24 saatte **250 farklı kişi** sınırı vardır.

## 4. Kalıcı token

`business.facebook.com/settings/system-users`

1. **Ekle** → ad `okulpaketi-api`, rol **Yönetici**
2. **Varlık ekle** (token'dan ÖNCE):
   - Uygulamalar → uygulama → *Uygulamayı yönet*
   - WhatsApp hesapları → WABA → *Yönet*
3. **Yeni jeton oluştur** → süre **Süresiz**, izinler:
   `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`

Varlık eklemeden token üretilirse `#200 Permissions error` alınır.

Ayrıca: App Dashboard → **App settings → Basic → App secret** (webhook imzası için).

## 5. Supabase

1. Yeni proje — bölge **Central EU (Frankfurt)** (KVKK ve gecikme açısından)
2. **SQL Editor**'da sırayla çalıştır:
   `supabase/migrations/0001_init.sql`, sonra `supabase/migrations/0002_rls.sql`
3. **Authentication → Users → Add user** — *Auto Confirm User* açık.
   İlk kullanıcı trigger sayesinde otomatik `admin` olur.
4. **Authentication → Sign In / Providers → Email** → *Allow new users to sign up* **kapalı**
5. **Project Settings → API** → Project URL, `anon`, `service_role`

Supabase'in GitHub/Vercel entegrasyonları **gerekmez**, atlanabilir.

**Kontrol noktası:**

```sql
select
  (select count(*) from information_schema.tables  where table_schema = 'public') as tablo_ve_gorunum,
  (select count(*) from public.settings)                                          as ayar_satiri,
  (select count(*) from information_schema.routines where routine_schema = 'public') as fonksiyon;
```

`ayar_satiri = 1` olmalı.

## 6. Vercel

1. `vercel.com/new` → depoyu içe aktar
2. **Root Directory: `okulpaketi`** ⚠️ (repo kökü değil)
3. Ortam değişkenleri (Vercel Key kutusuna toplu yapıştırılabilir):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
META_GRAPH_API_VERSION=v25.0
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
CRON_SECRET=
```

`META_WEBHOOK_VERIFY_TOKEN` ve `CRON_SECRET` kendiniz üretirsiniz: `openssl rand -hex 32`.

4. Uygulama kodu varsayılan dalda değilse: **Settings → Git → Production Branch**'i
   ilgili dala çevirip **yeni bir commit** ile deploy tetikleyin. Eski deployment'a
   "Redeploy" demek işe yaramaz — aynı (yanlış daldaki) commit'i derler.

**Kontrol noktası:** `https://<proje>.vercel.app/` → `/giris`'e yönlenmeli, giriş sonrası
panel açılmalı, üstte **TEST MODU** rozeti görünmeli.

## 7. Webhook

Meta → **Step 2. Production setup → Configure Webhooks**

- Callback URL: `https://<proje>.vercel.app/api/webhooks/whatsapp`
- Verify token: `META_WEBHOOK_VERIFY_TOKEN` ile **aynı** değer
- **messages** alanına abone olun

⚠️ Uygulama *Unpublished* iken Meta yalnızca panelden gönderilen test webhook'larını
iletir; gerçek `delivered`/`read` olayları için uygulamanın **yayınlanması** gerekir.
Yayınlamak için gizlilik politikası URL'i, uygulama simgesi ve kategori istenir.

## 8. İlk test gönderimi

1. Panel → **Ayarlar** → mod **TEST**, test numarasını kaydedin
2. **WhatsApp bağlantısını test et** → şablon durumu `APPROVED` görünmeli
3. **Test mesajı gönder** → test numarasına ulaşmalı
4. **Excel Yükle** → `docs/ornek-liste.csv`
   - Beklenen: 7 satır → 3 geçerli, 1 tekrar, 3 hatalı
5. **Gönderime Hazırla** → onay diyaloğu → **Gönder**
6. Telefonda mesajı okuyun, detay sayfasını yenileyin:
   `Gönderildi → Teslim edildi → Okundu` ilerlemeli

## 9. Kendi numaranıza geçiş

Test numarasından kurumsal numaraya geçerken **yalnızca `META_PHONE_NUMBER_ID`**
değişir; WABA ID, şablon ve kod aynı kalır.

Dikkat: WhatsApp Business **uygulamasında** aktif bir numarayı Cloud API'ye bağlarsanız
o numarada uygulamayı kaybedersiniz — gelen müşteri cevapları webhook'a düşer ve bu
sistem gelen mesajları işlemez. Elle yazışma devam edecekse API için **ayrı bir hat**
kullanın.

Canlı gönderim için ayrıca: iş doğrulaması tamamlanmış olmalı ve WABA'ya **ödeme
yöntemi** eklenmiş olmalı.
