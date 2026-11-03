import { parseCotNetOi, type SeriesPoint } from './series';

/** Legacy futures-only Commitments of Traders. Public, no key. */
const CFTC_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

export const CFTC_CONTRACTS = [
  { id: 'es', code: '13874A', label: 'E-mini S&P 500 spec net/OI' },
  { id: 'ty', code: '043602', label: 'US 10-year note spec net/OI' },
  { id: 'fx', code: '099741', label: 'Euro FX spec net/OI' },
  { id: 'cl', code: '067651', label: 'WTI crude spec net/OI' },
] as const;

export async function fetchCotNetOi(contractCode: string): Promise<SeriesPoint[]> {
  const url = new URL(CFTC_URL);
  url.searchParams.set('$limit', '400');
  // Descending plus a cap returns the latest reports. Ascending would return the oldest 400 and mark them stale.
  url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  url.searchParams.set(
    '$select',
    'report_date_as_yyyy_mm_dd,open_interest_all,noncomm_positions_long_all,noncomm_positions_short_all',
  );
  url.searchParams.set('cftc_contract_market_code', contractCode);

  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new Error(`CFTC ${contractCode} request failed`);
  }
  if (!response.ok) throw new Error(`CFTC ${contractCode} HTTP ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`CFTC ${contractCode} returned invalid JSON`);
  }
  return parseCotNetOi(body);
}
