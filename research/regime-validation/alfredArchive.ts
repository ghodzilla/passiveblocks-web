import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import type { IntervalRow } from '../../lib/regime/alfredAsOf';

export interface AlfredFile {
  id: string;
  rows: IntervalRow[];
  vintageDates: string[];
}

interface FredObservations {
  observations?: { realtime_start?: string; realtime_end?: string; date?: string; value?: string | number }[];
}

interface FredVintageDates {
  vintage_dates?: string[];
}

export function loadAlfredSeries(dir: string, id: string): AlfredFile {
  const observations = JSON.parse(gunzipSync(readFileSync(path.join(dir, `${id}.observations.json.gz`))).toString()) as FredObservations;
  const vintages = JSON.parse(gunzipSync(readFileSync(path.join(dir, `${id}.vintagedates.json.gz`))).toString()) as FredVintageDates;
  const rows: IntervalRow[] = [];
  for (const row of observations.observations ?? []) {
    if (!row || typeof row.date !== 'string' || typeof row.realtime_start !== 'string' || typeof row.realtime_end !== 'string') continue;
    if (typeof row.value !== 'string' && typeof row.value !== 'number') continue;
    rows.push({ date: row.date, value: row.value, rt_start: row.realtime_start, rt_end: row.realtime_end });
  }
  const vintageDates = Array.from(new Set(vintages.vintage_dates ?? [])).sort();
  return { id, rows, vintageDates };
}

export const ALFRED_SERIES = [
  'WALCL',
  'WTREGEN',
  'RRPONTSYD',
  'DGS2',
  'BAMLH0A0HYM2',
  'DFEDTARU',
  'DFF',
  'T10Y2Y',
  'USALOLITOAASTSAM',
  'AUSLOLITOAASTSAM',
  'IPG3344S',
  'DFII10',
  'DTWEXBGS',
  'BAA10Y',
] as const;
