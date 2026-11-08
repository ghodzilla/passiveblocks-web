import type { SeriesPoint } from './series';

export interface IntervalRow {
  date: string;
  value: string | number;
  rt_start: string;
  rt_end: string;
}

/**
 * Value of a series on vintage date V.
 * Keeps a row only when its revision interval contains V and the observation
 * date is on or before V. If two rows cover the same observation, the later
 * rt_start is the one that was current.
 */
export function asofSeries(rows: IntervalRow[], vintage: string): SeriesPoint[] {
  const best = new Map<string, { value: number; rtStart: string }>();
  for (const row of rows) {
    if (row.value === '.' || row.value === '') continue;
    if (row.date > vintage || row.rt_start > vintage || row.rt_end < vintage) continue;
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    if (!Number.isFinite(value)) continue;
    const prev = best.get(row.date);
    if (!prev || row.rt_start >= prev.rtStart) best.set(row.date, { value, rtStart: row.rt_start });
  }
  return Array.from(best.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row]) => ({ date, value: row.value }));
}
