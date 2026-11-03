import { aiAt, prepareAi } from './ai';
import { actionFor, budgetsFor, classifyRegime, regimeLabel } from './classify';
import {
  BASE_WEIGHTS,
  COMPONENT_IDS,
  COMPONENT_LABEL,
  HISTORY_WEEKS,
  RULES_VERSION,
  THRESHOLDS,
  WINDOWS,
  type ComponentId,
  type RegimeId,
} from './constants';
import type { SeriesPoint } from './series';
import { lastIndexOnOrBefore, zScoreSeries } from './stats';
import type { ComponentScore, FreshnessRow, HistoryPoint, RegimeSnapshot } from './types';

export interface PositioningInput {
  id: string;
  label: string;
  netOi: SeriesPoint[];
}

export interface ModelInput {
  today: string;
  generatedAt: string;
  liquidityChange: SeriesPoint[];
  policyGap: SeriesPoint[];
  creditEase: SeriesPoint[];
  curve: SeriesPoint[];
  growthDiff: SeriesPoint[];
  usMomentum: SeriesPoint[];
  positioning: PositioningInput[];
  /** log(SPY/RSP). Empty when either price series is missing. */
  concentration?: SeriesPoint[];
  /** log(SMH/SPY). Empty when either price series is missing. */
  semis?: SeriesPoint[];
  /** FRED IPG3344S level. Empty when the series was not fetched. */
  capex?: SeriesPoint[];
  levels: {
    liquidityChangeMillions: number | null;
    policyGapPp: number | null;
    hyOas: number | null;
    curvePp: number | null;
    growthDiff: number | null;
    usMomentum: number | null;
  };
  freshness: FreshnessRow[];
  gaps: string[];
  policyRateSeriesId: string;
}

interface Leg {
  z: number | null;
  asOf: string | null;
  level: number | null;
}

interface Scored {
  z: Partial<Record<ComponentId, number | null>>;
  asOf: Partial<Record<ComponentId, string | null>>;
  gaps: Partial<Record<ComponentId, string | null>>;
  positioningNote: string | null;
  aiReading: string;
}

function emptyWeights(): Record<ComponentId, number> {
  const weights = {} as Record<ComponentId, number>;
  for (const id of COMPONENT_IDS) weights[id] = 0;
  return weights;
}

export function weightedComposite(values: Partial<Record<ComponentId, number | null>>): {
  composite: number | null;
  weights: Record<ComponentId, number>;
} {
  const weights = emptyWeights();
  let sum = 0;
  for (const id of COMPONENT_IDS) {
    const z = values[id];
    if (z == null || !Number.isFinite(z)) continue;
    weights[id] = BASE_WEIGHTS[id];
    sum += BASE_WEIGHTS[id];
  }
  if (sum === 0) return { composite: null, weights };
  let composite = 0;
  for (const id of COMPONENT_IDS) {
    weights[id] = weights[id] / sum;
    const z = values[id];
    if (z != null && Number.isFinite(z)) composite += weights[id] * z;
  }
  return { composite: Math.min(3, Math.max(-3, composite)), weights };
}

function legAt(series: SeriesPoint[], zs: (number | null)[], date: string): Leg {
  const idx = lastIndexOnOrBefore(series, date);
  if (idx < 0) return { z: null, asOf: null, level: null };
  return { z: zs[idx], asOf: series[idx].date, level: series[idx].value };
}

function prepare(series: SeriesPoint[], window: number, minObs: number) {
  return { series, zs: zScoreSeries(series.map((point) => point.value), window, minObs) };
}

function oldestDate(dates: (string | null | undefined)[]): string | null {
  const sorted = dates.filter((date): date is string => Boolean(date)).sort();
  return sorted[0] ?? null;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

interface Prepared {
  liquidity: ReturnType<typeof prepare>;
  policy: ReturnType<typeof prepare>;
  credit: ReturnType<typeof prepare>;
  curve: ReturnType<typeof prepare>;
  growthDiff: ReturnType<typeof prepare>;
  usMomentum: ReturnType<typeof prepare>;
  positioning: { input: PositioningInput; prepared: ReturnType<typeof prepare> }[];
  ai: ReturnType<typeof prepareAi>;
}

function scoreAt(prepared: Prepared, input: ModelInput, date: string): Scored {
  const liquidity = legAt(prepared.liquidity.series, prepared.liquidity.zs, date);
  const policy = legAt(prepared.policy.series, prepared.policy.zs, date);
  const credit = legAt(prepared.credit.series, prepared.credit.zs, date);
  const curve = legAt(prepared.curve.series, prepared.curve.zs, date);
  const diff = legAt(prepared.growthDiff.series, prepared.growthDiff.zs, date);
  const momentum = legAt(prepared.usMomentum.series, prepared.usMomentum.zs, date);

  let growthZ: number | null = null;
  let growthGap: string | null = null;
  const growthParts: number[] = [];
  const growthDates: (string | null)[] = [];
  if (curve.z != null) {
    growthParts.push(curve.z);
    growthDates.push(curve.asOf);
  }
  if (diff.z != null) {
    growthParts.push(diff.z);
    growthDates.push(diff.asOf);
  } else if (momentum.z != null) {
    growthParts.push(momentum.z);
    growthDates.push(momentum.asOf);
    growthGap = input.growthDiff.length === 0
      ? 'Australia CLI is unavailable. Growth uses the US yield curve and US CLI 6-month momentum, not a US−AU differential.'
      : 'US−AU CLI differential does not yet have a full z-score window. US CLI 6-month momentum is used instead.';
  }
  if (curve.z == null && diff.z != null) {
    growthGap = 'Yield curve is unavailable. Growth is the US−AU CLI differential only.';
  }
  if (curve.z != null && diff.z == null && momentum.z == null && input.growthDiff.length === 0) {
    growthGap = 'US−AU CLI differential is unavailable. Growth is the Treasury curve (T10Y2Y) only.';
  }
  if (growthParts.length > 0) {
    growthZ = Math.min(3, Math.max(-3, mean(growthParts)));
  } else {
    growthGap = growthGap ?? 'Growth series do not have enough history for a z-score.';
  }

  const posZs: number[] = [];
  const posDates: string[] = [];
  const thin: string[] = [];
  for (const contract of prepared.positioning) {
    const leg = legAt(contract.prepared.series, contract.prepared.zs, date);
    if (leg.z == null) {
      thin.push(contract.input.label);
      continue;
    }
    posZs.push(leg.z);
    if (leg.asOf) posDates.push(leg.asOf);
  }

  let positioningZ: number | null = null;
  let positioningGap: string | null = null;
  let positioningNote: string | null = null;
  if (input.positioning.length === 0) {
    positioningGap =
      'Positioning is not in the composite. CFTC legacy non-commercial futures positioning was not available. No proxy (including VIX) was substituted.';
  } else if (posZs.length === 0) {
    positioningGap =
      'CFTC contracts were returned but none had enough history (156-week window, 52-week minimum). Positioning is excluded.';
  } else {
    positioningZ = Math.min(3, Math.max(-3, -mean(posZs)));
    positioningNote = `Contrarian of the mean spec z (${posZs.length} contract${posZs.length === 1 ? '' : 's'}).`;
    if (thin.length) {
      positioningGap = `Excluded for short history: ${thin.join(', ')}.`;
    }
  }

  const ai = aiAt(prepared.ai, date);

  return {
    z: {
      liquidity: liquidity.z,
      policy: policy.z,
      credit: credit.z,
      growth: growthZ,
      positioning: positioningZ,
      ai: ai.z,
    },
    asOf: {
      liquidity: liquidity.asOf,
      policy: policy.asOf,
      credit: credit.asOf,
      growth: oldestDate(growthDates),
      positioning: oldestDate(posDates),
      ai: ai.asOf,
    },
    gaps: {
      liquidity: liquidity.z == null ? 'Liquidity impulse does not have enough history for a z-score.' : null,
      policy: policy.z == null ? 'Policy path does not have enough history for a z-score.' : null,
      credit: credit.z == null ? 'Credit spreads do not have enough history for a z-score.' : null,
      growth: growthGap,
      positioning: positioningGap,
      ai: ai.gap,
    },
    positioningNote,
    aiReading: ai.reading,
  };
}

function coreReady(z: Scored['z']): boolean {
  return z.liquidity != null && z.policy != null && z.credit != null;
}

function spineDates(input: ModelInput): string[] {
  const dates = new Set<string>();
  const base = input.liquidityChange.length
    ? input.liquidityChange
    : input.creditEase.length
      ? input.creditEase
      : input.policyGap;
  for (const point of base) dates.add(point.date);
  const newest = [
    input.liquidityChange,
    input.policyGap,
    input.creditEase,
    input.curve,
    input.growthDiff,
    input.usMomentum,
    ...input.positioning.map((contract) => contract.netOi),
    input.concentration ?? [],
    input.semis ?? [],
    input.capex ?? [],
  ]
    .map((series) => series[series.length - 1]?.date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  if (newest) dates.add(newest);
  return Array.from(dates).sort();
}

function formatSigned(value: number | null, digits: number, suffix: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}${suffix}`;
}

function formatBillions(millions: number | null): string {
  if (millions == null || !Number.isFinite(millions)) return '—';
  const billions = millions / 1000;
  const sign = billions > 0 ? '+' : billions < 0 ? '−' : '';
  return `${sign}$${Math.abs(billions).toFixed(0)}bn`;
}

function coreFresh(rows: FreshnessRow[], ids: string[]): boolean {
  return ids.every((id) => {
    const row = rows.find((item) => item.id === id);
    return Boolean(row && row.asOf && !row.stale);
  });
}

const DETAIL: Record<ComponentId, string> = {
  liquidity:
    '13-week change in net liquidity (Fed assets WALCL − TGA WTREGEN − overnight RRP RRPONTSYD×1000). Trailing 156-week z-score, winsorised at ±3. Positive means the liquidity impulse is easier than its own history.',
  policy:
    'Policy rate minus the 2-year Treasury yield (DGS2). Positive means the market prices a lower path than the current policy rate — an easier path than the trailing 3-year window.',
  credit:
    'Sign-flipped ICE BofA US high-yield OAS (BAMLH0A0HYM2). Positive means spreads are tighter than their trailing 3-year window.',
  growth:
    'Equal blend of the Treasury curve (T10Y2Y) and the US−AU OECD CLI differential (USALOLITOAASTSAM − AUSLOLITOAASTSAM) when both exist. Positive means a steeper curve and US leading indicators ahead of Australia versus their own history.',
  positioning:
    'Contrarian z-score of CFTC legacy futures-only non-commercial net position / open interest (E-mini S&P, 10-year note, euro FX, WTI). Positive means specs are shorter than usual. This is not dealer inventory, and it is not TFF leveraged-money versus asset-manager split.',
  ai:
    'Modest 8% weight. Equal blend of the legs that have a z-score, trailing 252 observations (126 minimum), winsorised at ±3. Concentration is log(SPY/RSP), sign-flipped, so cap-weight beating equal-weight lowers the composite. Semiconductors are log(SMH/SPY); a rise is risk-on. Capex, when FRED returns it, is IPG3344S industrial production of semiconductors and other electronic components. Dollar hyperscaler capex is not a separate series. Data-center electricity demand is omitted. This component is not required for a regime print: a missing gauge is dropped and the other weights are renormalised.',
};

export function buildModel(input: ModelInput): RegimeSnapshot {
  const prepared: Prepared = {
    liquidity: prepare(input.liquidityChange, WINDOWS.liquidity.window, WINDOWS.liquidity.min),
    policy: prepare(input.policyGap, WINDOWS.policy.window, WINDOWS.policy.min),
    credit: prepare(input.creditEase, WINDOWS.credit.window, WINDOWS.credit.min),
    curve: prepare(input.curve, WINDOWS.curve.window, WINDOWS.curve.min),
    growthDiff: prepare(input.growthDiff, WINDOWS.growthDiff.window, WINDOWS.growthDiff.min),
    usMomentum: prepare(input.usMomentum, WINDOWS.growthDiff.window, WINDOWS.growthDiff.min),
    positioning: input.positioning.map((contract) => ({
      input: contract,
      prepared: prepare(contract.netOi, WINDOWS.positioning.window, WINDOWS.positioning.min),
    })),
    ai: prepareAi({
      concentration: input.concentration ?? [],
      semis: input.semis ?? [],
      capex: input.capex ?? [],
    }),
  };

  const dates = spineDates(input);
  let previous: RegimeId | null = null;
  const walked: { point: HistoryPoint; scored: Scored }[] = [];
  for (const date of dates) {
    const scored = scoreAt(prepared, input, date);
    const { composite } = weightedComposite(coreReady(scored.z) ? scored.z : {});
    const regime = classifyRegime({
      composite,
      liquidityZ: scored.z.liquidity ?? null,
      creditZ: scored.z.credit ?? null,
      previous,
    });
    if (regime) previous = regime;
    walked.push({
      point: {
        date,
        composite,
        regime,
        liquidity: scored.z.liquidity ?? null,
        policy: scored.z.policy ?? null,
        credit: scored.z.credit ?? null,
        growth: scored.z.growth ?? null,
        positioning: scored.z.positioning ?? null,
        ai: scored.z.ai ?? null,
      },
      scored,
    });
  }

  const liveStep =
    [...walked].reverse().find((step) => step.point.composite != null) ??
    walked[walked.length - 1] ??
    null;
  const walkedLive = liveStep?.scored ?? scoreAt(prepared, input, input.today);
  const liveAi = aiAt(prepared.ai, input.today, { today: input.today, dropStale: true });
  const liveScored: Scored = {
    ...walkedLive,
    z: { ...walkedLive.z, ai: liveAi.z },
    asOf: { ...walkedLive.asOf, ai: liveAi.asOf },
    gaps: { ...walkedLive.gaps, ai: liveAi.gap },
    aiReading: liveAi.reading,
  };
  const livePoint = liveStep?.point;
  const ready = coreReady(liveScored.z);
  const { composite, weights } = weightedComposite(ready ? liveScored.z : {});

  const liquidityOk = coreFresh(input.freshness, ['WALCL', 'WTREGEN', 'RRPONTSYD']);
  const policyOk = coreFresh(input.freshness, ['DGS2', input.policyRateSeriesId]);
  const creditOk = coreFresh(input.freshness, ['BAMLH0A0HYM2']);
  const zOk = (id: ComponentId) => {
    const z = liveScored.z[id];
    return z != null && Number.isFinite(z);
  };
  const actionable = liquidityOk && policyOk && creditOk && zOk('liquidity') && zOk('policy') && zOk('credit') && composite != null;
  const weak = composite != null && Math.abs(composite) < THRESHOLDS.weakAbsComposite;
  let regime = livePoint?.regime ?? null;
  if (liveAi.z !== walkedLive.z.ai) {
    const prior = [...walked].reverse().find((step) => livePoint != null && step.point.date < livePoint.date && step.point.regime)?.point.regime ?? null;
    regime = classifyRegime({
      composite,
      liquidityZ: liveScored.z.liquidity ?? null,
      creditZ: liveScored.z.credit ?? null,
      previous: prior,
    });
  }
  const decision = actionFor({ actionable, weak, regime });
  const budget = budgetsFor(regime, decision.action);

  const readings: Record<ComponentId, string> = {
    liquidity: `13-week Δ net liquidity ${formatBillions(input.levels.liquidityChangeMillions)}`,
    policy: `Policy − 2y ${formatSigned(input.levels.policyGapPp, 2, ' pp')} (${input.policyRateSeriesId})`,
    credit: input.levels.hyOas == null ? 'HY OAS —' : `HY OAS ${input.levels.hyOas.toFixed(2)}%`,
    growth: `Curve ${formatSigned(input.levels.curvePp, 2, ' pp')} · US−AU CLI ${formatSigned(input.levels.growthDiff, 2, '')}`,
    positioning: liveScored.positioningNote ?? 'No positioning print',
    ai: liveScored.aiReading,
  };

  const components: ComponentScore[] = COMPONENT_IDS.map((id) => {
    const z = liveScored.z[id];
    const included = ready && z != null && Number.isFinite(z);
    return {
      id,
      label: COMPONENT_LABEL[id],
      z: included ? z : null,
      included,
      weight: weights[id],
      asOf: liveScored.asOf[id] ?? null,
      gap: liveScored.gaps[id] ?? null,
      detail: DETAIL[id],
      reading: readings[id],
    };
  });

  const gaps = [...input.gaps];
  for (const component of components) {
    if (component.gap && !gaps.includes(component.gap)) gaps.push(component.gap);
  }
  const staleCore = input.freshness.filter((row) =>
    ['WALCL', 'WTREGEN', 'RRPONTSYD', 'DGS2', input.policyRateSeriesId, 'BAMLH0A0HYM2'].includes(row.id) && row.stale,
  );
  for (const row of staleCore) {
    const line = `${row.label} is stale (last print ${row.asOf ?? 'missing'}, limit ${row.staleAfterDays} days).`;
    if (!gaps.includes(line)) gaps.push(line);
  }
  if (!ready) {
    const line = 'Composite withheld until liquidity, policy, and credit all have a z-score. A positioning, growth, or AI print alone cannot set the regime.';
    if (!gaps.includes(line)) gaps.push(line);
  }
  const stalePositioning = input.freshness.filter((row) => row.id.startsWith('CFTC-') && row.stale);
  if (stalePositioning.length > 0 && components.some((component) => component.id === 'positioning' && component.included)) {
    const line = `Positioning is older than its ${stalePositioning[0].staleAfterDays}-day limit (${stalePositioning.map((row) => row.label).join(', ')}).`;
    if (!gaps.includes(line)) gaps.push(line);
  }

  const history = walked
    .map((step) => step.point)
    .filter((point) => point.composite != null)
    .slice(-HISTORY_WEEKS);

  return {
    rulesVersion: RULES_VERSION,
    generatedAt: input.generatedAt,
    today: input.today,
    printDate: livePoint?.date ?? null,
    regime,
    regimeLabel: regimeLabel(regime),
    composite,
    actionable,
    weak,
    action: decision.action,
    message: decision.message,
    modelBudget: budget.modelBudget,
    effectiveBudget: budget.effectiveBudget,
    budgetOverridden: budget.budgetOverridden,
    components,
    history,
    freshness: input.freshness,
    gaps,
  };
}
