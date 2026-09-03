# App Store Connect — App Privacy ("Nutrition Label") Cevap Taslağı

> App Store Connect → App Privacy bölümü için gerekçeli cevaplar.

## Veri toplama beyanı
**"Yes, we collect data from this app."**

## Toplanan veri türleri

| Kategori | Veri türü | Kullanım amacı | Kullanıcıya bağlı mı? | Takip amacıyla mı? |
|---|---|---|---|---|
| Location | **Precise Location** | App Functionality | Evet (yalnızca eşleşilen kişiye, şifreli) | **Hayır** |
| Contact Info | **Phone Number** | App Functionality (hesap) | Evet (yalnızca HMAC özeti saklanır) | Hayır |
| User Content | **Other User Content** (şifreli istekler) | App Functionality | Evet | Hayır |
| Identifiers | **Device ID** — yalnızca push bildirim jetonu | App Functionality | Evet | Hayır |
| Other Data | **Other Data Types** — 18+ doğrulama bayrağı, rıza kaydı | App Functionality / Legal | Evet | Hayır |

Toplanmayanlar: Health & Fitness, Financial Info, Contacts, Browsing/Search History, Purchases, Usage Data, Diagnostics, Sensitive Info, Photos/Videos, Audio, Name, Email, Physical Address.

## "Data Used to Track You"
**Hiçbiri.** Uygulama reklam ağı, veri simsarı veya üçüncü taraf analitik ile veri paylaşmaz. `NSUserTrackingUsageDescription` yoktur; ATT izni istenmez.

## Precise Location için ek notlar (inceleme notlarına eklenecek)
- Konum yalnızca kullanıcının **ayrı bir ekranda, önceden işaretlenmemiş** kutuyla açık rıza vermesi ve konum paylaşımını açması hâlinde toplanır.
- Cihazda XChaCha20-Poly1305 ile şifrelenir; sunucu içeriği okuyamaz. Sunucuda yalnızca ≤ 5 dakika, bellekte tutulur. **Geçmiş tutulmaz.**
- Paylaşım her zaman karşılıklıdır ve tek dokunuşla kapatılır; karşı tarafa bildirim gitmez.
- Arka plan konumu (`UIBackgroundModes: location`, "Always" izni) isteğe bağlıdır; "When In Use" veya reddedilmiş izinle uygulama tüm diğer işlevleriyle çalışır.

## Info.plist izin açıklamaları (önerilen metinler)
- `NSLocationWhenInUseUsageDescription`: "Son konumunuzu, siz isterseniz, partnerinizle karşılıklı olarak paylaşmak için. Konum geçmişi tutulmaz."
- `NSLocationAlwaysAndWhenInUseUsageDescription`: "Uygulama kapalıyken de son konumunuzun güncel kalması için. İstediğiniz an kapatabilirsiniz; partnerinize bildirim gitmez."
- Critical Alerts entitlement'ı (`com.apple.developer.usernotifications.critical-alerts`): **istenmez**.

## Hesap silme (App Store Review Guideline 5.1.1(v))
Uygulama içinden: Ayarlar → Hesabı sil → Evet, sil. Tam silme; 30 gün içinde kalıcı. İnceleme notlarına test hesabı ve akış eklenir.

## Yaş derecelendirmesi
17+ (Unrestricted Web Access yok; "Made for Kids" değil). Kayıtta 18 yaş doğrulaması yapılır.
