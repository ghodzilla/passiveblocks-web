import { NextResponse } from 'next/server';
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
    const message = error instanceof Error ? error.message : 'Weekly review failed';
    return NextResponse.json({ ok: false, note: message, changes: [] }, {
      status: 500,
      headers: {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
}
