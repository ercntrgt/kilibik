import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { ModeBadge } from '@/components/ui';
import { signOutAction } from '@/app/actions';

const NAV = [
  { href: '/panel', label: 'Panel' },
  { href: '/yukle', label: 'Excel Yükle' },
  { href: '/gonderimler', label: 'Gönderimler' },
  { href: '/ayarlar', label: 'Ayarlar' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const settings = await getSettings(createSupabaseAdminClient());

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-ink-200 bg-white lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-ink-900">AtlasELT</p>
          <p className="text-xs text-ink-500">OkulPaketi Bilgilendirme</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-white px-5 py-3">
          <ModeBadge mode={settings.sendMode} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500">{user.fullName ?? user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
              >
                Çıkış
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
