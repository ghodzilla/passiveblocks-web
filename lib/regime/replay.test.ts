import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { asofSeries } from './alfredAsOf';
import { applyContribution, executionBar, maxDrawdown, settleAudDay, tradedFraction } from './replay';
import { loadIntervalFiles, panelAt } from '../../research/regime-validation/loadIntervals';
import type { PriceSeries } from './prices';

describe('ALFRED vintage reconstruction', () => {
  it('keeps the revision that contains the vintage and drops a later observation', () => {
    const rows = [
      { date: '2024-10-17', value: '1', rt_start: '2024-10-17', rt_end: '2024-10-20' },
      { date: '2024-10-17', value: '2', rt_start: '2024-10-21', rt_end: '9999-12-31' },
      { date: '2024-10-22', value: '9', rt_start: '2024-10-22', rt_end: '9999-12-31' },
    ];
    const early = asofSeries(rows, '2024-10-18');
    assert.deepEqual(early, [{ date: '2024-10-17', value: 1 }]);
    const later = asofSeries(rows, '2024-10-22');
    assert.equal(later.find((row) => row.date === '2024-10-17')?.value, 2);
    assert.equal(later.some((row) => row.date > '2024-10-22'), false);
  });

  it('matches the archived credit counts, including the three dates before 252 observations', () => {
    const intervals = loadIntervalFiles('research/regime-validation/fred');
    const first = panelAt(intervals, '2024-10-18');
    const ready = panelAt(intervals, '2024-10-23');
    const full = panelAt(intervals, '2026-09-25');
    assert.equal(first.vintageDate, '2024-10-17');
    assert.equal(first.series.BAMLH0A0HYM2.length, 249);
    assert.equal(ready.series.BAMLH0A0HYM2.length, 252);
    assert.equal(ready.series.BAMLH0A0HYM2[251].value, 2.92);
    assert.equal(full.series.BAMLH0A0HYM2.length, 756);
    assert.equal(ready.series.DGS2.length >= 756, true);
    assert.equal(ready.series.BAMLH0A0HYM2.every((row) => row.date <= ready.vintageDate), true);
    const policy = ready.series.DFEDTARU.find((row) => row.date === '2019-06-03');
    assert.equal(policy?.value, 2.5);
  });
});

describe('replay accounting', () => {
  it('does not let a contribution change unit NAV or its drawdown', () => {
    const funded = applyContribution(0.9, 1, 1);
    assert.equal(funded.nav, 0.9);
    assert.ok(funded.wealth > 1.8);
    const drawdown = maxDrawdown([1, funded.nav, funded.nav]);
    assert.ok(drawdown != null && Math.abs(drawdown - 0.1) < 1e-12);
    assert.equal(maxDrawdown([1, funded.wealth]), 0);
  });

  it('fills ASX on the next session and a US holiday on the next open bar', () => {
    const asx: PriceSeries = {
      symbol: 'GOLD.AX',
      bars: [{ date: '2024-11-28', high: 10, low: 10, close: 10 }, { date: '2024-11-29', high: 11, low: 11, close: 11 }],
      asOf: '2024-11-29',
      source: 'yahoo',
      error: null,
      adjusted: true,
    };
    const spy: PriceSeries = {
      symbol: 'SPY',
      bars: [{ date: '2024-11-27', high: 100, low: 100, close: 100 }, { date: '2024-11-29', high: 101, low: 101, close: 101 }],
      asOf: '2024-11-29',
      source: 'yahoo',
      error: null,
      adjusted: true,
    };
    assert.equal(executionBar(asx, '2024-11-28')?.date, '2024-11-29');
    assert.equal(executionBar(spy, '2024-11-27')?.date, '2024-11-29');
    assert.equal(executionBar(spy, '2024-11-28')?.date, '2024-11-29');
    assert.equal(tradedFraction([{ symbol: 'SPY', weight: 0.5 }, { symbol: 'CASH', weight: 0.5 }], [{ symbol: 'CASH', weight: 1 }]), 0.5);
    const held = [{ symbol: 'SPY', qty: 0.01, entry: 100, stop: 90, riskPerShare: 10, openedOn: '2024-11-01' }];
    const kept = settleAudDay({ cash: 0.5, positions: held, local: { SPY: 110 }, aud: { SPY: 160 }, openedOn: '2024-11-04', buys: [], oneWay: 0.001 });
    assert.equal(kept.positions.length, 1);
    assert.equal(kept.sellNotional, 0);
    const sold = settleAudDay({ cash: 0.5, positions: held, local: { SPY: 80 }, aud: { SPY: 120 }, openedOn: '2024-11-04', buys: [], oneWay: 0.001 });
    assert.equal(sold.positions.length, 0);
    assert.ok(sold.cash > 0.5);
    const bought = settleAudDay({
      cash: 1,
      positions: [],
      local: { SPY: 100 },
      aud: { SPY: 150 },
      openedOn: '2024-11-04',
      buys: [{ symbol: 'SPY', weight: 0.1, stop: 90 }],
      oneWay: 0,
    });
    assert.equal(bought.positions.length, 1);
    assert.ok(Math.abs(bought.buyNotional - 0.1) < 1e-12);
    assert.ok(Math.abs(bought.cash - 0.9) < 1e-12);
  });

  it('keeps the recorded point-in-time verdict', () => {
    const file = JSON.parse(readFileSync('research/regime-validation/replay-results.json', 'utf8'));
    assert.deepEqual(file.production.failClosedDates, ['2024-10-18', '2024-10-21', '2024-10-22']);
    assert.equal(file.audit[0].hyCount, 249);
    assert.equal(file.audit[1].hyCount, 252);
    assert.equal(file.coverage.replayedSessions, 514);
    assert.equal(file.production.missingCount, 0);
    assert.equal(file.hypotheses.h1, 'unsupported');
    assert.equal(file.hypotheses.h2, 'unsupported');
    assert.equal(file.fullStrategy, 'incomplete_no_single_execution_policy');
    assert.equal(file.production.ledger.recommendedDaysOverGross, 0);
    assert.ok(file.production.ledger.daysHeldGrossOverBudget > 400);
    assert.ok(file.production.ledger.consecutiveDaysWithTheSameNewWeight > 0);
    assert.equal(file.coverage.cliDecisionsShorterThan60, 0);
    assert.ok(file.production.summary.returnPerDrawdown < file.staticSixtyForty.summary.returnPerDrawdown);
    assert.equal(JSON.stringify(file).includes('api_key'), false);
  });
});
