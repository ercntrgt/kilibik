# Veri İşleyen Sözleşmesi (Taslak) — Barındırma Sağlayıcısı

> KVKK m.12 ve Kişisel Verilerin Silinmesi Yönetmeliği çerçevesinde, veri sorumlusu **[ŞİRKET UNVANI]** ile veri işleyen **[SAĞLAYICI UNVANI]** arasındaki ana hizmet sözleşmesinin eki olarak düzenlenmiştir. Yayın öncesi hukuk danışmanı tarafından tamamlanacaktır.

## 1. Taraflar ve Roller

- **Veri Sorumlusu:** [ŞİRKET UNVANI], [ADRES], MERSİS [NO]
- **Veri İşleyen:** [SAĞLAYICI UNVANI], [ADRES]
- Veri İşleyen, kişisel verileri yalnızca Veri Sorumlusu'nun yazılı talimatları doğrultusunda ve bu sözleşmede belirtilen amaçla işler.

## 2. İşlemenin Konusu ve Niteliği

| Unsur | Açıklama |
|---|---|
| Amaç | Kilibik uygulamasının sunucu, veritabanı (PostgreSQL) ve bellek deposu (Redis) hizmetlerinin barındırılması |
| İşleme türü | Depolama, iletim, yedekleme (yalnızca PostgreSQL için), silme |
| Veri kategorileri | Telefon numarası özeti (HMAC), 18+ doğrulama bayrağı, açık anahtar, push jetonu, eşleşme kaydı, **şifreli** istek metinleri, **şifreli** son konum (yalnızca bellek, ≤5 dk), paylaşım durumu, rıza kayıtları |
| Özel nitelikli veri | **Yok** |
| İlgili kişi grupları | 18 yaş üzeri uygulama kullanıcıları |
| Süre | Ana sözleşme süresince |

**Önemli:** Konum ve istek metni içerikleri Veri Sorumlusu tarafından dahi çözülemeyen şekilde uçtan uca şifrelidir. Veri İşleyen bu içeriklere hiçbir koşulda erişemez.

## 3. Veri İşleyen'in Yükümlülükleri

1. Verileri yalnızca belgelenmiş talimatla işler; talimatın mevzuata aykırı olduğunu düşünürse derhal bildirir.
2. Veri işleyen personeli gizlilik yükümlülüğü altına alır ve erişimi görev gereği zorunlu kişilerle sınırlar.
3. KVKK m.12 kapsamında uygun teknik ve idari tedbirleri alır; asgari olarak:
   - aktarımda TLS 1.2+, diskte şifreleme,
   - erişim kontrolü, çok faktörlü kimlik doğrulama, erişim loglaması,
   - ağ segmentasyonu, güvenlik yamalarının düzenli uygulanması,
   - Redis örneği için **kalıcılığın kapalı** (`save ""`, `appendonly no`) tutulması — konum blob'ları diske yazılmaz.
4. Alt işleyen kullanmadan önce Veri Sorumlusu'nun yazılı onayını alır; alt işleyenlere aynı yükümlülükleri yansıtır. Mevcut alt işleyenler: [LİSTE].
5. Verileri **[ÜLKE/BÖLGE]** dışına aktarmaz. Yurt dışı aktarım yalnızca KVKK m.9 şartları sağlandığında ve yazılı onayla yapılır.
6. İlgili kişilerin m.11 taleplerinin karşılanmasında Veri Sorumlusu'na makul yardımı sağlar.
7. **Veri ihlali** hâlinde, öğrendiği andan itibaren en geç **24 saat** içinde Veri Sorumlusu'na bildirir (Veri Sorumlusu'nun Kurul'a 72 saat içinde bildirim yükümlülüğü için).
8. Hizmetin sona ermesinde Veri Sorumlusu'nun tercihine göre tüm verileri iade eder veya siler; yedekler dahil silme işlemini en geç **30 gün** içinde tamamlar ve yazılı olarak teyit eder.
9. Yükümlülüklere uyumu gösteren bilgileri sağlar; yılda bir denetime veya bağımsız denetim raporuna (ISO 27001 / SOC 2) imkân tanır.
10. Veri Sorumlusu'nun **veri saklama tablosunda** belirtilen sürelerin uygulanabilmesi için gereken silme ve TTL mekanizmalarının çalışmasını engellemez.

## 4. Veri Sorumlusu'nun Yükümlülükleri

1. Hukuka uygun işleme dayanaklarını (sözleşme, açık rıza) sağlar ve aydınlatma yükümlülüğünü yerine getirir.
2. Talimatları yazılı verir; sistem yapılandırmasını (TTL, saklama süreleri) belgeler.
3. VERBİS kaydını (yükümlüyse) tutar.

## 5. Yedekleme

- PostgreSQL yedekleri en fazla **[7] gün** saklanır ve şifrelenir.
- Redis için **yedek alınmaz**; bellek içi verinin kalıcı kopyası bulunmaz.
- Yedeklerdeki kişisel veriler, yedek rotasyonu tamamlanınca kendiliğinden yok olur; hesap silme talebi yedeklerin rotasyon süresi kadar gecikmeyle tamamlanmış sayılır (≤30 gün toplam).

## 6. Sorumluluk ve Tazminat

Veri İşleyen'in bu sözleşmeye aykırılığından doğan idari para cezaları ve üçüncü kişi tazminat talepleri Veri İşleyen'e rücu edilir. [Sınırlar ana sözleşmeye göre belirlenir.]

## 7. Süre ve Fesih

Ana sözleşme ile birlikte yürürlüğe girer ve onunla sona erer. Madde 3/8 sona ermeden sonra da geçerlidir.

## 8. Uygulanacak Hukuk

Türkiye Cumhuriyeti hukuku; [İL] mahkemeleri ve icra daireleri yetkilidir.

---
Veri Sorumlusu adına: ____________________ · Tarih: ________
Veri İşleyen adına: ____________________ · Tarih: ________
