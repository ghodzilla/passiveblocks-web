import { cookies } from 'next/headers';
import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { paperLedgerFrom } from '@/lib/regime/audPaper';
import { loadBenchmarkCloses } from '@/lib/regime/benchmarks';
import { FRED_SERIES } from '@/lib/regime/constants';
import { toControlRoom } from '@/lib/regime/controlRoom';
import { readDruckContext } from '@/lib/regime/druckContextStore';
import { toDruckPanel } from '@/lib/regime/druckPresent';
import { readDruck, readDruckWeeks } from '@/lib/regime/druckStore';
import { enforceRegimePage } from '@/lib/regime/guard';
import { readPaperLog } from '@/lib/regime/paperLog';
import { signRefreshCsrf } from '@/lib/regime/refreshHealth';
import { retiredBookLines, type RetiredVisser } from '@/lib/regime/retiredBooks';
import { REGIME_COOKIE } from '@/lib/regime/session';
import { readJournal, readRefresh } from '@/lib/regime/state';
import { readVisser } from '@/lib/regime/visserStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage() {
  await enforceRegimePage();
  const secret = process.env.REGIME_SESSION_SECRET;
  const sessionToken = cookies().get(REGIME_COOKIE)?.value ?? 'ip';
  const csrf = secret && secret.length >= 32 ? signRefreshCsrf(secret, sessionToken) : null;
  const [paperLog, visser, druck, druckWeeks, refresh, journal, benchmarks, context] = await Promise.all([
    readPaperLog(),
    readVisser(),
    readDruck(),
    readDruckWeeks(),
    readRefresh(),
    readJournal(),
    loadBenchmarkCloses(),
    readDruckContext(),
  ]);
  const ledger = paperLedgerFrom(journal);
  const marks = ledger.marks ?? [];
  const lastMark = marks.length > 0 ? marks[marks.length - 1] : null;
  const saved = visser.record?.snapshot ?? null;
  const visserRetired: RetiredVisser = {
    status: visser.status,
    decisionDate: saved?.decisionDate ?? null,
    equityAud: saved ? saved.cashAud + saved.investedAud : null,
    sleeveNav: saved?.sleeveNav ?? null,
  };
  const stored = refresh.status === 'ok' ? refresh.value : null;
  const liquidity = stored?.snapshot?.components?.find((row) => row.id === 'liquidity') ?? null;
  const spreadSource = stored?.health.sources.find((row) => row.id === FRED_SERIES.hy) ?? null;
  const spreadFresh = stored?.snapshot?.freshness?.find((row) => row.id === FRED_SERIES.hy) ?? null;
  const panel = toDruckPanel({
    status: druck.status,
    snapshot: druck.record?.snapshot ?? null,
    banner: druck.record?.attempt.banner ?? null,
    outcome: druck.record?.attempt.outcome ?? null,
    weeks: druckWeeks,
    qqq: benchmarks.qqq,
    spy: benchmarks.spy,
    bonds: benchmarks.bonds,
  });
  const room = toControlRoom({
    status: druck.status,
    snapshot: druck.record?.snapshot ?? null,
    banner: panel.banner,
    outcome: druck.record?.attempt.outcome ?? null,
    weeks: druckWeeks,
    qqq: benchmarks.qqq,
    spy: benchmarks.spy,
    bonds: benchmarks.bonds,
    liquidityAsOf: liquidity?.asOf ?? stored?.snapshot?.today ?? null,
    spreadAsOf: spreadSource?.observationDate ?? spreadFresh?.asOf ?? null,
    attemptedAt: druck.record?.attempt.at ?? null,
    benchmarkMissing: benchmarks.missing,
    paperRule: panel.paperRule,
    record: panel.record,
    context,
  });
  return (
    <RegimeDashboard
      room={room}
      csrf={csrf}
      retired={retiredBookLines({
        equity: ledger.equity,
        valued: ledger.valued === true && (ledger.equity ?? 0) > 0,
        asOf: lastMark?.date ?? null,
        nav: paperLog.latest?.nav ?? null,
        decisions: paperLog.decisions,
      }, visserRetired)}
    />
  );
}
