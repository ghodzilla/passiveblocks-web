import { NextResponse } from 'next/server';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { refreshRegimeSnapshot } from '@/lib/regime/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  if (!(await regimeApiAllowed(true))) return regimeDenied();
  const snapshot = await refreshRegimeSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
