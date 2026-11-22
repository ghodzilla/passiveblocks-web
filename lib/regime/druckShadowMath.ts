import { LIQUIDITY_CHANGE_WEEKS, WINDOWS } from './constants';
import { threeMonthsBefore, type V2MarketRead } from './druck';
import { zScoreLatest } from './stats';
import { lastOnOrBefore, trailingChange, type SeriesPoint } from './series';
import { ageDays, type CloseBar } from './visser';

export interface NavPoint {
  date: string;
  nav: number;
  /** Share of the book traded that week. Buys and sells are added together. */
  turnover: number;
}

export function shiftDates(points: readonly SeriesPoint[], days: number): SeriesPoint[] {
  return points.map((point) => ({ date: addUtcDays(point.date, days), value: point.value }));
}

function addUtcDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Liquidity z-score and the 3-month direction, using only points dated on or before the decision.
 * The z-score matches the live book: 13-week change, 156-week window, winsorised at ±3.
 */
export function liquidityScore(net: readonly SeriesPoint[], decision: string): { z: number | null; up: boolean | null } {
  const history: SeriesPoint[] = net.filter((point) => point.date <= decision).map((point) => ({ date: point.date, value: point.value }));
  const changes = trailingChange(history, LIQUIDITY_CHANGE_WEEKS);
  const z = zScoreLatest(changes.map((point) => point.value), WINDOWS.liquidity.window, WINDOWS.liquidity.min);
  const now = history.length > 0 ? history[history.length - 1] : null;
  const then = lastOnOrBefore(history, threeMonthsBefore(decision));
  const up = now && then ? now.value + 1e-9 >= then.value : null;
  return { z, up };
}

/** True when the dollar index close is above its own 200-day average. Null when that average is not ready. */
export function dollarReady(bars: readonly CloseBar[], decision: string): boolean | null {
  const closes = bars.filter((bar) => bar.date <= decision && bar.close > 0);
  if (closes.length < 200) return null;
  const last = closes[closes.length - 1];
  if (ageDays(last.date, decision) > 10) return null;
  let sum = 0;
  for (let i = closes.length - 200; i < closes.length; i++) sum += closes[i].close;
  const average = sum / 200;
  if (!(last.close > 0) || !(average > 0)) return null;
  return last.close > average;
}

function yieldPair(points: readonly SeriesPoint[], decision: string): { now: number; then: number } | null {
  const series = points.map((point) => ({ date: point.date, value: point.value }));
  const now = lastOnOrBefore(series, decision);
  const then = lastOnOrBefore(series, threeMonthsBefore(decision));
  if (!now || !then) return null;
  if (ageDays(now.date, decision) > 10) return null;
  if (ageDays(then.date, threeMonthsBefore(decision)) > 10) return null;
  return { now: now.value, then: then.value };
}

/** The three extra checks. Null when any one of them is missing. Nothing is filled in. */
export function readV2Extras(input: {
  decision: string;
  dgs10: readonly SeriesPoint[];
  dgs2: readonly SeriesPoint[];
  dollarAbove200: boolean | null;
  liquidityUp: boolean | null;
}): V2MarketRead | null {
  const yield10 = yieldPair(input.dgs10, input.decision);
  const yield2 = yieldPair(input.dgs2, input.decision);
  if (!yield10 || !yield2 || input.dollarAbove200 == null || input.liquidityUp == null) return null;
  return {
    yield10Now: yield10.now,
    yield10Then: yield10.then,
    curveNow: yield10.now - yield2.now,
    curveThen: yield10.then - yield2.then,
    dollarAbove200: input.dollarAbove200,
    liquidityUp: input.liquidityUp,
  };
}
