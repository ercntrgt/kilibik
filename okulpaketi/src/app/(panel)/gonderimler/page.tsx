import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { Card, EmptyState, LinkButton, StatusBadge, TableShell } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';

export const metadata = { title: 'Gönderimler | AtlasELT OkulPaketi' };
export const dynamic = 'force-dynamic';

type Campaign = {
  id: string; name: string; file_name: string | null; status: string; send_mode: string;
  total_rows: number; valid_count: number; created_at: string;
};

type Stats = {
  campaign_id: string; total_messages: number; pending_count: number;
  sent_count: number; delivered_count: number; read_count: number; failed_count: number;
};

export default async function CampaignsPage() {
  const admin = createSupabaseAdminClient();

  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, name, file_name, status, send_mode, total_rows, valid_count, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (campaigns ?? []) as Campaign[];
  const { data: statsRows } = rows.length
    ? await admin.from('campaign_stats').select('*').in('campaign_id', rows.map((c) => c.id))
    : { data: [] as Stats[] };

  const statsMap = new Map((statsRows ?? []).map((s) => [(s as Stats).campaign_id, s as Stats]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Gönderimler</h1>
          <p className="text-sm text-ink-500">Her Excel yüklemesi ayrı bir gönderim olarak kaydedilir.</p>
        </div>
        <LinkButton href="/yukle" variant="primary">Excel Yükle</LinkButton>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Kayıtlı gönderim yok" description="İlk dosyanızı yükleyerek başlayın." />
        ) : (
          <TableShell
            head={
              <tr>
                <th className="px-3 py-2">Gönderim</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Mod</th>
                <th className="px-3 py-2 text-right">Kişi</th>
                <th className="px-3 py-2 text-right">Gönderildi</th>
                <th className="px-3 py-2 text-right">Teslim</th>
                <th className="px-3 py-2 text-right">Okundu</th>
                <th className="px-3 py-2 text-right">Başarısız</th>
                <th className="px-3 py-2">Tarih</th>
              </tr>
            }
          >
            {rows.map((campaign) => {
              const stats = statsMap.get(campaign.id);
              return (
                <tr key={campaign.id} className="hover:bg-ink-50">
                  <td className="px-3 py-2">
                    <a href={`/gonderimler/${campaign.id}`} className="font-medium text-brand-600 hover:underline">
                      {campaign.name}
                    </a>
                    {campaign.file_name && <p className="text-xs text-ink-500">{campaign.file_name}</p>}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={campaign.status} kind="campaign" /></td>
                  <td className="px-3 py-2 text-ink-500">{campaign.send_mode === 'test' ? 'Test' : 'Canlı'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(campaign.valid_count)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(stats?.sent_count ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(stats?.delivered_count ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(stats?.read_count ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{formatNumber(stats?.failed_count ?? 0)}</td>
                  <td className="px-3 py-2 text-ink-500">{formatDateTime(campaign.created_at)}</td>
                </tr>
              );
            })}
          </TableShell>
        )}
      </Card>
    </>
  );
}
