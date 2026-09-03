# Fazlar ve durum

| Faz | Kapsam | Durum |
|---|---|---|
| 1 | Kimlik (telefon+OTP, 18+), eşleşme (davet kodu/QR), X25519 anahtar değişimi, uçtan uca şifreli istek akışı | ✅ Sunucu + testler + mobil ekranlar |
| 2 | Şifreli konum, TTL'li Redis, harita, tek dokunuşla kapatma | ✅ Sunucu + testler + mobil ekranlar |
| 3 | Dürtme, bildirimler (APNs/FCM, içeriksiz payload), cooldown ve hız sınırları | ✅ Sunucu + testler + mobil; gerçek APNs/FCM kimlik bilgisiyle uçtan uca doğrulama bekliyor |
| 4 | Uyum artefaktları, store formları, hesap silme akışı | ✅ `docs/compliance/*`, `DELETE /account`, 3 dokunuş |
| 5 | Kapalı beta, yayın başvurusu | ⏳ Yapılacaklar: kurumsal geliştirici hesapları, KVKK avukat onayı, `[ŞİRKET UNVANI]` vb. yer tutucuların doldurulması, APNs/FCM anahtarları, SMS sağlayıcısı, Play arka plan konum beyanı videosu, TestFlight / Play kapalı test grubu |

## Uygulanmayan / ertelenen (gerekçeli)
- **Apple / Google Sign-In:** Spesifikasyon "veya" dediği için v1'de yalnızca telefon+OTP. Şema (`auth_provider`) hazır.
- **Yerler (v2):** Spesifikasyon gereği v2. Tasarım `docs/ARCHITECTURE.md`'de.
- **Karşılıklılık şartı** ("sen paylaşmazsan göremezsin"): bilerek yok — rızayı geri almanın cezası olurdu (kırmızı çizgi 5).
