import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiAt, aiGap, blendSigned, logRelative, prepareAi } from './ai';
import type { ActionId } from './classify';
import { THRESHOLDS, type RegimeId } from './constants';
import { CORR_ALARM, CORR_SCALE_FLOOR, CORR_WARN, crowdingReport, crowdingScale, pearson } from './correlation';
import { evaluateSignalHealth, healthStatus } from './health';
import { buildIdeas } from './ideas';
import { buildModel, type ModelInput } from './model';
import { applyOverlapCaps, OVERLAP_GROUP_CAP } from './overlap';
import type { Bar } from './signals';
import { quantAgrees, signalBlendWeights, signalStrength } from './signals';
import type { FreshnessRow } from './types';
import type { SeriesPoint } from './series';

function dated(end: string, n: number, valueAt: (index: number) => number): SeriesPoint[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, index) => ({
    date: new Date(endMs - (n - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    value: valueAt(index),
  }));
}

function bars(closes: number[], end = '2026-11-03'): Bar[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return closes.map((close, index) => ({
    date: new Date(endMs - (closes.length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    close,
  }));
}

function freshRow(id: string, asOf: string): FreshnessRow {
  return {
    id,
    label: id,
    asOf,
    ageDays: 0,
    stale: false,
    staleAfterDays: 21,
    source: id,
    href: 'https://example.test',
    latest: 1,
  };
}

function flatCore(asOf: string): ModelInput {
  const flat = (n: number) => dated(asOf, n, () => 0);
  return {
    today: asOf,
    generatedAt: `${asOf}T00:00:00.000Z`,
    liquidityChange: flat(180),
    policyGap: flat(800),
    creditEase: flat(800),
    curve: flat(800),
    growthDiff: flat(80),
    usMomentum: flat(80),
    positioning: [],
    levels: {
      liquidityChangeMillions: 0,
      policyGapPp: 0,
      hyOas: 4,
      curvePp: 0,
      growthDiff: 0,
      usMomentum: 0,
    },
    freshness: [
      freshRow('WALCL', asOf),
      freshRow('WTREGEN', asOf),
      freshRow('RRPONTSYD', asOf),
      freshRow('DGS2', asOf),
      freshRow('DFEDTARU', asOf),
      freshRow('BAMLH0A0HYM2', asOf),
    ],
    gaps: [],
    policyRateSeriesId: 'DFEDTARU',
  };
}

function ideaSnapshot(regime: RegimeId, action: ActionId) {
  return {
    regime,
    regimeLabel: regime,
    action,
    message: 'Risk budget open.',
    today: '2026-11-03',
    effectiveBudget: { volTarget: 0.12, maxGross: 1.5, maxNet: 1 },
    components: [],
  };
}

describe('AI capex and concentration', () => {
  it('builds a log relative, sign-flips concentration, and blends only the legs that exist', () => {
    const ratio = logRelative(
      [{ date: '2024-01-02', value: 110 }, { date: '2024-01-03', value: 90 }],
      [{ date: '2024-01-02', value: 100 }, { date: '2024-01-04', value: 100 }],
    );
    assert.equal(ratio.length, 1);
    assert.ok(Math.abs(ratio[0].value - Math.log(1.1)) < 1e-12);
    assert.equal(blendSigned([null, undefined]), null);
    assert.equal(blendSigned([-1, 1]), 0);
    assert.equal(blendSigned([4, 4]), 3);

    const asOf = '2024-06-01';
    const spike = dated(asOf, 160, (index) => (index === 159 ? 1 : 0));
    const concentrated = buildModel({ ...flatCore(asOf), concentration: spike });
    const ai = concentrated.components.find((component) => component.id === 'ai');
    assert.equal(ai?.included, true);
    assert.ok((ai?.z ?? 0) < -2);
    assert.ok((concentrated.composite ?? 0) < 0);
    assert.ok(Math.abs(concentrated.composite ?? 1) < THRESHOLDS.weakAbsComposite);
    assert.equal(concentrated.regime, 'transitional');
    assert.ok(concentrated.history.some((point) => point.ai != null && point.ai < 0));

    const semis = buildModel({ ...flatCore(asOf), semis: spike });
    assert.ok((semis.components.find((component) => component.id === 'ai')?.z ?? 0) > 2);
    assert.ok((semis.composite ?? 0) > 0);

    const offset = buildModel({ ...flatCore(asOf), concentration: spike, semis: spike });
    assert.equal(offset.components.find((component) => component.id === 'ai')?.z, 0);
  });

  it('omits a missing or stale gauge and does not let it set the regime', () => {
    const asOf = '2024-06-01';
    const missing = buildModel(flatCore(asOf));
    const ai = missing.components.find((component) => component.id === 'ai');
    assert.equal(ai?.included, false);
    assert.equal(ai?.z, null);
    assert.match(ai?.gap ?? '', /IPG3344S/);
    assert.match(ai?.gap ?? '', /electricity demand is omitted/);
    assert.equal(missing.composite, 0);

    const alone = buildModel({
      ...flatCore(asOf),
      liquidityChange: [],
      policyGap: [],
      creditEase: [],
      curve: [],
      growthDiff: [],
      usMomentum: [],
      concentration: dated(asOf, 160, (index) => (index === 159 ? 1 : 0)),
    });
    assert.equal(alone.composite, null);
    assert.equal(alone.components.find((component) => component.id === 'ai')?.included, false);
    assert.match(alone.gaps.join(' '), /Composite withheld/);

    const staleEnd = '2024-01-01';
    const stale = buildModel({
      ...flatCore(asOf),
      concentration: dated(staleEnd, 160, (index) => (index === 159 ? 1 : 0)),
    });
    assert.equal(stale.components.find((component) => component.id === 'ai')?.included, false);
    assert.match(stale.components.find((component) => component.id === 'ai')?.gap ?? '', /10 days/);
    assert.equal(stale.actionable, true);

    const prepared = prepareAi({
      concentration: dated(asOf, 160, () => 0),
      semis: [],
      capex: [],
    });
    const live = aiAt(prepared, asOf, { today: asOf, dropStale: true });
    assert.equal(live.z, 0);
    assert.match(aiGap(live.legs) ?? '', /SMH\/SPY/);
  });
});

describe('crowding and correlation', () => {
  it('scales from 1 to one half as correlation rises, and leaves an unknown book unscaled', () => {
    assert.equal(crowdingScale(null), 1);
    assert.equal(crowdingScale(CORR_WARN), 1);
    assert.equal(crowdingScale(CORR_ALARM), CORR_SCALE_FLOOR);
    assert.ok(Math.abs(crowdingScale((CORR_WARN + CORR_ALARM) / 2) - 0.75) < 1e-12);
    assert.ok(Math.abs((pearson([1, 2, 3], [2, 4, 6]) ?? 0) - 1) < 1e-12);

    const closes: number[] = [];
    for (let i = 0; i < 80; i++) closes.push(100 + (i % 2) + i * 0.05);
    const wave = bars(closes);
    const names = ['SPY', 'QQQ', 'IWM', 'XLF', 'XLE', 'GLD', 'TLT', 'EFA'];
    const hot = crowdingReport(names.map((symbol) => ({ symbol, bars: wave })));
    assert.ok((hot.average ?? 0) > 0.99);
    assert.equal(hot.scale, CORR_SCALE_FLOOR);
    assert.match(hot.warning ?? '', /Crowding alarm/);
    assert.equal(hot.dispersion != null, true);

    const thin = crowdingReport(names.slice(0, 7).map((symbol) => ({ symbol, bars: wave })));
    assert.equal(thin.average, null);
    assert.equal(thin.scale, 1);
    assert.match(thin.gap ?? '', /not scaled/);

    const report = buildIdeas({
      snapshot: ideaSnapshot('risk_on', 'risk_budget_open'),
      book: {
        fetchedAt: '2026-11-03T00:00:00.000Z',
        gaps: [],
        series: names.map((symbol) => ({ symbol, bars: wave, asOf: wave[wave.length - 1].date, source: 'yahoo' as const, error: null })),
      },
      watchlist: '',
    });
    assert.equal(report.crowding.scale, CORR_SCALE_FLOOR);
    assert.match(report.crowding.warning ?? '', /scaled by 0.50/);
  });
});

describe('overlap caps', () => {
  it('caps the AI/megacap group, leaves SPY outside it, and still caps when correlation is missing', () => {
    const capped = applyOverlapCaps(
      [
        { symbol: 'QQQ', status: 'confirmed', weight: 0.2 },
        { symbol: 'XLK', status: 'confirmed', weight: 0.2 },
        { symbol: 'NVDA', status: 'confirmed', weight: 0.02 },
        { symbol: 'SPY', status: 'confirmed', weight: 0.2 },
        { symbol: 'TLT', status: 'avoid', weight: 0 },
      ],
      null,
    );
    assert.equal(capped.weights[3], 0.2);
    assert.ok(Math.abs(capped.weights[0] + capped.weights[1] + capped.weights[2] - OVERLAP_GROUP_CAP) < 1e-4);
    assert.ok(capped.weights[0] < 0.2);
    assert.equal(capped.groups.length, 1);
    assert.equal(capped.groups[0].combinedBefore, 0.42);
    assert.ok(capped.groups[0].symbols.includes('QQQ'));
    assert.equal(capped.groups[0].symbols.includes('SPY'), false);
    assert.match(capped.gap ?? '', /unavailable/);

    const pair = applyOverlapCaps(
      [
        { symbol: 'GLD', status: 'confirmed', weight: 0.2 },
        { symbol: 'IEF', status: 'confirmed', weight: 0.2 },
        { symbol: 'SHY', status: 'confirmed', weight: 0.1 },
      ],
      [{ a: 'GLD', b: 'IEF', corr: 0.91 }],
    );
    assert.equal(pair.weights[0], 0.125);
    assert.equal(pair.weights[1], 0.125);
    assert.equal(pair.weights[2], 0.1);
    assert.match(pair.groups[0].reason, /0\.80/);
    assert.equal(pair.gap, null);

    const up = bars(Array.from({ length: 260 }, (_, index) => 100 * (1.0008 ** index)));
    const report = buildIdeas({
      snapshot: ideaSnapshot('risk_on', 'risk_budget_open'),
      book: {
        fetchedAt: '2026-11-03T00:00:00.000Z',
        gaps: [],
        series: ['QQQ', 'XLK'].map((symbol) => ({
          symbol,
          bars: up,
          asOf: up[up.length - 1].date,
          source: 'yahoo' as const,
          error: null,
        })),
      },
      watchlist: '',
    });
    const qqq = report.rows.find((row) => row.symbol === 'QQQ');
    const xlk = report.rows.find((row) => row.symbol === 'XLK');
    assert.equal(qqq?.status, 'confirmed');
    assert.equal(xlk?.status, 'confirmed');
    assert.equal(report.rows.some((row) => row.symbol === 'SPY' && row.status === 'confirmed'), false);
    assert.ok(Math.abs((qqq?.maxWeight ?? 0) + (xlk?.maxWeight ?? 0) - OVERLAP_GROUP_CAP) < 1e-4);
    assert.deepEqual(report.overlap.groups[0]?.symbols, ['QQQ', 'XLK']);
  });
});

describe('signal decay', () => {
  it('retires a signal only when both the information coefficient and the hit rate have failed', () => {
    assert.equal(healthStatus(null, 0.6, 40), 'unknown');
    assert.equal(healthStatus(0.2, 0.6, 39), 'unknown');
    assert.equal(healthStatus(-0.1, 0.4, 40), 'retired');
    assert.equal(healthStatus(-0.1, 0.6, 40), 'degraded');
    assert.equal(healthStatus(0.1, 0.4, 40), 'degraded');
    assert.equal(healthStatus(0.1, 0.6, 40), 'healthy');

    const steady = {
      asOf: '2026-11-03',
      lastClose: 100,
      momentum12_1: 0.2,
      ma200: 90,
      above200: true,
      annVol20: 0.2,
      reversionZ: 0,
    };
    const retiredMomentum = [
      { id: 'momentum' as const, status: 'retired' as const },
      { id: 'trend' as const, status: 'healthy' as const },
      { id: 'reversion' as const, status: 'healthy' as const },
    ];
    assert.equal(quantAgrees('tactical', { ...steady, momentum12_1: 0 }, retiredMomentum), true);
    assert.equal(quantAgrees('tactical', { ...steady, momentum12_1: 0 }), false);
    const both = [
      { id: 'momentum' as const, status: 'retired' as const },
      { id: 'trend' as const, status: 'retired' as const },
      { id: 'reversion' as const, status: 'healthy' as const },
    ];
    assert.equal(quantAgrees('tactical', steady, both), false);
    assert.equal(signalStrength(steady, both), null);
    const degraded = [
      { id: 'momentum' as const, status: 'degraded' as const },
      { id: 'trend' as const, status: 'healthy' as const },
      { id: 'reversion' as const, status: 'healthy' as const },
    ];
    const weights = signalBlendWeights(degraded);
    assert.ok(weights);
    assert.ok(Math.abs(weights.momentum - 0.25 / 0.75) < 1e-12);
    assert.ok((signalStrength(steady, degraded) ?? 0) < (signalStrength(steady) ?? 0));

    const short = evaluateSignalHealth([{ symbol: 'SPY', bars: bars(Array.from({ length: 80 }, () => 100)) }]);
    assert.deepEqual(short.map((signal) => signal.status), ['unknown', 'unknown', 'unknown']);

    const long = Array.from({ length: 8 }, (_, symbol) => {
      const daily = 1 + (symbol - 3.5) * 0.0004;
      const closes: number[] = [];
      let price = 100;
      for (let i = 0; i < 500; i++) {
        closes.push(price);
        price *= daily;
      }
      return { symbol: `S${symbol}`, bars: bars(closes) };
    });
    const health = evaluateSignalHealth(long);
    const momentum = health.find((signal) => signal.id === 'momentum');
    assert.ok((momentum?.samples ?? 0) >= 40);
    assert.ok((momentum?.ic ?? 0) > 0.5);
    assert.ok((momentum?.hitRate ?? 0) > 0.8);
    assert.equal(momentum?.status, 'healthy');
  });
});
