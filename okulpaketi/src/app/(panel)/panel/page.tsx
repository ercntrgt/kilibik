import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { Card, EmptyState, LinkButton, StatCard, StatusBadge, TableShell } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/format';

export const metadata = { title: 'Panel | AtlasELT OkulPaketi' };
export const dynamic = 'force-dynamic';

type Stats = {
  total: number; today: number; sent: number; delivered: number;
  read: number; failed: number; pending: number; campaigns: number;
};

type CampaignRow = {
  id: string; name: string; status: string; send_mode: string;
  total_rows: number; valid_count: number; created_at: string;
};

export default async function DashboardPage() {
  const admin = createSupabaseAdminClient();

  const [{ data: statsData }, { data: campaigns }] = await Promise.all([
    admin.rpc('dashboard_stats'),
    admin
      .from('campaigns')
      .select('id, name, status, send_mode, total_rows, valid_count, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const stats = (statsData ?? {}) as Partial<Stats>;
  const rows = (campaigns ?? []) as CampaignRow[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Panel</h1>
          <p className="text-sm text-ink-500">Teslimat bilgilendirme gönderimlerinin özeti</p>
        </div>
        <LinkButton href="/yukle" variant="primary">Excel Yükle</LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Toplam gönderim" value={stats.total ?? 0} />
        <StatCard label="Bugün" value={stats.today ?? 0} tone="info" />
        <StatCard label="Başarılı" value={stats.sent ?? 0} tone="info" />
        <StatCard label="Teslim edildi" value={stats.delivered ?? 0} tone="success" />
        <StatCard label="Okundu" value={stats.read ?? 0} tone="success" />
        <StatCard label="Başarısız" value={stats.failed ?? 0} tone="danger" />
        <StatCard label="Bekleyen" value={stats.pending ?? 0} tone="warning" />
      </div>

      <Card
        title="Son gönderimler"
        actions={<LinkButton href="/gonderimler">Tümünü gör</LinkButton>}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Henüz gönderim yok"
            description="Excel veya CSV dosyası yükleyerek ilk teslimat bilgilendirmenizi hazırlayın."
            action={<LinkButton href="/yukle" variant="primary">Excel Yükle</LinkButton>}
          />
        ) : (
          <TableShell
            head={
              <tr>
                <th className="px-3 py-2">Gönderim</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Mod</th>
                <th className="px-3 py-2 text-right">Kayıt</th>
                <th className="px-3 py-2">Tarih</th>
              </tr>
            }
          >
            {rows.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-ink-50">
                <td className="px-3 py-2">
                  <a href={`/gonderimler/${campaign.id}`} className="font-medium text-brand-600 hover:underline">
                    {campaign.name}
                  </a>
                </td>
                <td className="px-3 py-2"><StatusBadge status={campaign.status} kind="campaign" /></td>
                <td className="px-3 py-2 text-ink-500">{campaign.send_mode === 'test' ? 'Test' : 'Canlı'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(campaign.valid_count)} / {formatNumber(campaign.total_rows)}
                </td>
                <td className="px-3 py-2 text-ink-500">{formatDateTime(campaign.created_at)}</td>
              </tr>
            ))}
          </TableShell>
        )}
      </Card>
    </>
  );
}
