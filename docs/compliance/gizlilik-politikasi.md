# Kilibik Gizlilik Politikası

**Sürüm:** 1 · **Güncelleme:** [TARİH]

Bu politika, Kilibik uygulamasının hangi verileri, ne kadar süreyle, kimlerin erişimiyle işlediğini ve verilerinizi nasıl silebileceğinizi sade bir dille açıklar. Hukuki dayanaklar için Aydınlatma Metni'ne bakın.

## Tek cümleyle

Kilibik, iki yetişkinin **karşılıklı** olarak küçük istekler, son konum ve "beni ara" hatırlatmaları paylaştığı bir uygulamadır. Sunucularımız konumunuzu ve istek metinlerinizi **okuyamaz**; konum en fazla 5 dakika tutulur ve geçmişi asla saklanmaz.

## Hangi veriler?

| Veri | Nerede? | Ne kadar? | Kim görebilir? |
|---|---|---|---|
| Telefon numaranızın özeti (numaranın kendisi değil) | Sunucu | Hesap silinene kadar | Kimse — geri döndürülemez özet |
| 18 yaş üzeri doğrulandı bayrağı | Sunucu | Hesap silinene kadar | Yalnızca sistem |
| Açık anahtarınız | Sunucu | Hesap silinene kadar | Partneriniz |
| Özel anahtarınız | **Yalnızca cihazınız** (Keychain / Keystore) | Uygulama silinene kadar | Kimse |
| Şifreli istekler | Sunucu | 90 gün veya eşleşme bitene kadar | Yalnızca partneriniz çözebilir |
| Şifreli son konum | Sunucu belleği (Redis) | **En fazla 5 dakika** | Yalnızca partneriniz çözebilir |
| Konum paylaşımı açık/kapalı | Sunucu | Yalnızca güncel durum | Partneriniz (nötr durum olarak) |
| Push bildirim jetonu | Sunucu | Hesap silinene / çıkış yapılana kadar | Apple / Google bildirim altyapısı |
| Rıza kaydı (tür, sürüm, tarih) | Sunucu | Hesap silinene kadar | Yalnızca sistem |

## Neler yapılmaz?

- Konum geçmişi tutulmaz. Rota, ziyaret, "nerede ne kadar kaldı" yoktur.
- Kimse kimseyi tek yönlü göremez. Gizli mod, görünmez ol, habersiz bölge uyarısı yoktur.
- Yanıt süresi, cevaplama oranı, kaçırılan istek sayısı gibi hiçbir istatistik üretilmez veya gösterilmez.
- Konum paylaşımını kapattığınızda partnerinize bildirim gitmez; ne zaman kapattığınız kaydedilmez.
- Reklam, analitik, çökme raporlama veya başka üçüncü taraf SDK'lar bulunmaz. Konum verisi hiçbir üçüncü tarafa gitmez.
- Sessiz modunuzu delen bildirim gönderilmez.
- 18 yaşından küçükler hesap açamaz.

## Konum tam olarak nasıl işleniyor?

1. Cihazınız konumu alır (hareket ettiğinizde, en fazla 2 dakikada bir).
2. Cihazınız, yalnızca sizin ve partnerinizin cihazında bulunan ortak anahtarla konumu şifreler.
3. Sunucu, okuyamadığı bu paketi 5 dakikalık bir sayaçla bellekte tutar; yeni paket eskisinin üzerine yazılır.
4. Partnerinizin cihazı paketi çeker, çözer ve haritada gösterir.
5. 5 dakika içinde yeni paket gelmezse sunucudaki kayıt kendiliğinden yok olur; partnerinizin haritasında "konum bilgisi eski" görünür.

## Bildirimler

Bildirim içeriği cihazınızda üretilir. Sunucudan gelen sinyal yalnızca "yeni istek / yeni konum / beni ara" türünü taşır; istek metni veya konum bildirimde yolculuk etmez. Bildirimler telefonunuzun standart kurallarına (sessiz, rahatsız etmeyin) uyar.

## Verilerinizi silmek

**Ayarlar → Hesabı sil → Evet, sil.** Üç dokunuş, uygulama içinden, şifre veya e-posta gerekmez.

Silme anında: eşleşmeniz sonlandırılır, tüm istekler, rıza kayıtları, paylaşım durumu, anahtarınız ve bildirim jetonunuz silinir, sunucu belleğindeki şifreli konum silinir, hesabınız anonimleştirilir. Kalan hesap satırı en geç **30 gün** içinde kalıcı olarak silinir. Partnerinizin ekranında yalnızca "eşleşme sona erdi" görünür.

Eşleşmeyi sonlandırmak (hesabı silmeden): Ayarlar → Eşleşmeyi sonlandır. Tüm istekler ve iki tarafın şifreli konumu silinir.

## Haklarınız ve iletişim

KVKK m.11 kapsamındaki haklarınız ve başvuru yolları Aydınlatma Metni'nde açıklanmıştır.
İletişim: kvkk@[ALANADI] · [ŞİRKET UNVANI], [ADRES]

## Değişiklikler

Bu politika değiştiğinde sürüm numarası artar ve uygulama sizi yeni sürümü okumaya yönlendirir. Konum rızasını etkileyen bir değişiklikte rıza yeniden istenir.
