import { headers } from 'next/headers';
import { requirePageUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { Card } from '@/components/ui';
import SettingsForm from '@/components/SettingsForm';
import { TEMPLATE_BODY } from '@/lib/message';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Ayarlar | AtlasELT OkulPaketi' };
export const dynamic = 'force-dynamic';

function mask(value: string | undefined): string {
  if (!value) return 'Tanımlı değil';
  if (value.length <= 6) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default async function SettingsPage() {
  const user = await requirePageUser();
  const settings = await getSettings(createSupabaseAdminClient());

  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/webhooks/whatsapp`;

  const env = {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    wabaId: process.env.META_WABA_ID,
    apiVersion: process.env.META_GRAPH_API_VERSION || 'v23.0',
    tokenSet: Boolean(process.env.META_WHATSAPP_TOKEN),
    verifyTokenSet: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    appSecretSet: Boolean(process.env.META_APP_SECRET),
  };

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Ayarlar</h1>
        <p className="text-sm text-ink-500">
          Gönderim modu, şablon bilgisi ve WhatsApp bağlantı durumu.
          {settings.updatedAt && ` Son güncelleme: ${formatDateTime(settings.updatedAt)}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Gönderim ayarları">
            <SettingsForm initial={settings} canEdit={user.role === 'admin'} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="WhatsApp bağlantısı">
            <dl className="space-y-2 text-sm">
              <Row label="Phone Number ID" value={env.phoneNumberId ?? 'Tanımlı değil'} />
              <Row label="WABA ID" value={env.wabaId ?? 'Tanımlı değil'} />
              <Row label="Graph API sürümü" value={env.apiVersion} />
              <Row label="Access token" value={env.tokenSet ? `Tanımlı (${mask(process.env.META_WHATSAPP_TOKEN)})` : 'Tanımlı değil'} />
              <Row label="Webhook verify token" value={env.verifyTokenSet ? 'Tanımlı' : 'Tanımlı değil'} />
              <Row label="App secret (imza)" value={env.appSecretSet ? 'Tanımlı' : 'Tanımlı değil'} />
              <Row label="Kullanılan şablon" value={`${settings.templateName} (${settings.templateLanguage})`} />
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Access token güvenlik nedeniyle hiçbir ekranda açık gösterilmez; yalnızca sunucu tarafında kullanılır.
            </p>
          </Card>

          <Card title="Webhook">
            <p className="text-sm text-ink-700">Meta uygulamasında kullanılacak Callback URL:</p>
            <code className="mt-2 block overflow-x-auto rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-700">{webhookUrl}</code>
            <p className="mt-2 text-xs text-ink-500">
              Verify token olarak <code>META_WEBHOOK_VERIFY_TOKEN</code> değerini girin ve <code>messages</code>{' '}
              alanına abone olun.
            </p>
          </Card>

          <Card title="Şablon metni">
            <pre className="whitespace-pre-wrap rounded-md bg-ink-50 p-3 text-sm leading-relaxed text-ink-700">
              {TEMPLATE_BODY}
            </pre>
            <p className="mt-2 text-xs text-ink-500">
              Metin Meta panelindeki onaylı şablonla birebir aynı olmalıdır. Parametre sırası: 1 alıcı tipi,
              2 set adı, 3 teslim tarihi, 4 teslim saati, 5 teslim noktası.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-ink-100 pb-1.5 last:border-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900 break-all">{value}</dd>
    </div>
  );
}
