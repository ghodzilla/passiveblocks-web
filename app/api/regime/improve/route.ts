import { NextResponse } from 'next/server';
import { safeDbMessage } from '@/lib/regime/db';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { runWeeklyReview } from '@/lib/regime/weekly';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  if (!(await regimeApiAllowed(true))) return regimeDenied();
  try {
    const result = await runWeeklyReview(new Date());
    return NextResponse.json(result, {
      headers: {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    const message = safeDbMessage(error);
    return NextResponse.json({ ok: false, note: message, changes: [] }, {
      status: 500,
      headers: {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
}
