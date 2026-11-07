import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { applyStoredDecision, decisionFromDesk, RULE_VERSION, type StoredDecision } from './decision';
import { accrueCash, buyWithCost, evaluateBook, evaluateSymbol, laggedInvested, parseResearchAssumptions, sellWithCost } from './evaluate';
import { ideaGates, sizingVerdict } from './gates';
import { evaluateSignalHealth, forwardWindowsDisjoint, IC_HORIZON, IC_MIN, selectNonOverlappingDates, signalHealthSentence } from './health';
import type { Desk } from './desk';
import type { IdeasReport } from './ideas';
import { quantAgrees, signalBlendWeights, type Bar, type QuantSignals } from './signals';

function barsFrom(closes: number[], end = '2026-11-03'): Bar[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return closes.map((close, index) => ({
    date: new Date(endMs - (closes.length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    close,
  }));
}

function signals(partial: Partial<QuantSignals>): QuantSignals {
  return {
    asOf: '2026-11-03',
    lastClose: 100,
    momentum12_1: 0.04,
    ma200: 90,
    above200: true,
    annVol20: 0.12,
    reversionZ: 0.2,
    ...partial,
  };
}

describe('signal health samples', () => {
  it('rejects a 28-calendar-day gap when the trading sessions still overlap, and allows an exact boundary', () => {
    const holiday = selectNonOverlappingDates([
      { date: '2024-01-02', sessions: [{ symbol: 'SPY', session: 0 }] },
      { date: '2024-01-30', sessions: [{ symbol: 'SPY', session: 19 }] },
    ]);
    assert.deepEqual(holiday, ['2024-01-30']);
    assert.equal(forwardWindowsDisjoint([{ symbol: 'SPY', session: 0 }], [{ symbol: 'SPY', session: 19 }], IC_HORIZON), false);
    assert.equal(forwardWindowsDisjoint([{ symbol: 'SPY', session: 0 }], [{ symbol: 'SPY', session: IC_HORIZON }], IC_HORIZON), true);
    const boundary = selectNonOverlappingDates([
      { date: '2024-01-02', sessions: [{ symbol: 'SPY', session: 0 }] },
      { date: '2024-02-02', sessions: [{ symbol: 'SPY', session: IC_HORIZON }] },
      { date: '2024-03-04', sessions: [{ symbol: 'SPY', session: IC_HORIZON * 2 }] },
    ]);
    assert.deepEqual(boundary, ['2024-03-04', '2024-02-02', '2024-01-02']);
    const mixed = selectNonOverlappingDates([
      { date: '2024-01-02', sessions: [{ symbol: 'SPY', session: 0 }, { symbol: 'BTC-USD', session: 0 }] },
      { date: '2024-02-02', sessions: [{ symbol: 'SPY', session: 19 }, { symbol: 'BTC-USD', session: 25 }] },
    ]);
    assert.deepEqual(mixed, ['2024-02-02']);
    const missing = selectNonOverlappingDates([
      { date: '2024-01-02', sessions: [{ symbol: 'SPY', session: 0 }] },
      { date: '2024-01-07', sessions: [{ symbol: 'BTC-USD', session: 1 }] },
    ]);
    assert.deepEqual(missing, ['2024-01-07', '2024-01-02']);
  });

  it('stays unknown when the book is missing or too short, without calling the feed failed', () => {
    const empty = evaluateSignalHealth([]);
    assert.deepEqual(empty.map((signal) => signal.status), ['unknown', 'unknown', 'unknown']);
    assert.deepEqual(empty.map((signal) => signal.samples), [0, 0, 0]);
    assert.match(signalHealthSentence(empty[0]), /insufficient performance evidence/);
    assert.match(signalHealthSentence(empty[0]), /not a missing price feed/);
    assert.match(signalHealthSentence(empty[0]), /heuristic/);
    const one = evaluateSignalHealth([{ symbol: 'SPY', bars: barsFrom(Array.from({ length: 80 }, () => 100)) }]);
    assert.ok(one.every((signal) => signal.samples < IC_MIN && signal.status === 'unknown'));
  });

  it('keeps the same buy pass or fail when evidence is insufficient, and only changes rank weight', () => {
    const steady: QuantSignals = {
      asOf: '2026-11-03',
      lastClose: 100,
      momentum12_1: 0.04,
      ma200: 90,
      above200: true,
      annVol20: 0.12,
      reversionZ: 0.2,
    };
    const degraded = [
      { id: 'momentum' as const, status: 'degraded' as const },
      { id: 'trend' as const, status: 'degraded' as const },
      { id: 'reversion' as const, status: 'degraded' as const },
    ];
    const unknown = [
      { id: 'momentum' as const, status: 'unknown' as const },
      { id: 'trend' as const, status: 'unknown' as const },
      { id: 'reversion' as const, status: 'unknown' as const },
    ];
    assert.equal(quantAgrees('tactical', steady, degraded), true);
    assert.equal(quantAgrees('tactical', steady, unknown), true);
    assert.equal(quantAgrees('tactical', { ...steady, above200: false }, degraded), false);
    assert.equal(quantAgrees('tactical', { ...steady, above200: false }, unknown), false);
    const allDegraded = signalBlendWeights(degraded);
    const allUnknown = signalBlendWeights(unknown);
    assert.ok(allDegraded);
    assert.ok(allUnknown);
    assert.ok(Math.abs(allDegraded.momentum - allUnknown.momentum) < 1e-12);
    const onlyMomentum = signalBlendWeights([
      { id: 'momentum', status: 'degraded' },
      { id: 'trend', status: 'unknown' },
      { id: 'reversion', status: 'unknown' },
    ]);
    assert.ok(onlyMomentum);
    assert.ok(onlyMomentum.momentum < allUnknown.momentum);
  });
});

describe('stale price checklist', () => {
  it('blocks a share as Watch when the last price is stale and leaves cash able to pass that check', () => {
    const share = ideaGates({
      themes: [{ id: 'scarcity', label: 'Scarcity', on: true }],
      stance: 'prefer',
      regimeOpen: true,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({ asOf: '2026-10-01', above200: true }),
      halted: false,
      pyramid: 'new',
    });
    const trend = share.find((gate) => gate.id === 'trend');
    assert.equal(trend?.pass, false);
    assert.equal(trend?.detail, 'the last price is stale');
    const sized = sizingVerdict({ gates: share, stance: 'prefer', pyramid: 'new', weight: 0.05 });
    assert.equal(sized.status, 'watch');
    assert.match(sized.verdict, /stale/);

    const cash = ideaGates({
      themes: [],
      stance: 'prefer',
      regimeOpen: false,
      role: 'cash',
      today: '2026-11-03',
      signals: signals({ asOf: '2026-11-03', above200: false, momentum12_1: -0.2 }),
      halted: false,
      pyramid: 'new',
    });
    assert.equal(cash.find((gate) => gate.id === 'trend')?.pass, true);
    assert.equal(cash.find((gate) => gate.id === 'momentum')?.pass, true);
    assert.match(cash.find((gate) => gate.id === 'trend')?.detail ?? '', /Cash does not need/);
  });
});

describe('stored checklist', () => {
  it('keeps the saved verdict when the page would recompute a different one', () => {
    const line = {
      symbol: 'GOLD.AX',
      name: 'Gold',
      role: 'defensive' as const,
      status: 'confirmed' as const,
      weight: 0.04,
      verdict: 'recomputed',
      gates: [],
      above200: true,
      momentum12_1: 0.1,
      reversionZ: 0,
      asOf: '2026-11-03',
      dip: null,
      theme: 'Scarcity',
    };
    const decision: StoredDecision = {
      ruleVersion: RULE_VERSION,
      themeConfigVersion: 'test',
      storedAt: '2026-11-07T20:32:00.000Z',
      signalHealth: [{ id: 'momentum', label: '12–1 momentum', ic: null, hitRate: null, samples: 8, status: 'unknown' }],
      themes: [{ id: 'scarcity', label: 'Scarcity', on: true, enabled: true, reason: 'stored reason' }],
      lines: [{ ...line, status: 'watch', weight: 0, verdict: 'Watching: the market score does not allow a new buy yet', above200: false }],
      note: 'stored',
    };
    const desk = {
      themes: [{ id: 'scarcity', label: 'Scarcity', on: false, enabled: true, reason: 'recomputed', lines: [] }],
      lines: [line],
    } as unknown as Desk;
    const ideas = { rows: [{ symbol: 'GOLD.AX', status: 'confirmed', maxWeight: 0.04 }], signalHealth: [{ id: 'momentum', status: 'degraded' }] } as unknown as IdeasReport;
    const applied = applyStoredDecision(desk, ideas, decision);
    assert.equal(applied.desk.lines[0]?.verdict, decision.lines[0]?.verdict);
    assert.equal(applied.desk.lines[0]?.weight, 0);
    assert.equal(applied.desk.lines[0]?.status, 'watch');
    assert.equal(applied.desk.themes[0]?.on, true);
    assert.equal(applied.ideas.rows[0]?.status, 'watch');
    assert.equal(applied.ideas.signalHealth[0]?.status, 'unknown');

    const round = decisionFromDesk({
      desk: applied.desk,
      signalHealth: applied.ideas.signalHealth,
      storedAt: decision.storedAt,
    });
    assert.equal(round.ruleVersion, RULE_VERSION);
    assert.equal(round.lines[0]?.verdict, decision.lines[0]?.verdict);
    assert.equal(round.lines[0]?.weight, 0);
  });
});

describe('price-only evaluation', () => {
  it('charges the same round trip on the way in and the way out', () => {
    const bought = buyWithCost(1, 10, 10);
    const sold = sellWithCost(bought.shares, 10, 10);
    const fraction = 10 / 10_000;
    assert.ok(Math.abs(sold.cash - (1 - fraction) ** 2) < 1e-12);
    assert.ok(bought.cost > 0);
    assert.ok(sold.cost > 0);
  });

  it('fills on the next session, so the crash and the following down session are still held', () => {
    const up: number[] = [];
    let price = 100;
    for (let i = 0; i < 420; i += 1) {
      up.push(price);
      price *= 1.001;
    }
    const peak = price;
    const held = barsFrom([...up, peak * 0.45, peak * 0.45]);
    const soldLater = barsFrom([...up, peak * 0.45, peak * 0.3]);
    const crash = held.length - 2;
    const invested = laggedInvested(soldLater);
    assert.equal(invested[crash], true);
    assert.equal(invested[crash + 1], false);
    const assumptions = parseResearchAssumptions({ costBps: '10', cashBps: '0' });
    const stillHeld = evaluateSymbol('HELD', held, true, assumptions);
    const delayed = evaluateSymbol('DELAY', soldLater, true, assumptions);
    const heldTactical = stillHeld.paths.find((path) => path.id === 'tactical_price');
    const delayedTactical = delayed.paths.find((path) => path.id === 'tactical_price');
    assert.ok(heldTactical);
    assert.ok(delayedTactical);
    assert.ok(delayedTactical.endEquity < heldTactical.endEquity);
    assert.equal(delayedTactical.contributed, heldTactical.contributed);
  });

  it('uses the same contributions for monthly and tactical, and leaves uninvested cash', () => {
    const flat = barsFrom(Array.from({ length: 400 }, () => 50));
    const assumptions = parseResearchAssumptions({ costBps: '25', cashBps: '0' });
    const report = evaluateSymbol('FLAT', flat, false, assumptions);
    const monthly = report.paths.find((path) => path.id === 'monthly_invest');
    const tactical = report.paths.find((path) => path.id === 'tactical_price');
    const lump = report.paths.find((path) => path.id === 'lump_sum');
    assert.ok(monthly);
    assert.ok(tactical);
    assert.ok(lump);
    assert.equal(monthly.contributed, tactical.contributed);
    assert.equal(lump.contributed, monthly.contributed);
    assert.equal(lump.comparable, false);
    assert.equal(monthly.comparable, true);
    assert.ok(monthly.costsPaid > 0);
    assert.equal(tactical.costsPaid, 0);
    assert.ok(Math.abs(tactical.endCash - tactical.contributed) < 1e-9);
    assert.equal(tactical.endInvested, 0);
    assert.ok(monthly.endCash < 1e-9);
    assert.equal(report.totalReturn, 'price_only');
    assert.equal(monthly.wealthPerUnitContributed != null, true);
  });

  it('accrues leftover cash only when a yield assumption is set', () => {
    assert.equal(accrueCash(10, 0, 365), 10);
    const grown = accrueCash(10, 0.05, 365);
    assert.ok(grown > 10.4);
    assert.ok(grown < 10.51);
    const assumptions = parseResearchAssumptions({ costBps: '0', cashBps: '500' });
    const dates = Array.from({ length: 400 }, (_, index) => {
      const ms = Date.parse('2024-01-01T00:00:00Z') + index * 86_400_000;
      return new Date(ms).toISOString().slice(0, 10);
    });
    const bars = dates.map((date) => ({ date, close: 50 }));
    const report = evaluateSymbol('CASH', bars, null, assumptions);
    const tactical = report.paths.find((path) => path.id === 'tactical_price');
    assert.ok(tactical);
    assert.ok(tactical.endCash > tactical.contributed);
    assert.equal(report.totalReturn, 'unknown');
  });

  it('marks the full strategy not validated and does not invent a macro history', () => {
    const closes = Array.from({ length: 40 }, () => 100);
    const report = evaluateBook({
      fetchedAt: '2026-11-07T00:00:00.000Z',
      gaps: [],
      series: [{ symbol: 'SPY', bars: barsFrom(closes), asOf: '2026-11-03', source: 'yahoo', error: null, adjusted: null }],
    }, parseResearchAssumptions());
    assert.equal(report.fullStrategy, 'not_validated');
    assert.match(report.fullStrategyReason, /not validated/);
    assert.equal(report.assumptions.oneWayBps, 10);
    assert.equal(report.assumptions.cashYieldBps, 0);
    assert.match(report.returnLabel, /Not a time-weighted return/);
    assert.equal(report.symbols[0]?.skipped == null, false);
    assert.equal(JSON.stringify(report).includes('composite'), false);
    assert.equal(parseResearchAssumptions({ costBps: '250' }).oneWayBps, 100);
    assert.equal(parseResearchAssumptions({ costBps: '250' }).clamped, true);
  });

  it('splits a long price path into an earlier and a later half without searching thresholds', () => {
    const closes: number[] = [];
    let price = 100;
    for (let i = 0; i < 1200; i += 1) {
      closes.push(price);
      price *= 1.0004;
    }
    const report = evaluateSymbol('LONG', barsFrom(closes), true, parseResearchAssumptions({ costBps: '10', cashBps: '0' }));
    assert.equal(report.skipped, null);
    assert.ok((report.months ?? 0) >= 24);
    assert.ok(report.inSample);
    assert.ok(report.outOfSample);
    assert.equal(report.inSample.monthlyWealthPerUnit != null, true);
    assert.equal(report.outOfSample.tacticalWealthPerUnit != null, true);
    assert.equal(report.totalReturn, 'adjusted');
  });
});

describe('migration hygiene', () => {
  it('does not embed a database URL or password', () => {
    const sql = readFileSync(new URL('../../db/regime/001_durable_state.sql', import.meta.url), 'utf8');
    assert.equal(sql.includes('postgres://'), false);
    assert.equal(sql.includes('postgresql://'), false);
    assert.equal(/password\s*=/i.test(sql), false);
  });
});
