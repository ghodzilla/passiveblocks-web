import { NextResponse } from 'next/server';
import { safeDbMessage } from '@/lib/regime/db';
import { regimeApiAllowed, regimeDenied } from '@/lib/regime/guard';
import { readJournal, writeJournal } from '@/lib/regime/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return regimeDenied();
}

export async function POST(request: Request) {
  if (!(await regimeApiAllowed(false))) return regimeDenied();
  const form = await request.formData();
  const capitalRaw = String(form.get('capital') ?? '').trim();
  const targetRaw = String(form.get('targetCagr') ?? '').trim();
  const capital = Number(capitalRaw);
  const targetPct = Number(targetRaw);
  if (!Number.isFinite(capital) || capital <= 0 || capital > 1e12) {
    return NextResponse.redirect(new URL('/private/regime?settings=capital', request.url), 303);
  }
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 200) {
    return NextResponse.redirect(new URL('/private/regime?settings=target', request.url), 303);
  }
  const journal = await readJournal();
  journal.settings.capital = capital;
  journal.settings.targetCagr = targetPct / 100;
  try {
    await writeJournal(journal);
  } catch (error) {
    console.error(JSON.stringify({ event: 'regime_journal', phase: 'failure', message: safeDbMessage(error) }));
    return NextResponse.redirect(new URL('/private/regime?settings=store', request.url), 303);
  }
  return NextResponse.redirect(new URL('/private/regime', request.url), 303);
}
