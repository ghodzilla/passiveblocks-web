import { snapshotFromBundle, type DataBundle } from './assemble';
import { CFTC_CONTRACTS, fetchCotNetOi } from './cftc';
import { FRED_OBSERVATION_START, FRED_SERIES } from './constants';
import { fetchFredSeries } from './fred';
import type { PositioningInput } from './model';
import { fetchYahooBars } from './prices';
import { providerSource, type ProviderSource } from './refreshHealth';
import type { SeriesPoint } from './series';
import { melbourneDate } from './time';
import type { RegimeSnapshot } from './types';

async function fredOrEmpty(seriesId: string): Promise<{ points: SeriesPoint[]; error: string | null }> {
  try {
    const points = await fetchFredSeries(seriesId, FRED_OBSERVATION_START);
    if (points.length === 0) return { points, error: `${seriesId} returned no observations` };
    return { points, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${seriesId} fetch failed`;
    return { points: [], error: message };
  }
}

async function yahooCloses(symbol: string, gaps: string[], reports: ProviderSource[], fetchedAt: string): Promise<SeriesPoint[]> {
  const result = await fetchYahooBars(symbol);
  const points = result.error || result.bars.length === 0
    ? []
    : result.bars.map((bar) => ({ date: bar.date, value: bar.close }));
  if (points.length === 0) gaps.push(result.error ?? `${symbol} returned no prices for the AI gauge.`);
  reports.push(providerSource({
    id: symbol,
    label: symbol,
    mandatory: false,
    observationDate: points.length ? points[points.length - 1].date : null,
    fetchedAt,
    error: points.length ? null : (result.error ?? `${symbol} returned no prices`),
  }));
  return points;
}

function recordFeed(
  reports: ProviderSource[],
  id: string,
  label: string,
  mandatory: boolean,
  result: { points: SeriesPoint[]; error: string | null },
  fetchedAt: string,
): SeriesPoint[] {
  reports.push(providerSource({
    id,
    label,
    mandatory,
    observationDate: result.points.length ? result.points[result.points.length - 1].date : null,
    fetchedAt,
    error: result.error,
  }));
  return result.points;
}

export async function fetchRegimeBundle(now: Date): Promise<DataBundle> {
  const today = melbourneDate(now);
  const generatedAt = now.toISOString();
  const gaps: string[] = [];
  const reports: ProviderSource[] = [];

  const [spy, rsp, smh] = await Promise.all([
    yahooCloses('SPY', gaps, reports, generatedAt),
    yahooCloses('RSP', gaps, reports, generatedAt),
    yahooCloses('SMH', gaps, reports, generatedAt),
  ]);

  if (!process.env.FRED_API_KEY) {
    gaps.push('FRED_API_KEY is not set. No FRED series were fetched.');
    for (const series of [
      [FRED_SERIES.walcl, 'Fed total assets', true],
      [FRED_SERIES.tga, 'Treasury General Account', true],
      [FRED_SERIES.rrp, 'Overnight reverse repo', true],
      [FRED_SERIES.dgs2, 'US 2-year yield', true],
      [FRED_SERIES.policyUpper, 'Fed funds target upper', true],
      [FRED_SERIES.hy, 'US high-yield OAS', true],
    ] as const) {
      reports.push(providerSource({
        id: series[0],
        label: series[1],
        mandatory: series[2],
        observationDate: null,
        fetchedAt: generatedAt,
        error: 'FRED_API_KEY is not set',
      }));
    }
    const positioning = await fetchPositioning(gaps, reports, generatedAt);
    return { ...emptyFredBundle(today, generatedAt, gaps, positioning), spy, rsp, smh, capex: [], reports };
  }

  const [walcl, tga, rrp, dgs2, policyUpper, hy, curve, usCli, auCli, capex] = await Promise.all([
    fredOrEmpty(FRED_SERIES.walcl),
    fredOrEmpty(FRED_SERIES.tga),
    fredOrEmpty(FRED_SERIES.rrp),
    fredOrEmpty(FRED_SERIES.dgs2),
    fredOrEmpty(FRED_SERIES.policyUpper),
    fredOrEmpty(FRED_SERIES.hy),
    fredOrEmpty(FRED_SERIES.curve),
    fredOrEmpty(FRED_SERIES.usCli),
    fredOrEmpty(FRED_SERIES.auCli),
    fredOrEmpty(FRED_SERIES.capex),
  ]);

  const walclPoints = recordFeed(reports, FRED_SERIES.walcl, 'Fed total assets', true, walcl, generatedAt);
  const tgaPoints = recordFeed(reports, FRED_SERIES.tga, 'Treasury General Account', true, tga, generatedAt);
  const rrpPoints = recordFeed(reports, FRED_SERIES.rrp, 'Overnight reverse repo', true, rrp, generatedAt);
  const dgs2Points = recordFeed(reports, FRED_SERIES.dgs2, 'US 2-year yield', true, dgs2, generatedAt);
  const policyUpperPoints = recordFeed(reports, FRED_SERIES.policyUpper, 'Fed funds target upper', false, policyUpper, generatedAt);
  const hyPoints = recordFeed(reports, FRED_SERIES.hy, 'US high-yield OAS', true, hy, generatedAt);
  const curvePoints = recordFeed(reports, FRED_SERIES.curve, 'US 10y−2y curve', false, curve, generatedAt);
  const usCliPoints = recordFeed(reports, FRED_SERIES.usCli, 'US OECD CLI', false, usCli, generatedAt);
  const auCliPoints = recordFeed(reports, FRED_SERIES.auCli, 'Australia OECD CLI', false, auCli, generatedAt);
  const capexPoints = recordFeed(reports, FRED_SERIES.capex, 'Semiconductor industrial production', false, capex, generatedAt);

  for (const result of [walcl, tga, rrp, dgs2, hy, curve, usCli, auCli, capex]) {
    if (result.error && result.error !== 'FRED_API_KEY is not set') gaps.push(result.error);
  }
  let policyRate = policyUpperPoints;
  let policyRateSeriesId: string = FRED_SERIES.policyUpper;
  if (policyUpper.error || policyUpperPoints.length === 0) {
    const effective = await fredOrEmpty(FRED_SERIES.policyEffective);
    const effectivePoints = recordFeed(reports, FRED_SERIES.policyEffective, 'Effective fed funds', true, effective, generatedAt);
    if (effectivePoints.length > 0 && !effective.error) {
      policyRate = effectivePoints;
      policyRateSeriesId = FRED_SERIES.policyEffective;
      gaps.push('DFEDTARU unavailable. Policy path uses effective fed funds (DFF) instead of the target upper bound.');
    } else {
      const upper = reports.find((item) => item.id === FRED_SERIES.policyUpper);
      if (upper) upper.mandatory = true;
      if (policyUpper.error) gaps.push(policyUpper.error);
      if (effective.error) gaps.push(effective.error);
    }
  } else {
    const upper = reports.find((item) => item.id === FRED_SERIES.policyUpper);
    if (upper) upper.mandatory = true;
  }

  const positioning = await fetchPositioning(gaps, reports, generatedAt);

  return {
    today,
    generatedAt,
    walcl: walclPoints,
    tga: tgaPoints,
    rrp: rrpPoints,
    dgs2: dgs2Points,
    policyRate,
    policyRateSeriesId,
    hy: hyPoints,
    curve: curvePoints,
    usCli: usCliPoints,
    auCli: auCliPoints,
    positioning,
    spy,
    rsp,
    smh,
    capex: capexPoints,
    gaps,
    reports,
  };
}

async function fetchPositioning(gaps: string[], reports: ProviderSource[], fetchedAt: string): Promise<PositioningInput[]> {
  const results = await Promise.all(
    CFTC_CONTRACTS.map(async (contract) => {
      try {
        const netOi = await fetchCotNetOi(contract.code);
        if (netOi.length === 0) {
          return { contract, netOi, error: `${contract.label} returned no COT rows` };
        }
        return { contract, netOi, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : `${contract.label} fetch failed`;
        return { contract, netOi: [] as SeriesPoint[], error: message };
      }
    }),
  );

  const positioning: PositioningInput[] = [];
  const failures: string[] = [];
  for (const result of results) {
    reports.push(providerSource({
      id: `CFTC-${result.contract.id}`,
      label: result.contract.label,
      mandatory: false,
      observationDate: result.netOi.length ? result.netOi[result.netOi.length - 1].date : null,
      fetchedAt,
      error: result.error,
    }));
    if (result.error || result.netOi.length === 0) {
      failures.push(result.error ?? `${result.contract.label} unavailable`);
      continue;
    }
    positioning.push({
      id: result.contract.id,
      label: result.contract.label,
      netOi: result.netOi,
    });
  }
  if (positioning.length === 0) {
    gaps.push(
      `Positioning feed failed for every contract (${failures.join('; ')}). The composite is renormalised without it.`,
    );
  } else if (failures.length) {
    gaps.push(`Positioning partial: ${failures.join('; ')}.`);
  }
  return positioning;
}

function emptyFredBundle(
  today: string,
  generatedAt: string,
  gaps: string[],
  positioning: PositioningInput[],
): DataBundle {
  return {
    today,
    generatedAt,
    walcl: [],
    tga: [],
    rrp: [],
    dgs2: [],
    policyRate: [],
    policyRateSeriesId: FRED_SERIES.policyUpper,
    hy: [],
    curve: [],
    usCli: [],
    auCli: [],
    positioning,
    gaps,
    reports: [],
  };
}

export async function buildRegimeSnapshot(now = new Date()): Promise<RegimeSnapshot> {
  try {
    const bundle = await fetchRegimeBundle(now);
    return snapshotFromBundle(bundle);
  } catch (error) {
    const today = melbourneDate(now);
    const message = error instanceof Error ? error.message : 'Regime data fetch failed';
    return snapshotFromBundle({
      ...emptyFredBundle(today, now.toISOString(), [message], []),
    });
  }
}
