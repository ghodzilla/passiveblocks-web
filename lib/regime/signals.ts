import { clamp, mean, sampleStdev } from './stats';

export interface Bar {
  date: string;
  close: number;
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

/**
 * Long confirmation. Cash is the ballast: a flat price is the point, so
 * momentum and trend do not veto it. Everything else needs a positive 12–1
 * month return, price above the 200-day average, and a 5-session return
 * that is not stretched versus its own trailing distribution.
 */
export function quantAgrees(role: 'tactical' | 'systematic' | 'cash', signals: QuantSignals): boolean {
  if (role === 'cash') {
    return signals.lastClose != null && signals.annVol20 != null && signals.asOf != null;
  }
  if (signals.momentum12_1 == null || signals.above200 == null || signals.reversionZ == null) return false;
  return signals.momentum12_1 > 0 && signals.above200 && signals.reversionZ < REVERSION_VETO;
}

/** Blend of momentum, trend, and an unstretched short-term z-score. Null when the two trend inputs are missing. */
export function signalStrength(signals: QuantSignals): number | null {
  if (signals.momentum12_1 == null || signals.above200 == null) return null;
  const mom = clamp(signals.momentum12_1 / 0.25, -1, 1);
  const trend = signals.above200 ? 1 : -1;
  const revert = signals.reversionZ == null ? 0 : clamp(-signals.reversionZ / 2, -1, 1);
  return 0.5 * mom + 0.3 * trend + 0.2 * revert;
}
