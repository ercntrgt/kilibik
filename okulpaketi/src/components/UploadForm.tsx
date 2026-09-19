'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type UploadResponse = {
  campaignId: string;
  summary: { total: number; valid: number; invalid: number; duplicate: number };
  columns: { matched: string[]; missing: string[]; unmatched: string[] };
};

export default function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Lütfen bir dosya seçin.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (name.trim()) formData.append('name', name.trim());

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error ?? 'Dosya işlenemedi.');
        return;
      }
      setResult(body as UploadResponse);
    } catch {
      setError('Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Dosya okundu. Hiçbir mesaj gönderilmedi — önizleme ekranında kontrol edip onaylayabilirsiniz.
        </p>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="Toplam kayıt" value={result.summary.total} />
          <Summary label="Geçerli" value={result.summary.valid} tone="text-emerald-600" />
          <Summary label="Hatalı" value={result.summary.invalid} tone="text-red-600" />
          <Summary label="Tekrar eden" value={result.summary.duplicate} tone="text-amber-600" />
        </dl>

        {result.columns.missing.length > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Bulunamayan kolonlar: {result.columns.missing.join(', ')}. Bu alanlar boş sayılacağı için ilgili
            satırlar hatalı olarak işaretlenir.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/gonderimler/${result.campaignId}`)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Önizlemeye git
          </button>
          <button
            type="button"
            onClick={() => { setResult(null); setFileName(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Yeni dosya yükle
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink-700">
          Gönderim adı <span className="font-normal text-ink-500">(opsiyonel)</span>
        </label>
        <input
          id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="25 Eylül Denizli Koleji Kitap Teslimi" maxLength={200}
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-ink-700">Dosya (.xlsx, .xlsm, .csv)</label>
        <input
          id="file" ref={fileRef} type="file" required
          accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:text-ink-700"
        />
        {fileName && <p className="mt-1 text-xs text-ink-500">Seçilen: {fileName}</p>}
        <p className="mt-1 text-xs text-ink-500">En fazla 8 MB / 20.000 satır.</p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Dosya okunuyor…' : 'Dosyayı yükle ve kontrol et'}
      </button>
    </form>
  );
}

function Summary({ label, value, tone = 'text-ink-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-ink-200 px-3 py-2">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
