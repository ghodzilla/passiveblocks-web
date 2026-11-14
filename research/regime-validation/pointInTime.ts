import { asofPoints, asofQuery, type AsOfPoint } from '../../lib/regime/alfredAsOf';
import { previousCalendarDay, type VintagePanel } from '../../lib/regime/replay';
import type { SeriesPoint } from '../../lib/regime/series';

export const MANDATORY_SERIES = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'DGS2'] as const;
export const OPTIONAL_SERIES = ['T10Y2Y', 'USALOLITOAASTSAM', 'AUSLOLITOAASTSAM', 'IPG3344S', 'DFII10', 'DTWEXBGS'] as const;
export const POLICY_SERIES = ['DFEDTARU', 'DFF'] as const;

export interface VintageSource {
  vintageDates: string[];
  asOf: (vintage: string) => AsOfPoint[];
}

export interface UsedInput {
  decisionDate: string;
  vintageDate: string;
  seriesId: string;
  points: AsOfPoint[];
}

export interface DecisionAssessment {
  date: string;
  vintageDate: string;
  status: 'ready' | 'skipped';
  reasons: string[];
  panel: VintagePanel | null;
  used: UsedInput[];
  creditObservations: number | null;
}

export function latestVintageOnOrBefore(dates: string[], asOf: string): string | null {
  let lo = 0;
  let hi = dates.length - 1;
  let found: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= asOf) {
      found = dates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function noVintageReason(id: string): string {
  return `${id} has no ALFRED vintage as of the day before the decision.`;
}

export function creditMissingReason(id: string): string {
  return `${id} has no ALFRED vintage as of the day before the decision. Credit stays fail-closed.`;
}

export function creditShortReason(id: string, window: number): string {
  return `${id} is short of the ${window}-observation credit window. Credit stays fail-closed.`;
}

function pointsOf(source: VintageSource | undefined, vintageDate: string): AsOfPoint[] | null {
  if (!source || latestVintageOnOrBefore(source.vintageDates, vintageDate) == null) return null;
  return source.asOf(vintageDate);
}

function toSeries(points: AsOfPoint[]): SeriesPoint[] {
  return points.map(({ date, value }) => ({ date, value }));
}

/**
 * Build the panel for decision date D from vintages published on or before D-1.
 * A missing mandatory vintage, including the credit series named by the variant, skips D.
 * Another credit series is never copied in to fill that gap.
 */
export function assessDecision(
  date: string,
  sources: Record<string, VintageSource>,
  spec: { creditSeries: string; creditWindow: number },
): DecisionAssessment {
  const vintageDate = previousCalendarDay(date);
  const reasons: string[] = [];
  const used: UsedInput[] = [];
  const series: Record<string, SeriesPoint[]> = {};

  const take = (id: string, engineId = id): AsOfPoint[] | null => {
    const points = pointsOf(sources[id], vintageDate);
    if (points == null) return null;
    if (points.length === 0) {
      reasons.push(`${id} has a vintage date but no numeric observation was published by the day before the decision.`);
      return null;
    }
    used.push({ decisionDate: date, vintageDate, seriesId: id, points });
    series[engineId] = toSeries(points);
    return points;
  };

  for (const id of MANDATORY_SERIES) {
    if (take(id) == null && !reasons.some((reason) => reason.startsWith(`${id} has`))) {
      reasons.push(noVintageReason(id));
    }
  }

  const upper = pointsOf(sources.DFEDTARU, vintageDate);
  const effective = pointsOf(sources.DFF, vintageDate);
  const upperPoints = upper && upper.length > 0 ? upper : null;
  const effectivePoints = effective && effective.length > 0 ? effective : null;
  if (!upperPoints && !effectivePoints) {
    if (upper && upper.length === 0) reasons.push('DFEDTARU has a vintage date but no numeric observation was published by the day before the decision.');
    if (effective && effective.length === 0) reasons.push('DFF has a vintage date but no numeric observation was published by the day before the decision.');
    if (!upper && !effective) reasons.push('DFEDTARU and DFF have no ALFRED vintage as of the day before the decision.');
  } else {
    if (upperPoints) {
      used.push({ decisionDate: date, vintageDate, seriesId: 'DFEDTARU', points: upperPoints });
      series.DFEDTARU = toSeries(upperPoints);
    }
    if (effectivePoints) {
      used.push({ decisionDate: date, vintageDate, seriesId: 'DFF', points: effectivePoints });
      series.DFF = toSeries(effectivePoints);
    }
  }

  let creditObservations: number | null = null;
  const creditSource = sources[spec.creditSeries];
  const creditKnown = pointsOf(creditSource, vintageDate);
  if (creditKnown == null) {
    reasons.push(creditMissingReason(spec.creditSeries));
  } else if (creditKnown.length === 0) {
    reasons.push(`${spec.creditSeries} has a vintage date but no numeric observation was published by the day before the decision. Credit stays fail-closed.`);
    creditObservations = 0;
  } else if (creditKnown.length < spec.creditWindow) {
    reasons.push(creditShortReason(spec.creditSeries, spec.creditWindow));
    creditObservations = creditKnown.length;
  } else {
    creditObservations = creditKnown.length;
    used.push({ decisionDate: date, vintageDate, seriesId: spec.creditSeries, points: creditKnown });
    series.BAMLH0A0HYM2 = toSeries(creditKnown);
  }

  for (const id of OPTIONAL_SERIES) {
    const points = pointsOf(sources[id], vintageDate);
    if (points && points.length > 0) {
      used.push({ decisionDate: date, vintageDate, seriesId: id, points });
      series[id] = toSeries(points);
    }
  }

  if (reasons.length > 0) {
    return { date, vintageDate, status: 'skipped', reasons, panel: null, used: [], creditObservations };
  }
  return {
    date,
    vintageDate,
    status: 'ready',
    reasons: [],
    panel: { decisionDate: date, vintageDate, series, positioning: null },
    used,
    creditObservations,
  };
}

export interface LookaheadViolation {
  decisionDate: string;
  vintageDate: string;
  seriesId: string;
  observationDate: string;
  realtimeStart: string;
}

/** Every observation used on D must have been published on or before D-1. */
export function lookaheadViolations(used: UsedInput[]): LookaheadViolation[] {
  const violations: LookaheadViolation[] = [];
  for (const input of used) {
    const cutoff = previousCalendarDay(input.decisionDate);
    for (const point of input.points) {
      if (input.vintageDate > cutoff || point.realtimeStart > input.vintageDate || point.date > input.vintageDate || point.realtimeStart > cutoff) {
        violations.push({
          decisionDate: input.decisionDate,
          vintageDate: input.vintageDate,
          seriesId: input.seriesId,
          observationDate: point.date,
          realtimeStart: point.realtimeStart,
        });
      }
    }
  }
  return violations;
}

export function groupSkipReasons(rows: { date: string; reasons: string[] }[]): {
  reason: string;
  count: number;
  first: string;
  last: string;
  examples: string[];
}[] {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    for (const reason of row.reasons) {
      const dates = grouped.get(reason) ?? [];
      dates.push(row.date);
      grouped.set(reason, dates);
    }
  }
  return Array.from(grouped.entries()).map(([reason, dates]) => {
    const examples = [...dates.slice(0, 5), ...dates.slice(-3)].filter((date, index, all) => all.indexOf(date) === index);
    return { reason, count: dates.length, first: dates[0], last: dates[dates.length - 1], examples };
  });
}

/** Index ALFRED rows once. Each vintage is built when asked, then discarded by the caller. */
export function sourceFromRows(vintageDates: string[], rows: Parameters<typeof asofPoints>[0]): VintageSource {
  const query = asofQuery(rows);
  return { vintageDates, asOf: query };
}
