import type { SeriesPoint } from './series';

export interface IntervalRow {
  date: string;
  value: string | number;
  rt_start: string;
  rt_end: string;
}

export interface AsOfPoint {
  date: string;
  value: number;
  /** realtime_start of the revision that was current on the vintage date. */
  realtimeStart: string;
}

function numericValue(value: string | number): number | null {
  if (value === '.' || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Value of a series on vintage date V, with the realtime_start of each chosen row.
 * Keeps a row only when its revision interval contains V and the observation
 * date is on or before V. If two rows cover the same observation, the later
 * rt_start is the one that was current. A tie keeps the later row in the file.
 */
export function asofPoints(rows: IntervalRow[], vintage: string): AsOfPoint[] {
  const best = new Map<string, { value: number; rtStart: string; order: number }>();
  rows.forEach((row, order) => {
    const value = numericValue(row.value);
    if (value == null) return;
    if (row.date > vintage || row.rt_start > vintage || row.rt_end < vintage) return;
    const prev = best.get(row.date);
    if (!prev || row.rt_start > prev.rtStart || (row.rt_start === prev.rtStart && order >= prev.order)) {
      best.set(row.date, { value, rtStart: row.rt_start, order });
    }
  });
  return Array.from(best.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row]) => ({ date, value: row.value, realtimeStart: row.rtStart }));
}

/** Value of a series on vintage date V. */
export function asofSeries(rows: IntervalRow[], vintage: string): SeriesPoint[] {
  return asofPoints(rows, vintage).map(({ date, value }) => ({ date, value }));
}

interface IndexedRevision {
  value: number;
  rtStart: string;
  rtEnd: string;
  order: number;
}

/** One copy of the revisions, queried per vintage so a long replay does not retain every date. */
export function asofQuery(rows: IntervalRow[]): (vintage: string) => AsOfPoint[] {
  const byDate = new Map<string, IndexedRevision[]>();
  rows.forEach((row, order) => {
    const value = numericValue(row.value);
    if (value == null) return;
    const list = byDate.get(row.date) ?? [];
    list.push({ value, rtStart: row.rt_start, rtEnd: row.rt_end, order });
    byDate.set(row.date, list);
  });
  const dates = Array.from(byDate.keys()).sort();
  for (const date of dates) {
    byDate.get(date)!.sort((a, b) => a.rtStart.localeCompare(b.rtStart) || a.order - b.order);
  }
  return (vintage: string) => {
    const points: AsOfPoint[] = [];
    for (const date of dates) {
      if (date > vintage) break;
      const revs = byDate.get(date)!;
      let lo = 0;
      let hi = revs.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (revs[mid].rtStart <= vintage) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      while (idx >= 0 && revs[idx].rtEnd < vintage) idx -= 1;
      if (idx >= 0 && revs[idx].rtStart <= vintage && revs[idx].rtEnd >= vintage) {
        points.push({ date, value: revs[idx].value, realtimeStart: revs[idx].rtStart });
      }
    }
    return points;
  };
}

/**
 * Same selection as asofPoints, for many vintage dates.
 * Revisions are sorted by realtime_start, then file order.
 */
export function asofPointsMany(rows: IntervalRow[], vintages: string[]): Map<string, AsOfPoint[]> {
  const query = asofQuery(rows);
  const out = new Map<string, AsOfPoint[]>();
  for (const vintage of vintages) out.set(vintage, query(vintage));
  return out;
}
