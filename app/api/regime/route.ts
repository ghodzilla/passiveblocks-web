import { NextResponse } from 'next/server';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { getCachedRegimeSnapshot } from '@/lib/regime/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!(await regimeApiAllowed(false))) return regimeDenied();
  const snapshot = await getCachedRegimeSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
