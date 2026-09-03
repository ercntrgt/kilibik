# KIRMIZI ÇİZGİLER — pazarlığa kapalı

Bu liste spesifikasyonun §2'sidir. Bir özellik buraya çarpıyorsa **uygulanmaz**; bunun yerine neden uygulanmadığı raporlanır. Her madde için kodda/testte nerede kanıtlandığı belirtilmiştir.

| # | Kural | Kanıt |
|---|---|---|
| 1 | **Konum geçmişi tutulmaz.** Ne sunucuda, ne cihazda kalıcı olarak. Yalnızca süreli "son konum". | Şemada konum tablosu yok (`server/migrations/001_init.sql`); Redis `SET ... EX`; `redlines.test.ts` #1, #2, #7. Cihazda `LocationController` yalnızca son fix'i bellekte tutar. |
| 2 | **Asimetrik görünürlük yok.** Tek yönlü izleme, gizli mod, "görünmez ol" yok. | Partner hakkında görülebilen alanlar kapalı liste (`/partner`, `/location/partner`); `redlines.test.ts` #4 iki yönü birebir karşılaştırır, #7 kaynakta ghost/invisible/stealth arar. |
| 3 | **Tepki süresi / cevaplama istatistiği yok.** | `responded_at` yalnızca gösterim için; hiçbir `avg/percentile` yok; `redlines.test.ts` #5 hem yanıt anahtarlarını hem kaynağı tarar. |
| 4 | **Yasak bölge / gizli geofence yok.** | Sunucuda ve mobilde geofence kodu yok; #7 kaynak taraması. Yerler (v2) tamamen cihazda ve iki taraflı olacaktır (`docs/ARCHITECTURE.md`). |
| 5 | **Rızayı geri almanın cezası yok.** Paylaşım kapatılınca partnere bildirim gitmez; nötr "Konum paylaşımı kapalı" gösterilir. | `PUT /sharing` ve `DELETE /me/consents/location` `notify()` çağırmaz; `redlines.test.ts` #3, `location.test.ts`. Kapatan taraf partnerini görmeye devam eder (karşılıklılık şartı yok). |
| 6 | **Kapatılamayan / reddedilemeyen istek yok.** Her isteğin en az üç yanıtı: Tamam / Olmaz / Sonra. | `REQUEST_RESPONSES` sabiti; şema `check`; `requests.test.ts`. |
| 7 | **Sessiz modu delen bildirim yok.** iOS Critical Alerts yok, Android `USE_FULL_SCREEN_INTENT` yok. | `redlines.test.ts` #6 manifest/entitlements/kaynak taraması; push kodu `interruption-level` içermez. |
| 8 | **Reklam ağı, analytics SDK'sı, üçüncü taraf izleyici yok.** Konum verisi hiçbir üçüncü tarafa gitmez. | `redlines.test.ts` #8 bağımlılık taraması; Firebase yalnızca Messaging, analytics kapalı (`firebase_analytics_collection_deactivated`). |
| 9 | **18 yaş altı kullanıcı yok.** | `isAdult()`; `auth.test.ts`. Doğum tarihi saklanmaz, yalnızca bayrak. |

## Ek tasarım kararları (kırmızı çizgilerden türetilen)

- **Sunucu kördür:** İstek metni de şifreli saklanır. Telefon numarası HMAC özetiyle saklanır. Doğum tarihi hiç yazılmaz.
- **Push payload'ı içerik taşımaz:** yalnızca `kind`. Metin cihazda (`loc-key` / yerel bildirim) üretilir.
- **Karşılıklılık şartı bilerek yok:** "Sen paylaşmazsan onu göremezsin" kuralı, rızayı geri almanın cezası olurdu (madde 5).
- **Keepalive:** Sabit duran kullanıcı için en geç 4 dakikada bir "hâlâ buradayım" gönderilir ki 5 dk TTL boşa dolmasın; yine de 2 dakikadan sık gönderim yoktur.
- **Rıza kaydı** (`consents`): KVKK ispat yükü için tür/sürüm/tarih tutulur; geri alma satırı siler, geçmiş tutulmaz.
