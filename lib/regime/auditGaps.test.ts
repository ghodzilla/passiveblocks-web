import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { applyStoredDecision, decisionFromDesk, RULE_VERSION, type StoredDecision } from './decision';
import { evaluateBook, evaluateSymbol, laggedInvested } from './evaluate';
import { ideaGates, sizingVerdict } from './gates';
import { evaluateSignalHealth, IC_GAP_DAYS, IC_MIN, independentSampleDates, signalHealthSentence } from './health';
import type { Desk } from './desk';
import type { IdeasReport } from './ideas';
import type { Bar, QuantSignals } from './signals';

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
  it('keeps scored dates at least a full forward window apart', () => {
    const dates = Array.from({ length: 90 }, (_, index) => {
      const ms = Date.parse('2026-01-01T00:00:00Z') + index * 86_400_000;
      return new Date(ms).toISOString().slice(0, 10);
    });
    const picked = independentSampleDates(dates, IC_GAP_DAYS, 10);
    assert.equal(picked[0] > picked[1], true);
    for (let i = 1; i < picked.length; i += 1) {
      const days = Math.round((Date.parse(`${picked[i - 1]}T00:00:00Z`) - Date.parse(`${picked[i]}T00:00:00Z`)) / 86_400_000);
      assert.ok(days >= IC_GAP_DAYS);
    }
  });

  it('stays unknown when the book is missing or too short to be a separate sample', () => {
    const empty = evaluateSignalHealth([]);
    assert.deepEqual(empty.map((signal) => signal.status), ['unknown', 'unknown', 'unknown']);
    assert.deepEqual(empty.map((signal) => signal.samples), [0, 0, 0]);
    assert.match(signalHealthSentence(empty[0]), /not validated/);
    const one = evaluateSignalHealth([{ symbol: 'SPY', bars: barsFrom(Array.from({ length: 80 }, () => 100)) }]);
    assert.ok(one.every((signal) => signal.samples < IC_MIN && signal.status === 'unknown'));
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
  it('takes the crash with the prior signal and sits in cash on the next session', () => {
    const closes: number[] = [];
    let price = 100;
    for (let i = 0; i < 420; i += 1) {
      closes.push(price);
      price *= 1.001;
    }
    const peak = price;
    closes.push(peak * 0.45);
    closes.push(peak * 0.3);
    const series = barsFrom(closes);
    const invested = laggedInvested(series);
    const crash = series.length - 2;
    assert.equal(invested[crash], true);
    assert.equal(invested[crash + 1], false);

    const report = evaluateSymbol('TEST', series, true);
    assert.equal(report.skipped, null);
    const tactical = report.paths.find((path) => path.id === 'tactical_price');
    const monthly = report.paths.find((path) => path.id === 'monthly_invest');
    assert.ok(tactical);
    assert.ok(monthly);
    assert.equal(tactical.contributed, monthly.contributed);
    assert.ok(tactical.sessionsInvested < tactical.sessions);
    assert.ok(tactical.sessionsInvested > 0);
  });

  it('marks the full strategy not validated and does not invent a macro history', () => {
    const closes = Array.from({ length: 40 }, () => 100);
    const report = evaluateBook({
      fetchedAt: '2026-11-07T00:00:00.000Z',
      gaps: [],
      series: [{ symbol: 'SPY', bars: barsFrom(closes), asOf: '2026-11-03', source: 'yahoo', error: null, adjusted: null }],
    });
    assert.equal(report.fullStrategy, 'not_validated');
    assert.match(report.fullStrategyReason, /not validated/);
    assert.equal(report.fees, 'not_applied');
    assert.equal(report.slippage, 'not_applied');
    assert.equal(report.symbols[0]?.skipped == null, false);
    assert.equal(JSON.stringify(report).includes('composite'), false);
  });

  it('splits a long price path into an earlier and a later half without searching thresholds', () => {
    const closes: number[] = [];
    let price = 100;
    for (let i = 0; i < 1200; i += 1) {
      closes.push(price);
      price *= 1.0004;
    }
    const report = evaluateSymbol('LONG', barsFrom(closes), true);
    assert.equal(report.skipped, null);
    assert.ok((report.months ?? 0) >= 24);
    assert.ok(report.inSample);
    assert.ok(report.outOfSample);
    assert.equal(report.inSample.monthly != null, true);
    assert.equal(report.outOfSample.tactical != null, true);
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
