import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | AtlasELT – OkulPaketi',
  description:
    'AtlasELT Eğitim Danışmanlık Ltd. Şti. teslimat bilgilendirme sisteminin kullanım koşulları.',
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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-ink-200 pb-6">
        <p className="text-sm font-semibold text-ink-900">AtlasELT – OkulPaketi</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900">Kullanım Koşulları</h1>
        <p className="mt-2 text-sm text-ink-500">Son güncelleme: {UPDATED_AT}</p>
      </header>

      <Section title="1. Taraflar ve kapsam">
        <p>
          Bu koşullar, <strong>ATLASELT EĞİTİM DANIŞMANLIK LİMİTED ŞİRKETİ</strong> (“Şirket”)
          tarafından işletilen OkulPaketi teslimat bilgilendirme sisteminin kullanımına
          ilişkindir. Sistem iki taraflıdır: bilgilendirme mesajlarını gönderen Şirket
          personeli ve bu mesajları alan müşteriler.
        </p>
      </Section>

      <Section title="2. Hizmetin tanımı">
        <p>
          Sistem, Şirket’ten kitap veya set satın almış müşterilere, satın aldıkları ürünün
          teslim tarihi, saat aralığı ve teslim noktası hakkında WhatsApp üzerinden
          bilgilendirme mesajı gönderir. Mesajlar Meta’nın WhatsApp Business Platform altyapısı
          ve önceden onaylanmış şablonlar kullanılarak iletilir.
        </p>
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
          Sistem üzerinden <strong>pazarlama, tanıtım veya kampanya mesajı gönderilmez.</strong>{' '}
          Mesajlar yalnızca satın alma işlemi gerçekleştirmiş ve teslimat bekleyen müşterilere
          iletilir.
        </p>
      </Section>

      <Section title="3. Yönetim paneline erişim">
        <p>
          Yönetim paneli herkese açık değildir; yalnızca Şirket tarafından yetkilendirilmiş
          personel kullanıcı adı ve şifre ile erişebilir. Personel:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hesap bilgilerini üçüncü kişilerle paylaşamaz,</li>
          <li>Sisteme yalnızca Şirket’in teslimat süreçleri kapsamında veri yükleyebilir,</li>
          <li>Yüklediği verilerin doğruluğundan ve ilgili kişilerden usulüne uygun şekilde
            elde edilmiş olmasından sorumludur.</li>
        </ul>
      </Section>

      <Section title="4. Kabul edilebilir kullanım">
        <p>Sistem üzerinden aşağıdaki amaçlarla mesaj gönderilemez:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>İzinsiz toplu ileti (spam), reklam veya tanıtım</li>
          <li>Satın alma ilişkisi bulunmayan kişilere mesaj gönderimi</li>
          <li>Yanıltıcı, hukuka aykırı veya üçüncü kişilerin haklarını ihlal eden içerik</li>
        </ul>
        <p>
          Şirket, WhatsApp Business Mesajlaşma Politikası’na ve yürürlükteki mevzuata uygun
          hareket etmeyi taahhüt eder; aykırı kullanım tespit edilen personel hesabı kapatılır.
        </p>
      </Section>

      <Section title="5. Mesaj almayı durdurma">
        <p>
          Bilgilendirme mesajı almak istemeyen müşteriler, gelen mesaja <strong>“İPTAL”</strong>{' '}
          yazarak yanıt verebilir, <strong>info@atlaselt.com</strong> adresine talep iletebilir
          veya WhatsApp üzerinden numarayı engelleyebilir. Bu durumda teslimat bilgilendirmesi
          gönderilmez; teslimat bilgisi telefon veya e-posta yoluyla alınabilir.
        </p>
      </Section>

      <Section title="6. Hizmet sürekliliği">
        <p>
          Sistem, üçüncü taraf altyapılara (Meta WhatsApp Business Platform, barındırma ve
          veritabanı sağlayıcıları) bağımlıdır. Bu altyapılardan kaynaklanan kesinti, gecikme
          veya mesajın iletilememesi hâllerinde Şirket’in sorumluluğu, teslimat bilgisinin
          müşteriye başka bir kanaldan (telefon, e-posta) ulaştırılması ile sınırlıdır.
        </p>
      </Section>

      <Section title="7. Kişisel verilerin korunması">
        <p>
          Kişisel verilerin işlenmesine ilişkin esaslar{' '}
          <a href="/gizlilik" className="font-medium text-brand-600 underline">
            Gizlilik Politikası ve Aydınlatma Metni
          </a>{' '}
          içinde düzenlenmiştir ve bu koşulların ayrılmaz parçasıdır.
        </p>
      </Section>

      <Section title="8. Değişiklikler">
        <p>
          Şirket bu koşullarda değişiklik yapabilir. Güncel metin bu sayfada yayımlanır ve “son
          güncelleme” tarihi değiştirilir.
        </p>
      </Section>

      <Section title="9. Uygulanacak hukuk ve yetki">
        <p>
          Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Uyuşmazlıklarda Isparta Mahkemeleri
          ve İcra Daireleri yetkilidir.
        </p>
      </Section>

      <Section title="10. İletişim">
        <p>
          ATLASELT EĞİTİM DANIŞMANLIK LİMİTED ŞİRKETİ · Çünür Mah. 102 Cad. Teknokent No: 287 G,
          İç Kapı No: 101/A1, Merkez / ISPARTA · info@atlaselt.com · 0532 562 24 13
        </p>
      </Section>
    </main>
  );
}
