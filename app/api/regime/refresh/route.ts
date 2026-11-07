import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { executeRegimeRefresh, writeRefreshLog } from '@/lib/regime/refreshRun';
import { ATTEMPT_COOKIE, refreshCsrfMatches, signAttemptCookie } from '@/lib/regime/refreshHealth';
import { REGIME_COOKIE, sessionCookieOptions } from '@/lib/regime/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const privateHeaders = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
};

function sameOrigin(request: Request): boolean {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

export async function GET() {
  if (!(await regimeApiAllowed(true))) return regimeDenied();
  try {
    const { health } = await executeRegimeRefresh({ trigger: 'cron' });
    return NextResponse.json(health, { headers: privateHeaders });
  } catch {
    writeRefreshLog('failure', { trigger: 'cron', message: 'Refresh stopped before a health record was saved' });
    return NextResponse.json({ outcome: 'failure' }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  if (!(await regimeApiAllowed(false))) return regimeDenied();
  if (!sameOrigin(request)) return regimeDenied();
  const secret = process.env.REGIME_SESSION_SECRET;
  const sessionToken = cookies().get(REGIME_COOKIE)?.value ?? 'ip';
  let provided = '';
  try {
    const form = await request.formData();
    const csrf = form.get('csrf');
    provided = typeof csrf === 'string' ? csrf : '';
  } catch {
    return regimeDenied();
  }
  if (!secret || secret.length < 32 || !refreshCsrfMatches(secret, sessionToken, provided)) return regimeDenied();
  let health;
  try {
    const result = await executeRegimeRefresh({ trigger: 'owner' });
    health = result.health;
  } catch {
    return NextResponse.redirect(new URL('/private/regime', request.url), 303);
  }
  const response = NextResponse.redirect(new URL('/private/regime', request.url), 303);
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  response.headers.set('cache-control', 'private, no-store');
  if (health.persisted) {
    response.cookies.set(ATTEMPT_COOKIE, '', { ...sessionCookieOptions(0), path: '/private' });
  } else {
    response.cookies.set(ATTEMPT_COOKIE, signAttemptCookie(secret, health), { ...sessionCookieOptions(60 * 10), path: '/private' });
  }
  return response;
}
