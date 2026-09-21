import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Oturum cerezini tazeler ve panel sayfalarini korur (Next 16 "proxy" konvansiyonu).
 * API uclari kendi icinde `requireApiUser()` ile korunur; bu yuzden /api
 * eslesme disinda birakilmistir (webhook ve cron da oyle).
 */
const PUBLIC_PATHS = ['/gizlilik', '/kosullar'];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const path = request.nextUrl.pathname;
  // Herkese acik sayfalar (Meta uygulama incelemesi gizlilik politikasi URL'i ister)
  if (PUBLIC_PATHS.includes(path)) return response;

  const { data } = await supabase.auth.getUser();
  const isLoginPage = path === '/giris';

  if (!data.user && !isLoginPage) {
    const redirectUrl = new URL('/giris', request.url);
    if (path !== '/') redirectUrl.searchParams.set('next', path);
    return NextResponse.redirect(redirectUrl);
  }

  if (data.user && isLoginPage) {
    return NextResponse.redirect(new URL('/panel', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
