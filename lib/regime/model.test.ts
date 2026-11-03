import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { snapshotFromBundle, type DataBundle } from './assemble';
import { actionFor, budgetsFor, classifyRegime } from './classify';
import { BASE_WEIGHTS, COMPONENT_IDS, MODEL_BUDGET, THRESHOLDS } from './constants';
import { buildModel, weightedComposite, type ModelInput } from './model';
import {
  netLiquidityMillions,
  parseCotNetOi,
  parseFredObservations,
  policyGap,
  trailingChange,
  type SeriesPoint,
} from './series';
import { zScoreLatest } from './stats';
import type { FreshnessRow } from './types';

function dated(start: string, stepDays: number, values: number[]): SeriesPoint[] {
  const origin = Date.parse(`${start}T00:00:00Z`);
  return values.map((value, index) => ({
    date: new Date(origin + index * stepDays * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

function flatThen(n: number, jump: number, stepDays: number, start: string): SeriesPoint[] {
  return dated(start, stepDays, Array.from({ length: n }, (_, index) => (index === n - 1 ? jump : 0)));
}

function freshRow(id: string, asOf: string, stale = false): FreshnessRow {
  return {
    id,
    label: id,
    asOf,
    ageDays: stale ? 40 : 0,
    stale,
    staleAfterDays: stale ? 10 : 21,
    source: id,
    href: 'https://fred.stlouisfed.org/',
    latest: 1,
  };
}

function modelInput(overrides: Partial<ModelInput> = {}): ModelInput {
  const asOf = '2024-06-01';
  const base: ModelInput = {
    today: asOf,
    generatedAt: `${asOf}T00:00:00.000Z`,
    liquidityChange: flatThen(180, 0, 7, '2020-01-01'),
    policyGap: flatThen(800, 0, 1, '2022-01-01'),
    creditEase: flatThen(800, 0, 1, '2022-01-01'),
    curve: flatThen(800, 0, 1, '2022-01-01'),
    growthDiff: flatThen(80, 0, 30, '2018-01-01'),
    usMomentum: flatThen(80, 0, 30, '2018-01-01'),
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
  return { ...base, ...overrides, levels: { ...base.levels, ...overrides.levels } };
}

describe('z-scores', () => {
  it('matches the sample z-score and ignores points outside the window', () => {
    const sample = [1, 2, 3, 4, 5];
    const expected = (5 - 3) / Math.sqrt(2.5);
    assert.ok(Math.abs((zScoreLatest(sample, 5, 5) ?? NaN) - expected) < 1e-12);

    const padded = [...Array.from({ length: 10 }, () => 100), ...sample];
    assert.ok(Math.abs((zScoreLatest(padded, 5, 5) ?? NaN) - expected) < 1e-12);
  });

  it('returns 0 for a flat window, null before the minimum, and clamps spikes', () => {
    assert.equal(zScoreLatest([2, 2, 2, 2, 2], 5, 5), 0);
    assert.equal(zScoreLatest([1, 2, 3], 10, 5), null);
    assert.equal(zScoreLatest([...Array.from({ length: 20 }, () => 0), 100], 21, 5), 3);
    assert.equal(zScoreLatest([...Array.from({ length: 20 }, () => 0), -100], 21, 5), -3);
  });
});

describe('series transforms', () => {
  it('aligns net liquidity in millions of USD', () => {
    const net = netLiquidityMillions(
      [{ date: '2020-01-08', value: 4_000_000 }],
      [{ date: '2020-01-01', value: 300_000 }],
      [{ date: '2020-01-08', value: 0.5 }],
    );
    assert.deepEqual(net, [{ date: '2020-01-08', value: 3_699_500 }]);
    assert.deepEqual(netLiquidityMillions(
      [{ date: '2020-01-08', value: 4_000_000 }],
      [],
      [{ date: '2020-01-08', value: 0.5 }],
    ), []);
  });

  it('scores an easier policy path as positive and tightens credit by flipping OAS', () => {
    const gap = policyGap(
      [{ date: '2024-01-02', value: 4 }, { date: '2024-01-03', value: 5.5 }],
      [{ date: '2024-01-01', value: 5.5 }],
    );
    assert.deepEqual(gap, [
      { date: '2024-01-02', value: 1.5 },
      { date: '2024-01-03', value: 0 },
    ]);
    const change = trailingChange(
      [{ date: '2020-01-01', value: 10 }, { date: '2020-01-08', value: 12 }, { date: '2020-01-15', value: 7 }],
      2,
    );
    assert.deepEqual(change, [{ date: '2020-01-15', value: -3 }]);
  });

  it('parses FRED gaps and CFTC net open interest', () => {
    assert.deepEqual(parseFredObservations({
      observations: [
        { date: '2024-01-01', value: '.' },
        { date: '2024-01-02', value: '1.5' },
        { date: '2024-01-02', value: '1.75' },
        { date: 'bad', value: '3' },
      ],
    }), [{ date: '2024-01-02', value: 1.75 }]);

    assert.deepEqual(parseCotNetOi([
      {
        report_date_as_yyyy_mm_dd: '2024-01-02T00:00:00.000',
        open_interest_all: '200',
        noncomm_positions_long_all: '60',
        noncomm_positions_short_all: '40',
      },
      {
        report_date_as_yyyy_mm_dd: '2024-01-09',
        open_interest_all: '0',
        noncomm_positions_long_all: '1',
        noncomm_positions_short_all: '1',
      },
    ]), [{ date: '2024-01-02', value: 0.1 }]);
    assert.deepEqual(parseCotNetOi({ error: true }), []);
  });
});

describe('composite weights', () => {
  it('sums to one and renormalises when positioning is missing', () => {
    const sum = COMPONENT_IDS.reduce((total, id) => total + BASE_WEIGHTS[id], 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
    const { composite, weights } = weightedComposite({
      liquidity: 1,
      policy: 1,
      credit: 1,
      growth: 1,
      positioning: null,
    });
    assert.ok(Math.abs((composite ?? 0) - 1) < 1e-12);
    assert.equal(weights.positioning, 0);
    assert.ok(Math.abs(weights.liquidity - 0.3 / 0.9) < 1e-12);
    assert.ok(Math.abs(weights.credit - 0.25 / 0.9) < 1e-12);
    assert.equal(weightedComposite({}).composite, null);
  });
});

describe('classification hysteresis', () => {
  it('applies entry and exit bands in severity order', () => {
    assert.equal(classifyRegime({ composite: 0, liquidityZ: 0, creditZ: 0, previous: null }), 'transitional');
    assert.equal(classifyRegime({ composite: 0.55, liquidityZ: 0.2, creditZ: 0, previous: null }), 'transitional');
    assert.equal(classifyRegime({ composite: 0.65, liquidityZ: 0.1, creditZ: 0, previous: null }), 'risk_on');
    assert.equal(classifyRegime({ composite: 0.7, liquidityZ: 0, creditZ: 0, previous: null }), 'transitional');
    assert.equal(classifyRegime({ composite: 0.7, liquidityZ: null, creditZ: 0, previous: null }), 'transitional');
    assert.equal(classifyRegime({ composite: -0.75, liquidityZ: 0, creditZ: 0, previous: null }), 'tightening');
    assert.equal(classifyRegime({ composite: -1.75, liquidityZ: -1, creditZ: -1, previous: null }), 'crisis');
    assert.equal(classifyRegime({ composite: -1.25, liquidityZ: -1, creditZ: -2, previous: null }), 'crisis');
    assert.equal(classifyRegime({ composite: -1.25, liquidityZ: -1, creditZ: -1.9, previous: null }), 'tightening');

    assert.equal(classifyRegime({ composite: 0.4, liquidityZ: 0.2, creditZ: 0, previous: 'risk_on' }), 'risk_on');
    assert.equal(classifyRegime({ composite: 0.2, liquidityZ: 0.2, creditZ: 0, previous: 'risk_on' }), 'transitional');
    assert.equal(classifyRegime({ composite: 0.8, liquidityZ: -0.3, creditZ: 0, previous: 'risk_on' }), 'transitional');
    assert.equal(classifyRegime({ composite: -0.9, liquidityZ: -0.4, creditZ: -0.5, previous: 'risk_on' }), 'tightening');
    assert.equal(classifyRegime({ composite: -1.9, liquidityZ: -1, creditZ: -2.2, previous: 'risk_on' }), 'crisis');

    assert.equal(classifyRegime({ composite: -0.5, liquidityZ: 0, creditZ: 0, previous: 'tightening' }), 'tightening');
    assert.equal(classifyRegime({ composite: -0.3, liquidityZ: 0, creditZ: 0, previous: 'tightening' }), 'transitional');

    assert.equal(classifyRegime({ composite: -1.0, liquidityZ: -0.4, creditZ: -1.6, previous: 'crisis' }), 'crisis');
    assert.equal(classifyRegime({ composite: -1.0, liquidityZ: -0.4, creditZ: -1.4, previous: 'crisis' }), 'tightening');
    assert.equal(classifyRegime({ composite: 0, liquidityZ: 0, creditZ: 0, previous: 'crisis' }), 'transitional');
    assert.equal(classifyRegime({ composite: null, liquidityZ: 0, creditZ: 0, previous: 'crisis' }), null);
  });

  it('walks a path without leaving a regime inside its hold band', () => {
    const path: { c: number; liq: number; credit: number; expect: ReturnType<typeof classifyRegime> }[] = [
      { c: 0, liq: 0, credit: 0, expect: 'transitional' },
      { c: 0.7, liq: 0.2, credit: 0, expect: 'risk_on' },
      { c: 0.4, liq: 0.2, credit: 0, expect: 'risk_on' },
      { c: 0.2, liq: 0.2, credit: 0, expect: 'transitional' },
      { c: -0.8, liq: -0.4, credit: -0.4, expect: 'tightening' },
      { c: -0.5, liq: -0.2, credit: -0.2, expect: 'tightening' },
      { c: -1.8, liq: -1, credit: -2.2, expect: 'crisis' },
      { c: -1.4, liq: -0.5, credit: -1.8, expect: 'crisis' },
      { c: -0.5, liq: 0, credit: -1, expect: 'tightening' },
    ];
    let previous: ReturnType<typeof classifyRegime> = null;
    for (const step of path) {
      previous = classifyRegime({
        composite: step.c,
        liquidityZ: step.liq,
        creditZ: step.credit,
        previous,
      });
      assert.equal(previous, step.expect);
    }
  });
});

describe('action and risk budget', () => {
  it('tells the owner to do nothing or reduce risk when the signal is weak or the data is stale', () => {
    const stale = actionFor({ actionable: false, weak: false, regime: 'risk_on' });
    assert.equal(stale.action, 'reduce_risk');
    assert.match(stale.message, /Do nothing \/ reduce risk/);
    const staleBudget = budgetsFor('risk_on', stale.action);
    assert.equal(staleBudget.effectiveBudget.volTarget, 0.03);
    assert.equal(staleBudget.effectiveBudget.maxGross, 0.2);
    assert.equal(staleBudget.effectiveBudget.maxNet, 0);
    assert.equal(staleBudget.budgetOverridden, true);

    const quiet = actionFor({ actionable: true, weak: true, regime: 'transitional' });
    assert.equal(quiet.action, 'do_nothing');
    assert.match(quiet.message, /Do nothing/);
    const quietBudget = budgetsFor('transitional', quiet.action);
    assert.equal(quietBudget.effectiveBudget.maxGross, 0.4);
    assert.equal(quietBudget.effectiveBudget.maxNet, 0.2);

    const crisis = actionFor({ actionable: true, weak: false, regime: 'crisis' });
    assert.equal(crisis.action, 'reduce_risk');
    assert.deepEqual(budgetsFor('crisis', crisis.action).effectiveBudget, MODEL_BUDGET.crisis);
    assert.deepEqual(budgetsFor('risk_on', 'risk_budget_open').effectiveBudget, MODEL_BUDGET.risk_on);
    assert.equal(MODEL_BUDGET.risk_on.volTarget, 0.12);
    assert.equal(MODEL_BUDGET.crisis.volTarget, 0.03);
    assert.equal(THRESHOLDS.weakAbsComposite, 0.35);
  });
});

describe('snapshot', () => {
  it('classifies a positive liquidity shock as risk-on when the core data is fresh', () => {
    const asOf = '2024-12-31';
    const snap = buildModel(modelInput({
      today: asOf,
      liquidityChange: flatThen(180, 10, 7, '2020-01-01'),
      policyGap: flatThen(800, 5, 1, '2022-01-01'),
      creditEase: flatThen(800, 5, 1, '2022-01-01'),
      curve: flatThen(800, 5, 1, '2022-01-01'),
      growthDiff: flatThen(80, 5, 30, '2018-01-01'),
      freshness: [
        freshRow('WALCL', asOf),
        freshRow('WTREGEN', asOf),
        freshRow('RRPONTSYD', asOf),
        freshRow('DGS2', asOf),
        freshRow('DFEDTARU', asOf),
        freshRow('BAMLH0A0HYM2', asOf),
      ],
    }));
    assert.equal(snap.regime, 'risk_on');
    assert.equal(snap.regimeLabel, 'Risk-On Liquidity Expansion');
    assert.ok((snap.composite ?? 0) > 0.65);
    assert.equal(snap.action, 'risk_budget_open');
    assert.equal(snap.actionable, true);
    assert.equal(snap.effectiveBudget.volTarget, 0.12);
    assert.equal(snap.effectiveBudget.maxGross, 1.5);
    assert.equal(snap.effectiveBudget.maxNet, 1);
    assert.equal(snap.components.find((component) => component.id === 'positioning')?.included, false);
    assert.match(snap.gaps.join(' '), /Positioning is not in the composite/);
    assert.ok(snap.history.length > 10);
    const entered = snap.history.find((point) => point.regime === 'risk_on');
    assert.ok(entered);
  });

  it('keeps the model label but blocks action when core data is stale', () => {
    const snap = buildModel(modelInput({
      today: '2024-08-15',
      liquidityChange: flatThen(180, 10, 7, '2020-01-01'),
      policyGap: flatThen(800, 5, 1, '2022-01-01'),
      creditEase: flatThen(800, 5, 1, '2022-01-01'),
      curve: flatThen(800, 5, 1, '2022-01-01'),
      growthDiff: flatThen(80, 5, 30, '2018-01-01'),
      freshness: [
        freshRow('WALCL', '2024-06-01'),
        freshRow('WTREGEN', '2024-06-01'),
        freshRow('RRPONTSYD', '2024-06-01'),
        freshRow('DGS2', '2024-06-01', true),
        freshRow('DFEDTARU', '2024-06-01'),
        freshRow('BAMLH0A0HYM2', '2024-06-01'),
      ],
    }));
    assert.equal(snap.regime, 'risk_on');
    assert.equal(snap.actionable, false);
    assert.equal(snap.action, 'reduce_risk');
    assert.match(snap.message, /Do nothing \/ reduce risk/);
    assert.equal(snap.effectiveBudget.maxNet, 0);
    assert.match(snap.gaps.join(' '), /stale/);
  });

  it('does nothing when every leg is flat', () => {
    const snap = buildModel(modelInput());
    assert.equal(snap.regime, 'transitional');
    assert.equal(snap.weak, true);
    assert.equal(snap.action, 'do_nothing');
    assert.match(snap.message, /no-edge band/);
    assert.equal(snap.composite, 0);
  });

  it('classifies a negative shock as crisis and treats crowded longs as risk-off positioning', () => {
    const asOf = '2024-12-31';
    const snap = buildModel(modelInput({
      today: asOf,
      liquidityChange: flatThen(180, -10, 7, '2020-01-01'),
      policyGap: flatThen(800, -5, 1, '2022-01-01'),
      creditEase: flatThen(800, -5, 1, '2022-01-01'),
      curve: flatThen(800, -5, 1, '2022-01-01'),
      growthDiff: flatThen(80, -5, 30, '2018-01-01'),
      positioning: [{
        id: 'es',
        label: 'E-mini S&P 500 spec net/OI',
        netOi: flatThen(180, 1, 7, '2020-01-01'),
      }],
      freshness: [
        freshRow('WALCL', asOf),
        freshRow('WTREGEN', asOf),
        freshRow('RRPONTSYD', asOf),
        freshRow('DGS2', asOf),
        freshRow('DFEDTARU', asOf),
        freshRow('BAMLH0A0HYM2', asOf),
      ],
    }));
    assert.equal(snap.regime, 'crisis');
    assert.equal(snap.action, 'reduce_risk');
    assert.equal(snap.effectiveBudget.volTarget, 0.03);
    assert.equal(snap.effectiveBudget.maxGross, 0.2);
    assert.equal(snap.effectiveBudget.maxNet, 0.1);
    const positioning = snap.components.find((component) => component.id === 'positioning');
    assert.equal(positioning?.included, true);
    assert.ok((positioning?.z ?? 0) < 0);
  });

  it('does not let positioning alone set the regime', () => {
    const snap = buildModel(modelInput({
      liquidityChange: [],
      policyGap: [],
      creditEase: [],
      curve: [],
      growthDiff: [],
      usMomentum: [],
      positioning: [{
        id: 'es',
        label: 'E-mini S&P 500 spec net/OI',
        netOi: flatThen(180, 1, 7, '2020-01-01'),
      }],
      freshness: [
        freshRow('WALCL', '2024-06-01', true),
        freshRow('WTREGEN', '2024-06-01', true),
        freshRow('RRPONTSYD', '2024-06-01', true),
        freshRow('DGS2', '2024-06-01', true),
        freshRow('DFEDTARU', '2024-06-01', true),
        freshRow('BAMLH0A0HYM2', '2024-06-01', true),
      ],
    }));
    assert.equal(snap.regime, null);
    assert.equal(snap.regimeLabel, 'Unavailable');
    assert.equal(snap.composite, null);
    assert.equal(snap.action, 'reduce_risk');
    assert.equal(snap.components.find((component) => component.id === 'positioning')?.included, false);
    assert.match(snap.gaps.join(' '), /Composite withheld/);
  });

  it('builds the liquidity impulse from raw FRED units and records a missing Australia CLI', () => {
    const weeks = 200;
    const walcl = dated('2018-01-03', 7, Array.from({ length: weeks }, (_, index) => 4_000_000 + index * 1000));
    const tga = walcl.map((point) => ({ date: point.date, value: 400_000 }));
    const rrp = walcl.map((point) => ({ date: point.date, value: 1 }));
    const last = walcl[walcl.length - 1].date;
    const bundle: DataBundle = {
      today: last,
      generatedAt: `${last}T00:00:00.000Z`,
      walcl,
      tga,
      rrp,
      dgs2: flatThen(900, 4, 1, '2021-01-01'),
      policyRate: flatThen(900, 5, 1, '2021-01-01'),
      policyRateSeriesId: 'DFEDTARU',
      hy: flatThen(900, 3.5, 1, '2021-01-01'),
      curve: flatThen(900, 0.4, 1, '2021-01-01'),
      usCli: flatThen(90, 100, 30, '2016-01-01'),
      auCli: [],
      positioning: [],
      gaps: [],
    };
    const snap = snapshotFromBundle(bundle);
    const liquidity = snap.components.find((component) => component.id === 'liquidity');
    assert.equal(liquidity?.included, true);
    assert.match(liquidity?.reading ?? '', /\+\$/);
    const growth = snap.components.find((component) => component.id === 'growth');
    assert.match(growth?.gap ?? '', /Australia CLI is unavailable/);
    assert.equal(snap.freshness.find((row) => row.id === 'AUSLOLITOAASTSAM')?.stale, true);
  });
});
