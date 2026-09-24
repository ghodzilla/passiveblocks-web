import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Private surfaces (/drafts, /os): access = client IP in ALLOWED_IPS
// OR signed-in Supabase user whose email is in OS_ALLOWED_EMAILS.
// Both lists are comma-separated env vars. Fail closed when neither grants access.
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
}

function parseList(raw: string | undefined): string[] {
  return (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isIpAllowed(ip: string): boolean {
  if (!ip) return false;
  return parseList(process.env.ALLOWED_IPS).includes(ip);
}

function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = parseList(process.env.OS_ALLOWED_EMAILS).map((e) => e.toLowerCase());
  return list.includes(email.toLowerCase());
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

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
    },
  });
}

function redirectToLogin(request: NextRequest, next: string): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', next);
  const res = NextResponse.redirect(loginUrl);
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

// Protect /tax — login enforced only when TAX_AUTH_ENABLED=true (subscription check happens in the page itself)
// Protect /drafts and /os — IP allowlist OR allowed signed-in email
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/drafts') || pathname.startsWith('/os')) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');

    // 1. IP allowlist (no Supabase round-trip needed).
    if (isIpAllowed(getClientIp(request))) {
      return response;
    }

    // 2. Signed-in allowed email. Without Supabase config, keep the old 404.
    if (!supabaseConfigured() || parseList(process.env.OS_ALLOWED_EMAILS).length === 0) {
      return denyPrivate();
    }

    let email: string | undefined;
    try {
      const supabase = makeSupabase(request, response);
      const { data: { user } } = await supabase.auth.getUser();
      email = user?.email;
    } catch {
      email = undefined;
    }

    if (isEmailAllowed(email)) {
      return response;
    }
    if (email) {
      // Signed in, but not an allowed account.
      return denyPrivate();
    }
    return redirectToLogin(request, `${pathname}${search}`);
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
  ],
};
