import type { SeriesPoint } from './series';

export function mean(values: number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Sample standard deviation. Returns 0 when n < 2. */
export function sampleStdev(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  let acc = 0;
  for (const value of values) {
    const d = value - center;
    acc += d * d;
  }
  return Math.sqrt(acc / (values.length - 1));
}

/**
 * Trailing z-score of the last observation.
 * The window includes the current point (causal, in-sample). Winsorised at ±3.
 * Returns null until minObs points exist. A flat window returns 0.
 */
export function zFromSlice(slice: number[]): number {
  if (slice.length < 2) return 0;
  const sd = sampleStdev(slice);
  if (sd < 1e-12) return 0;
  return clamp((slice[slice.length - 1] - mean(slice)) / sd, -3, 3);
}

export function zScoreLatest(values: number[], window: number, minObs: number): number | null {
  if (values.length < minObs) return null;
  const slice = values.slice(-window);
  if (slice.length < minObs) return null;
  return zFromSlice(slice);
}

export function zScoreSeries(values: number[], window: number, minObs: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out[i] = slice.length < minObs ? null : zFromSlice(slice);
  }
  return out;
}

export function ageInDays(asOf: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

export function lastIndexOnOrBefore(series: SeriesPoint[], date: string): number {
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
