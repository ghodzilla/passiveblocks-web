import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { refreshCsrfMatches } from '@/lib/regime/refreshHealth';
import { REGIME_COOKIE } from '@/lib/regime/session';
import { runVisserRefresh } from '@/lib/regime/visserRefresh';

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
  const result = await runVisserRefresh({ trigger: 'cron' });
  const status = result.outcome === 'outage' ? 500 : 200;
  return NextResponse.json({
    outcome: result.outcome,
    banner: result.banner,
    errors: result.errors,
    decisionDate: result.decisionDate,
    phase: result.phase,
  }, { status, headers: privateHeaders });
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
  try {
    await runVisserRefresh({ trigger: 'owner' });
  } catch {
    return NextResponse.redirect(new URL('/private/regime#visser-basket', request.url), 303);
  }
  const response = NextResponse.redirect(new URL('/private/regime#visser-basket', request.url), 303);
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
