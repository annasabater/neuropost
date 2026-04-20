import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that must NEVER require auth (webhooks, cron, meta callback)
const PUBLIC_API = [
  '/api/stripe/webhook',
  '/api/meta/webhook',
  '/api/meta/callback',
  '/api/cron/',
  '/api/auth/',
  '/auth/callback',
  '/api/telegram/webhook',      // Telegram POST → validated via x-telegram-bot-api-secret-token
  '/api/inspiration/ingest',    // Cron → validated via Authorization: Bearer ${CRON_SECRET}
];

const PROTECTED = [
  '/dashboard', '/posts', '/ideas', '/calendar', '/comments',
  '/analytics', '/brand', '/notifications', '/settings', '/onboarding',
  '/tendencias', '/competencia', '/community',
  '/resumen', '/contactos', '/churn', '/captacion',
  '/mi-feed', '/worker',
  '/chat', '/solicitudes', '/historial', '/soporte', '/inbox', '/biblioteca',
];
const ADMIN_PATHS = ['/admin', '/cupones'];
const AUTH_ONLY = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public API routes pass through
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Follow the exact @supabase/ssr recommended pattern:
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  // IMPORTANT: supabaseResponse must be returned (not a new NextResponse.next())
  // so that session cookies are correctly propagated on token refresh.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagate new cookies to the request so downstream server components see them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Recreate the response so Set-Cookie headers are included
          supabaseResponse = NextResponse.next({ request });
          // Use Supabase's own cookie options — do NOT override with httpOnly/maxAge
          // or the browser client loses access to its own session cookie.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Use getUser() not getSession() — getUser() revalidates the JWT
  // server-side; getSession() can return a stale value from the cookie.
  // Do not add any logic between createServerClient and getUser().
  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdmin     = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isAuthOnly  = AUTH_ONLY.some((p) => pathname === p);
  const isApiRoute  = pathname.startsWith('/api');

  // Webhooks/callbacks already handled above; other API routes return 401 for unauthed
  if (!user && isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Has session → bounce away from login/register
  if (user && isAuthOnly) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.redirect(new URL(brand ? '/dashboard' : '/onboarding', request.url));
  }

  // No session + onboarding → redirect to register (not login)
  if (!user && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/register', request.url));
  }

  // No session → redirect to login, saving intended destination
  if (!user && (isProtected || isAdmin)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Onboarding with session → skip if already has brand
  if (user && pathname === '/onboarding') {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (brand) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Admin routes — require superadmin role in app_metadata
  if (user && isAdmin) {
    const isSuperAdmin = user.app_metadata?.role === 'superadmin';
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Return the supabaseResponse so refreshed session cookies are sent to the browser
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)',
  ],
};
