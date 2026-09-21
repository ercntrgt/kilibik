import { Card } from '@/components/ui';
import UploadForm from '@/components/UploadForm';
import { TEMPLATE_BODY } from '@/lib/message';

export const metadata = { title: 'Excel Yükle | AtlasELT OkulPaketi' };

const COLUMNS = [
  ['telefon', '905321234567 / 0532 123 45 67', 'Telefon, Telefon No, Cep Telefonu, GSM'],
  ['alici_tipi', 'velimiz / öğrencimiz', 'Alıcı Tipi, Hitap, Kime'],
  ['set_adi', 'Speakout B1+', 'Set Adı, Kitap, Ürün Adı'],
  ['teslim_tarihi', '25.09.2026', 'Teslim Tarihi, Tarih'],
  ['teslim_saati', '10:00-16:00', 'Teslim Saati, Saat Aralığı'],
  ['teslim_noktasi', 'Denizli Koleji Ana Kampüs', 'Teslim Noktası, Adres, Okul'],
];

export default function UploadPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Excel / CSV Yükle</h1>
        <p className="text-sm text-ink-500">
          Dosya yüklendiğinde mesaj gönderilmez; önce veriler kontrol edilir ve önizleme gösterilir.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Dosya seç">
            <UploadForm />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Beklenen kolonlar" description="Başlıklardaki küçük farklılıklar otomatik eşleştirilir.">
            <ul className="space-y-3 text-sm">
              {COLUMNS.map(([key, example, aliases]) => (
                <li key={key}>
                  <p className="font-medium text-ink-900">{key}</p>
                  <p className="text-ink-500">Örnek: {example}</p>
                  <p className="text-xs text-ink-500">Kabul edilen başlıklar: {aliases}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Gönderilecek mesaj">
            <pre className="whitespace-pre-wrap rounded-md bg-ink-50 p-3 text-sm leading-relaxed text-ink-700">
              {TEMPLATE_BODY}
            </pre>
          </Card>
        </div>
      </div>
    </>
  );
}
