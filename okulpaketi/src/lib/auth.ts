import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'staff';
};

/** Oturumu ve profili dogrular. Yoksa null doner. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;

  return {
    id: profile.id,
    email: profile.email ?? data.user.email ?? '',
    fullName: profile.full_name ?? null,
    role: (profile.role ?? 'staff') as 'admin' | 'staff',
  };
}

/** Sayfalar icin: oturum yoksa /giris'e gonderir. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/giris');
  return user;
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** API route'lari icin: oturum yoksa 401 firlatir. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiAuthError('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 401);
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== 'admin') throw new ApiAuthError('Bu işlem için yönetici yetkisi gerekiyor.', 403);
  return user;
}
