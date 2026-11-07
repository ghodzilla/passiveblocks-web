import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { asofSeries, type IntervalRow } from '../../lib/regime/alfredAsOf';
import { previousCalendarDay, type VintagePanel } from '../../lib/regime/replay';

export function loadIntervalFiles(dir: string): Record<string, IntervalRow[]> {
  const out: Record<string, IntervalRow[]> = {};
  for (const name of readdirSync(dir)) {
    const match = name.match(/^intervals_([A-Z0-9]+)\.jsonl$/);
    if (!match) continue;
    const rows: IntervalRow[] = [];
    for (const line of readFileSync(path.join(dir, name), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as IntervalRow;
      rows.push(row);
    }
    out[match[1]] = rows;
  }
  return out;
}

export function panelAt(intervals: Record<string, IntervalRow[]>, decisionDate: string): VintagePanel {
  const vintageDate = previousCalendarDay(decisionDate);
  const series: VintagePanel['series'] = {};
  for (const [id, rows] of Object.entries(intervals)) series[id] = asofSeries(rows, vintageDate);
  return { decisionDate, vintageDate, series, positioning: null };
}
