import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/private-access';
import { regimeDenied } from '@/lib/regime/guard';
import { unavailableStoreReason } from '@/lib/regime/refreshHealth';
import { readSelfCheck } from '@/lib/regime/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Cron bearer only. A session or an allowlisted IP does not unlock this JSON. */
export async function GET() {
  if (!isCronAuthorized(headers().get('authorization'))) return regimeDenied();
  const record = await readSelfCheck();
  if (record.status !== 'ok') {
    return NextResponse.json({
      ok: false,
      failures: [{ id: 'store', detail: unavailableStoreReason(record.status) }],
      asOf: null,
    }, {
      status: 500,
      headers: {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
  return NextResponse.json(record.value ?? { ok: true, failures: [], asOf: null }, {
    headers: {
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
