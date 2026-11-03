import type { Bar } from './signals';
import { sampleStdev } from './stats';

/** Trailing sessions used for the average pairwise correlation. */
export const CORR_WINDOW = 60;
/** Below this many series the alarm is unknown and weights are not scaled. */
export const CORR_MIN_SERIES = 8;
/** Correlation at or below this leaves suggested weights unchanged. */
export const CORR_WARN = 0.55;
/** At or above this, risk weights are scaled by the floor. */
export const CORR_ALARM = 0.7;
export const CORR_SCALE_FLOOR = 0.5;
export const DISPERSION_WINDOW = 20;

export interface CrowdingReport {
  average: number | null;
  dispersion: number | null;
  scale: number;
  names: number;
  pairs: number;
  warning: string | null;
  gap: string | null;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
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

/**
 * 1 at or below the warning line, the floor at or above the alarm line,
 * linear in between. Unknown correlation returns 1 so a missing book
 * does not invent a haircut.
 */
export function crowdingScale(average: number | null): number {
  if (average == null || !Number.isFinite(average)) return 1;
  if (average <= CORR_WARN) return 1;
  if (average >= CORR_ALARM) return CORR_SCALE_FLOOR;
  const t = (average - CORR_WARN) / (CORR_ALARM - CORR_WARN);
  return 1 - t * (1 - CORR_SCALE_FLOOR);
}

function returnMap(bars: Bar[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev > 0 && curr > 0) out.set(bars[i].date, Math.log(curr / prev));
  }
  return out;
}

export function pairCorrelation(a: Bar[], b: Bar[], window = CORR_WINDOW): number | null {
  const left = returnMap(a);
  const right = returnMap(b);
  const dates: string[] = [];
  for (const date of Array.from(left.keys())) {
    if (right.has(date)) dates.push(date);
  }
  dates.sort();
  if (dates.length < window) return null;
  const slice = dates.slice(-window);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const date of slice) {
    xs.push(left.get(date) as number);
    ys.push(right.get(date) as number);
  }
  return pearson(xs, ys);
}

function windowReturn(bars: Bar[], window: number): number | null {
  if (bars.length < window + 1) return null;
  const last = bars[bars.length - 1].close;
  const past = bars[bars.length - 1 - window].close;
  if (last <= 0 || past <= 0) return null;
  return last / past - 1;
}

export function crowdingReport(series: { symbol: string; bars: Bar[] }[]): CrowdingReport {
  const usable = series.filter((item) => item.bars.length >= CORR_WINDOW + 1);
  const maps = usable.map((item) => returnMap(item.bars));
  let pairs = 0;
  let sum = 0;
  for (let i = 0; i < maps.length; i++) {
    for (let j = i + 1; j < maps.length; j++) {
      const corr = pairCorrelation(usable[i].bars, usable[j].bars);
      if (corr == null || !Number.isFinite(corr)) continue;
      pairs += 1;
      sum += corr;
    }
  }

  const minPairs = (CORR_MIN_SERIES * (CORR_MIN_SERIES - 1)) / 2;
  const average = usable.length >= CORR_MIN_SERIES && pairs >= minPairs ? sum / pairs : null;
  const scale = crowdingScale(average);

  const disp: number[] = [];
  for (const item of series) {
    const ret = windowReturn(item.bars, DISPERSION_WINDOW);
    if (ret != null && Number.isFinite(ret)) disp.push(ret);
  }
  const dispersion = disp.length >= CORR_MIN_SERIES ? sampleStdev(disp) : null;

  let gap: string | null = null;
  if (average == null) {
    gap = `Crowding is unknown: fewer than ${CORR_MIN_SERIES} series share ${CORR_WINDOW} overlapping return dates (${usable.length} long enough, ${pairs} pairs). Suggested weights were not scaled.`;
  }

  let warning: string | null = null;
  if (average != null && average > CORR_WARN) {
    const dispText = dispersion == null ? 'Cross-sectional dispersion is unavailable.' : `Cross-sectional ${DISPERSION_WINDOW}-day dispersion is ${(dispersion * 100).toFixed(1)}%.`;
    warning = `Crowding alarm: average pairwise correlation is ${average.toFixed(2)} across ${usable.length} names (${pairs} pairs). Suggested risk weights are scaled by ${scale.toFixed(2)}. Cash is not scaled. ${dispText}`;
  }

  return {
    average,
    dispersion,
    scale,
    names: usable.length,
    pairs,
    warning,
    gap,
  };
}

export function pairTable(
  series: { symbol: string; bars: Bar[] }[],
  symbols: string[],
): { pairs: { a: string; b: string; corr: number }[]; unavailable: boolean } {
  const bySymbol = new Map<string, Bar[]>();
  for (const item of series) bySymbol.set(item.symbol, item.bars);
  const unique = Array.from(new Set(symbols));
  const pairs: { a: string; b: string; corr: number }[] = [];
  let attempted = 0;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const left = bySymbol.get(unique[i]);
      const right = bySymbol.get(unique[j]);
      if (!left || !right) continue;
      attempted += 1;
      const corr = pairCorrelation(left, right);
      if (corr == null || !Number.isFinite(corr)) continue;
      pairs.push({ a: unique[i], b: unique[j], corr });
    }
  }
  return { pairs, unavailable: unique.length >= 2 && pairs.length === 0 && attempted >= 0 };
}
