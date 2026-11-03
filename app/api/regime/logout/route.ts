import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { regimeDenied } from '@/lib/regime/guard';
import { REGIME_COOKIE, sessionCookieOptions } from '@/lib/regime/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/private/login', request.url), 303);
  res.cookies.set(REGIME_COOKIE, '', sessionCookieOptions(0));
  return res;
}

export function GET() {
  return regimeDenied();
}
