import { NextResponse } from 'next/server';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { getRegimeDesk } from '@/lib/regime/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!(await regimeApiAllowed(false))) return regimeDenied();
  const { snapshot, ideas, desk, consistency } = await getRegimeDesk();
  return NextResponse.json({ ...snapshot, ideas, desk, consistency }, {
    headers: {
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
