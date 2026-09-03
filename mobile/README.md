# Kilibik Mobil (React Native, bare workflow)

## Kurulum

```bash
cd mobile
npm install
# iOS (macOS)
cd ios && pod install && cd ..
npm run ios
# Android
npm run android
```

Sunucu adresi: `src/config.ts` → `API_BASE_URL` (Android emülatör `http://10.0.2.2:3000`, iOS simülatör `http://localhost:3000`).

## Native yapılandırma gereksinimleri

### Firebase (yalnızca Messaging)
- `android/app/google-services.json` ve `ios/GoogleService-Info.plist` eklenir (repo'ya konmaz).
- Analytics **kapalı** tutulur: `AndroidManifest.xml` içinde `firebase_analytics_collection_deactivated=true`, `Info.plist` içinde `FirebaseAnalyticsCollectionDeactivated=true`, `FirebaseDataCollectionDefaultEnabled=false`. Yalnızca `@react-native-firebase/messaging` bağımlılığı vardır; analytics/crashlytics paketleri **eklenmez**.
- iOS: Push Notifications capability + Background Modes → Remote notifications, Location updates. **Critical Alerts istenmez.**
- iOS `Localizable.strings` içine push metinleri (payload metin taşımaz):
  ```
  "PUSH_NUDGE" = "Beni ara";
  "PUSH_REQUEST" = "Yeni istek";
  "PUSH_REQUEST_RESPONSE" = "İsteğine yanıt geldi";
  "PUSH_PAIR" = "Eşleştiniz";
  ```

### Konum
- Android: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`. `USE_FULL_SCREEN_INTENT` **yok**.
- iOS: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` (metinler `docs/compliance/apple-app-privacy.md`).
- Arka plan izni reddedilirse yalnızca ön planda paylaşılır; tamamen reddedilirse paylaşım kapalı kalır, uygulamanın geri kalanı çalışır (`src/logic/permissions.ts`).

### Harita
- `react-native-maps`: Android için `AndroidManifest.xml` içine `com.google.android.geo.API_KEY`; iOS Apple Maps varsayılan.

## Yapı

| Dizin | İçerik |
|---|---|
| `src/logic/` | Saf mantık: rıza durumu, konum gönderim politikası (150 m / 2 dk / keepalive), izin → yetenek eşlemesi, 3 dokunuşla silme akışı. Sunucu test paketinde test edilir. |
| `src/crypto/` | libsodium adaptörü, Keychain/Keystore'da anahtar çifti, zarf şifreleme |
| `src/location/` | Konum denetleyicisi (geçmiş tutmaz; yalnızca son fix bellekte) |
| `src/push/` | FCM jetonu, cihazda üretilen bildirim metinleri, sessiz tür yenilemeleri |
| `src/screens/onboarding/` | Yaş → aydınlatma → **ayrı** açık rıza → telefon → OTP → eşleşme |
| `src/screens/` | İstekler, harita, dürt, ayarlar, uyum metinleri |

## Bilinçli olarak olmayanlar
Konum geçmişi, tek yönlü görünürlük, gizli mod, geofence, yanıt istatistikleri, critical alert / full-screen intent, analytics SDK, reklam. Bkz. `docs/RED_LINES.md`.

## Xcode'da bir kez yapılacaklar
- `ios/Kilibik/tr.lproj/Localizable.strings` ve `Base.lproj` dosyalarını projeye ekleyin (Add Files → "Create groups").
- Signing & Capabilities: Push Notifications, Background Modes (Location updates, Remote notifications). `Kilibik.entitlements` `CODE_SIGN_ENTITLEMENTS` ile bağlıdır.
- `GoogleService-Info.plist` dosyasını `ios/` altına ekleyin.

## Android'de bir kez yapılacaklar
- `android/app/google-services.json` ekleyin.
- Harita anahtarı: `android/gradle.properties` veya `~/.gradle/gradle.properties` içine `MAPS_API_KEY=...`.
