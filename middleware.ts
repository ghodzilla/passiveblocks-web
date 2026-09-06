import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// IP allowlist for private surfaces. Comma-separated env var.
// Gates /drafts and /os. Fail closed when unset.
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
}

function isIpAllowed(ip: string): boolean {
  const raw = process.env.ALLOWED_IPS || '';
  if (!raw.trim()) return false;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(ip);
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

// Protect /tax — must be logged in (subscription check happens in the page itself)
// Protect /drafts and /os — IP-allowlist only (private surfaces)
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // /drafts and /os — IP allowlist gate. No auth, no Supabase. Never indexable.
  if (pathname.startsWith('/drafts') || pathname.startsWith('/os')) {
    const ip = getClientIp(request);
    if (!isIpAllowed(ip)) {
      return denyPrivate();
    }
    response.headers.set('x-robots-tag', 'noindex, nofollow');
    return response;
  }

  // If Supabase is not configured yet, pass through — no auth enforcement
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && pathname.startsWith('/tax')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', '/tax');
    return NextResponse.redirect(loginUrl);
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
