import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ActionId } from './classify';
import type { RegimeId } from './constants';
import {
  buildIdeas,
  defensiveOnly,
  priceIsFresh,
  printStance,
  scaleWeights,
  SINGLE_POSITION_CAP,
  SYSTEMATIC_CAP,
  volTargetWeight,
} from './ideas';
import { parseYahooChart } from './prices';
import {
  computeSignals,
  quantAgrees,
  REVERSION_VETO,
  signalStrength,
  type Bar,
} from './signals';
import type { RegimeSnapshot } from './types';
import { EXPRESSIONS, parseWatchlist, PLAYBOOK_ETFS } from './universe';

function bars(closes: number[], end = '2026-11-03'): Bar[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return closes.map((close, index) => ({
    date: new Date(endMs - (closes.length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    close,
  }));
}

function drift(n: number, start: number, daily: number, end = '2026-11-03'): Bar[] {
  const closes: number[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    closes.push(price);
    price *= daily;
  }
  return bars(closes, end);
}

function snapshot(partial: {
  regime: RegimeId | null;
  action: ActionId;
  today?: string;
  volTarget?: number;
  maxGross?: number;
  maxNet?: number;
  message?: string;
}): Pick<RegimeSnapshot, 'regime' | 'regimeLabel' | 'action' | 'message' | 'today' | 'effectiveBudget' | 'components'> {
  return {
    regime: partial.regime,
    regimeLabel: partial.regime ?? 'Unavailable',
    action: partial.action,
    message: partial.message ?? 'Do nothing / reduce risk.',
    today: partial.today ?? '2026-11-03',
    effectiveBudget: {
      volTarget: partial.volTarget ?? 0.12,
      maxGross: partial.maxGross ?? 1.5,
      maxNet: partial.maxNet ?? 1,
    },
    components: [
      { id: 'liquidity', label: 'Liquidity', z: 0.8, included: true, weight: 0.3, asOf: '2026-11-01', gap: null, detail: '', reading: '' },
      { id: 'policy', label: 'Policy path', z: 0.2, included: true, weight: 0.2, asOf: '2026-11-01', gap: null, detail: '', reading: '' },
      { id: 'credit', label: 'Credit', z: 0.4, included: true, weight: 0.25, asOf: '2026-11-01', gap: null, detail: '', reading: '' },
      { id: 'growth', label: 'Growth differential', z: 0.1, included: true, weight: 0.15, asOf: '2026-11-01', gap: null, detail: '', reading: '' },
      { id: 'positioning', label: 'Positioning extremes', z: null, included: false, weight: 0, asOf: null, gap: null, detail: '', reading: '' },
    ],
  };
}

describe('price signals', () => {
  it('computes 12–1 momentum from the skipped month', () => {
    const closes = new Array<number>(253).fill(100);
    closes[0] = 100;
    closes[253 - 1 - 252] = 100;
    closes[253 - 1 - 21] = 125;
    const signals = computeSignals(bars(closes));
    assert.ok(Math.abs((signals.momentum12_1 ?? 0) - 0.25) < 1e-9);
  });

  it('marks the trend from the 200-day average and annualises 20-day vol', () => {
    const flat = new Array<number>(200).fill(100);
    assert.equal(computeSignals(bars(flat)).above200, false);
    const up = flat.slice();
    up[199] = 130;
    const trend = computeSignals(bars(up));
    assert.equal(trend.above200, true);
    assert.ok((trend.ma200 ?? 0) > 100 && (trend.ma200 ?? 0) < 101);

    const calm = computeSignals(bars(new Array<number>(30).fill(50)));
    assert.equal(calm.annVol20, 0);
  });

  it('vetoes a stretched 5-session return and accepts a steady drift', () => {
    const steady = computeSignals(drift(260, 100, 1.0008));
    assert.ok((steady.momentum12_1 ?? 0) > 0);
    assert.equal(steady.above200, true);
    assert.ok((steady.reversionZ ?? 1) < REVERSION_VETO);
    assert.equal(quantAgrees('tactical', steady), true);

    const closes = drift(260, 100, 1.0002).map((bar) => bar.close);
    closes[closes.length - 1] *= 1.2;
    const spiked = computeSignals(bars(closes));
    assert.ok((spiked.reversionZ ?? 0) >= REVERSION_VETO);
    assert.equal(quantAgrees('tactical', spiked), false);
    assert.equal(quantAgrees('tactical', { ...steady, momentum12_1: 0 }), false);
    assert.equal(quantAgrees('tactical', { ...steady, above200: false }), false);
    assert.equal(quantAgrees('tactical', { ...steady, reversionZ: REVERSION_VETO }), false);
    assert.equal(quantAgrees('cash', { ...steady, momentum12_1: 0, above200: false }), true);
    assert.equal(signalStrength(steady) != null, true);
  });
});

describe('confirmation and sizing', () => {
  it('confirms a favoured uptrend, watches a missing price, and avoids what the book does not prefer', () => {
    const up = drift(260, 100, 1.0008);
    const report = buildIdeas({
      snapshot: snapshot({ regime: 'risk_on', action: 'risk_budget_open' }),
      book: {
        fetchedAt: '2026-11-03T00:00:00.000Z',
        gaps: [],
        series: [
          { symbol: 'SPY', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'AAPL', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'TLT', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'QQQ', bars: [], asOf: null, source: null, error: 'QQQ returned no prices' },
        ],
      },
      watchlist: 'AAPL',
    });

    const spy = report.rows.find((row) => row.symbol === 'SPY');
    const aapl = report.rows.find((row) => row.symbol === 'AAPL');
    const tlt = report.rows.find((row) => row.symbol === 'TLT');
    const qqq = report.rows.find((row) => row.symbol === 'QQQ');
    assert.equal(spy?.status, 'confirmed');
    assert.ok((spy?.maxWeight ?? 0) > 0 && (spy?.maxWeight ?? 1) <= SINGLE_POSITION_CAP);
    assert.equal(aapl?.status, 'confirmed');
    assert.ok((aapl?.maxWeight ?? 1) <= SYSTEMATIC_CAP);
    assert.equal(tlt?.status, 'avoid');
    assert.equal(tlt?.maxWeight, 0);
    assert.equal(qqq?.status, 'watch');
    assert.equal(qqq?.signals.lastClose, null);
    assert.equal(qqq?.maxWeight, 0);
    assert.match(spy?.invalidation ?? '', /200-day average/);
    assert.match(spy?.drivers ?? '', /Liquidity z \+0\.80/);
    assert.equal(report.defensiveOnly, false);
    assert.equal(report.watchlistNote, null);
  });

  it('limits a do-nothing or reduce-risk print to defensive and cash ideas', () => {
    const up = drift(260, 50, 1);
    const flat = bars(new Array<number>(40).fill(50));
    const report = buildIdeas({
      snapshot: snapshot({
        regime: 'crisis',
        action: 'reduce_risk',
        volTarget: 0.03,
        maxGross: 0.2,
        maxNet: 0,
        message: 'Reduce risk. Crisis regime.',
      }),
      book: {
        fetchedAt: '2026-11-03T00:00:00.000Z',
        gaps: [],
        series: [
          { symbol: 'SPY', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'AAA.AX', bars: flat, asOf: flat[flat.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'AAPL', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'TLT', bars: up, asOf: up[up.length - 1].date, source: 'yahoo', error: null },
        ],
      },
      watchlist: 'AAPL',
    });

    assert.equal(report.defensiveOnly, true);
    assert.match(report.banner ?? '', /Reduce risk/);
    assert.equal(report.rows.some((row) => row.symbol === 'AAPL'), false);
    assert.match(report.watchlistNote ?? '', /stood down/);
    const spy = report.rows.find((row) => row.symbol === 'SPY');
    const cash = report.rows.find((row) => row.symbol === 'AAA.AX');
    const tlt = report.rows.find((row) => row.symbol === 'TLT');
    assert.equal(spy?.status, 'avoid');
    assert.equal(spy?.maxWeight, 0);
    assert.equal(tlt?.status, 'avoid');
    assert.equal(tlt?.maxWeight, 0);
    assert.equal(cash?.status, 'confirmed');
    assert.equal(cash?.maxWeight, 0.2);
    assert.equal(cash?.signals.lastClose, 50);
    assert.equal(report.rows.some((row) => row.status === 'confirmed' && !row.defensive), false);
  });

  it('ranks confirmed names by signal strength', () => {
    const mild = drift(260, 100, 1.0004);
    const strong = drift(260, 100, 1.002);
    const report = buildIdeas({
      snapshot: snapshot({ regime: 'risk_on', action: 'risk_budget_open' }),
      book: {
        fetchedAt: '2026-11-03T00:00:00.000Z',
        gaps: [],
        series: [
          { symbol: 'SPY', bars: mild, asOf: mild[mild.length - 1].date, source: 'yahoo', error: null },
          { symbol: 'QQQ', bars: strong, asOf: strong[strong.length - 1].date, source: 'yahoo', error: null },
        ],
      },
      watchlist: '',
    });
    const symbols = report.rows.filter((row) => row.status === 'confirmed').map((row) => row.symbol);
    assert.equal(symbols[0], 'QQQ');
    assert.ok(symbols.indexOf('QQQ') < symbols.indexOf('SPY'));
  });

  it('caps a single idea at 20%, a stock at 2%, and the book at the net and gross budget', () => {
    assert.equal(volTargetWeight(0.12, 0.24, 'tactical'), SINGLE_POSITION_CAP);
    assert.equal(volTargetWeight(0.12, 0.8, 'tactical'), 0.15);
    assert.equal(volTargetWeight(0.12, 0.12, 'systematic'), SYSTEMATIC_CAP);
    assert.equal(volTargetWeight(0.03, 0.001, 'cash'), SINGLE_POSITION_CAP);
    assert.equal(volTargetWeight(0.12, null, 'tactical'), 0);
    assert.deepEqual(
      scaleWeights(
        [
          { role: 'tactical', raw: 0.2 },
          { role: 'tactical', raw: 0.2 },
          { role: 'tactical', raw: 0.2 },
        ],
        1,
        0.3,
      ),
      [0.1, 0.1, 0.1],
    );
    assert.deepEqual(
      scaleWeights(
        [
          { role: 'cash', raw: 0.2 },
          { role: 'tactical', raw: 0.2 },
        ],
        0.2,
        0,
      ),
      [0.2, 0],
    );
  });

  it('stands cash up and risk assets down when the action is do nothing', () => {
    assert.equal(defensiveOnly('do_nothing'), true);
    assert.equal(defensiveOnly('reduce_risk'), true);
    assert.equal(defensiveOnly('risk_budget_open'), false);
    const cash = EXPRESSIONS.find((item) => item.id === 'cash');
    const beta = EXPRESSIONS.find((item) => item.id === 'equity-beta');
    assert.ok(cash && beta);
    assert.equal(printStance(cash, 'risk_on', true), 'prefer');
    assert.equal(printStance(beta, 'risk_on', true), 'avoid');
    assert.equal(printStance(beta, 'risk_on', false), 'prefer');
    assert.equal(priceIsFresh('2026-10-27', '2026-11-03'), true);
    assert.equal(priceIsFresh('2026-10-26', '2026-11-03'), false);
    assert.equal(priceIsFresh(null, '2026-11-03'), false);
  });
});

describe('yahoo prices and the watchlist', () => {
  it('skips null closes and does not invent a fill', () => {
    const parsed = parseYahooChart({
      chart: {
        result: [{
          timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
          indicators: {
            adjclose: [{ adjclose: [100, null, 110] }],
            quote: [{ close: [99, 105, 108] }],
          },
        }],
      },
    }, 'SPY');
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed.map((bar) => bar.close), [100, 110]);

    assert.deepEqual(parseYahooChart({ chart: { result: [] } }, 'SPY'), []);
    assert.deepEqual(parseYahooChart(null, 'SPY'), []);

    const quoteOnly = parseYahooChart({
      chart: {
        result: [{
          timestamp: [1_700_000_000],
          indicators: { quote: [{ close: [42] }] },
        }],
      },
    }, 'SPY');
    assert.equal(quoteOnly[0]?.close, 42);
  });

  it('keeps every playbook ticker in the catalog and lets the watchlist replace the default', () => {
    const catalog = new Set(PLAYBOOK_ETFS.map((item) => item.symbol));
    for (const expression of EXPRESSIONS) {
      for (const symbol of expression.symbols) assert.equal(catalog.has(symbol), true);
    }
    assert.equal(parseWatchlist(undefined), null);
    assert.deepEqual(parseWatchlist('aapl, bhp.ax, aapl'), ['AAPL', 'BHP.AX']);
    assert.deepEqual(parseWatchlist(''), []);
  });
});
