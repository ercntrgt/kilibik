'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  templateName: string;
  templateLanguage: string;
  sendMode: 'test' | 'live';
  testPhoneE164: string | null;
  batchSize: number;
  throttlePerSecond: number;
  dedupeWindowHours: number;
};

type ConnectionResult = {
  connected: boolean;
  message: string;
  phone: { displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null } | null;
  template: { status: string; name: string; language: string } | null;
  templateError?: string | null;
};

export default function SettingsForm({ initial, canEdit }: { initial: Settings; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (form.sendMode === 'live' && initial.sendMode !== 'live') {
      const confirmed = window.confirm(
        'CANLI GÖNDERİM moduna geçiyorsunuz. Bundan sonraki gönderimler gerçek müşteri numaralarına gidecek. Onaylıyor musunuz?',
      );
      if (!confirmed) return;
    }

    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: form.templateName,
          templateLanguage: form.templateLanguage,
          sendMode: form.sendMode,
          testPhone: form.testPhoneE164 ?? '',
          batchSize: Number(form.batchSize),
          throttlePerSecond: Number(form.throttlePerSecond),
          dedupeWindowHours: Number(form.dedupeWindowHours),
        }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body?.error ?? 'Ayarlar kaydedilemedi.'); return; }
      setForm(body as Settings);
      setNotice('Ayarlar kaydedildi.');
      router.refresh();
    } catch {
      setError('Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true); setError(null); setConnection(null);
    try {
      const response = await fetch('/api/settings/test-connection', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) { setError(body?.error ?? 'Bağlantı testi başarısız.'); return; }
      setConnection(body as ConnectionResult);
    } catch {
      setError('Bağlantı testi yapılamadı.');
    } finally {
      setTesting(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true); setError(null); setNotice(null);
    try {
      const response = await fetch('/api/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) { setError(body?.error ?? 'Test mesajı gönderilemedi.'); return; }
      if (body.sent) setNotice(`Test mesajı ${body.to} numarasına gönderildi.`);
      else setError(`Test mesajı gönderilemedi: ${body.error?.detail ?? 'bilinmeyen hata'}`);
    } catch {
      setError('Test mesajı gönderilemedi.');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <fieldset disabled={!canEdit} className="space-y-5">
        <div>
          <span className="block text-sm font-medium text-ink-700">Gönderim modu</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${form.sendMode === 'test' ? 'border-amber-300 bg-amber-50' : 'border-ink-200'}`}>
              <input type="radio" name="sendMode" checked={form.sendMode === 'test'} onChange={() => update('sendMode', 'test')} className="mt-1" />
              <span>
                <span className="block text-sm font-medium text-ink-900">TEST MODU</span>
                <span className="block text-xs text-ink-500">Tüm mesajlar yalnızca test numarasına gider.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${form.sendMode === 'live' ? 'border-red-300 bg-red-50' : 'border-ink-200'}`}>
              <input type="radio" name="sendMode" checked={form.sendMode === 'live'} onChange={() => update('sendMode', 'live')} className="mt-1" />
              <span>
                <span className="block text-sm font-medium text-ink-900">CANLI GÖNDERİM</span>
                <span className="block text-xs text-ink-500">Mesajlar gerçek müşteri numaralarına gider.</span>
              </span>
            </label>
          </div>
        </div>

        <Field label="Test telefon numarası" hint="TEST modunda tüm mesajlar bu numaraya gönderilir.">
          <input
            type="text" value={form.testPhoneE164 ?? ''} placeholder="0532 123 45 67"
            onChange={(e) => update('testPhoneE164', e.target.value)}
            className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Şablon adı" hint="Meta panelindeki onaylı şablon adı.">
            <input
              type="text" value={form.templateName}
              onChange={(e) => update('templateName', e.target.value)}
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Şablon dili" hint="Örn. tr">
            <input
              type="text" value={form.templateLanguage}
              onChange={(e) => update('templateLanguage', e.target.value)}
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Grup boyutu" hint="Her turda işlenecek kayıt (1-200)">
            <input
              type="number" min={1} max={200} value={form.batchSize}
              onChange={(e) => update('batchSize', Number(e.target.value))}
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Saniyede istek" hint="Meta hız limiti için (1-80)">
            <input
              type="number" min={1} max={80} value={form.throttlePerSecond}
              onChange={(e) => update('throttlePerSecond', Number(e.target.value))}
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Tekrar penceresi (saat)" hint="Aynı kişiye aynı içeriği tekrar göndermeyi engeller">
            <input
              type="number" min={0} max={8760} value={form.dedupeWindowHours}
              onChange={(e) => update('dedupeWindowHours', Number(e.target.value))}
              className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      </fieldset>

      {!canEdit && (
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-500">
          Ayarları yalnızca yönetici hesapları değiştirebilir.
        </p>
      )}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {connection && (
        <div className={`rounded-md border px-3 py-2 text-sm ${connection.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <p className="font-medium">{connection.connected ? 'Bağlantı başarılı' : 'Bağlantı kurulamadı'}</p>
          <p>{connection.message}</p>
          {connection.phone && (
            <p className="mt-1 text-xs">
              Numara: {connection.phone.displayPhoneNumber ?? '-'} · İsim: {connection.phone.verifiedName ?? '-'} ·
              Kalite: {connection.phone.qualityRating ?? '-'}
            </p>
          )}
          {connection.template && (
            <p className="mt-1 text-xs">
              Şablon: {connection.template.name} ({connection.template.language}) — durum: {connection.template.status}
            </p>
          )}
          {connection.templateError && <p className="mt-1 text-xs">Şablon kontrolü: {connection.templateError}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit" disabled={saving || !canEdit}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Kaydediliyor…' : 'Ayarları kaydet'}
        </button>
        <button
          type="button" onClick={handleTestConnection} disabled={testing}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          {testing ? 'Test ediliyor…' : 'WhatsApp bağlantısını test et'}
        </button>
        <button
          type="button" onClick={handleSendTest} disabled={sendingTest || !canEdit}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          {sendingTest ? 'Gönderiliyor…' : 'Test mesajı gönder'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
