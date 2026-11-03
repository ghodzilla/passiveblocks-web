import { snapshotFromBundle, type DataBundle } from './assemble';
import { CFTC_CONTRACTS, fetchCotNetOi } from './cftc';
import { FRED_OBSERVATION_START, FRED_SERIES } from './constants';
import { fetchFredSeries } from './fred';
import type { PositioningInput } from './model';
import type { SeriesPoint } from './series';
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

export async function fetchRegimeBundle(now: Date): Promise<DataBundle> {
  const today = now.toISOString().slice(0, 10);
  const generatedAt = now.toISOString();
  const gaps: string[] = [];

  if (!process.env.FRED_API_KEY) {
    gaps.push('FRED_API_KEY is not set. No FRED series were fetched.');
    const positioning = await fetchPositioning(gaps);
    return emptyFredBundle(today, generatedAt, gaps, positioning);
  }

  const [walcl, tga, rrp, dgs2, policyUpper, hy, curve, usCli, auCli] = await Promise.all([
    fredOrEmpty(FRED_SERIES.walcl),
    fredOrEmpty(FRED_SERIES.tga),
    fredOrEmpty(FRED_SERIES.rrp),
    fredOrEmpty(FRED_SERIES.dgs2),
    fredOrEmpty(FRED_SERIES.policyUpper),
    fredOrEmpty(FRED_SERIES.hy),
    fredOrEmpty(FRED_SERIES.curve),
    fredOrEmpty(FRED_SERIES.usCli),
    fredOrEmpty(FRED_SERIES.auCli),
  ]);

  for (const result of [walcl, tga, rrp, dgs2, hy, curve, usCli, auCli]) {
    if (result.error && result.error !== 'FRED_API_KEY is not set') gaps.push(result.error);
  }

  let policyRate = policyUpper.points;
  let policyRateSeriesId: string = FRED_SERIES.policyUpper;
  if (policyUpper.error || policyUpper.points.length === 0) {
    const effective = await fredOrEmpty(FRED_SERIES.policyEffective);
    if (effective.points.length > 0) {
      policyRate = effective.points;
      policyRateSeriesId = FRED_SERIES.policyEffective;
      gaps.push('DFEDTARU unavailable. Policy path uses effective fed funds (DFF) instead of the target upper bound.');
    } else if (policyUpper.error) {
      gaps.push(policyUpper.error);
      if (effective.error) gaps.push(effective.error);
    }
  }

  const positioning = await fetchPositioning(gaps);

  return {
    today,
    generatedAt,
    walcl: walcl.points,
    tga: tga.points,
    rrp: rrp.points,
    dgs2: dgs2.points,
    policyRate,
    policyRateSeriesId,
    hy: hy.points,
    curve: curve.points,
    usCli: usCli.points,
    auCli: auCli.points,
    positioning,
    gaps,
  };
}

async function fetchPositioning(gaps: string[]): Promise<PositioningInput[]> {
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
  };
}

export async function buildRegimeSnapshot(now = new Date()): Promise<RegimeSnapshot> {
  try {
    const bundle = await fetchRegimeBundle(now);
    return snapshotFromBundle(bundle);
  } catch (error) {
    const today = now.toISOString().slice(0, 10);
    const message = error instanceof Error ? error.message : 'Regime data fetch failed';
    return snapshotFromBundle({
      ...emptyFredBundle(today, now.toISOString(), [message], []),
    });
  }
}
