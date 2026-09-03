# Kilibik — Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni

**Sürüm:** 1 · **Yürürlük:** [TARİH] · **Dayanak:** 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ

> Bu metin, uygulama içinden (Ayarlar → Gizlilik → Aydınlatma Metni) ve `/legal/privacy-notice` adresinden her zaman erişilebilir. Yayın öncesi bir KVKK avukatı tarafından doğrulanacaktır.

## 1. Veri Sorumlusu

**[ŞİRKET UNVANI]** ("Şirket")
Adres: [ADRES]
MERSİS: [MERSİS NO] · KEP: [KEP ADRESİ] · E-posta: kvkk@[ALANADI]

## 2. Uygulamanın Amacı ve Temel İlke

Kilibik, birbirini karşılıklı olarak seçmiş **iki yetişkin** arasında küçük istekler paylaşmayı, son konumu **karşılıklı** olarak paylaşmayı ve tek dokunuşla "beni ara" hatırlatması göndermeyi sağlar.

Uygulama, bir tarafın diğerini gözetlediği bir araç **değildir**. Bir tarafın görebildiği her veri, diğer tarafa da aynen açıktır. Tek yönlü görünürlük, gizli mod veya habersiz bölge tanımı gibi hiçbir özellik bulunmaz.

## 3. İşlenen Kişisel Veriler, Amaçlar ve Hukuki Sebepler

| Veri kategorisi | Veri | İşleme amacı | Hukuki sebep (KVKK m.5) |
|---|---|---|---|
| Kimlik doğrulama | Telefon numarasının geri döndürülemez özeti (HMAC), tek kullanımlık SMS kodu | Hesap oluşturma ve girişi | m.5/2-c: sözleşmenin kurulması ve ifası |
| Yaş doğrulama | Yalnızca "18 yaş üzeri doğrulandı" bayrağı. **Doğum tarihi saklanmaz.** | 18 yaş altı kullanıcıların uygulamaya alınmaması | m.5/2-a: kanunlarda öngörülme; m.5/2-ç: hukuki yükümlülük |
| Eşleşme | Eşleşme kaydı (iki hesap kimliği, tarih), cihazınızda üretilen **açık** anahtar | Eşleşmenin kurulması ve uçtan uca şifreleme | m.5/2-c |
| İstekler | Cihazınızda şifrelenmiş istek metni, gönderim ve yanıt zamanı, yanıt durumu (Tamam/Olmaz/Sonra) | İsteklerin partnerinize iletilmesi | m.5/2-c |
| **Konum** | Cihazınızda şifrelenmiş **son** konum (sunucu içeriğini okuyamaz), en fazla **5 dakika** tutulur | Son konumunuzun partnerinizle karşılıklı paylaşılması | **m.5/1: açık rıza** (ayrı metinle alınır) |
| Bildirim | Push bildirim jetonu | "Yeni istek", "yeni konum", "beni ara" uyarıları | m.5/2-c |
| Paylaşım durumu | Konum paylaşımının açık/kapalı olduğu bilgisi (yalnızca güncel durum) | Partnerinize nötr durum gösterilmesi | m.5/2-c |
| Rıza kaydı | Rıza türü, sürümü ve tarihi | İspat yükümlülüğü | m.5/2-ç |

**Konum verisi hakkında önemli açıklama:** Konumunuz cihazınızda, yalnızca sizin ve partnerinizin cihazlarında bulunan ortak bir anahtarla şifrelenir. Sunucularımız yalnızca okunamayan bir veri paketi taşır ve bunu en fazla 5 dakika sonra kendiliğinden siler. **Konum geçmişi tutulmaz.** Şirket, konumunuzu hiçbir zaman göremez.

## 4. İşlenmeyen Veriler

Aşağıdakiler bilinçli olarak **işlenmez**:

- Konum geçmişi, rota, ziyaret edilen yerler
- Yanıt süresi, cevaplama oranı, "kaçırılan istek" sayısı gibi türetilmiş performans verileri
- Konum paylaşımını ne zaman kapatıp açtığınıza dair kayıt
- Reklam kimliği, analitik/izleme SDK'ları aracılığıyla toplanan davranış verileri
- Rehber, fotoğraf, mikrofon, sağlık verisi

## 5. Kişisel Verilerin Aktarılması

- **Partneriniz:** Şifreli istekler ve şifreli son konum, yalnızca eşleştiğiniz tek kişiye iletilir; içeriği yalnızca o çözebilir.
- **Barındırma sağlayıcısı:** Sunucular **[SAĞLAYICI ADI, ÜLKE]** üzerinde barındırılır. Sağlayıcı yalnızca veri işleyen sıfatıyla, Şirket adına ve talimatıyla hareket eder (bkz. Veri İşleyen Sözleşmesi). Sağlayıcı da konum içeriğini okuyamaz.
- **SMS sağlayıcısı:** Tek kullanımlık giriş kodu gönderimi için telefon numaranız **[SMS SAĞLAYICI]**'ya iletilir.
- **Bildirim altyapısı:** Apple (APNs) ve Google (FCM) yalnızca "yeni içerik var" türünde, içerik taşımayan sinyalleri iletir.
- **Yurt dışı aktarım:** [Eğer sağlayıcı yurt dışındaysa: KVKK m.9 kapsamında açık rıza / Kurul kararıyla yeterli koruma / standart sözleşme dayanağı burada belirtilir.]
- Reklam ağı, veri simsarı veya üçüncü taraf analitik hizmetlerine **hiçbir veri aktarılmaz**.

## 6. Toplama Yöntemi

Veriler, uygulamayı kullanmanız sırasında elektronik ortamda, otomatik yollarla toplanır. Konum, cihazınızın konum servisinden yalnızca izin verdiğiniz sürece ve hareket eşiği (yaklaşık 150 m) ile en fazla 2 dakikada bir alınır.

## 7. Saklama Süreleri

| Veri | Süre |
|---|---|
| Şifreli son konum | En fazla **5 dakika** (kendiliğinden silinir) |
| Şifreli istekler | **90 gün** veya eşleşme sonlanınca (hangisi önceyse) |
| Hesap verileri | Hesap silinene kadar; silme talebinden itibaren en geç **30 gün** içinde kalıcı olarak silinir |
| SMS kodu | 5 dakika |
| Davet kodu | 10 dakika |

Ayrıntı: Veri Saklama Tablosu.

## 8. KVKK m.11 Kapsamındaki Haklarınız

Şirkete başvurarak;
a) kişisel verilerinizin işlenip işlenmediğini öğrenme,
b) işlenmişse buna ilişkin bilgi talep etme,
c) işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
ç) yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,
d) eksik veya yanlış işlenmişse düzeltilmesini isteme,
e) KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme,
f) (d) ve (e) kapsamındaki işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme,
g) münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,
ğ) kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme
haklarına sahipsiniz.

**Hesabınızı silme hakkınızı uygulama içinden, üç dokunuşla kullanabilirsiniz:** Ayarlar → Hesabı sil → Evet, sil.

## 9. Başvuru

Başvurularınızı Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak;
- yazılı olarak yukarıdaki adrese,
- KEP adresimize,
- sistemimizde kayıtlı e-posta adresinizden kvkk@[ALANADI] adresine
iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır.

## 10. Rızanın Geri Alınması

Konum paylaşımı için verdiğiniz açık rızayı **her an, tek dokunuşla, gerekçe göstermeden** geri alabilirsiniz (Ayarlar → Konum paylaşımı). Rızanızı geri almanızın hiçbir sonucu yoktur: partnerinize bildirim gönderilmez, uygulamanın diğer işlevleri aynen çalışmaya devam eder.
