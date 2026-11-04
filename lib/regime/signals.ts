import { clamp, mean, sampleStdev } from './stats';

export interface Bar {
  date: string;
  close: number;
  high?: number;
  low?: number;
}

/** Skip the most recent month (21 sessions) and measure the year before that. */
export const MOMENTUM_SKIP = 21;
export const MOMENTUM_LOOKBACK = 252;
export const TREND_WINDOW = 200;
export const VOL_WINDOW = 20;
export const REVERSION_SPAN = 5;
export const REVERSION_HISTORY = 60;
/** A long is not confirmed when the 5-session return z-score is this stretched or higher. */
export const REVERSION_VETO = 1.5;

export interface QuantSignals {
  asOf: string | null;
  lastClose: number | null;
  momentum12_1: number | null;
  ma200: number | null;
  above200: boolean | null;
  annVol20: number | null;
  reversionZ: number | null;
}

export function computeSignals(bars: Bar[]): QuantSignals {
  const closes = bars.map((bar) => bar.close).filter((close) => Number.isFinite(close) && close > 0);
  const last = bars.length > 0 ? bars[bars.length - 1] : null;
  const empty: QuantSignals = {
    asOf: last?.date ?? null,
    lastClose: last && last.close > 0 ? last.close : null,
    momentum12_1: null,
    ma200: null,
    above200: null,
    annVol20: null,
    reversionZ: null,
  };
  if (closes.length === 0) return empty;

  const n = closes.length;
  let momentum12_1: number | null = null;
  if (n >= MOMENTUM_LOOKBACK + 1) {
    const recent = closes[n - 1 - MOMENTUM_SKIP];
    const past = closes[n - 1 - MOMENTUM_LOOKBACK];
    if (recent > 0 && past > 0) momentum12_1 = recent / past - 1;
  }

  let ma200: number | null = null;
  let above200: boolean | null = null;
  if (n >= TREND_WINDOW) {
    ma200 = mean(closes.slice(n - TREND_WINDOW));
    above200 = closes[n - 1] > ma200;
  }

  let annVol20: number | null = null;
  if (n >= VOL_WINDOW + 1) {
    const rets: number[] = [];
    for (let i = n - VOL_WINDOW; i < n; i++) {
      const prev = closes[i - 1];
      const curr = closes[i];
      if (prev > 0 && curr > 0) rets.push(Math.log(curr / prev));
    }
    if (rets.length >= 2) annVol20 = sampleStdev(rets) * Math.sqrt(252);
  }

  let reversionZ: number | null = null;
  if (n >= REVERSION_HISTORY + REVERSION_SPAN + 1) {
    const ret = (end: number) => closes[end] / closes[end - REVERSION_SPAN] - 1;
    const latest = ret(n - 1);
    const history: number[] = [];
    for (let end = n - 1 - REVERSION_HISTORY; end <= n - 2; end++) history.push(ret(end));
    const center = mean(history);
    const sd = sampleStdev(history);
    if (sd < 1e-12) reversionZ = Math.abs(latest - center) < 1e-8 ? 0 : (latest > center ? 3 : -3);
    else reversionZ = clamp((latest - center) / sd, -3, 3);
  }

  return {
    asOf: last?.date ?? null,
    lastClose: closes[n - 1],
    momentum12_1,
    ma200,
    above200,
    annVol20,
    reversionZ,
  };
}

export type SignalId = 'momentum' | 'trend' | 'reversion';
export type SignalHealthStatus = 'healthy' | 'degraded' | 'retired' | 'unknown';

/** Minimal view so confirmation can down-weight a decayed signal without importing the IC panel. */
export interface SignalHealthView {
  id: SignalId;
  status: SignalHealthStatus;
}

const STRENGTH_PRIOR: Record<SignalId, number> = {
  momentum: 0.5,
  trend: 0.3,
  reversion: 0.2,
};

function statusOf(health: SignalHealthView[] | undefined, id: SignalId): SignalHealthStatus {
  return health?.find((item) => item.id === id)?.status ?? 'unknown';
}

/**
 * Retired signals drop out and the rest are renormalised. A degraded signal
 * keeps half of its prior weight. Unknown keeps the default blend.
 * Returns null when momentum and trend are both retired.
 */
export function signalBlendWeights(health?: SignalHealthView[]): Record<SignalId, number> | null {
  const weights: Record<SignalId, number> = { momentum: 0, trend: 0, reversion: 0 };
  for (const id of ['momentum', 'trend', 'reversion'] as const) {
    const status = statusOf(health, id);
    if (status === 'retired') weights[id] = 0;
    else if (status === 'degraded') weights[id] = STRENGTH_PRIOR[id] * 0.5;
    else weights[id] = STRENGTH_PRIOR[id];
  }
  if (weights.momentum === 0 && weights.trend === 0) return null;
  const sum = weights.momentum + weights.trend + weights.reversion;
  if (sum <= 0) return null;
  return {
    momentum: weights.momentum / sum,
    trend: weights.trend / sum,
    reversion: weights.reversion / sum,
  };
}

/**
 * Long confirmation. Cash is the ballast: a flat price is the point, so
 * momentum and trend do not veto it. Everything else needs a positive 12–1
 * month return, price above the 200-day average, and a 5-session return
 * that is not stretched versus its own trailing distribution.
 * A retired signal is not a gate. If both momentum and trend are retired,
 * reversion alone cannot confirm.
 */
export function quantAgrees(
  role: 'tactical' | 'systematic' | 'cash',
  signals: QuantSignals,
  health?: SignalHealthView[],
): boolean {
  if (role === 'cash') {
    return signals.lastClose != null && signals.annVol20 != null && signals.asOf != null;
  }
  const momentum = statusOf(health, 'momentum');
  const trend = statusOf(health, 'trend');
  const reversion = statusOf(health, 'reversion');
  if (momentum === 'retired' && trend === 'retired') return false;
  if (momentum !== 'retired') {
    if (signals.momentum12_1 == null || !(signals.momentum12_1 > 0)) return false;
  }
  if (trend !== 'retired') {
    if (signals.above200 == null || !signals.above200) return false;
  }
  if (reversion !== 'retired') {
    if (signals.reversionZ == null || !(signals.reversionZ < REVERSION_VETO)) return false;
  }
  return true;
}

/** Blend of momentum, trend, and an unstretched short-term z-score. Null when the two trend inputs are missing or both are retired. */
export function signalStrength(signals: QuantSignals, health?: SignalHealthView[]): number | null {
  const weights = signalBlendWeights(health);
  if (!weights) return null;
  if (weights.momentum > 0 && signals.momentum12_1 == null) return null;
  if (weights.trend > 0 && signals.above200 == null) return null;
  const mom = signals.momentum12_1 == null ? 0 : clamp(signals.momentum12_1 / 0.25, -1, 1);
  const trend = signals.above200 == null ? 0 : (signals.above200 ? 1 : -1);
  const revert = signals.reversionZ == null ? 0 : clamp(-signals.reversionZ / 2, -1, 1);
  return weights.momentum * mom + weights.trend * trend + weights.reversion * revert;
}
