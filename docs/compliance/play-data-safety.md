# Google Play Console — Data Safety (Veri Güvenliği) Formu Cevap Taslağı

> Form Play Console'da doldurulur; bu belge cevapların gerekçeli taslağıdır. Yayın öncesi güncel form alanlarıyla karşılaştırılır.

## Genel sorular

| Soru | Cevap | Gerekçe |
|---|---|---|
| Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu? | **Evet** | Telefon özeti, şifreli konum, şifreli mesajlar |
| Toplanan tüm kullanıcı verileri aktarımda şifreleniyor mu? | **Evet** | TLS; ayrıca konum ve mesajlar uçtan uca şifreli |
| Kullanıcıların veri silme talebi için bir yol sunuyor musunuz? | **Evet** | Uygulama içi: Ayarlar → Hesabı sil → Evet, sil. Ayrıca kvkk@[ALANADI] |
| Hesap silme URL'si | https://[ALANADI]/hesap-silme | Uygulama içi akışı anlatan sayfa |
| Bağımsız güvenlik incelemesi | Hayır (v1) | — |
| Google Play Ailelere Yönelik Politika | Kapsam dışı; 18+ | — |

## Veri türleri

### Konum
| Alan | Cevap |
|---|---|
| Yaklaşık konum | Hayır |
| **Kesin konum** | **Toplanıyor**, paylaşılıyor (yalnızca kullanıcının eşleştiği tek kişiyle) |
| Zorunlu mu? | **İsteğe bağlı** — kullanıcı açık rıza vermeden ve paylaşımı açmadan toplanmaz |
| Amaç | Uygulama işlevselliği (partnerle karşılıklı son konum paylaşımı) |
| Geçici (ephemeral) işleme | **Evet** — sunucuda yalnızca bellekte, ≤ 5 dakika, şifreli; kalıcı depolama yok |
| Şifreli mi? | Evet, uçtan uca; sunucu okuyamaz |
| Not | Konum geçmişi tutulmaz. Paylaşım her an kapatılabilir. Reklam/analitik amacı yok. |

### Kişisel bilgiler
| Alan | Cevap |
|---|---|
| Ad, e-posta, adres | Toplanmıyor |
| **Telefon numarası** | Toplanıyor (yalnızca geri döndürülemez HMAC özeti saklanır; düz numara yalnızca SMS kodu gönderimi için anlık kullanılır) — Zorunlu — Amaç: hesap yönetimi |
| Diğer kişisel bilgi (18+ doğrulama bayrağı) | Toplanıyor — Zorunlu — Amaç: yasal uyum. Doğum tarihi saklanmaz. |

### Mesajlar
| Alan | Cevap |
|---|---|
| **Diğer uygulama içi mesajlar** (istekler) | Toplanıyor, paylaşılıyor (yalnızca eşleşilen kişiyle) — İsteğe bağlı — Amaç: uygulama işlevselliği — **Uçtan uca şifreli**, sunucu okuyamaz — 90 gün sonra silinir |

### Uygulama etkinliği, uygulama bilgileri ve performansı, cihaz kimlikleri
| Alan | Cevap |
|---|---|
| Uygulama etkileşimleri, arama geçmişi, diğer içerik | **Toplanmıyor** |
| Çökme günlükleri, tanılama | **Toplanmıyor** (üçüncü taraf çökme SDK'sı yok) |
| Cihaz veya diğer kimlikler | **Push bildirim jetonu** toplanıyor — Zorunlu (bildirim için) — Amaç: uygulama işlevselliği. Reklam kimliği **toplanmıyor**. |

### Toplanmayan diğer kategoriler
Finansal bilgi, sağlık ve fitness, fotoğraf/video, ses dosyaları, dosyalar/dokümanlar, takvim, kişiler, web tarama geçmişi: **Toplanmıyor.**

## Paylaşım beyanı

Veriler yalnızca (1) kullanıcının eşleştiği tek kişiyle (şifreli olarak) ve (2) veri işleyen sıfatıyla barındırma sağlayıcısıyla paylaşılır. Üçüncü taraf reklam/analitik ortağı **yoktur**. FCM yalnızca içeriksiz "kind" sinyali taşır.

## İzinler (AndroidManifest)

| İzin | Gerekçe | Play beyanı |
|---|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Karşılıklı son konum paylaşımı | Konum |
| `ACCESS_BACKGROUND_LOCATION` | Uygulama arkadayken de son konumun güncellenmesi (kullanıcı isterse) | **Arka plan konumu beyanı** ve video gerekir; temel özellik: "partnerle karşılıklı son konum paylaşımı". Reddedilirse uygulama çalışmaya devam eder. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Android 14+ arka plan konum servisi | Ön plan servisi türü: location |
| `POST_NOTIFICATIONS` | Bildirimler | — |
| `INTERNET` | — | — |
| `USE_FULL_SCREEN_INTENT` | **İstenmez** | — |
