'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Stats = {
  total_messages: number;
  pending_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
};

type Props = {
  campaignId: string;
  initialStatus: string;
  validCount: number;
  sendMode: 'test' | 'live';
  testPhone: string | null;
  templateName: string;
  initialStats: Stats;
};

const EMPTY_STATS: Stats = {
  total_messages: 0, pending_count: 0, sent_count: 0,
  delivered_count: 0, read_count: 0, failed_count: 0,
};

export default function CampaignRunner({
  campaignId, initialStatus, validCount, sendMode, testPhone, templateName, initialStats,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [stats, setStats] = useState<Stats>(initialStats ?? EMPTY_STATS);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; }, []);

  const refreshStats = useCallback(async () => {
    const response = await fetch(`/api/campaigns/${campaignId}/status`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    if (body.stats) setStats(body.stats as Stats);
    if (body.campaign?.status) setStatus(body.campaign.status as string);
  }, [campaignId]);

  async function post(path: string, payload?: unknown) {
    const response = await fetch(`/api/campaigns/${campaignId}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error ?? 'İşlem başarısız oldu.');
    return body;
  }

  async function handlePrepare() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const body = await post('/prepare');
      setStatus('ready');
      setNotice(`${body.pending} kayıt gönderime hazır.`);
      await refreshStats();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hazırlama başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function runDispatchLoop() {
    setBusy(true); setError(null); setNotice(null); setConfirmOpen(false);
    stopRef.current = false;
    let totalSent = 0;
    let totalFailed = 0;

    try {
      for (let round = 0; round < 500; round += 1) {
        if (stopRef.current) break;
        const body = await post('/dispatch', { confirm: true });
        totalSent += body.sent ?? 0;
        totalFailed += body.failed ?? 0;
        setStatus(body.status ?? 'sending');
        await refreshStats();

        if ((body.remaining ?? 0) <= 0) break;
        if (body.status === 'paused' || body.status === 'cancelled') break;
        if ((body.claimed ?? 0) === 0) break;
      }
      setNotice(`Gönderim turu tamamlandı. Gönderilen: ${totalSent}, başarısız: ${totalFailed}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderim sırasında hata oluştu.');
    } finally {
      setBusy(false);
      await refreshStats();
      router.refresh();
    }
  }

  async function handleRetry() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const body = await post('/retry');
      setNotice(`${body.requeued} başarısız kayıt yeniden kuyruğa alındı.`);
      setStatus('sending');
      await refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yeniden gönderim başlatılamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePause(paused: boolean) {
    stopRef.current = paused;
    try {
      const body = await post('/pause', { paused });
      setStatus(body.status);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Durum değiştirilemedi.');
    }
  }

  const processed = stats.total_messages - stats.pending_count;
  const progress = stats.total_messages > 0 ? Math.round((processed / stats.total_messages) * 100) : 0;

  return (
    <div className="space-y-4">
      {sendMode === 'test' && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>TEST MODU açık.</strong> Dosyada kaç kişi olursa olsun tüm mesajlar yalnızca{' '}
          <strong>{testPhone ?? 'tanımlı test numarası'}</strong> numarasına gönderilir. Canlı gönderim için
          Ayarlar sayfasından “Canlı Gönderim” moduna geçin.
        </p>
      )}
      {sendMode === 'live' && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>CANLI GÖNDERİM.</strong> Mesajlar gerçek müşteri numaralarına gidecek.
        </p>
      )}

      {status !== 'draft' && stats.total_messages > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-ink-500">
            <span>İlerleme</span>
            <span className="tabular-nums">{processed} / {stats.total_messages} (%{progress})</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'draft' && (
          <button
            type="button" onClick={handlePrepare} disabled={busy || validCount === 0}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Hazırlanıyor…' : 'Gönderime Hazırla'}
          </button>
        )}

        {(status === 'ready' || status === 'sending') && stats.pending_count > 0 && (
          <button
            type="button" onClick={() => setConfirmOpen(true)} disabled={busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Gönderiliyor…' : status === 'sending' ? 'Gönderime devam et' : 'WhatsApp Mesajlarını Gönder'}
          </button>
        )}

        {status === 'sending' && busy && (
          <button
            type="button" onClick={() => { stopRef.current = true; }}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Bu turdan sonra dur
          </button>
        )}

        {(status === 'sending' || status === 'ready') && !busy && (
          <button
            type="button" onClick={() => handlePause(true)}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Duraklat
          </button>
        )}

        {status === 'paused' && (
          <button
            type="button" onClick={() => handlePause(false)}
            className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Devam ettir
          </button>
        )}

        {stats.failed_count > 0 && !busy && (
          <button
            type="button" onClick={handleRetry}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Başarısızları yeniden gönder ({stats.failed_count})
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-ink-900">Gönderimi onaylayın</h3>
            <p className="mt-2 text-sm text-ink-700">
              <strong>{stats.pending_count}</strong> kişiye WhatsApp mesajı gönderilecek. Devam etmek istediğinize
              emin misiniz?
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink-500">
              <li>Şablon: <span className="font-medium text-ink-700">{templateName}</span></li>
              <li>
                Mod:{' '}
                <span className={`font-medium ${sendMode === 'test' ? 'text-amber-700' : 'text-red-700'}`}>
                  {sendMode === 'test' ? `TEST (yalnızca ${testPhone})` : 'CANLI GÖNDERİM'}
                </span>
              </li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button" onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Vazgeç
              </button>
              <button
                type="button" onClick={runDispatchLoop}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Evet, gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
