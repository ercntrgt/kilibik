import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { Card, EmptyState, StatCard, StatusBadge, TableShell } from '@/components/ui';
import CampaignRunner from '@/components/CampaignRunner';
import { buildPreviewText } from '@/lib/message';
import { formatPhone, phoneSearchTerm } from '@/lib/phone';
import { formatDateTime, formatNumber, percent } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const MESSAGE_FILTERS: Record<string, string[]> = {
  pending: ['pending', 'processing'],
  sent: ['sent'],
  delivered: ['delivered'],
  read: ['read'],
  failed: ['failed'],
};

type Recipient = {
  id: string; row_number: number; phone_e164: string | null; raw_phone: string | null;
  alici_tipi: string | null; set_adi: string | null; teslim_tarihi: string | null;
  teslim_saati: string | null; teslim_noktasi: string | null; status: string; issues: string[] | null;
  messages: {
    status: string; wamid: string | null; sent_at: string | null; delivered_at: string | null;
    read_at: string | null; error_code: string | null; error_detail: string | null;
  }[] | null;
};

export default async function CampaignDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: statsRow } = await admin.from('campaign_stats').select('*').eq('campaign_id', id).maybeSingle();
  const stats = {
    total_messages: Number(statsRow?.total_messages ?? 0),
    pending_count: Number(statsRow?.pending_count ?? 0),
    sent_count: Number(statsRow?.sent_count ?? 0),
    delivered_count: Number(statsRow?.delivered_count ?? 0),
    read_count: Number(statsRow?.read_count ?? 0),
    failed_count: Number(statsRow?.failed_count ?? 0),
  };

  const durum = String(query.durum ?? 'all');
  const arama = String(query.q ?? '').trim();
  const setFilter = String(query.set ?? '').trim();
  const noktaFilter = String(query.nokta ?? '').trim();
  const page = Math.max(1, Number(query.sayfa ?? 1) || 1);

  const needsMessageJoin = durum in MESSAGE_FILTERS;
  const messageSelect = `messages${needsMessageJoin ? '!inner' : ''}(status, wamid, sent_at, delivered_at, read_at, error_code, error_detail)`;

  let recipientQuery = admin
    .from('recipients')
    .select(
      `id, row_number, phone_e164, raw_phone, alici_tipi, set_adi, teslim_tarihi, teslim_saati, teslim_noktasi, status, issues, ${messageSelect}`,
      { count: 'exact' },
    )
    .eq('campaign_id', id);

  if (needsMessageJoin) recipientQuery = recipientQuery.in('messages.status', MESSAGE_FILTERS[durum]);
  else if (durum === 'invalid') recipientQuery = recipientQuery.in('status', ['invalid', 'duplicate', 'duplicate_previous']);

  if (arama) {
    const term = phoneSearchTerm(arama);
    if (term) recipientQuery = recipientQuery.ilike('phone_e164', `%${term}%`);
  }
  if (setFilter) recipientQuery = recipientQuery.eq('set_adi', setFilter);
  if (noktaFilter) recipientQuery = recipientQuery.eq('teslim_noktasi', noktaFilter);

  const { data: recipientRows, count } = await recipientQuery
    .order('row_number')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const recipients = (recipientRows ?? []) as unknown as Recipient[];
  const totalFiltered = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  // Filtre secenekleri
  const { data: facetRows } = await admin
    .from('recipients')
    .select('set_adi, teslim_noktasi')
    .eq('campaign_id', id)
    .limit(2000);

  const sets = [...new Set((facetRows ?? []).map((r) => r.set_adi).filter(Boolean))] as string[];
  const noktalar = [...new Set((facetRows ?? []).map((r) => r.teslim_noktasi).filter(Boolean))] as string[];

  // Onizleme icin ilk gecerli kayitlar
  const { data: previewRows } = await admin
    .from('recipients')
    .select('alici_tipi, set_adi, teslim_tarihi, teslim_saati, teslim_noktasi')
    .eq('campaign_id', id)
    .eq('status', 'valid')
    .order('row_number')
    .limit(3);

  // Hatali kayitlar
  const { data: problemRows } = await admin
    .from('recipients')
    .select('row_number, raw_phone, phone_e164, status, issues')
    .eq('campaign_id', id)
    .in('status', ['invalid', 'duplicate', 'duplicate_previous'])
    .order('row_number')
    .limit(100);

  const isDraft = campaign.status === 'draft';
  const hasMessages = stats.total_messages > 0;

  // Basarisiz nedenleri ozeti
  const { data: failedRows } = hasMessages
    ? await admin.from('messages').select('error_code, error_title').eq('campaign_id', id).eq('status', 'failed').limit(1000)
    : { data: [] as { error_code: string | null; error_title: string | null }[] };

  const failureReasons = new Map<string, number>();
  for (const row of failedRows ?? []) {
    const key = `${row.error_code ?? '-'} — ${row.error_title ?? 'Bilinmeyen hata'}`;
    failureReasons.set(key, (failureReasons.get(key) ?? 0) + 1);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} kind="campaign" />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {campaign.file_name ? `${campaign.file_name} · ` : ''}
            Yüklendi: {formatDateTime(campaign.created_at)}
            {campaign.started_at ? ` · Başladı: ${formatDateTime(campaign.started_at)}` : ''}
            {campaign.completed_at ? ` · Bitti: ${formatDateTime(campaign.completed_at)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Dosya indirme uclari: Link degil duz <a> (prefetch tetiklenmesin) */}
          <a
            href={`/api/campaigns/${id}/export?format=xlsx`}
            className="inline-flex items-center rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Excel indir
          </a>
          <a
            href={`/api/campaigns/${id}/export?format=csv`}
            className="inline-flex items-center rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            CSV indir
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Toplam kayıt" value={campaign.total_rows} />
        <StatCard label="Geçerli" value={campaign.valid_count} tone="success" />
        <StatCard label="Hatalı" value={campaign.invalid_count} tone="danger" />
        <StatCard label="Tekrar eden" value={campaign.duplicate_count} tone="warning" />
        <StatCard label="Bekleyen" value={stats.pending_count} tone="warning" />
        <StatCard label="Başarısız" value={stats.failed_count} tone="danger" />
      </div>

      {hasMessages && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Gönderildi" value={stats.sent_count} tone="info" hint={percent(stats.sent_count, stats.total_messages)} />
          <StatCard label="Teslim edildi" value={stats.delivered_count} tone="success" hint={percent(stats.delivered_count, stats.total_messages)} />
          <StatCard label="Okundu" value={stats.read_count} tone="success" hint={percent(stats.read_count, stats.total_messages)} />
          <StatCard label="Toplam mesaj" value={stats.total_messages} />
        </div>
      )}

      <Card title={isDraft ? 'Gönderim onayı' : 'Gönderim kontrolü'}>
        <CampaignRunner
          campaignId={id}
          initialStatus={campaign.status}
          validCount={campaign.valid_count}
          sendMode={campaign.send_mode === 'live' ? 'live' : 'test'}
          testPhone={campaign.test_phone_e164}
          templateName={campaign.template_name}
          initialStats={stats}
        />
      </Card>

      {(previewRows ?? []).length > 0 && (
        <Card title="Mesaj önizleme" description="İlk kayıtlar için gönderilecek metin">
          <div className="space-y-3">
            {(previewRows ?? []).map((row, index) => (
              <pre
                key={index}
                className="whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50 p-3 text-sm leading-relaxed text-ink-700"
              >
                {buildPreviewText({
                  aliciTipi: row.alici_tipi ?? '',
                  setAdi: row.set_adi ?? '',
                  teslimTarihi: row.teslim_tarihi ?? '',
                  teslimSaati: row.teslim_saati ?? '',
                  teslimNoktasi: row.teslim_noktasi ?? '',
                })}
              </pre>
            ))}
          </div>
        </Card>
      )}

      {(problemRows ?? []).length > 0 && (
        <Card
          title="Gönderime dahil edilmeyen kayıtlar"
          description="Bu satırlara mesaj gönderilmez."
        >
          <TableShell
            head={
              <tr>
                <th className="px-3 py-2">Satır</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Sebep</th>
              </tr>
            }
          >
            {(problemRows ?? []).map((row) => (
              <tr key={row.row_number}>
                <td className="px-3 py-2 tabular-nums">{row.row_number}</td>
                <td className="px-3 py-2">{row.phone_e164 ? formatPhone(row.phone_e164) : (row.raw_phone || '-')}</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} kind="recipient" /></td>
                <td className="px-3 py-2 text-ink-700">{(row.issues ?? []).join(' · ')}</td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

      {failureReasons.size > 0 && (
        <Card title="Başarısız gönderim nedenleri">
          <ul className="space-y-1 text-sm">
            {[...failureReasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, total]) => (
              <li key={reason} className="flex justify-between gap-4 border-b border-ink-100 py-1 last:border-0">
                <span className="text-ink-700">{reason}</span>
                <span className="tabular-nums font-medium text-red-600">{formatNumber(total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Kayıtlar" description={`${formatNumber(totalFiltered)} kayıt bulundu`}>
        <form method="get" className="mb-4 grid gap-3 md:grid-cols-5">
          <select name="durum" defaultValue={durum} className="rounded-md border border-ink-200 px-3 py-2 text-sm">
            <option value="all">Tümü</option>
            <option value="pending">Bekleyen</option>
            <option value="sent">Gönderildi</option>
            <option value="delivered">Teslim edildi</option>
            <option value="read">Okundu</option>
            <option value="failed">Başarısız</option>
            <option value="invalid">Gönderilmeyen kayıtlar</option>
          </select>
          <input
            name="q" defaultValue={arama} placeholder="Telefon ara"
            className="rounded-md border border-ink-200 px-3 py-2 text-sm"
          />
          <select name="set" defaultValue={setFilter} className="rounded-md border border-ink-200 px-3 py-2 text-sm">
            <option value="">Tüm setler</option>
            {sets.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select name="nokta" defaultValue={noktaFilter} className="rounded-md border border-ink-200 px-3 py-2 text-sm">
            <option value="">Tüm teslim noktaları</option>
            {noktalar.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button type="submit" className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
            Filtrele
          </button>
        </form>

        {recipients.length === 0 ? (
          <EmptyState title="Bu filtreye uyan kayıt yok" />
        ) : (
          <>
            <TableShell
              head={
                <tr>
                  <th className="px-3 py-2">Satır</th>
                  <th className="px-3 py-2">Telefon</th>
                  <th className="px-3 py-2">Alıcı</th>
                  <th className="px-3 py-2">Set</th>
                  <th className="px-3 py-2">Teslim</th>
                  <th className="px-3 py-2">Nokta</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Son işlem</th>
                </tr>
              }
            >
              {recipients.map((row) => {
                const message = row.messages?.[0];
                const lastAt = message?.read_at ?? message?.delivered_at ?? message?.sent_at ?? null;
                return (
                  <tr key={row.id} className="align-top hover:bg-ink-50">
                    <td className="px-3 py-2 tabular-nums">{row.row_number}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.phone_e164 ? formatPhone(row.phone_e164) : (row.raw_phone || '-')}</td>
                    <td className="px-3 py-2">{row.alici_tipi}</td>
                    <td className="px-3 py-2 cell-clip">{row.set_adi}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.teslim_tarihi} {row.teslim_saati}</td>
                    <td className="px-3 py-2 cell-clip">{row.teslim_noktasi}</td>
                    <td className="px-3 py-2">
                      {message
                        ? <StatusBadge status={message.status} />
                        : <StatusBadge status={row.status} kind="recipient" />}
                      {message?.error_detail && (
                        <p className="mt-1 max-w-xs text-xs text-red-600">{message.error_detail}</p>
                      )}
                      {!message && (row.issues ?? []).length > 0 && (
                        <p className="mt-1 max-w-xs text-xs text-ink-500">{(row.issues ?? []).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-500">{formatDateTime(lastAt)}</td>
                  </tr>
                );
              })}
            </TableShell>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-ink-500">Sayfa {page} / {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a
                      href={`?durum=${durum}&q=${encodeURIComponent(arama)}&set=${encodeURIComponent(setFilter)}&nokta=${encodeURIComponent(noktaFilter)}&sayfa=${page - 1}`}
                      className="rounded-md border border-ink-200 px-3 py-1.5 hover:bg-ink-50"
                    >
                      Önceki
                    </a>
                  )}
                  {page < totalPages && (
                    <a
                      href={`?durum=${durum}&q=${encodeURIComponent(arama)}&set=${encodeURIComponent(setFilter)}&nokta=${encodeURIComponent(noktaFilter)}&sayfa=${page + 1}`}
                      className="rounded-md border border-ink-200 px-3 py-1.5 hover:bg-ink-50"
                    >
                      Sonraki
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
