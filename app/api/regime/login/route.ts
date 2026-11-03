import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clientIp } from '@/lib/private-access';
import { evaluateLogin } from '@/lib/regime/login';
import { loginAttempts } from '@/lib/regime/lockout';
import {
  REGIME_COOKIE,
  safeRegimeNext,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from '@/lib/regime/session';
import { regimeDenied } from '@/lib/regime/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const next = safeRegimeNext(String(form.get('next') ?? ''));
  const ip = clientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'));
  const result = await evaluateLogin({
    password,
    hash: process.env.REGIME_PASSWORD_HASH,
    secret: process.env.REGIME_SESSION_SECRET,
    ip,
    nowSec: Math.floor(Date.now() / 1000),
    guard: loginAttempts,
  });

  if (!result.ok) {
    const url = new URL('/private/login', request.url);
    url.searchParams.set('error', result.reason);
    url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(REGIME_COOKIE, result.token, sessionCookieOptions(SESSION_TTL_SECONDS));
  return res;
}

export function GET() {
  return regimeDenied();
}
