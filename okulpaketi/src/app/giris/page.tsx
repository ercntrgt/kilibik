import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Giriş | AtlasELT OkulPaketi' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-ink-900">AtlasELT – OkulPaketi</h1>
          <p className="mt-1 text-sm text-ink-500">WhatsApp Bilgilendirme Paneli</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-ink-500">Yükleniyor…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">
          Bu panel yalnızca yetkili personel içindir.
        </p>
      </div>
    </main>
  );
}
