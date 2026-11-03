import { mean, sampleStdev } from './stats';
import {
  MOMENTUM_LOOKBACK,
  MOMENTUM_SKIP,
  REVERSION_HISTORY,
  REVERSION_SPAN,
  TREND_WINDOW,
  type Bar,
} from './signals';

/** Forward trading days used for the hit-rate and information coefficient. */
export const IC_HORIZON = 20;
/** Most recent non-overlapping samples kept after stepping. */
export const IC_WINDOW = 120;
/** Fewer than this and the signal stays on the default rule. */
export const IC_MIN = 40;
/** Step so overlapping 20-day forwards are not treated as independent. */
export const IC_STEP = 5;
export const RETIRE_HIT_RATE = 0.48;
const MIN_CROSS_SECTION = 5;

export type SignalId = 'momentum' | 'trend' | 'reversion';
export type HealthStatus = 'healthy' | 'degraded' | 'retired' | 'unknown';

export interface SignalHealth {
  id: SignalId;
  label: string;
  ic: number | null;
  hitRate: number | null;
  samples: number;
  status: HealthStatus;
}

const LABELS: Record<SignalId, string> = {
  momentum: '12–1 momentum',
  trend: '200-day trend',
  reversion: '5-session mean reversion',
};

export function healthStatus(ic: number | null, hitRate: number | null, samples: number): HealthStatus {
  if (ic == null || hitRate == null || !Number.isFinite(ic) || !Number.isFinite(hitRate) || samples < IC_MIN) {
    return 'unknown';
  }
  if (ic < 0 && hitRate < RETIRE_HIT_RATE) return 'retired';
  if (ic < 0 || hitRate < RETIRE_HIT_RATE) return 'degraded';
  return 'healthy';
}

interface DatedSignal {
  date: string;
  momentum: number | null;
  trend: number | null;
  reversion: number | null;
  forward: number | null;
}

function panel(bars: Bar[]): DatedSignal[] {
  const closes: number[] = [];
  const dates: string[] = [];
  for (const bar of bars) {
    if (Number.isFinite(bar.close) && bar.close > 0) {
      closes.push(bar.close);
      dates.push(bar.date);
    }
  }
  const n = closes.length;
  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + closes[i];

  const out: DatedSignal[] = [];
  for (let i = 0; i < n; i++) {
    let momentum: number | null = null;
    if (i >= MOMENTUM_LOOKBACK) {
      const recent = closes[i - MOMENTUM_SKIP];
      const past = closes[i - MOMENTUM_LOOKBACK];
      if (recent > 0 && past > 0) momentum = recent / past - 1;
    }

    let trend: number | null = null;
    if (i + 1 >= TREND_WINDOW) {
      const ma = (prefix[i + 1] - prefix[i + 1 - TREND_WINDOW]) / TREND_WINDOW;
      trend = closes[i] > ma ? 1 : -1;
    }

    let reversion: number | null = null;
    if (i >= REVERSION_HISTORY + REVERSION_SPAN) {
      const ret = (end: number) => closes[end] / closes[end - REVERSION_SPAN] - 1;
      const latest = ret(i);
      const history: number[] = [];
      for (let end = i - REVERSION_HISTORY; end <= i - 1; end++) history.push(ret(end));
      const center = mean(history);
      const sd = sampleStdev(history);
      const z = sd < 1e-12
        ? (Math.abs(latest - center) < 1e-8 ? 0 : (latest > center ? 3 : -3))
        : Math.min(3, Math.max(-3, (latest - center) / sd));
      reversion = -z;
    }

    let forward: number | null = null;
    if (i + IC_HORIZON < n && closes[i] > 0) forward = closes[i + IC_HORIZON] / closes[i] - 1;
    out.push({ date: dates[i], momentum, trend, reversion, forward });
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < MIN_CROSS_SECTION || ys.length !== n) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx < 1e-18 || dy < 1e-18) return null;
  return num / Math.sqrt(dx * dy);
}

function hitRate(xs: number[], ys: number[]): number | null {
  let hits = 0;
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === 0 || ys[i] === 0) continue;
    n += 1;
    if (Math.sign(xs[i]) === Math.sign(ys[i])) hits += 1;
  }
  if (n < MIN_CROSS_SECTION) return null;
  return hits / n;
}

function summarize(id: SignalId, rows: Map<string, { signal: number[]; forward: number[] }>): SignalHealth {
  const dates = Array.from(rows.keys()).filter((date) => {
    const row = rows.get(date);
    return row != null && row.signal.length >= MIN_CROSS_SECTION;
  }).sort();

  const picked: string[] = [];
  for (let i = dates.length - 1; i >= 0 && picked.length < IC_WINDOW; i -= IC_STEP) picked.push(dates[i]);

  const ics: number[] = [];
  const hits: number[] = [];
  for (const date of picked) {
    const row = rows.get(date);
    if (!row) continue;
    const ic = pearson(row.signal, row.forward);
    const hit = hitRate(row.signal, row.forward);
    if (ic == null || hit == null) continue;
    ics.push(ic);
    hits.push(hit);
  }

  const samples = ics.length;
  const ic = samples ? ics.reduce((sum, value) => sum + value, 0) / samples : null;
  const rate = samples ? hits.reduce((sum, value) => sum + value, 0) / samples : null;
  return {
    id,
    label: LABELS[id],
    ic,
    hitRate: rate,
    samples,
    status: healthStatus(ic, rate, samples),
  };
}

/**
 * Cross-sectional information coefficient and hit rate.
 * Momentum uses the 12–1 value, trend is +1/−1, and the reversion signal
 * is the sign-flipped 5-session z (the veto points the other way).
 * A short sample stays unknown and does not retire anything.
 */
export function evaluateSignalHealth(series: { symbol: string; bars: Bar[] }[]): SignalHealth[] {
  const panels = series.map((item) => panel(item.bars));
  const buckets: Record<SignalId, Map<string, { signal: number[]; forward: number[] }>> = {
    momentum: new Map(),
    trend: new Map(),
    reversion: new Map(),
  };

  for (const points of panels) {
    for (const point of points) {
      if (point.forward == null) continue;
      const add = (id: SignalId, signal: number | null) => {
        if (signal == null || !Number.isFinite(signal)) return;
        let row = buckets[id].get(point.date);
        if (!row) {
          row = { signal: [], forward: [] };
          buckets[id].set(point.date, row);
        }
        row.signal.push(signal);
        row.forward.push(point.forward as number);
      };
      add('momentum', point.momentum);
      add('trend', point.trend);
      add('reversion', point.reversion);
    }
  }

  return [
    summarize('momentum', buckets.momentum),
    summarize('trend', buckets.trend),
    summarize('reversion', buckets.reversion),
  ];
}
