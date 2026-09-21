import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası ve Aydınlatma Metni | AtlasELT – OkulPaketi',
  description:
    'AtlasELT Eğitim Danışmanlık Ltd. Şti. teslimat bilgilendirme sisteminde kişisel verilerin işlenmesine ilişkin aydınlatma metni.',
  robots: { index: true, follow: true },
};

const UPDATED_AT = '21.09.2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-ink-100 last:border-0">
      <th scope="row" className="w-48 py-2 pr-4 text-left align-top font-medium text-ink-900">{label}</th>
      <td className="py-2 align-top">{value}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-ink-200 pb-6">
        <p className="text-sm font-semibold text-ink-900">AtlasELT – OkulPaketi</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900">
          Gizlilik Politikası ve Aydınlatma Metni
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          WhatsApp teslimat bilgilendirme sistemi · Son güncelleme: {UPDATED_AT}
        </p>
      </header>

      <Section title="1. Veri sorumlusu">
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca veri sorumlusu
          aşağıda bilgileri yer alan şirkettir.
        </p>
        <table className="w-full text-sm">
          <tbody>
            <Row label="Unvan" value="ATLASELT EĞİTİM DANIŞMANLIK LİMİTED ŞİRKETİ" />
            <Row label="Adres" value="Çünür Mah. 102 Cad. Teknokent No: 287 G, İç Kapı No: 101/A1, Merkez / ISPARTA" />
            <Row label="MERSİS No" value="0206 0666 9620 0014" />
            <Row label="Ticaret Sicil No" value="13156" />
            <Row label="Oda Sicil No" value="15458" />
            <Row label="Telefon" value="0532 562 24 13" />
            <Row label="E-posta" value="info@atlaselt.com" />
          </tbody>
        </table>
      </Section>

      <Section title="2. İşlenen kişisel veriler">
        <p>
          Web sitemizden kitap/set satın alan öğrenci ve velilere teslimat bilgilendirmesi
          gönderebilmek için yalnızca aşağıdaki veriler işlenir:
        </p>
        <table className="w-full text-sm">
          <tbody>
            <Row label="İletişim verisi" value="Cep telefonu numarası" />
            <Row label="Müşteri işlem verisi" value="Satın alınan set/kitap adı, teslim tarihi, teslim saat aralığı, teslim noktası" />
            <Row label="Alıcı bilgisi" value="Hitap türü (veli / öğrenci)" />
            <Row label="İşlem güvenliği verisi" value="Mesajın gönderim, iletim ve okunma zamanı; gönderim durumu ve varsa hata kodu" />
          </tbody>
        </table>
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
          Bu sistemde <strong>ad-soyad, T.C. kimlik numarası, adres, e-posta, ödeme bilgisi
          veya konum verisi işlenmez.</strong> Mesaj içeriği yalnızca yukarıdaki teslimat
          bilgilerinden oluşur.
        </p>
      </Section>

      <Section title="3. İşleme amaçları">
        <ul className="list-disc space-y-1 pl-5">
          <li>Satın alınan ürünün teslim tarihi, saati ve noktası hakkında bilgilendirme yapmak</li>
          <li>Bilgilendirmenin ulaşıp ulaşmadığını takip etmek, ulaşmadıysa yeniden denemek</li>
          <li>Aynı bilgilendirmenin mükerrer gönderilmesini engellemek</li>
        </ul>
        <p>
          Bu sistem üzerinden <strong>pazarlama, tanıtım veya kampanya mesajı gönderilmez.</strong>{' '}
          Gönderilen mesajlar WhatsApp Business Platform sınıflandırmasında “Utility (işlemsel
          bilgilendirme)” niteliğindedir ve yalnızca satın alma işlemi gerçekleştirmiş
          müşterilere iletilir.
        </p>
      </Section>

      <Section title="4. Hukuki sebep">
        <p>
          Kişisel verileriniz KVKK m.5/2-(c) uyarınca <em>“bir sözleşmenin kurulması veya
          ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel
          verilerin işlenmesinin gerekli olması”</em> hukuki sebebine dayanılarak, açık rızanız
          aranmaksızın işlenmektedir. Satın aldığınız ürünün tarafınıza teslim edilebilmesi için
          teslimat bilgilendirmesi sözleşmenin ifasının zorunlu bir parçasıdır.
        </p>
      </Section>

      <Section title="5. Aktarım">
        <table className="w-full text-sm">
          <tbody>
            <Row label="Meta Platforms Ireland Ltd." value="Mesajın WhatsApp üzerinden iletilmesi — İrlanda / ABD" />
            <Row label="Supabase" value="Kayıtların saklanması — Avrupa Birliği (Frankfurt)" />
            <Row label="Vercel Inc." value="Uygulamanın barındırılması — Avrupa Birliği / ABD" />
          </tbody>
        </table>
        <p>
          Mesajın iletilebilmesi için telefon numaranız ve mesaj parametreleri (set adı, teslim
          tarihi, saat aralığı, teslim noktası) Meta’ya aktarılır. Bu aktarım hizmetin niteliği
          gereği zorunludur ve KVKK m.9 kapsamında sözleşmenin ifası için gerekli olması hukuki
          sebebine dayanır.
        </p>
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
          Kişisel verileriniz <strong>reklam ağlarına, veri simsarlarına veya üçüncü taraf
          analitik sağlayıcılarına aktarılmaz</strong>; pazarlama amacıyla hiçbir kuruluşla
          paylaşılmaz.
        </p>
      </Section>

      <Section title="6. Saklama süresi">
        <p>
          Telefon numarası ve teslimat bilgileri ile gönderim durum kayıtları, teslimat
          tamamlandıktan sonra <strong>3 yıl</strong> süreyle saklanır. Süre sonunda veriler
          silinir veya anonim hâle getirilir. Yasal saklama yükümlülüğü bulunan hâllerde ilgili
          mevzuatta öngörülen süre uygulanır.
        </p>
      </Section>

      <Section title="7. İlgili kişinin hakları (KVKK m.11)">
        <p>Veri sorumlusuna başvurarak;</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>Silinmesini veya yok edilmesini isteme</li>
          <li>Düzeltme, silme ve yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme</li>
          <li>Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç doğmasına itiraz etme</li>
          <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p>
          haklarına sahipsiniz. Taleplerinizi <strong>info@atlaselt.com</strong> adresine
          e-posta ile veya yukarıdaki şirket adresine yazılı olarak iletebilirsiniz.
          Başvurularınız en geç <strong>30 gün</strong> içinde sonuçlandırılır.
        </p>
      </Section>

      <Section title="8. Mesaj almayı durdurma">
        <p>Teslimat bilgilendirmesi almak istemiyorsanız:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Gelen mesaja <strong>“İPTAL”</strong> yazarak yanıt verebilir,</li>
          <li>info@atlaselt.com adresine talebinizi iletebilir,</li>
          <li>WhatsApp üzerinden numaramızı engelleyebilirsiniz.</li>
        </ul>
        <p>
          Bu durumda teslimat bilgilendirmesi tarafınıza gönderilmez; teslimat süreci hakkında
          bilgi almak için telefon veya e-posta yoluyla bizimle iletişime geçmeniz gerekir.
        </p>
      </Section>

      <Section title="9. Veri güvenliği">
        <ul className="list-disc space-y-1 pl-5">
          <li>Tüm veri aktarımı TLS ile şifrelenir.</li>
          <li>Veritabanı erişimi satır bazlı güvenlik kuralları (RLS) ile sınırlandırılmıştır.</li>
          <li>Sisteme yalnızca yetkilendirilmiş personel, kullanıcı adı ve şifre ile erişebilir.</li>
          <li>WhatsApp erişim anahtarları yalnızca sunucu tarafında tutulur; hiçbir ekranda veya kayıtta görüntülenmez.</li>
          <li>Gelen bildirimler kriptografik imza doğrulamasından geçirilir.</li>
        </ul>
      </Section>

      <Section title="10. Çerezler">
        <p>
          Yönetim paneli yalnızca <strong>oturum çerezi</strong> kullanır; bu çerez giriş yapan
          personelin oturumunu sürdürmek için zorunludur. Reklam, izleme veya analitik çerezi
          kullanılmaz.
        </p>
      </Section>

      <Section title="11. Değişiklikler">
        <p>
          Bu politikada değişiklik yapılması hâlinde güncel metin bu sayfada yayımlanır ve “son
          güncelleme” tarihi değiştirilir.
        </p>
      </Section>

      <footer className="mt-10 border-t border-ink-200 pt-6 text-xs text-ink-500">
        ATLASELT EĞİTİM DANIŞMANLIK LİMİTED ŞİRKETİ ·
        Çünür Mah. 102 Cad. Teknokent No: 287 G, İç Kapı No: 101/A1, Merkez / ISPARTA
      </footer>
    </main>
  );
}
