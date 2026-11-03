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

// Private surfaces fail closed.
// /drafts and /os: ALLOWED_IPS or a signed-in email in OS_ALLOWED_EMAILS.
// /private and /api/regime: REGIME_ALLOWED_IPS or REGIME_OWNER_EMAILS.
// The lists are separate so an OS collaborator is not automatically the regime owner.
// Cron: Authorization: Bearer CRON_SECRET on /api/regime/refresh only.

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

// Protect /tax — login enforced only when TAX_AUTH_ENABLED=true (subscription check happens in the page itself)
// Protect /drafts and /os — IP allowlist OR allowed signed-in email
// Protect /private and /api/regime — owner IP, owner email, or cron secret on the refresh route
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  const isOs = pathname.startsWith('/drafts') || pathname.startsWith('/os');
  const isRegimeApi = pathname.startsWith('/api/regime');
  const isRegimePage = pathname.startsWith('/private');

  if (isOs || isRegimeApi || isRegimePage) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
    if (isRegimeApi || isRegimePage) {
      response.headers.set('cache-control', 'private, no-store');
    }

    const surface = isRegimeApi ? 'regime-api' : isRegimePage ? 'regime-page' : 'os';
    const emailEnv = surface === 'os' ? process.env.OS_ALLOWED_EMAILS : process.env.REGIME_OWNER_EMAILS;
    const ipEnv = surface === 'os' ? process.env.ALLOWED_IPS : process.env.REGIME_ALLOWED_IPS;
    const ipAllowed = isIpAllowed(clientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip')), ipEnv);
    const cronAuthorized = isRegimeApi
      && pathname.startsWith('/api/regime/refresh')
      && isCronAuthorized(request.headers.get('authorization'));

    let email: string | null = null;
    const needEmail = !ipAllowed && !cronAuthorized && supabaseConfigured() && parseList(emailEnv).length > 0;
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
      surface,
      ipAllowed,
      cronAuthorized,
      email,
      emailAllowed: isEmailAllowed(email, emailEnv),
      emailsConfigured: parseList(emailEnv).length > 0,
      supabaseConfigured: supabaseConfigured(),
    });

    if (decision === 'allow') return response;
    if (decision === 'login') return redirectToLogin(request, `${pathname}${search}`);
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
