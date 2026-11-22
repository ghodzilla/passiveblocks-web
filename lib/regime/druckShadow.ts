import { CASH_YIELD_ANNUAL } from './cashYield';
import { DRUCK_CANDIDATES, DRUCK_CASH_SYMBOL, DRUCK_COST, DRUCK_SHADOW_BOOK_ID, DRUCK_SPY } from './druck.config';
import {
  dollarReady,
  liquidityScore,
  readV2Extras,
  shiftDates,
  type NavPoint,
} from './druckShadowMath';
import {
  lastOnOrBefore,
  stepDruck,
  threeMonthsBefore,
  type CloseBar,
  type DruckMarket,
  type DruckSnapshot,
  type V2MarketRead,
} from './druck';
import { FX_SYMBOL, markInAud } from './fx';
import { walkSixtyForty, type ClosePoint } from './judgement';
import { netLiquidityMillions, type SeriesPoint } from './series';
import { decisionSession, weekEndingSunday } from './visser';

export interface ShadowBundle {
  prices: Record<string, readonly CloseBar[]>;
  hy: readonly SeriesPoint[];
  dgs10: readonly SeriesPoint[];
  dgs2: readonly SeriesPoint[];
  dollar: readonly CloseBar[];
  /** Fed net liquidity, already shifted by each series' publication lag. */
  netLiquidity: readonly SeriesPoint[];
}

export interface ShadowStatRow {
  period: string;
  book: string;
  cagr: number | null;
  worst: number | null;
  sharpe: number | null;
  turnover: number | null;
}

export interface ShadowReport {
  ok: boolean;
  computedAt: string;
  firstDate: string | null;
  lastDate: string | null;
  skippedWeeks: number;
  note: string;
  rows: ShadowStatRow[];
}

const PERIODS = [
  { id: '2013–22', start: '2013-01-01', end: '2022-12-31' },
  { id: '2023–26', start: '2023-01-01', end: '2026-12-31' },
] as const;

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function calendarOf(bars: readonly CloseBar[]): string[] {
  const dates: string[] = [];
  for (const bar of bars) {
    if (bar.close > 0 && dates[dates.length - 1] !== bar.date) dates.push(bar.date);
  }
  return dates;
}

function weekEnds(calendar: readonly string[]): string[] {
  const ends: string[] = [];
  for (let i = 0; i < calendar.length; i++) {
    const next = calendar[i + 1];
    if (!next || weekEndingSunday(calendar[i]) !== weekEndingSunday(next)) ends.push(calendar[i]);
  }
  return ends;
}

function sliceTo(bars: readonly CloseBar[], asOf: string): CloseBar[] {
  let hi = bars.length;
  let lo = 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date <= asOf) lo = mid + 1;
    else hi = mid;
  }
  // The 200-day average and the 6-month rank only need the recent sessions.
  const start = Math.max(0, lo - 420);
  return bars.slice(start, lo) as CloseBar[];
}

function marketFor(bundle: ShadowBundle, now: Date, decision: string, asOf: string): DruckMarket | null {
  const prices: Record<string, CloseBar[]> = {};
  for (const symbol of Object.keys(bundle.prices)) prices[symbol] = sliceTo(bundle.prices[symbol], asOf);
  const spreads = lastOnOrBefore(bundle.hy, decision);
  const spreadsThen = lastOnOrBefore(bundle.hy, threeMonthsBefore(decision));
  const score = liquidityScore(bundle.netLiquidity, decision);
  const extra = readV2Extras({
    decision,
    dgs10: bundle.dgs10,
    dgs2: bundle.dgs2,
    dollarAbove200: dollarReady(bundle.dollar, decision),
    liquidityUp: score.up,
  });
  if (score.z == null || !spreads || !spreadsThen || !extra) return null;
  return {
    now,
    prices,
    liquidity: score.z,
    liquidityAsOf: decision,
    spreadNow: spreads.value,
    spreadThen: spreadsThen.value,
    spreadAsOf: spreads.date,
    errors: [],
    v2: extra,
  };
}

function remember(path: NavPoint[], snapshot: DruckSnapshot): void {
  const traded = snapshot.trades.reduce((sum, trade) => sum + Math.abs(trade.notionalAud), 0);
  const turnover = snapshot.equityAud > 0 ? traded / snapshot.equityAud : 0;
  path.push({ date: snapshot.filledOn ?? snapshot.decisionDate, nav: snapshot.nav, turnover });
}

/**
 * Walk the live rules and the v2 shadow over the same weeks.
 * Each step sees only data dated on or before that week. A name with no 200-day average yet is left off.
 */
export function walkShadow(bundle: ShadowBundle, computedAt: string): ShadowReport {
  const calendar = calendarOf(bundle.prices[DRUCK_SPY] ?? []);
  const ends = weekEnds(calendar).filter((date) => date >= '2013-01-01' && date <= '2026-12-31');
  let v1: DruckSnapshot | null = null;
  let v2: DruckSnapshot | null = null;
  const path1: NavPoint[] = [];
  const path2: NavPoint[] = [];
  let skipped = 0;
  const spreadReady = bundle.hy.length > 0 ? addDays(bundle.hy[0].date, 100) : '9999-01-01';
  for (const weekEnd of ends) {
    if (weekEnd < spreadReady) {
      skipped += 1;
      continue;
    }
    const now = new Date(`${addDays(weekEnd, 4)}T21:00:00.000Z`);
    if (decisionSession(calendar, now) !== weekEnd) {
      skipped += 1;
      continue;
    }
    const market = marketFor(bundle, now, weekEnd, addDays(weekEnd, 4));
    if (!market) {
      skipped += 1;
      continue;
    }
    const left = stepDruck(v1, market, { rules: 'v1', skipUnlisted: true });
    const right = stepDruck(v2, market, { rules: 'v2', skipUnlisted: true });
    if (left.snapshot && left.outcome !== 'feed_failed') {
      v1 = left.snapshot;
      if (left.snapshot.phase === 'filled') remember(path1, left.snapshot);
    } else skipped += 1;
    if (right.snapshot && right.outcome !== 'feed_failed') {
      v2 = right.snapshot;
      if (right.snapshot.phase === 'filled' && right.snapshot.bookId === DRUCK_SHADOW_BOOK_ID) remember(path2, right.snapshot);
    } else skipped += 1;
  }
  const benchDates = ends.filter((date) => date >= '2013-01-01');
  const bookDates = path1.map((point) => point.date);
  const rows: ShadowStatRow[] = [];
  for (const period of PERIODS) {
    const sameWindow = bookDates.filter((date) => date >= period.start && date <= period.end);
    const dates = sameWindow.length >= 2 ? sameWindow : benchDates;
    rows.push(statRow(period.id, 'Current rules', path1, period.start, period.end));
    rows.push(statRow(period.id, 'v2 rules', path2, period.start, period.end));
    rows.push(benchmarkRow(period.id, '60/40', dates, bundle, period.start, period.end, 'mix'));
    rows.push(benchmarkRow(period.id, 'QQQ', dates, bundle, period.start, period.end, 'qqq'));
  }
  const current = rows.filter((row) => row.book === 'Current rules' && row.cagr != null);
  const span = path1.length > 1 ? ` The book path runs from ${path1[0].date} to ${path1[path1.length - 1].date}.` : '';
  const note = `${verdict(rows, bundle.hy[0]?.date ?? null)}${span}`;
  return {
    ok: current.length > 0,
    computedAt,
    firstDate: path1[0]?.date ?? null,
    lastDate: path1[path1.length - 1]?.date ?? null,
    skippedWeeks: skipped,
    note,
    rows,
  };
}

function yearsBetween(start: string, end: string): number {
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  return days / 365.25;
}

export function pathStats(points: readonly NavPoint[]): { cagr: number | null; worst: number | null; sharpe: number | null; turnover: number | null } {
  const usable = points.filter((point) => point.nav > 0);
  if (usable.length < 2) return { cagr: null, worst: null, sharpe: null, turnover: null };
  const first = usable[0];
  const last = usable[usable.length - 1];
  const years = yearsBetween(first.date, last.date);
  const cagr = years > 0.05 ? (last.nav / first.nav) ** (1 / years) - 1 : null;
  let peak = usable[0].nav;
  let worst = 0;
  for (const point of usable) {
    if (point.nav > peak) peak = point.nav;
    if (peak > 0) worst = Math.min(worst, point.nav / peak - 1);
  }
  const excess: number[] = [];
  for (let i = 1; i < usable.length; i++) {
    const gap = (Date.parse(`${usable[i].date}T00:00:00Z`) - Date.parse(`${usable[i - 1].date}T00:00:00Z`)) / 86_400_000;
    const cash = gap > 0 ? (1 + CASH_YIELD_ANNUAL) ** (gap / 365.25) - 1 : 0;
    excess.push(usable[i].nav / usable[i - 1].nav - 1 - cash);
  }
  const sharpe = sharpeOf(excess);
  const traded = usable.reduce((sum, point) => sum + point.turnover, 0);
  const turnover = years > 0.05 ? traded / years : null;
  return { cagr, worst, sharpe, turnover };
}

function sharpeOf(excess: number[]): number | null {
  if (excess.length < 8) return null;
  const mean = excess.reduce((sum, value) => sum + value, 0) / excess.length;
  let acc = 0;
  for (const value of excess) acc += (value - mean) ** 2;
  const sd = Math.sqrt(acc / (excess.length - 1));
  if (!(sd > 1e-12)) return null;
  return (mean / sd) * Math.sqrt(52);
}

function statRow(period: string, book: string, path: readonly NavPoint[], start: string, end: string): ShadowStatRow {
  const slice = path.filter((point) => point.date >= start && point.date <= end);
  const stats = pathStats(slice);
  return { period, book, ...stats };
}

function audSeries(symbol: string, dates: readonly string[], bundle: ShadowBundle): ClosePoint[] {
  const bars = bundle.prices[symbol] ?? [];
  const fx = bundle.prices[FX_SYMBOL] ?? [];
  const out: ClosePoint[] = [];
  for (const date of dates) {
    const bar = lastBar(bars, date);
    if (!bar) continue;
    const marked = markInAud({ symbol, local: bar.close, priceDate: bar.date, fxBars: fx as { date: string; close: number }[] });
    if (!marked) continue;
    out.push({ date, close: marked.aud });
  }
  return out;
}

function lastBar(bars: readonly CloseBar[], date: string): CloseBar | null {
  let found: CloseBar | null = null;
  for (const bar of bars) {
    if (bar.date <= date && bar.close > 0) found = bar;
    else if (bar.date > date) break;
  }
  return found;
}

function benchmarkRow(
  period: string,
  book: string,
  dates: readonly string[],
  bundle: ShadowBundle,
  start: string,
  end: string,
  kind: 'mix' | 'qqq',
): ShadowStatRow {
  const slice = dates.filter((date) => date >= start && date <= end);
  const empty = { period, book, cagr: null, worst: null, sharpe: null, turnover: null };
  if (slice.length < 2) return empty;
  if (kind === 'qqq') {
    const qqq = audSeries('QQQ', slice, bundle);
    if (qqq.length < 2) return empty;
    const points: NavPoint[] = [{ date: qqq[0].date, nav: 1 - DRUCK_COST, turnover: 1 }];
    for (let i = 1; i < qqq.length; i++) {
      const nav = points[points.length - 1].nav * (qqq[i].close / qqq[i - 1].close);
      points.push({ date: qqq[i].date, nav, turnover: 0 });
    }
    return { period, book, ...pathStats(points) };
  }
  const spy = audSeries(DRUCK_SPY, slice, bundle);
  const bonds = audSeries('IEF', slice, bundle);
  const walked = walkSixtyForty({ dates: slice.slice(), spy, bonds, oneWay: DRUCK_COST });
  if (!walked) return empty;
  let turnover = 1;
  let spyW = 0.6;
  let month = walked.dates[0].slice(0, 7);
  for (let i = 1; i < walked.dates.length; i++) {
    const nextMonth = walked.dates[i].slice(0, 7);
    if (nextMonth !== month) {
      turnover += Math.abs(spyW - 0.6) * 2;
      spyW = 0.6;
      month = nextMonth;
    } else if (walked.values[i - 1] > 0) {
      const spyNow = spy.find((point) => point.date === walked.dates[i])?.close;
      const spyThen = spy.find((point) => point.date === walked.dates[i - 1])?.close;
      const bondNow = bonds.find((point) => point.date === walked.dates[i])?.close;
      const bondThen = bonds.find((point) => point.date === walked.dates[i - 1])?.close;
      if (spyNow && spyThen && bondNow && bondThen) {
        const spyValue = spyW * (spyNow / spyThen);
        const bondValue = (1 - spyW) * (bondNow / bondThen);
        const total = spyValue + bondValue;
        if (total > 0) spyW = spyValue / total;
      }
    }
  }
  const years = yearsBetween(walked.dates[0], walked.dates[walked.dates.length - 1]);
  const points: NavPoint[] = walked.dates.map((date, index) => ({
    date,
    nav: walked.values[index],
    turnover: index === 0 ? turnover : 0,
  }));
  const stats = pathStats(points);
  return { period, book, ...stats, turnover: years > 0.05 ? turnover / years : null };
}

function verdict(rows: readonly ShadowStatRow[], hyStart: string | null): string {
  const parts: string[] = [];
  for (const period of PERIODS) {
    const current = rows.find((row) => row.period === period.id && row.book === 'Current rules');
    const shadow = rows.find((row) => row.period === period.id && row.book === 'v2 rules');
    if (current?.cagr == null || shadow?.cagr == null) {
      const covered = hyStart && hyStart > period.start
        ? ` The free high-yield series starts on ${hyStart}, so this window was not run.`
        : '';
      parts.push(`${period.id}: not enough of a path to compare.${covered}`);
      continue;
    }
    const grew = shadow.cagr > current.cagr ? 'v2 grew faster' : 'v2 did not grow faster than the current rules';
    const fall = shadow.worst != null && current.worst != null && shadow.worst < current.worst - 1e-9
      ? ' Its worst fall was deeper.'
      : '';
    parts.push(`${period.id}: ${grew}.${fall}`);
  }
  return parts.join(' ');
}

export function laggedNetLiquidity(walcl: readonly SeriesPoint[], tga: readonly SeriesPoint[], rrpBillions: readonly SeriesPoint[]): SeriesPoint[] {
  return netLiquidityMillions(shiftDates(walcl, 7), shiftDates(tga, 3), shiftDates(rrpBillions, 1));
}

export function liveV2Read(input: {
  decision: string;
  dgs10: readonly SeriesPoint[];
  dgs2: readonly SeriesPoint[];
  dollar: readonly CloseBar[];
  walcl: readonly SeriesPoint[];
  tga: readonly SeriesPoint[];
  rrp: readonly SeriesPoint[];
}): V2MarketRead | null {
  const net = laggedNetLiquidity(input.walcl, input.tga, input.rrp);
  const score = liquidityScore(net, input.decision);
  return readV2Extras({
    decision: input.decision,
    dgs10: input.dgs10,
    dgs2: input.dgs2,
    dollarAbove200: dollarReady(input.dollar, input.decision),
    liquidityUp: score.up,
  });
}

export const SHADOW_SYMBOLS = [
  DRUCK_SPY,
  DRUCK_CASH_SYMBOL,
  'QQQ',
  'IEF',
  FX_SYMBOL,
  'DX-Y.NYB',
  ...DRUCK_CANDIDATES.map((candidate) => candidate.symbol),
];
