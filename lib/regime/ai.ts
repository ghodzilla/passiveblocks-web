import type { SeriesPoint } from './series';
import { lastIndexOnOrBefore, zScoreSeries } from './stats';

/** Daily price legs. A monthly capex series uses the same observation count. */
export const AI_Z_WINDOW = 252;
export const AI_Z_MIN = 126;
export const AI_PRICE_STALE_DAYS = 10;
export const AI_CAPEX_STALE_DAYS = 75;
export const AI_BASE_WEIGHT = 0.08;

export const CAPEX_SERIES_ID = 'IPG3344S';

export const ENERGY_GAP =
  'Data-center electricity demand is omitted. No free series isolates it, and utilities (XLU) are not used as a stand-in.';

export type AiLegId = 'concentration' | 'semis' | 'capex';

const LEG_SIGN: Record<AiLegId, -1 | 1> = {
  concentration: -1,
  semis: 1,
  capex: 1,
};

const LEG_LABEL: Record<AiLegId, string> = {
  concentration: 'Breadth (SPY/RSP, sign-flipped)',
  semis: 'Semis vs SPY',
  capex: 'Capex IPG3344S',
};

export interface AiLegPoint {
  id: AiLegId;
  signed: number | null;
  asOf: string | null;
  dropped: string | null;
}

export interface AiScore {
  z: number | null;
  asOf: string | null;
  gap: string | null;
  reading: string;
  legs: AiLegPoint[];
}

interface PreparedLeg {
  id: AiLegId;
  series: SeriesPoint[];
  zs: (number | null)[];
}

/** log(numer/denom) on shared dates. Skips non-positive prints. Nothing is filled in. */
export function logRelative(numer: SeriesPoint[], denom: SeriesPoint[]): SeriesPoint[] {
  const denomByDate = new Map<string, number>();
  for (const point of denom) denomByDate.set(point.date, point.value);
  const out: SeriesPoint[] = [];
  for (const point of numer) {
    const other = denomByDate.get(point.date);
    if (other == null || other <= 0 || point.value <= 0) continue;
    out.push({ date: point.date, value: Math.log(point.value / other) });
  }
  return out;
}

export function blendSigned(values: (number | null | undefined)[]): number | null {
  const parts: number[] = [];
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    parts.push(value);
  }
  if (parts.length === 0) return null;
  const avg = parts.reduce((sum, value) => sum + value, 0) / parts.length;
  return Math.min(3, Math.max(-3, avg));
}

export function prepareAi(input: {
  concentration: SeriesPoint[];
  semis: SeriesPoint[];
  capex: SeriesPoint[];
}): PreparedLeg[] {
  const legs: { id: AiLegId; series: SeriesPoint[] }[] = [
    { id: 'concentration', series: input.concentration },
    { id: 'semis', series: input.semis },
    { id: 'capex', series: input.capex },
  ];
  return legs.map((leg) => ({
    id: leg.id,
    series: leg.series,
    zs: zScoreSeries(leg.series.map((point) => point.value), AI_Z_WINDOW, AI_Z_MIN),
  }));
}

function ageDays(asOf: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/**
 * Point-in-time blend. Concentration enters with a minus sign: cap-weight
 * beating equal-weight is fragility, not a healthier risk-on print.
 * When dropStale is set, a price leg older than 10 days (capex: 75) is left out
 * of the live blend. History calls this without that filter.
 */
export function aiAt(
  legs: PreparedLeg[],
  date: string,
  opts?: { today?: string; dropStale?: boolean },
): AiScore {
  const points: AiLegPoint[] = [];
  const signedValues: number[] = [];
  const dates: string[] = [];

  for (const leg of legs) {
    const idx = lastIndexOnOrBefore(leg.series, date);
    const asOf = idx >= 0 ? leg.series[idx].date : null;
    const raw = idx >= 0 ? leg.zs[idx] : null;
    let dropped: string | null = null;
    let signed: number | null = raw == null || !Number.isFinite(raw) ? null : LEG_SIGN[leg.id] * raw;
    if (opts?.dropStale && opts.today && asOf && signed != null) {
      const limit = leg.id === 'capex' ? AI_CAPEX_STALE_DAYS : AI_PRICE_STALE_DAYS;
      const age = ageDays(asOf, opts.today);
      if (!Number.isFinite(age) || age > limit) {
        dropped = `${LEG_LABEL[leg.id]} is older than ${limit} days (as of ${asOf}), so it is left out of the live print.`;
        signed = null;
      }
    }
    if (signed != null) {
      signedValues.push(signed);
      dates.push(asOf as string);
    }
    points.push({ id: leg.id, signed, asOf, dropped });
  }

  const z = blendSigned(signedValues);
  const asOf = dates.length ? dates.slice().sort()[0] : null;
  const reading = signedValues.length
    ? points
      .filter((point) => point.signed != null)
      .map((point) => `${LEG_LABEL[point.id]} ${formatSigned(point.signed as number)}`)
      .join(' · ')
    : 'No AI print';

  return { z, asOf, gap: aiGap(points), reading, legs: points };
}

export function aiGap(legs: AiLegPoint[]): string | null {
  const dropped = legs.filter((leg) => leg.dropped).map((leg) => leg.dropped as string);
  const missing = legs.filter((leg) => leg.signed == null && !leg.dropped).map((leg) => leg.id);
  const present = legs.filter((leg) => leg.signed != null).map((leg) => leg.id);
  const parts: string[] = [];

  if (present.length === 0 && dropped.length === 0) {
    parts.push(
      'AI capex & concentration is not in the composite. Index concentration (log SPY/RSP) and semiconductors (log SMH/SPY) do not have a z-score (252 observations, 126 minimum), and semiconductor industrial production (FRED IPG3344S) is unavailable.',
    );
  } else {
    if (dropped.length) parts.push(dropped.join(' '));
    if (missing.includes('concentration') || missing.includes('semis')) {
      const which = [
        missing.includes('concentration') ? 'index concentration (SPY/RSP)' : null,
        missing.includes('semis') ? 'semiconductors (SMH/SPY)' : null,
      ].filter((item): item is string => Boolean(item));
      parts.push(`${which.join(' and ')} ${which.length === 1 ? 'is' : 'are'} omitted until a z-score exists.`);
    }
    if (missing.includes('capex')) {
      parts.push('Capex leg omitted: FRED IPG3344S (semiconductor and electronic-component industrial production) is unavailable. Dollar hyperscaler capex is not a separate series.');
    }
  }

  parts.push(ENERGY_GAP);
  return parts.join(' ');
}
