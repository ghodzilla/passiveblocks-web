import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openAudBook, paperLedgerFrom, rebaselineAudBook, retainLegacyPaper, rollAudPaper, type AudPaperBook } from './audPaper';
import { heldBookRule } from './consistency';
import { FX_CONVENTION, instrumentCurrency, instrumentCurrencyNote, markInAud } from './fx';
import { boundJournal, emptyJournal, JOURNAL_MARK_LIMIT } from './journal';
import { MODEL_BUDGET, THRESHOLDS } from './constants';

const fx = [
  { date: '2024-11-20', close: 0.7 },
  { date: '2024-11-27', close: 0.65 },
  { date: '2024-11-29', close: 0.64 },
];

function book(partial: Partial<AudPaperBook> = {}): AudPaperBook {
  return {
    bookId: 'aud-paper-v1',
    policy: 'book-limits-2026-11-07',
    currency: 'AUD',
    cash: 1000,
    peakEquity: 1000,
    positions: [],
    marks: [],
    pending: [],
    limitStatus: 'empty',
    exposures: null,
    openedOn: '2024-11-27',
    fx: null,
    note: 'test',
    ...partial,
  };
}

describe('AUD paper marks', () => {
  it('divides a USD price by AUDUSD and leaves an ASX price in AUD', () => {
    assert.equal(FX_CONVENTION, 'USD per 1 AUD');
    assert.equal(instrumentCurrency('GOLD.AX'), 'AUD');
    assert.equal(instrumentCurrency('SPY'), 'USD');
    assert.equal(instrumentCurrency('BTC-USD'), 'USD');
    assert.match(instrumentCurrencyNote('BTC-USD'), /USD/);
    const spy = markInAud({ symbol: 'SPY', local: 150, priceDate: '2024-11-27', fxBars: fx });
    assert.ok(spy);
    assert.ok(Math.abs(spy.aud - 150 / 0.65) < 1e-9);
    assert.equal(spy.fxDate, '2024-11-27');
    assert.ok(Math.abs(spy.aud - 150 * 0.65) > 1);
    const asx = markInAud({ symbol: 'GOLD.AX', local: 40, priceDate: '2024-11-28', fxBars: null });
    assert.equal(asx?.aud, 40);
    assert.equal(asx?.fxDate, null);
  });

  it('uses the last rate on or before the price date and ignores a later quote', () => {
    const before = markInAud({ symbol: 'QQQ', local: 100, priceDate: '2024-11-26', fxBars: fx });
    assert.equal(before?.fxDate, '2024-11-20');
    assert.ok(before && Math.abs(before.aud - 100 / 0.7) < 1e-9);
    const none = markInAud({ symbol: 'QQQ', local: 100, priceDate: '2024-11-01', fxBars: fx });
    assert.equal(none, null);
  });

  it('values a mixed US and ASX book in AUD and keeps cash in AUD', () => {
    const rolled = rollAudPaper(book({ cash: 100 }), {
      date: '2024-11-27',
      lines: [],
      local: { SPY: 65, 'GOLD.AX': 50 },
      asOf: { SPY: '2024-11-27', 'GOLD.AX': '2024-11-27' },
      fxBars: fx,
      fxFetchedAt: '2024-11-27T13:15:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    const withPositions = rollAudPaper(book({
      cash: 100,
      positions: [
        { symbol: 'SPY', qty: 1, entry: 65, stop: 50, riskPerShare: 15, openedOn: '2024-11-01', tranches: 1 },
        { symbol: 'GOLD.AX', qty: 1, entry: 50, stop: 40, riskPerShare: 10, openedOn: '2024-11-01', tranches: 1 },
      ],
    }), {
      date: '2024-11-27',
      lines: [
        { symbol: 'SPY', weight: 0, stop: 50, role: 'tactical', defensive: false },
        { symbol: 'GOLD.AX', weight: 0, stop: 40, role: 'tactical', defensive: true },
      ],
      local: { SPY: 65, 'GOLD.AX': 50 },
      asOf: { SPY: '2024-11-27', 'GOLD.AX': '2024-11-27' },
      fxBars: fx,
      fxFetchedAt: '2024-11-27T13:15:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(rolled.cash, 100);
    assert.ok((withPositions.cash ?? 0) > 100);
    assert.ok(Math.abs((withPositions.cash ?? 0) - (100 + 65)) > 1);
    assert.ok(withPositions.marks[0]?.equity != null);
    assert.ok(Math.abs((withPositions.marks[0]?.equity ?? 0) - (100 + 65 / 0.65 + 50)) < 1e-6);
    assert.equal(withPositions.positions.length, 2);
    assert.ok((withPositions.positions.find((position) => position.symbol === 'SPY')?.qty ?? 1) < 1);
    assert.equal(withPositions.fx?.observationDate, '2024-11-27');
    assert.equal(withPositions.fx?.fetchedAt, '2024-11-27T13:15:00.000Z');
    assert.equal(withPositions.fx?.convention, 'USD per 1 AUD');
  });

  it('blocks a USD buy and withholds a net value when the rate does not cover that price', () => {
    const rolled = rollAudPaper(book({
      cash: 1000,
      positions: [
        { symbol: 'GOLD.AX', qty: 1, entry: 40, stop: 20, riskPerShare: 20, openedOn: '2024-11-01', tranches: 1 },
        { symbol: 'SPY', qty: 1, entry: 100, stop: 80, riskPerShare: 20, openedOn: '2024-11-01', tranches: 1 },
      ],
    }), {
      date: '2024-11-29',
      lines: [{ symbol: 'QQQ', weight: 0.05, stop: 90, role: 'tactical', defensive: false }],
      local: { 'GOLD.AX': 40, SPY: 100, QQQ: 100 },
      asOf: { 'GOLD.AX': '2024-11-29', SPY: '2024-11-29', QQQ: '2024-11-29' },
      fxBars: [{ date: '2024-11-01', close: 0.66 }],
      fxFetchedAt: '2024-11-29T13:15:00.000Z',
      fxError: null,
      maxGross: 0.4,
      maxNet: 0.2,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(rolled.limitStatus, 'unvalued');
    assert.equal(rolled.marks[0]?.equity, null);
    assert.equal(rolled.exposures, null);
    assert.equal(rolled.positions.some((position) => position.symbol === 'QQQ'), false);
    assert.ok(rolled.pending.some((item) => item.symbol === 'SPY'));
    assert.equal(rolled.positions.find((position) => position.symbol === 'GOLD.AX')?.qty, 1);
  });

  it('keeps a legacy mixed row byte for byte and does not copy it into the AUD book', () => {
    const journal = emptyJournal();
    journal.paper.cash = 50000;
    journal.paper.positions = [{ symbol: 'QQQ', qty: 10, entry: 100, stop: 90, riskPerShare: 10, openedOn: '2024-01-01' }];
    journal.paper.marks = [{ date: '2024-11-01', equity: 51000 }];
    const retained = retainLegacyPaper(journal);
    const opened = openAudBook(retained, '2024-11-27', 100000);
    assert.equal(retained.paper.cash, 50000);
    assert.equal(retained.paper.positions[0].qty, 10);
    assert.equal(retained.paper.positions[0].entry, 100);
    assert.equal(retained.paper.valuation, 'uncomparable_mixed_local');
    assert.equal(retained.paper.retained, true);
    assert.equal(opened.audBook?.positions.length, 0);
    assert.equal(opened.audBook?.cash, 100000);
    assert.notEqual(opened.audBook?.cash, retained.paper.cash);
    const again = rebaselineAudBook(opened, '2024-11-28', 100000);
    assert.equal(again.paper.positions[0].qty, 10);
    assert.equal(again.audBookPrevious?.openedOn, '2024-11-27');
    assert.equal(again.audBook?.positions.length, 0);
  });

  it('trims a carried book down to the net cap and records the AUD proceeds', () => {
    const rolled = rollAudPaper(book({
      cash: 1000,
      positions: [
        { symbol: 'SPY', qty: 5, entry: 100, stop: 80, riskPerShare: 20, openedOn: '2024-11-01', tranches: 1 },
        { symbol: 'QQQ', qty: 3, entry: 100, stop: 80, riskPerShare: 20, openedOn: '2024-11-01', tranches: 1 },
      ],
    }), {
      date: '2024-11-27',
      lines: [
        { symbol: 'SPY', weight: 0, stop: 80, role: 'tactical', defensive: false },
        { symbol: 'QQQ', weight: 0, stop: 80, role: 'tactical', defensive: false },
      ],
      local: { SPY: 65, QQQ: 65 },
      asOf: { SPY: '2024-11-27', QQQ: '2024-11-27' },
      fxBars: fx,
      fxFetchedAt: '2024-11-27T13:15:00.000Z',
      fxError: null,
      maxGross: 0.4,
      maxNet: 0.2,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.ok((rolled.cash ?? 0) > 1000);
    assert.ok(rolled.exposures);
    assert.ok(rolled.exposures.net <= 0.2 + 1e-6);
    assert.ok(rolled.exposures.gross <= 0.4 + 1e-6);
    assert.equal(rolled.limitStatus, 'enforced');
    const rule = heldBookRule(paperLedgerFrom({ ...emptyJournal(), audBook: rolled, paper: { ...emptyJournal().paper, valuation: 'uncomparable_mixed_local', positions: [{ symbol: 'QQQ', qty: 10, entry: 100, stop: 90, riskPerShare: 10, openedOn: '2024-01-01' }], cash: 50000, marks: [] } }));
    assert.equal(rule.id, 'held-book');
    assert.equal(rule.pass, true);
    assert.match(rule.detail, /book-limits-2026-11-07/);
    assert.match(rule.detail, /retained/);
  });

  it('records a stop in AUD when the rate is fresh and leaves it unfilled when the rate is stale', () => {
    const filled = rollAudPaper(book({
      cash: 100,
      positions: [{ symbol: 'SPY', qty: 1, entry: 80, stop: 90, riskPerShare: 10, openedOn: '2024-11-01', tranches: 1 }],
    }), {
      date: '2024-11-27',
      lines: [],
      local: { SPY: 65 },
      asOf: { SPY: '2024-11-27' },
      fxBars: fx,
      fxFetchedAt: '2024-11-27T13:15:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(filled.positions.length, 0);
    assert.ok(Math.abs((filled.cash ?? 0) - (100 + 65 / 0.65)) < 1e-6);
    const unfilled = rollAudPaper(book({
      cash: 100,
      positions: [{ symbol: 'SPY', qty: 1, entry: 80, stop: 90, riskPerShare: 10, openedOn: '2024-11-01', tranches: 1 }],
    }), {
      date: '2024-11-29',
      lines: [],
      local: { SPY: 65 },
      asOf: { SPY: '2024-11-29' },
      fxBars: [{ date: '2024-11-01', close: 0.66 }],
      fxFetchedAt: '2024-11-29T13:15:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(unfilled.positions.length, 1);
    assert.equal(unfilled.cash, 100);
    assert.equal(unfilled.marks[0]?.equity, null);
    assert.match(unfilled.pending[0]?.reason ?? '', /unfilled/);
    const recovered = rollAudPaper(unfilled, {
      date: '2024-11-29',
      lines: [],
      local: { SPY: 65 },
      asOf: { SPY: '2024-11-29' },
      fxBars: fx,
      fxFetchedAt: '2024-11-29T20:00:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(recovered.marks.length, 1);
    assert.equal(recovered.limitStatus, 'enforced');
    assert.ok(Math.abs((recovered.cash ?? 0) - (100 + 65 / 0.64)) < 1e-6);
    const again = rollAudPaper(recovered, {
      date: '2024-11-29',
      lines: [{ symbol: 'QQQ', weight: 0.05, stop: 90, role: 'tactical', defensive: false }],
      local: { SPY: 65, QQQ: 100 },
      asOf: { SPY: '2024-11-29', QQQ: '2024-11-29' },
      fxBars: fx,
      fxFetchedAt: '2024-11-29T21:00:00.000Z',
      fxError: null,
      maxGross: 1,
      maxNet: 1,
      haltNewEntries: false,
      overlapGroups: [],
    });
    assert.equal(again, recovered);
  });

  it('fails the held-book audit when the capped book is over its limit and keeps the policy on a trimmed book', () => {
    const over = heldBookRule({
      policy: 'book-limits-2026-11-07',
      currency: 'AUD',
      status: 'enforced',
      legacy: null,
      legacyPositions: 0,
      exposures: { gross: 0.5, net: 0.4, risk: 0.4, defensive: 0, cash: 0.5, maxGross: 0.4, maxNet: 0.2 },
      pending: [{ symbol: 'SPY', reason: 'trim' }],
      equity: 1000,
      valued: true,
      fx: null,
      note: 'paper only',
    });
    assert.equal(over.pass, false);
    assert.match(over.detail, /book-limits-2026-11-07/);
    assert.match(over.detail, /Paper only/);
    const journal = emptyJournal();
    const marks = Array.from({ length: JOURNAL_MARK_LIMIT + 3 }, (_, index) => ({
      date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
      equity: 1000,
      status: 'valued' as const,
    }));
    const pending = Array.from({ length: 45 }, (_, index) => ({ symbol: 'SPY', reason: `pending ${index}` }));
    journal.audBook = book({ marks, pending });
    journal.audBookPrevious = book({ marks, pending, note: 'previous' });
    journal.paper.cash = 10;
    journal.paper.positions = [{ symbol: 'QQQ', qty: 1, entry: 1, stop: 1, riskPerShare: 1, openedOn: '2024-01-01' }];
    const bounded = boundJournal(retainLegacyPaper(journal));
    assert.equal(bounded.audBook?.marks.length, JOURNAL_MARK_LIMIT);
    assert.equal(bounded.audBook?.pending.length, 40);
    assert.equal(bounded.audBook?.policy, 'book-limits-2026-11-07');
    assert.equal(bounded.audBookPrevious?.marks.length, JOURNAL_MARK_LIMIT);
    assert.equal(bounded.paper.positions[0].qty, 1);
    assert.equal(bounded.paper.cash, 10);
    assert.equal(bounded.paper.valuation, 'uncomparable_mixed_local');
  });

  it('leaves the macro thresholds where they were', () => {
    assert.equal(THRESHOLDS.crisisEnter, -1.75);
    assert.equal(THRESHOLDS.weakAbsComposite, 0.35);
    assert.equal(THRESHOLDS.riskOnEnter, 0.65);
    assert.deepEqual(MODEL_BUDGET.risk_on, { volTarget: 0.12, maxGross: 1.5, maxNet: 1 });
    assert.deepEqual(MODEL_BUDGET.transitional, { volTarget: 0.06, maxGross: 0.8, maxNet: 0.5 });
    assert.deepEqual(MODEL_BUDGET.tightening, { volTarget: 0.04, maxGross: 0.4, maxNet: 0.25 });
    assert.deepEqual(MODEL_BUDGET.crisis, { volTarget: 0.03, maxGross: 0.2, maxNet: 0.1 });
  });
});
