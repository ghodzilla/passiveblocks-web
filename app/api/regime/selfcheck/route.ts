import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/private-access';
import { regimeDenied } from '@/lib/regime/guard';
import { readSelfCheck } from '@/lib/regime/selfcheck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Cron bearer only. A session or an allowlisted IP does not unlock this JSON. */
export async function GET() {
  if (!isCronAuthorized(headers().get('authorization'))) return regimeDenied();
  const record = await readSelfCheck();
  return NextResponse.json(record ?? { ok: true, failures: [], asOf: null }, {
    headers: {
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
