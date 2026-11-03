import { CLI_MOMENTUM_MONTHS, FRED_SERIES, LIQUIDITY_CHANGE_WEEKS, STALE_AFTER_DAYS } from './constants';
import { buildModel, type ModelInput, type PositioningInput } from './model';
import {
  differenceAligned,
  lastPoint,
  netLiquidityMillions,
  policyGap,
  trailingChange,
  type SeriesPoint,
} from './series';
import { ageInDays } from './stats';
import type { FreshnessRow, RegimeSnapshot } from './types';

export interface DataBundle {
  today: string;
  generatedAt: string;
  walcl: SeriesPoint[];
  tga: SeriesPoint[];
  rrp: SeriesPoint[];
  dgs2: SeriesPoint[];
  policyRate: SeriesPoint[];
  policyRateSeriesId: string;
  hy: SeriesPoint[];
  curve: SeriesPoint[];
  usCli: SeriesPoint[];
  auCli: SeriesPoint[];
  positioning: PositioningInput[];
  gaps: string[];
}

function fredHref(id: string): string {
  return `https://fred.stlouisfed.org/series/${id}`;
}

function freshness(args: {
  id: string;
  label: string;
  points: SeriesPoint[];
  staleAfterDays: number;
  source: string;
  href: string;
  today: string;
}): FreshnessRow {
  const last = lastPoint(args.points);
  const age = last ? ageInDays(last.date, args.today) : null;
  return {
    id: args.id,
    label: args.label,
    asOf: last?.date ?? null,
    ageDays: age,
    stale: age == null || age > args.staleAfterDays,
    staleAfterDays: args.staleAfterDays,
    source: args.source,
    href: args.href,
    latest: last?.value ?? null,
  };
}

export function bundleToModelInput(bundle: DataBundle): ModelInput {
  const net = netLiquidityMillions(bundle.walcl, bundle.tga, bundle.rrp);
  const liquidityChange = trailingChange(net, LIQUIDITY_CHANGE_WEEKS);
  const gap = policyGap(bundle.dgs2, bundle.policyRate);
  const growthDiff = differenceAligned(bundle.usCli, bundle.auCli);
  const usMomentum = trailingChange(bundle.usCli, CLI_MOMENTUM_MONTHS);
  const today = bundle.today;

  const freshnessRows: FreshnessRow[] = [
    freshness({
      id: FRED_SERIES.walcl,
      label: 'Fed total assets',
      points: bundle.walcl,
      staleAfterDays: STALE_AFTER_DAYS.weekly,
      source: 'FRED WALCL',
      href: fredHref(FRED_SERIES.walcl),
      today,
    }),
    freshness({
      id: FRED_SERIES.tga,
      label: 'Treasury General Account',
      points: bundle.tga,
      staleAfterDays: STALE_AFTER_DAYS.weekly,
      source: 'FRED WTREGEN',
      href: fredHref(FRED_SERIES.tga),
      today,
    }),
    freshness({
      id: FRED_SERIES.rrp,
      label: 'Overnight reverse repo',
      points: bundle.rrp,
      staleAfterDays: STALE_AFTER_DAYS.daily,
      source: 'FRED RRPONTSYD',
      href: fredHref(FRED_SERIES.rrp),
      today,
    }),
    freshness({
      id: FRED_SERIES.dgs2,
      label: 'US 2-year yield',
      points: bundle.dgs2,
      staleAfterDays: STALE_AFTER_DAYS.daily,
      source: 'FRED DGS2',
      href: fredHref(FRED_SERIES.dgs2),
      today,
    }),
    freshness({
      id: bundle.policyRateSeriesId,
      label: bundle.policyRateSeriesId === FRED_SERIES.policyUpper ? 'Fed funds target upper' : 'Effective fed funds',
      points: bundle.policyRate,
      staleAfterDays: STALE_AFTER_DAYS.daily,
      source: `FRED ${bundle.policyRateSeriesId}`,
      href: fredHref(bundle.policyRateSeriesId),
      today,
    }),
    freshness({
      id: FRED_SERIES.hy,
      label: 'US high-yield OAS',
      points: bundle.hy,
      staleAfterDays: STALE_AFTER_DAYS.daily,
      source: 'FRED BAMLH0A0HYM2',
      href: fredHref(FRED_SERIES.hy),
      today,
    }),
    freshness({
      id: FRED_SERIES.curve,
      label: 'US 10y−2y curve',
      points: bundle.curve,
      staleAfterDays: STALE_AFTER_DAYS.daily,
      source: 'FRED T10Y2Y',
      href: fredHref(FRED_SERIES.curve),
      today,
    }),
    freshness({
      id: FRED_SERIES.usCli,
      label: 'US OECD CLI',
      points: bundle.usCli,
      staleAfterDays: STALE_AFTER_DAYS.monthly,
      source: 'FRED USALOLITOAASTSAM',
      href: fredHref(FRED_SERIES.usCli),
      today,
    }),
    freshness({
      id: FRED_SERIES.auCli,
      label: 'Australia OECD CLI',
      points: bundle.auCli,
      staleAfterDays: STALE_AFTER_DAYS.monthly,
      source: 'FRED AUSLOLITOAASTSAM',
      href: fredHref(FRED_SERIES.auCli),
      today,
    }),
  ];

  for (const contract of bundle.positioning) {
    freshnessRows.push(
      freshness({
        id: `CFTC-${contract.id}`,
        label: contract.label,
        points: contract.netOi,
        staleAfterDays: STALE_AFTER_DAYS.weekly,
        source: 'CFTC legacy futures-only COT',
        href: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
        today,
      }),
    );
  }

  return {
    today,
    generatedAt: bundle.generatedAt,
    liquidityChange,
    policyGap: gap,
    creditEase: bundle.hy.map((point) => ({ date: point.date, value: -point.value })),
    curve: bundle.curve,
    growthDiff,
    usMomentum,
    positioning: bundle.positioning,
    levels: {
      liquidityChangeMillions: lastPoint(liquidityChange)?.value ?? null,
      policyGapPp: lastPoint(gap)?.value ?? null,
      hyOas: lastPoint(bundle.hy)?.value ?? null,
      curvePp: lastPoint(bundle.curve)?.value ?? null,
      growthDiff: lastPoint(growthDiff)?.value ?? null,
      usMomentum: lastPoint(usMomentum)?.value ?? null,
    },
    freshness: freshnessRows,
    gaps: bundle.gaps,
    policyRateSeriesId: bundle.policyRateSeriesId,
  };
}

export function snapshotFromBundle(bundle: DataBundle): RegimeSnapshot {
  return buildModel(bundleToModelInput(bundle));
}
