import { mean, sampleStdev } from './stats';
import { averageTrueRange, DEFAULT_ATR_K, DEFAULT_RISK_PCT } from './sizing';
import { DIP_HIGH, DIP_LOW } from './dip';
import { MOMENTUM_LOOKBACK, type Bar } from './signals';

export interface ParamBound {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** The weekly job may only move these. Theme switches are not in this list. */
export const PARAM_BOUNDS: ParamBound[] = [
  { id: 'atr-k', label: 'ATR multiple', min: 1.5, max: 4, step: 0.5, default: DEFAULT_ATR_K },
  { id: 'risk-pct', label: 'Risk per entry', min: 0.005, max: 0.01, step: 0.0025, default: DEFAULT_RISK_PCT },
  { id: 'momentum-lookback', label: 'Momentum lookback (sessions)', min: 189, max: 315, step: 21, default: MOMENTUM_LOOKBACK },
  { id: 'dip-low', label: 'Dip band floor', min: 0.05, max: 0.15, step: 0.05, default: DIP_LOW },
  { id: 'dip-high', label: 'Dip band ceiling', min: 0.15, max: 0.3, step: 0.05, default: DIP_HIGH },
];

export interface FoldMetric {
  sharpe: number | null;
  calmar: number | null;
  cagr: number | null;
  maxDrawdown: number | null;
}

export function sharpeRatio(daily: number[]): number | null {
  if (daily.length < 20) return null;
  const sd = sampleStdev(daily);
  if (!(sd > 1e-12)) return null;
  const value = (mean(daily) / sd) * Math.sqrt(252);
  return Number.isFinite(value) ? value : null;
}

export function maxDrawdown(equity: number[]): number | null {
  if (equity.length < 2) return null;
  let peak = equity[0];
  let worst = 0;
  for (const value of equity) {
    if (!(value > 0)) return null;
    if (value > peak) peak = value;
    worst = Math.max(worst, (peak - value) / peak);
  }
  return worst;
}

export function equityCurve(daily: number[], start = 1): number[] {
  const curve = [start];
  let equity = start;
  for (const ret of daily) {
    equity *= 1 + ret;
    curve.push(equity);
  }
  return curve;
}

/** Annualised only after 30 daily observations. A shorter path does not get a made-up CAGR. */
export function cagrFromCurve(curve: number[]): number | null {
  if (curve.length < 31) return null;
  const start = curve[0];
  const end = curve[curve.length - 1];
  const days = curve.length - 1;
  if (!(start > 0) || !(end > 0)) return null;
  return (end / start) ** (365 / days) - 1;
}

export function foldMetric(daily: number[]): FoldMetric {
  const curve = equityCurve(daily);
  const dd = maxDrawdown(curve);
  const cagr = cagrFromCurve(curve);
  const calmar = cagr != null && dd != null && dd > 1e-8 ? cagr / dd : null;
  return { sharpe: sharpeRatio(daily), calmar, cagr, maxDrawdown: dd };
}

export function splitFolds<T>(items: T[], folds = 3, minPerFold = 20): T[][] | null {
  if (items.length < folds * minPerFold) return null;
  const size = Math.floor(items.length / folds);
  const out: T[][] = [];
  for (let i = 0; i < folds; i++) {
    const start = i * size;
    const end = i === folds - 1 ? items.length : start + size;
    out.push(items.slice(start, end));
  }
  return out;
}

/**
 * A fold counts only when the candidate improves the out-of-sample risk-adjusted result.
 * Higher Sharpe wins. An equal Sharpe needs a higher Calmar. A lower Sharpe never wins.
 * Full-sample return is not an input.
 */
export function foldWins(incumbent: FoldMetric[], candidate: FoldMetric[]): number {
  const n = Math.min(incumbent.length, candidate.length);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const left = incumbent[i].sharpe;
    const right = candidate[i].sharpe;
    if (left == null || right == null) continue;
    if (right > left + 1e-9) {
      wins += 1;
      continue;
    }
    if (Math.abs(right - left) <= 1e-9) {
      const lc = incumbent[i].calmar;
      const rc = candidate[i].calmar;
      if (lc != null && rc != null && rc > lc + 1e-9) wins += 1;
    }
  }
  return wins;
}

export function snapToBound(value: number, bound: ParamBound): number | null {
  if (value < bound.min - 1e-9 || value > bound.max + 1e-9) return null;
  const steps = Math.round((value - bound.default) / bound.step);
  const snapped = bound.default + steps * bound.step;
  if (Math.abs(snapped - value) > 1e-8) return null;
  if (snapped < bound.min - 1e-9 || snapped > bound.max + 1e-9) return null;
  return Math.round(snapped * 1e8) / 1e8;
}

export function neighbors(current: number, bound: ParamBound): number[] {
  const snapped = snapToBound(current, bound);
  const base = snapped ?? bound.default;
  const out: number[] = [];
  for (const delta of [-bound.step, bound.step]) {
    const next = snapToBound(Math.round((base + delta) * 1e8) / 1e8, bound);
    if (next != null && Math.abs(next - base) > 1e-9) out.push(next);
  }
  return out;
}

export function chooseTweak(input: {
  incumbent: FoldMetric[];
  candidates: { value: number; folds: FoldMetric[] }[];
}): { value: number; wins: number } | null {
  let best: { value: number; wins: number } | null = null;
  for (const candidate of input.candidates) {
    const wins = foldWins(input.incumbent, candidate.folds);
    if (wins < 2) continue;
    if (!best || wins > best.wins) best = { value: candidate.value, wins };
  }
  return best;
}

export function changeAllowed(log: { ruleId: string; at: string }[], ruleId: string, nowIso: string): boolean {
  const month = nowIso.slice(0, 7);
  return !log.some((entry) => entry.ruleId === ruleId && entry.at.slice(0, 7) === month);
}

export function laggedReturns(closes: number[], signalAt: (index: number) => boolean | null): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const on = signalAt(i - 1);
    if (on == null || !(closes[i - 1] > 0) || !(closes[i] > 0)) continue;
    const ret = closes[i] / closes[i - 1] - 1;
    out.push(on ? ret : 0);
  }
  return out;
}

export function momentumReturns(closes: number[], lookback: number): number[] {
  return laggedReturns(closes, (index) => {
    if (index < lookback || !(closes[index - lookback] > 0)) return null;
    return closes[index] > closes[index - lookback];
  });
}

/** Long when close is above the 200-day average, flat after a close through entry − k×ATR. */
export function stopSystemReturns(bars: Bar[], k: number): number[] {
  const closes = bars.map((bar) => bar.close);
  const out: number[] = [];
  let holding = false;
  let stop = 0;
  for (let i = 1; i < bars.length; i++) {
    const prev = closes[i - 1];
    const close = closes[i];
    if (!(prev > 0) || !(close > 0)) continue;
    out.push(holding ? close / prev - 1 : 0);
    if (holding && close <= stop) holding = false;
    if (!holding && i >= 199) {
      let sum = 0;
      for (let j = i - 199; j <= i; j++) sum += closes[j];
      const atr = averageTrueRange(bars.slice(0, i + 1));
      if (close > sum / 200 && atr != null && atr > 0 && k > 0) {
        holding = true;
        stop = close - k * atr;
      }
    }
  }
  return out;
}

export function dipBandReturns(closes: number[], low: number, high: number): number[] {
  return laggedReturns(closes, (index) => {
    if (index < 59) return null;
    const window = closes.slice(index - 59, index + 1);
    let peak = window[0];
    for (const price of window) if (price > peak) peak = price;
    const last = window[window.length - 1];
    if (!(peak > 0) || !(last > 0)) return null;
    const drawdown = 1 - last / peak;
    const maWindow = closes.slice(Math.max(0, index - 19), index + 1);
    let sum = 0;
    for (const price of maWindow) sum += price;
    return drawdown >= low && drawdown <= high && last > sum / maWindow.length;
  });
}

export function metricsByFold(daily: number[]): FoldMetric[] | null {
  const folds = splitFolds(daily);
  if (!folds) return null;
  return folds.map((fold) => foldMetric(fold));
}

export interface WeekChange {
  at: string;
  ruleId: string;
  action: 'promoted' | 'demoted' | 'retired';
  detail: string;
  from?: number;
  to?: number;
}

/** Pick at most one in-bound step per rule. Rejects a second change in the same UTC month. */
export function reviewParameter(input: {
  ruleId: string;
  current: number;
  nowIso: string;
  log: { ruleId: string; at: string }[];
  seriesFor: (value: number) => number[];
}): WeekChange | null {
  const bound = PARAM_BOUNDS.find((item) => item.id === input.ruleId);
  if (!bound) return null;
  if (!changeAllowed(input.log, input.ruleId, input.nowIso)) return null;
  const current = snapToBound(input.current, bound);
  if (current == null) return null;
  const incumbent = metricsByFold(input.seriesFor(current));
  if (!incumbent) return null;
  const candidates = neighbors(current, bound).map((value) => ({
    value,
    folds: metricsByFold(input.seriesFor(value)) ?? [],
  })).filter((candidate) => candidate.folds.length === incumbent.length);
  const chosen = chooseTweak({ incumbent, candidates });
  if (!chosen) return null;
  return {
    at: input.nowIso,
    ruleId: input.ruleId,
    action: 'promoted',
    from: current,
    to: chosen.value,
    detail: `${bound.label} moved from ${current} to ${chosen.value} after winning ${chosen.wins} of 3 out-of-sample folds.`,
  };
}
