import { cookies } from 'next/headers';
import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { enforceRegimePage } from '@/lib/regime/guard';
import { getRegimeDesk } from '@/lib/regime/load';
import { readPaperLog } from '@/lib/regime/paperLog';
import { ATTEMPT_COOKIE, openAttemptCookie, signRefreshCsrf } from '@/lib/regime/refreshHealth';
import { REGIME_COOKIE } from '@/lib/regime/session';
import { readSelfCheck } from '@/lib/regime/state';
import { toDruckPanel } from '@/lib/regime/druckPresent';
import { readDruck, readDruckWeeks } from '@/lib/regime/druckStore';
import { readVisser } from '@/lib/regime/visserStore';
import type { RetiredVisser } from '@/lib/regime/retiredBooks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage() {
  await enforceRegimePage();
  const secret = process.env.REGIME_SESSION_SECRET;
  const sessionToken = cookies().get(REGIME_COOKIE)?.value ?? 'ip';
  const csrf = secret && secret.length >= 32 ? signRefreshCsrf(secret, sessionToken) : null;
  const attempt = secret ? openAttemptCookie(secret, cookies().get(ATTEMPT_COOKIE)?.value) : null;
  const [{ snapshot, ideas, desk, book, consistency, health, blockReason }, selfCheck, paperLog, visser, druck, druckWeeks] = await Promise.all([
    getRegimeDesk(new Date(), attempt),
    readSelfCheck(),
    readPaperLog(),
    readVisser(),
    readDruck(),
    readDruckWeeks(),
  ]);
  const closes = (symbol: string) => (book?.series.find((series) => series.symbol === symbol)?.bars ?? []).map((bar) => ({ date: bar.date, close: bar.close }));
  const saved = visser.record?.snapshot ?? null;
  const visserRetired: RetiredVisser = {
    status: visser.status,
    decisionDate: saved?.decisionDate ?? null,
    equityAud: saved ? saved.cashAud + saved.investedAud : null,
    sleeveNav: saved?.sleeveNav ?? null,
  };
  return (
    <RegimeDashboard
      view={{ snapshot, ideas, desk, consistency }}
      selfCheck={selfCheck.status === 'ok' ? selfCheck.value : null}
      health={health}
      attempt={attempt}
      blockReason={blockReason}
      csrf={csrf}
      paperLog={paperLog}
      visserRetired={visserRetired}
      druck={toDruckPanel({
        status: druck.status,
        snapshot: druck.record?.snapshot ?? null,
        banner: druck.record?.attempt.banner ?? null,
        outcome: druck.record?.attempt.outcome ?? null,
        weeks: druckWeeks,
        qqq: closes('QQQ'),
        spy: closes('SPY'),
        bonds: closes('IEF'),
      })}
    />
  );
}
