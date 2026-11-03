import { parseFredObservations, type SeriesPoint } from './series';

const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations';

/**
 * Fetch one FRED series. The API key stays in the query string sent to FRED
 * and is never copied into thrown errors.
 */
export async function fetchFredSeries(seriesId: string, observationStart: string): Promise<SeriesPoint[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('FRED_API_KEY is not set');

  const url = new URL(FRED_URL);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('observation_start', observationStart);

  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new Error(`FRED ${seriesId} request failed`);
  }
  if (!response.ok) throw new Error(`FRED ${seriesId} HTTP ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`FRED ${seriesId} returned invalid JSON`);
  }
  return parseFredObservations(body);
}
