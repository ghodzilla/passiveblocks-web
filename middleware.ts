import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  clientIp,
  decideAccess,
  isCronAuthorized,
  isEmailAllowed,
  isIpAllowed,
  parseList,
  supabaseConfigured,
} from '@/lib/private-access';
import { decideRegimeAccess } from '@/lib/regime/access';
import {
  REGIME_COOKIE,
  regimeLoginConfigured,
  safeRegimeNext,
  verifySession,
} from '@/lib/regime/session';

// Private surfaces fail closed.
// /drafts and /os: ALLOWED_IPS or a signed-in email in OS_ALLOWED_EMAILS (Supabase).
// /private and /api/regime: REGIME_ALLOWED_IPS, a signed pb_regime_session cookie,
// or (refresh only) Authorization: Bearer CRON_SECRET.
// Regime does not call Supabase. Login uses REGIME_PASSWORD_HASH and REGIME_SESSION_SECRET.

function makeSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
}

function denyPrivate(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  });
}

function redirectToLogin(request: NextRequest, next: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', next);
  const res = NextResponse.redirect(loginUrl);
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  res.headers.set('cache-control', 'private, no-store');
  return res;
}

function redirectToRegimeLogin(request: NextRequest, next: string): NextResponse {
  const loginUrl = new URL('/private/login', request.url);
  loginUrl.searchParams.set('next', safeRegimeNext(next));
  const res = NextResponse.redirect(loginUrl);
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  res.headers.set('cache-control', 'private, no-store');
  return res;
}

function regimeIpAllowed(request: NextRequest): boolean {
  return isIpAllowed(
    clientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip')),
    process.env.REGIME_ALLOWED_IPS,
  );
}

// Protect /tax — login enforced only when TAX_AUTH_ENABLED=true (subscription check happens in the page itself)
// Protect /drafts and /os — IP allowlist OR allowed signed-in email
// Protect /private and /api/regime — owner password session, owner IP, or cron secret on the refresh route
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  const isOs = pathname.startsWith('/drafts') || pathname.startsWith('/os');
  const isRegimeApi = pathname.startsWith('/api/regime');
  const isRegimePage = pathname.startsWith('/private');

  if (isOs) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');

    const emailEnv = process.env.OS_ALLOWED_EMAILS;
    const ipAllowed = isIpAllowed(
      clientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip')),
      process.env.ALLOWED_IPS,
    );

    let email: string | null = null;
    const needEmail = !ipAllowed && supabaseConfigured() && parseList(emailEnv).length > 0;
    if (needEmail) {
      try {
        const supabase = makeSupabase(request, response);
        const { data: { user } } = await supabase.auth.getUser();
        email = user?.email ?? null;
      } catch {
        email = null;
      }
    }

    const decision = decideAccess({
      surface: 'os',
      ipAllowed,
      cronAuthorized: false,
      email,
      emailAllowed: isEmailAllowed(email, emailEnv),
      emailsConfigured: parseList(emailEnv).length > 0,
      supabaseConfigured: supabaseConfigured(),
    });

    if (decision === 'allow') return response;
    if (decision === 'login') return redirectToLogin(request, `${pathname}${search}`);
    return denyPrivate();
  }

  if (isRegimeApi || isRegimePage) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
    response.headers.set('cache-control', 'private, no-store');

    const ipAllowed = regimeIpAllowed(request);
    const loginConfigured = regimeLoginConfigured(
      process.env.REGIME_PASSWORD_HASH,
      process.env.REGIME_SESSION_SECRET,
    );
    const method = request.method;

    if (pathname === '/api/regime/logout') {
      if (method === 'POST') return response;
      return denyPrivate();
    }

    if (pathname === '/api/regime/login') {
      if (method === 'POST' && (loginConfigured || ipAllowed)) return response;
      return denyPrivate();
    }

    if (pathname === '/private/login') {
      if ((method === 'GET' || method === 'HEAD') && (loginConfigured || ipAllowed)) return response;
      return denyPrivate();
    }

    const cronAuthorized = isRegimeApi
      && pathname.startsWith('/api/regime/refresh')
      && isCronAuthorized(request.headers.get('authorization'));

    const sessionValid = ipAllowed || cronAuthorized
      ? false
      : await verifySession(
        request.cookies.get(REGIME_COOKIE)?.value,
        process.env.REGIME_SESSION_SECRET,
        Math.floor(Date.now() / 1000),
      );

    const decision = decideRegimeAccess({
      surface: isRegimeApi ? 'regime-api' : 'regime-page',
      ipAllowed,
      cronAuthorized,
      sessionValid,
      loginConfigured,
    });

    if (decision === 'allow') return response;
    if (decision === 'login') return redirectToRegimeLogin(request, `${pathname}${search}`);
    return denyPrivate();
  }

  // If Supabase is not configured yet, pass through — no auth enforcement
  if (!supabaseConfigured()) {
    return response;
  }

  const supabase = makeSupabase(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && pathname.startsWith('/tax') && process.env.TAX_AUTH_ENABLED === 'true') {
    return redirectToLogin(request, '/tax');
  }

  return response;
}

export const config = {
  matcher: [
    '/tax',
    '/tax/:path*',
    '/account',
    '/account/:path*',
    '/drafts',
    '/drafts/:path*',
    '/os',
    '/os/:path*',
    '/private',
    '/private/:path*',
    '/api/regime',
    '/api/regime/:path*',
  ],
};
