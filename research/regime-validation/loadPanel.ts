import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { SeriesPoint } from '../../lib/regime/series';
import { previousCalendarDay, type PositioningRelease, type VintagePanel } from '../../lib/regime/replay';

function asPoints(value: unknown): SeriesPoint[] {
  if (!Array.isArray(value)) return [];
  const out: SeriesPoint[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const date = 'date' in row && typeof row.date === 'string' ? row.date : 'observation_date' in row && typeof row.observation_date === 'string' ? row.observation_date : '';
    const raw = 'value' in row ? row.value : null;
    const num = typeof raw === 'number' ? raw : typeof raw === 'string' && raw !== '.' ? Number(raw) : NaN;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(num)) continue;
    out.push({ date, value: num });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function asPositioning(value: unknown): PositioningRelease[] {
  if (!Array.isArray(value)) return [];
  const out: PositioningRelease[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const id = 'id' in row && typeof row.id === 'string' ? row.id : '';
    const label = 'label' in row && typeof row.label === 'string' ? row.label : id;
    const published = 'published' in row && typeof row.published === 'string' ? row.published : '';
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(published)) continue;
    out.push({ id, label, published, netOi: asPoints('netOi' in row ? row.netOi : []) });
  }
  return out;
}

export function panelFromJson(value: unknown): VintagePanel | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const decisionDate = typeof row.decisionDate === 'string' ? row.decisionDate : '';
  const vintageDate = typeof row.vintageDate === 'string' ? row.vintageDate : previousCalendarDay(decisionDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(decisionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(vintageDate)) return null;
  const seriesIn = row.series && typeof row.series === 'object' ? row.series as Record<string, unknown> : {};
  const series: Record<string, SeriesPoint[]> = {};
  for (const [id, points] of Object.entries(seriesIn)) series[id] = asPoints(points);
  return {
    decisionDate,
    vintageDate,
    series,
    positioning: row.positioning == null ? null : asPositioning(row.positioning),
  };
}

export function loadPanelDir(dir: string): VintagePanel[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const files = readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'manifest.json').sort();
  const panels: VintagePanel[] = [];
  for (const name of files) {
    const parsed = panelFromJson(JSON.parse(readFileSync(path.join(dir, name), 'utf8')));
    if (parsed) panels.push(parsed);
  }
  return panels.sort((a, b) => a.decisionDate.localeCompare(b.decisionDate));
}
