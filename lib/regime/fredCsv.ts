import type { SeriesPoint } from './series';

/**
 * Read a FRED graph CSV. No API key. A "." gap is dropped, not filled in.
 * The public graph is the latest vintage. It is not a point-in-time ALFRED vintage.
 */
export function parseFredCsv(text: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('DATE') || trimmed.startsWith('observation')) continue;
    const [date, raw] = trimmed.split(',');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!raw || raw === '.') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/**
 * Keyless FRED graph download. Pass a start date. Some series, including the
 * high-yield spread, still return only their recent window. Throws on HTTP errors.
 */
export async function fetchFredCsv(seriesId: string, start = '2007-01-01'): Promise<SeriesPoint[]> {
  const end = new Date().toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${encodeURIComponent(start)}&coed=${end}`;
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'passiveblocks-regime/1.0 (owner research dashboard)' },
    });
  } catch {
    throw new Error(`FRED csv ${seriesId} request failed`);
  }
  if (!response.ok) throw new Error(`FRED csv ${seriesId} HTTP ${response.status}`);
  return parseFredCsv(await response.text());
}
