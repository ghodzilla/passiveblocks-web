import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Protect /tax — must be logged in (subscription check happens in the page itself)
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/tax')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', '/tax');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/tax', '/tax/:path*', '/account', '/account/:path*'],
};
