# Kilibik — Veri Saklama ve İmha Tablosu

**Sürüm:** 1 · Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca hazırlanmıştır.

| # | Veri | Konum | Saklama süresi | Sürenin başlangıcı | İmha yöntemi | Uygulayan mekanizma |
|---|---|---|---|---|---|---|
| 1 | Şifreli son konum blob'u | Redis (bellek, diske yazma kapalı) | **300 saniye** | Her yükleme (yeni kayıt eskisinin üzerine yazar) | Otomatik TTL silme | `SET ... EX 300`; `LOCATION_TTL_SECONDS` 600'ü aşamaz |
| 2 | Konum verisi (düz metin) | **Hiçbir yerde** | 0 | — | — | Sunucu yalnızca şifreli blob görür |
| 3 | Konum geçmişi | **Tutulmaz** | — | — | — | Kalıcı tablo yok; test `redlines.test.ts` #1, #7 |
| 4 | Şifreli istek metni, durum, zaman damgaları | PostgreSQL `requests` | **90 gün** | İstek oluşturulması | Fiziksel silme (`DELETE`) | Saatlik `runRetention`; ayrıca eşleşme bitince veya hesap silinince anında |
| 5 | Eşleşme kaydı | PostgreSQL `pairs` | Eşleşme aktif olduğu sürece; sonlandırılınca `dissolved_at` ile işaretlenir, hesap silinince kaskad silinir | — | Fiziksel silme (hesapla birlikte) | Hesap purge job |
| 6 | Telefon numarası özeti (HMAC) | PostgreSQL `users` | Hesap silinene kadar | Kayıt | Silme talebinde anında rastgele değerle değiştirilir; satır ≤30 gün içinde silinir | `DELETE /account` + purge job |
| 7 | Telefon numarası (düz) | **Saklanmaz**; yalnızca SMS gönderimi sırasında geçici bellekte | 0 | — | — | — |
| 8 | Doğum tarihi | **Saklanmaz**; yalnızca `birth_date_verified` bayrağı | — | — | — | Kayıt sırasında sunucu belleğinde karşılaştırılır, yazılmaz |
| 9 | Açık anahtar | PostgreSQL `users.public_key` | Hesap silinene kadar | Yükleme | Silme talebinde anında `NULL` | `DELETE /account` |
| 10 | Özel anahtar | Yalnızca cihaz (Keychain/Keystore) | Uygulama silinene kadar | — | Cihaz tarafından | Sunucuya hiç gönderilmez |
| 11 | Push bildirim jetonu | PostgreSQL `users.push_token` | Hesap silinene / çıkış yapılana kadar | Kayıt | Anında `NULL` | `DELETE /me/push-token`, `DELETE /account` |
| 12 | Konum paylaşımı durumu | PostgreSQL `sharing_state` | Yalnızca güncel değer; geçmiş yok | — | Hesap silinince anında | Tek satır, üzerine yazılır |
| 13 | Rıza kaydı (tür, sürüm, tarih) | PostgreSQL `consents` | Hesap silinene kadar (ispat) | Rıza | Rıza geri alınınca / hesap silinince anında | Tek satır; geri alma satırı siler, geçmiş yok |
| 14 | Tek kullanımlık SMS kodu | Redis | **5 dakika** veya doğrulanınca | Talep | TTL / anında silme | `otp:*` |
| 15 | Davet kodu | Redis | **10 dakika** veya kullanılınca | Üretim | TTL / anında silme | `invite:*` |
| 16 | Hız sınırı sayaçları (OTP, istek, konum, dürtme) | Redis | ≤ 1 saat / 15 dk | İlk istek | TTL | Yalnızca kötüye kullanımı engeller, raporlanmaz |
| 17 | Silinmiş hesap satırı (anonim) | PostgreSQL `users` | **≤ 30 gün** | `deleted_at` | Fiziksel silme (kaskad) | Saatlik purge job |
| 18 | Sunucu erişim logları | Barındırma sağlayıcısı | [SÜRE — sağlayıcıya göre; önerilen ≤ 30 gün] | — | Sağlayıcı rotasyonu | İstek gövdeleri (blob, istek metni) hiçbir zaman loglanmaz |
| 19 | Türetilmiş metrikler (yanıt süresi, oran, skor) | **Üretilmez** | — | — | — | Test `redlines.test.ts` #5 |

## Periyodik imha

- Otomatik: TTL'ler (satır 1, 14, 15, 16) ve saatlik `runRetention` işi (satır 4, 17).
- Manuel kontrol: `npm run jobs -w server` çalıştırılarak imha işi tetiklenebilir.
- Yönetmelik m.11 uyarınca periyodik imha süresi **6 ayı** aşmaz; uygulamada en uzun süre 90 gündür.
