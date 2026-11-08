import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { priceUniverse } from '../../lib/regime/load';
import { parseYahooChart } from '../../lib/regime/prices';
import {
  maxDrawdown,
  walkAudPaper,
  walkNav,
  type VintagePanel,
} from '../../lib/regime/replay';
import type { PriceBook } from '../../lib/regime/prices';
import { loadIntervalFiles, panelAt } from './loadIntervals';

const OUT = path.join(process.cwd(), 'research/regime-validation');
const PRICE_FILE = path.join(OUT, 'prices/book.json');
const FRED_DIR = path.join(OUT, 'fred');

interface StoredBook {
  downloadedAt: string;
  symbols: {
    symbol: string;
    url: string;
    adjusted: boolean | null;
    sha256: string | null;
    httpStatus: number | null;
    bars: { date: string; close: number; high?: number; low?: number }[];
    error: string | null;
  }[];
}

function bookFromFile(): PriceBook | null {
  try {
    const stored = JSON.parse(readFileSync(PRICE_FILE, 'utf8')) as StoredBook;
    return {
      fetchedAt: stored.downloadedAt,
      gaps: stored.symbols.filter((row) => row.error).map((row) => `${row.symbol}: ${row.error}`),
      series: stored.symbols.map((row) => ({
        symbol: row.symbol,
        bars: row.bars,
        asOf: row.bars.length ? row.bars[row.bars.length - 1].date : null,
        source: row.bars.length ? 'yahoo' as const : null,
        error: row.error,
        adjusted: row.adjusted,
      })),
    };
  } catch {
    return null;
  }
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function contributeOnFirstOfMonth(dates: string[]): (date: string, index: number) => number {
  const seen = new Set<string>();
  return (date) => {
    const key = monthKey(date);
    if (seen.has(key)) return 0;
    seen.add(key);
    return date === dates[0] ? 0 : 1;
  };
}

function summarise(points: { date: string; nav: number | null; wealth: number | null; gross: number; turnover: number }[]) {
  const navs = points.map((point) => point.nav);
  const valid = points.filter((point) => point.nav != null) as { date: string; nav: number; wealth: number | null; gross: number; turnover: number }[];
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const days = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86_400_000;
  const cagr = days > 0 && first.nav > 0 ? (last.nav / first.nav) ** (365.25 / days) - 1 : null;
  const returns: number[] = [];
  const gapDays: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    returns.push(valid[i].nav / valid[i - 1].nav - 1);
    gapDays.push((Date.parse(`${valid[i].date}T00:00:00Z`) - Date.parse(`${valid[i - 1].date}T00:00:00Z`)) / 86_400_000);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  let variance = 0;
  for (const value of returns) variance += (value - mean) ** 2;
  const sd = returns.length > 1 ? Math.sqrt(variance / (returns.length - 1)) : 0;
  const avgGap = gapDays.reduce((sum, value) => sum + value, 0) / gapDays.length;
  const periods = avgGap > 0 ? 365.25 / avgGap : 0;
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(periods) : null;
  const grossAvg = valid.reduce((sum, point) => sum + point.gross, 0) / valid.length;
  const turnover = valid.reduce((sum, point) => sum + point.turnover, 0);
  const invested = valid.filter((point) => point.gross > 0).length;
  const mid = Math.floor(valid.length / 2);
  return {
    start: first.date,
    end: last.date,
    observations: valid.length,
    dayCount: days,
    cagr,
    maxDrawdown: maxDrawdown(navs),
    sharpe,
    riskFree: 0,
    dayBasis: `Unit-NAV changes between decision dates. Annualised with 365.25 divided by the average gap of ${avgGap.toFixed(2)} days. Risk-free rate is 0 because cash yield is 0. Dependence-aware standard errors are not computed.`,
    averageGross: grossAvg,
    timeInMarket: invested / valid.length,
    turnover,
    trades: valid.filter((point) => point.turnover > 1e-6).length,
    wealthEnd: last.wealth,
    unitNavEnd: last.nav,
    firstHalfDrawdown: maxDrawdown(navs.slice(0, mid)),
    secondHalfDrawdown: maxDrawdown(navs.slice(mid)),
    firstHalfCagr: sliceCagr(valid.slice(0, mid)),
    secondHalfCagr: sliceCagr(valid.slice(mid)),
    returnPerDrawdown: maxDrawdown(navs) && cagr != null ? cagr / (maxDrawdown(navs) as number) : null,
    preExposed: true,
  };
}

function sliceCagr(points: { date: string; nav: number }[]): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86_400_000;
  if (!(days > 0) || !(first.nav > 0)) return null;
  return (last.nav / first.nav) ** (365.25 / days) - 1;
}

function exposureByAction(days: { action: string }[], points: { gross: number }[]) {
  const groups: Record<string, { days: number; averageGross: number }> = {};
  for (let index = 0; index < days.length; index++) {
    const key = days[index].action;
    const group = groups[key] ?? { days: 0, averageGross: 0 };
    group.days += 1;
    group.averageGross += points[index]?.gross ?? 0;
    groups[key] = group;
  }
  for (const key of Object.keys(groups)) groups[key].averageGross /= groups[key].days;
  return groups;
}

function perDrawdown(summary: ReturnType<typeof summarise>) {
  if (!summary || summary.cagr == null || summary.maxDrawdown == null || !(summary.maxDrawdown > 0)) return null;
  const ratio = (cagr: number | null, drawdown: number | null) => (
    cagr != null && drawdown != null && drawdown > 0 ? cagr / drawdown : null
  );
  return {
    full: summary.cagr / summary.maxDrawdown,
    firstHalf: ratio(summary.firstHalfCagr, summary.firstHalfDrawdown),
    secondHalf: ratio(summary.secondHalfCagr, summary.secondHalfDrawdown),
  };
}

function hypothesisVerdict(
  production: ReturnType<typeof summarise>,
  mix: ReturnType<typeof summarise>,
  spy: ReturnType<typeof summarise>,
  lump: ReturnType<typeof summarise>,
  diagnostic: { points: { date: string; nav: number | null; wealth: number | null; gross: number; turnover: number }[] },
) {
  const ratios = {
    production: perDrawdown(production),
    sixtyFortyMonthly: perDrawdown(mix),
    spyMonthly: perDrawdown(spy),
    spyBuyAndHold: perDrawdown(lump),
  };
  const above = (left: { full: number; firstHalf: number | null; secondHalf: number | null } | null, right: { full: number; firstHalf: number | null; secondHalf: number | null } | null) => (
    left != null && right != null
    && left.full > right.full
    && left.firstHalf != null && right.firstHalf != null && left.firstHalf > right.firstHalf
    && left.secondHalf != null && right.secondHalf != null && left.secondHalf > right.secondHalf
  );
  const price = summarise(diagnostic.points);
  const timeChanged = production != null && price != null && Math.abs(production.timeInMarket - price.timeInMarket) > 1e-6;
  const h1 = above(ratios.production, ratios.sixtyFortyMonthly) && above(ratios.production, ratios.spyBuyAndHold);
  return {
    h1: production == null ? 'inconclusive' : h1 ? 'supported' : 'unsupported',
    h2: production == null || price == null ? 'inconclusive' : timeChanged ? 'supported' : 'unsupported',
    ratios,
    timeInMarket: { production: production?.timeInMarket ?? null, priceOnly: price?.timeInMarket ?? null },
    because: 'H1 and H2 are scored on book-limits-2026-11-07, the repaired whole-book policy. That policy is not the historical add-and-hold journal. H1 asks for a higher unit-NAV return per unit of drawdown than buy-and-hold SPY and monthly 60/40, on the full span and on each half. H2 asks whether removing the stand-down, while keeping the same whole-book limits and the production budget, changes time in market. Any holding counts, including a defensive ETF. Risk, defensive, and cash sleeves are reported beside that flag. Thresholds were not fit to this span. Post-fill price drift is not a new-order breach.',
  };
}

function weekdayDecisions(): string[] {
  const dates: string[] = [];
  let cursor = Date.parse('2024-10-18T00:00:00Z');
  const end = Date.parse('2026-11-06T00:00:00Z');
  while (cursor <= end) {
    const day = new Date(cursor).getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return dates;
}

async function main() {
  const book = bookFromFile();
  const intervals = loadIntervalFiles(FRED_DIR);
  const weekdays = weekdayDecisions();
  const sessions = new Set((book?.series.find((series) => series.symbol === 'SPY')?.bars ?? []).map((bar) => bar.date));
  const traded = book ? weekdays.filter((date) => sessions.has(date)) : [];
  const holidays = book ? weekdays.filter((date) => !sessions.has(date)) : [];
  const base = {
    ranAt: new Date().toISOString(),
    command: 'npx tsx research/regime-validation/run-replay.ts',
    fullStrategy: 'not_validated',
    prices: book ? { symbols: book.series.length, gaps: book.gaps, file: 'research/regime-validation/prices/book.json' } : null,
    panelDates: weekdays.length,
    tradedSessions: traded.length,
    weekdayHolidaysSkipped: holidays,
    taxes: 'excluded',
    currency: 'AUD',
    costBps: 10,
    cashYieldBps: 0,
    universe: 'Current survivor list. Hypothetical frozen-rule lookback. Pre-exposed to the 2021–2026 paths already published.',
    clock: 'Decision instant is 13:15:00Z on a SPY session. US and crypto signals hide that session’s close. Every fill, including ASX, is the next session after the decision date. Weekdays with no SPY bar are not trades. Date.now is not the engine clock.',
  };
  if (!book || Object.keys(intervals).length === 0) {
    writeFileSync(path.join(OUT, 'replay-results.json'), `${JSON.stringify({ ...base, experiment: 'not_run', reason: 'Prices or the FRED interval files are missing.' }, null, 2)}\n`);
    return;
  }
  const asxCanFill = (date: string) => book.series.filter((series) => series.symbol.endsWith('.AX')).every((series) => series.bars.some((bar) => bar.date > date));
  const dates = traded.filter((date) => asxCanFill(date));
  const droppedNoLaterAsx = traded.filter((date) => !asxCanFill(date));
  const cache = new Map<string, VintagePanel>();
  const panelFor = (date: string) => {
    const found = cache.get(date);
    if (found) return found;
    const panel = panelAt(intervals, date);
    cache.set(date, panel);
    return panel;
  };
  const audit = ['2024-10-18', '2024-10-23', '2026-09-25', '2026-11-06'].map((date) => {
    const panel = panelFor(date);
    const hy = panel.series.BAMLH0A0HYM2 ?? [];
    return { date, vintage: panel.vintageDate, hyCount: hy.length, hyLast: hy[hy.length - 1]?.date ?? null, dgs2: (panel.series.DGS2 ?? []).length };
  });
  const started = Date.now();
  const production = walkAudPaper({
    dates,
    book,
    mode: 'production',
    policy: 'binding',
    panel: panelFor,
    contribute: contributeOnFirstOfMonth(dates),
  });
  console.log('binding', Date.now() - started, 'ms', production.missing.length);
  const diagnostic = walkAudPaper({
    dates,
    book,
    mode: 'price_only',
    policy: 'binding',
    panel: panelFor,
    contribute: contributeOnFirstOfMonth(dates),
  });
  console.log('ablation', Date.now() - started, 'ms', diagnostic.missing.length);
  const addHold = walkAudPaper({
    dates,
    book,
    mode: 'production',
    policy: 'add_hold',
    panel: panelFor,
    contribute: contributeOnFirstOfMonth(dates),
  });
  console.log('add-hold', Date.now() - started, 'ms', addHold.missing.length);
  const staticMix = walkNav({
    dates,
    book,
    contribute: contributeOnFirstOfMonth(dates),
    target: (date) => ({
      date,
      weights: [{ symbol: 'SPY', weight: 0.6 }, { symbol: 'CASH', weight: 0.4 }],
      gross: 0.6,
      actionable: true,
      regime: null,
      action: 'static',
      omissions: [],
      label: 'static_benchmark',
    }),
  });
  const spyPath = walkNav({
    dates,
    book,
    contribute: contributeOnFirstOfMonth(dates),
    target: (date) => ({
      date,
      weights: [{ symbol: 'SPY', weight: 1 }, { symbol: 'CASH', weight: 0 }],
      gross: 1,
      actionable: true,
      regime: null,
      action: 'spy',
      omissions: [],
      label: 'static_benchmark',
    }),
  });
  const lumpSpy = walkNav({
    dates,
    book,
    contribute: () => 0,
    target: (date) => ({
      date,
      weights: [{ symbol: 'SPY', weight: 1 }, { symbol: 'CASH', weight: 0 }],
      gross: 1,
      actionable: true,
      regime: null,
      action: 'spy_lump',
      omissions: [],
      label: 'static_benchmark',
    }),
  });
  const creditShort = dates.filter((date) => (panelFor(date).series.BAMLH0A0HYM2 ?? []).length < 252);
  const creditPartialWindow = dates.filter((date) => {
    const n = (panelFor(date).series.BAMLH0A0HYM2 ?? []).length;
    return n >= 252 && n < 756;
  });
  const runnable = production.missing.length === 0 && diagnostic.missing.length === 0 && addHold.missing.length === 0 && staticMix.missing.length === 0 && spyPath.missing.length === 0 && lumpSpy.missing.length === 0;
  let cliMin = Number.POSITIVE_INFINITY;
  let cliBelow60 = 0;
  for (const date of dates) {
    const count = (panelFor(date).series.USALOLITOAASTSAM ?? []).length;
    if (count < cliMin) cliMin = count;
    if (count < 60) cliBelow60 += 1;
  }
  writeFileSync(path.join(OUT, 'replay-results.json'), `${JSON.stringify({
    ...base,
    experiment: 'book_limits_2026_11_07',
    fullStrategy: 'repaired_policy_not_the_historical_rule',
    policy: 'book-limits-2026-11-07',
    restricted: [
      'CFTC positioning omitted. No release-dated history was in the archive, and today’s book was not copied back.',
      'Universe is the current survivor list, a hypothetical, and the window is inside the already examined 2021–2026 sample.',
      'book-limits-2026-11-07 caps the carried book and new tranches. It is the owner-approved repair. It is not the historical add-and-hold journal, and it is not an unseen out-of-sample test.',
      'A hold with suggestion weight 0 is kept. It is sold for a stop, a stale or missing mark, or a binding cap. One pyramid tranche is allowed per position.',
      'FRED observation_start on the fetch was 2019-06-01. The 60-month CLI window constant was not changed. Months before June 2019 are absent from the file.',
      'DFEDTARU intervals are joined across the 2022-12-31 and 2023-01-01 realtime chunks. A row whose rt_start is the chunk boundary is the copy that contains the vintage, not a claim about the original release minute.',
      'The three dates with fewer than 252 credit observations are not actionable. Defensive names can still be held or added inside the preservation budget.',
    ],
    reason: 'Prior-day vintages, the current survivor universe, 10 bps, cash yield 0, and next-session fills. The scored book is the repaired whole-book policy. The add-and-hold path is a historical diagnostic on the same dates. CFTC is omitted. This is not a guarantee and the aspiration label is not a result.',
    audit,
    coverage: {
      weekdayDecisions: weekdays.length,
      spySessions: traded.length,
      replayedSessions: dates.length,
      droppedNoLaterAsxSession: droppedNoLaterAsx,
      holidaysSkipped: holidays,
      creditBelow252: creditShort,
      creditShortOf756: creditPartialWindow.length,
      firstFullCreditWindow: dates.find((date) => (panelFor(date).series.BAMLH0A0HYM2 ?? []).length >= 756) ?? null,
      fill: 'next session after the decision date, for US, crypto, and ASX',
      cliMonthsAtFirstReplay: Number.isFinite(cliMin) ? cliMin : null,
      cliDecisionsShorterThan60: cliBelow60,
      sessionArithmetic: `${weekdays.length} weekdays minus ${holidays.length} dates with no SPY bar is ${traded.length}. Dropping ${droppedNoLaterAsx.length} date with no later fill leaves ${dates.length}.`,
    },
    production: {
      label: 'whole_book_limits',
      policy: production.binding?.version ?? null,
      binding: production.binding,
      ledger: production.ledger,
      missingExecutions: production.missing.slice(0, 20),
      missingCount: production.missing.length,
      omissionsSample: production.days.find((row) => row.actionable)?.omissions ?? production.days[0]?.omissions ?? [],
      failClosedDays: production.days.filter((row) => !row.actionable).length,
      failClosedDates: production.days.filter((row) => !row.actionable).map((row) => row.date),
      heldSymbols: production.heldSymbols,
      exposureByAction: exposureByAction(production.days, production.points),
      regimeCounts: production.days.reduce<Record<string, number>>((counts, row) => {
        const key = row.regime ?? 'none';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
      summary: runnable ? summarise(production.points) : null,
    },
    priceOnlyDiagnostic: {
      label: 'ablation_standdown_removed_same_whole_book_limits',
      ledger: diagnostic.ledger,
      binding: diagnostic.binding,
      missingExecutions: diagnostic.missing.length,
      heldSymbols: diagnostic.heldSymbols,
      summary: diagnostic.missing.length ? null : summarise(diagnostic.points),
    },
    addHoldDiagnostic: {
      label: 'historical_add_and_hold_not_the_policy',
      ledger: addHold.ledger,
      missingExecutions: addHold.missing.length,
      summary: addHold.missing.length ? null : summarise(addHold.points),
    },
    staticSixtyForty: {
      label: 'static_60_spy_40_cash',
      summary: runnable ? summarise(staticMix.points) : null,
    },
    spySameContributions: {
      label: 'spy_same_contributions',
      summary: runnable ? summarise(spyPath.points) : null,
    },
    spyLumpSum: {
      label: 'spy_buy_and_hold',
      funding: 'One unit at the first session. No later contributions. Different funding from the monthly paths.',
      summary: runnable ? summarise(lumpSpy.points) : null,
    },
    hypotheses: runnable ? hypothesisVerdict(summarise(production.points), summarise(staticMix.points), summarise(spyPath.points), summarise(lumpSpy.points), diagnostic) : null,
    metricsNote: 'CAGR, drawdown, and Sharpe use unit NAV after stripping the shared monthly contribution. Wealth includes that contribution and is not the drawdown. Monthly SPY and buy-and-hold SPY share a unit NAV because a contribution adds units and does not change NAV. Their ending wealth differs. The sample is pre-exposed. This is not an out-of-sample profitability result.',
  }, null, 2)}\n`);
  console.log(JSON.stringify({ decisions: dates.length, failClosed: production.days.filter((row) => !row.actionable).length, missing: production.missing.length, diagnosticMissing: diagnostic.missing.length }));
}

export async function downloadPrices(): Promise<void> {
  const symbols = Array.from(new Set([...priceUniverse(undefined).map((item) => item.symbol), 'AUDUSD=X', 'RSP', 'SMH', 'SPY']));
  const rows: StoredBook['symbols'] = new Array(symbols.length);
  let next = 0;
  async function worker() {
    while (next < symbols.length) {
      const index = next;
      next += 1;
      const symbol = symbols[index];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&includeAdjustedClose=true`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'passiveblocks-research/1.0' } });
      const body = Buffer.from(await response.arrayBuffer());
      const parsed = response.ok ? parseYahooChart(JSON.parse(body.toString('utf8')), symbol) : [];
      const adjusted = body.includes(Buffer.from('"adjclose"'));
      rows[index] = {
        symbol,
        url,
        adjusted: response.ok ? adjusted : null,
        sha256: body.length ? createHash('sha256').update(body).digest('hex') : null,
        httpStatus: response.status,
        bars: parsed,
        error: response.ok && parsed.length > 0 ? null : `${symbol} HTTP ${response.status}, ${parsed.length} bars`,
      };
      console.log(symbol, response.status, parsed.length);
    } catch (error) {
      rows[index] = {
        symbol,
        url,
        adjusted: null,
        sha256: null,
        httpStatus: null,
        bars: [],
        error: error instanceof Error ? error.message : 'price request failed',
      };
    }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  mkdirSync(path.dirname(PRICE_FILE), { recursive: true });
  const payload = { downloadedAt: new Date().toISOString(), source: 'Yahoo chart range=5y interval=1d includeAdjustedClose=true', symbols: rows };
  writeFileSync(PRICE_FILE, `${JSON.stringify(payload)}\n`);
  const manifest = {
    downloadedAt: payload.downloadedAt,
    symbols: rows.map((row) => ({ symbol: row.symbol, url: row.url, adjusted: row.adjusted, sha256: row.sha256, httpStatus: row.httpStatus, bars: row.bars.length, error: row.error })),
  };
  writeFileSync(path.join(OUT, 'prices/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1]?.endsWith('run-replay.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'replay failed');
    process.exit(1);
  });
}
