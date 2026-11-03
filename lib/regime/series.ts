export interface SeriesPoint {
  date: string;
  value: number;
}

export function lastOnOrBefore(series: SeriesPoint[], date: string): SeriesPoint | null {
  let found: SeriesPoint | null = null;
  for (const point of series) {
    if (point.date <= date) found = point;
    else break;
  }
  return found;
}

export function lastPoint(series: SeriesPoint[]): SeriesPoint | null {
  return series.length ? series[series.length - 1] : null;
}

/** Keep the latest numeric print for each YYYY-MM-DD. Drops FRED "." gaps. */
export function parseFredObservations(payload: unknown): SeriesPoint[] {
  if (!payload || typeof payload !== 'object') return [];
  const observations = (payload as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) return [];
  const byDate = new Map<string, number>();
  for (const row of observations) {
    if (!row || typeof row !== 'object') continue;
    const date = 'date' in row && typeof row.date === 'string' ? row.date : '';
    const raw = 'value' in row && typeof row.value === 'string' ? row.value : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (raw === '.' || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    byDate.set(date, value);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}

export function trailingChange(series: SeriesPoint[], periods: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = periods; i < series.length; i++) {
    out.push({
      date: series[i].date,
      value: series[i].value - series[i - periods].value,
    });
  }
  return out;
}

export function negated(series: SeriesPoint[]): SeriesPoint[] {
  return series.map((point) => ({ date: point.date, value: -point.value }));
}

/**
 * Net liquidity in millions of USD.
 * WALCL and WTREGEN are millions. RRPONTSYD is billions, so it is ×1000.
 * A week is emitted only when TGA and RRP both have a print on or before it.
 */
export function netLiquidityMillions(
  walcl: SeriesPoint[],
  tga: SeriesPoint[],
  rrpBillions: SeriesPoint[],
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const week of walcl) {
    const treasury = lastOnOrBefore(tga, week.date);
    const rrp = lastOnOrBefore(rrpBillions, week.date);
    if (!treasury || !rrp) continue;
    out.push({
      date: week.date,
      value: week.value - treasury.value - rrp.value * 1000,
    });
  }
  return out;
}

/** Policy rate minus 2-year yield, in percentage points. Aligned on DGS2 dates. */
export function policyGap(dgs2: SeriesPoint[], policyRate: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const yieldPoint of dgs2) {
    const policy = lastOnOrBefore(policyRate, yieldPoint.date);
    if (!policy) continue;
    out.push({ date: yieldPoint.date, value: policy.value - yieldPoint.value });
  }
  return out;
}

/** Left minus the right-hand print on or before the same date. */
export function differenceAligned(left: SeriesPoint[], right: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const point of left) {
    const other = lastOnOrBefore(right, point.date);
    if (!other) continue;
    out.push({ date: point.date, value: point.value - other.value });
  }
  return out;
}

export interface CotRow {
  report_date_as_yyyy_mm_dd?: string;
  open_interest_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
}

function cotNumber(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Non-commercial net position divided by open interest.
 * Legacy futures-only COT (CFTC dataset 6dca-aqww). One row per report date.
 */
export function parseCotNetOi(payload: unknown): SeriesPoint[] {
  if (!Array.isArray(payload)) return [];
  const byDate = new Map<string, number>();
  for (const row of payload as CotRow[]) {
    if (!row || typeof row !== 'object') continue;
    const date = typeof row.report_date_as_yyyy_mm_dd === 'string'
      ? row.report_date_as_yyyy_mm_dd.slice(0, 10)
      : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const oi = cotNumber(row.open_interest_all);
    const long = cotNumber(row.noncomm_positions_long_all);
    const short = cotNumber(row.noncomm_positions_short_all);
    if (oi == null || oi <= 0 || long == null || short == null) continue;
    byDate.set(date, (long - short) / oi);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}
