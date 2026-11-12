import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FreshnessRow } from './types';
import {
  bookAudValue,
  bookParts,
  budgetMeans,
  componentPlain,
  describeFeeds,
  holdingsNow,
  knownGapLines,
  marketCall,
  paperComparabilityNote,
  performanceSinceStart,
  researchPlain,
  sydneyWhen,
  todayAction,
  trustLine,
} from './ownerCopy';

const line = (
  symbol: string,
  name: string,
  weight: number,
  role: 'tactical' | 'systematic' | 'cash' = 'tactical',
  pyramid: 'new' | 'add' | 'hold' | 'no-add-loser' = 'new',
) => ({ symbol, name, role, weight, pyramid, defensive: role === 'cash' });

describe('owner brief', () => {
  it('calls a cautious market in one sentence', () => {
    const sentence = marketCall({ actionable: true, action: 'reduce_risk', regime: 'tightening' });
    assert.equal(sentence, 'Markets look cautious, so the plan is to hold mostly defensive assets and cash.');
    assert.equal(sentence.includes('regime'), false);
    assert.equal(sentence.includes('z-score'), false);
  });

  it('sizes a buy in AUD and as a share of the book', () => {
    const action = todayAction({
      actionable: true,
      action: 'risk_budget_open',
      halted: false,
      bookAud: 150_000,
      lines: [
        line('GLD', 'Gold', 0.08),
        line('AAA.AX', 'BetaShares cash', 0.4, 'cash', 'hold'),
      ],
    });
    assert.match(action.headline, /New buys are allowed/);
    assert.match(action.steps.join(' '), /Buy Gold \(GLD\) for about \$12,000 \(8% of the book\)/);
    assert.match(action.steps.join(' '), /Hold BetaShares cash \(AAA\.AX\)/);
  });

  it('says hold when the window is shut, and does not invent a sale', () => {
    const action = todayAction({
      actionable: true,
      action: 'do_nothing',
      halted: false,
      bookAud: 100_000,
      lines: [line('XLV', 'Health care', 0.05, 'tactical', 'hold')],
    });
    assert.match(action.headline, /No buys, no sells today/);
    assert.match(action.steps.join(' '), /Keep all 1 holdings/);
    assert.equal(action.steps.some((step) => step.startsWith('Sell')), false);
    assert.match(action.means, /paper book's value/);
  });

  it('keeps a waiting sale in the original words', () => {
    const action = todayAction({
      actionable: true,
      action: 'reduce_risk',
      halted: false,
      bookAud: 100_000,
      lines: [],
      pending: [{ symbol: 'BTC-USD', reason: 'Stop touched in the instrument price. The sell is unfilled because AUDUSD is missing or stale.' }],
    });
    assert.match(action.headline, /TRIM/);
    assert.match(action.steps.join(' '), /BTC-USD/);
    assert.match(action.steps.join(' '), /sell is unfilled/);
  });

  it('leaves dollars blank when the book is not in AUD', () => {
    assert.deepEqual(bookAudValue({ currency: null, equity: 10, capital: 100, valued: false }), {
      amount: null,
      basis: 'unavailable',
    });
    const action = todayAction({
      actionable: true,
      action: 'risk_budget_open',
      halted: false,
      bookAud: null,
      lines: [line('GLD', 'Gold', 0.08)],
    });
    assert.match(action.steps[0], /8% of the book/);
    assert.equal(action.steps[0].includes('$'), false);
  });

  it('uses the current book value, then the starting amount', () => {
    assert.deepEqual(bookAudValue({ currency: 'AUD', equity: 110_000, capital: 100_000, valued: true }), {
      amount: 110_000,
      basis: 'value',
    });
    assert.deepEqual(bookAudValue({ currency: 'AUD', equity: null, capital: 100_000, valued: false }), {
      amount: 100_000,
      basis: 'starting amount',
    });
  });

  it('describes holdings from the held book, not from a suggested mark', () => {
    const held = holdingsNow({
      lines: [line('GLD', 'Gold', 0)],
      exposures: null,
      heldWeights: [
        { symbol: 'GLD', weight: 0.08 },
        { symbol: 'CASH', weight: 0.92 },
      ],
      heldBasis: 'held-book',
      bookAud: 100_000,
    });
    assert.match(held.sentence, /in cash/);
    assert.match(held.sentence, /1 holdings/);
    assert.match(held.items.join(' '), /Gold \(GLD\), about \$8,000/);
    const suggested = holdingsNow({
      lines: [line('GLD', 'Gold', 0.2)],
      exposures: { gross: 0.4, net: 0.1, risk: 0.1, defensive: 0.3, cash: 0.6, maxGross: 0.4, maxNet: 0.2 },
      heldWeights: [{ symbol: 'QQQ', weight: 1 }],
      heldBasis: undefined,
      bookAud: 100_000,
    });
    assert.match(suggested.sentence, /split of the paper book/);
    assert.equal(suggested.items.some((item) => item.includes('QQQ')), false);
    assert.match(suggested.items.join(' '), /Cash in the account: 60%/);
  });

  it('uses one invested figure for the holdings total, the bar and the allocation', () => {
    const weights = [
      { symbol: 'CASH', weight: 0.599 },
      { symbol: 'SHY', weight: 0.101 },
      { symbol: 'AAA.AX', weight: 0.1 },
      { symbol: 'BILL.AX', weight: 0.1 },
      { symbol: 'UUP', weight: 0.022 },
      { symbol: 'XLRE', weight: 0.021 },
      { symbol: 'USMV', weight: 0.021 },
      { symbol: 'XLP', weight: 0.018 },
      { symbol: 'XLV', weight: 0.018 },
    ];
    const exposures = { gross: 0.401, net: 0.1, risk: 0, defensive: 0.1, cash: 0.599, maxGross: 0.4, maxNet: 0.2 };
    const parts = bookParts({ weights, exposures });
    const holdings = weights.filter((row) => row.symbol !== 'CASH').reduce((sum, row) => sum + row.weight, 0);
    assert.ok(Math.abs(parts.invested - holdings) < 1e-9);
    assert.ok(Math.abs(parts.invested - exposures.gross) < 1e-9);
    assert.ok(Math.abs(parts.cash + parts.cashLike + parts.defensive + parts.risk - 1) < 1e-9);
    assert.ok(Math.abs(parts.cashLike + parts.defensive + parts.risk - parts.invested) < 1e-9);
    assert.ok(parts.defensive < parts.cashLike);
    const held = holdingsNow({
      lines: weights.filter((row) => row.symbol !== 'CASH').map((row) => line(row.symbol, row.symbol, 0)),
      exposures,
      heldWeights: weights,
      heldBasis: 'held-book',
      bookAud: 100_464,
    });
    assert.match(held.sentence, /\$40,286/);
    assert.match(held.sentence, /40\.1%/);
    assert.equal(held.sentence.includes('49.3%'), false);
    const overstated = weights.map((row) => (row.symbol === 'SHY' ? { ...row, weight: 0.191 } : row));
    const mismatched = bookParts({ weights: overstated, exposures });
    assert.ok(Math.abs(mismatched.invested - 0.401) < 1e-9);
    assert.ok(Math.abs(mismatched.cash + mismatched.cashLike + mismatched.defensive + mismatched.risk - 1) < 1e-6);
    const mismatchedHeld = holdingsNow({
      lines: overstated.filter((row) => row.symbol !== 'CASH').map((row) => line(row.symbol, row.symbol, 0)),
      exposures,
      heldWeights: overstated,
      heldBasis: 'held-book',
      bookAud: 100_464,
    });
    assert.match(mismatchedHeld.sentence, /40\.1%/);
    assert.equal(mismatchedHeld.sentence.includes('49.3%'), false);
  });

  it('reports the paper result without turning the aim into a forecast', () => {
    const done = performanceSinceStart({
      capital: 100_000,
      equity: 103_000,
      currency: 'AUD',
      valued: true,
      realisedText: '4.2%',
      drawdown: 0.03,
      comparable: false,
    });
    assert.match(done.sentence, /Up .*\$3,000/);
    assert.match(done.sentence, /Yearly rate so far 4\.2%/);
    assert.equal(done.sentence.includes('66'), false);
    const empty = performanceSinceStart({
      capital: 100_000,
      equity: null,
      currency: 'AUD',
      valued: false,
      realisedText: 'Not enough history yet',
      drawdown: null,
      comparable: true,
    });
    assert.match(empty.sentence, /no Australian-dollar result yet/);
  });

  it('takes the trust line from the research status and does not hard-code a return', () => {
    const unsupported = trustLine({ verdict: 'inconclusive', fullStrategy: 'not_validated', h1: 'unsupported' });
    assert.equal(unsupported, 'Not proven yet. Sizes follow the written rules.');
    assert.equal(unsupported.includes('66'), false);
    assert.equal(/\d/.test(unsupported), false);
    const measured = trustLine({
      verdict: 'inconclusive',
      fullStrategy: 'not_validated',
      h1: 'unsupported',
      rules: { start: '2024-10-18', end: '2026-11-05', cagr: 0.0517, maxDrawdown: 0.0321 },
      spy: { cagr: 0.11, maxDrawdown: 0.1767 },
    });
    assert.match(measured, /Not proven yet/);
    assert.match(measured, /5\.2%/);
    assert.match(measured, /11\.0%/);
    assert.equal(measured.includes('starting point'), false);
    assert.match(researchPlain({ h1: 'unsupported', h2: 'not_tested' }), /unsupported/);
    assert.match(researchPlain({ h1: 'unsupported', h2: 'not_tested' }), /data-availability check/);
  });
});

describe('freshness words', () => {
  const row = (patch: Partial<FreshnessRow>): FreshnessRow => ({
    id: 'WALCL',
    label: 'Fed total assets',
    asOf: '2026-11-06',
    ageDays: 4,
    stale: false,
    staleAfterDays: 21,
    source: 'FRED WALCL',
    href: 'https://fred.stlouisfed.org/series/WALCL',
    latest: 1,
    ...patch,
  });

  it('formats a calendar day and a download clock in Sydney', () => {
    assert.equal(sydneyWhen('2026-11-09'), '9 Nov 2026');
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /10 Nov 2026/);
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /11:30/);
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /AEDT/);
  });

  it('marks feeds fresh, stale, or blocked from the data', () => {
    const feeds = describeFeeds({
      rows: [
        row({}),
        row({ id: 'BAMLH0A0HYM2', label: 'US high-yield OAS', asOf: '2026-10-01', stale: true, source: 'FRED BAMLH0A0HYM2', href: 'https://example.com' }),
        row({ id: 'SPY', label: 'S&P 500', asOf: null, stale: true, source: 'Yahoo chart SPY', href: 'https://example.com' }),
      ],
      sources: [
        { id: 'WALCL', label: 'Fed total assets', observationDate: '2026-11-06', fetchedAt: '2026-11-10T00:30:00.000Z', error: null },
        { id: 'SPY', label: 'S&P 500', observationDate: null, fetchedAt: '2026-11-10T00:30:00.000Z', error: 'SPY HTTP 403' },
      ],
      priceGaps: ['GLD: GLD HTTP 403', 'BTC-USD: BTC-USD returned no prices'],
      pricesFetchedAt: '2026-11-10T00:30:00.000Z',
    });
    const byId = new Map(feeds.map((feed) => [feed.id, feed]));
    assert.equal(byId.get('WALCL')?.status, 'fresh');
    assert.equal(byId.get('WALCL')?.name, 'Money at the US central bank');
    assert.match(byId.get('WALCL')?.updated ?? '', /AEDT|AEST/);
    assert.equal(byId.get('BAMLH0A0HYM2')?.status, 'stale');
    assert.equal(byId.get('SPY')?.status, 'blocked');
    assert.match(byId.get('SPY')?.means ?? '', /SPY HTTP 403/);
    assert.equal(byId.get('GLD')?.status, 'blocked');
    assert.equal(byId.get('GLD')?.name, 'Gold');
    assert.equal(byId.get('BTC-USD')?.name, 'Bitcoin');
    assert.match(byId.get('BTC-USD')?.means ?? '', /returned no prices/);
  });

  it('does not invent a blocked gold feed when the data has no such gap', () => {
    const feeds = describeFeeds({
      rows: [row({})],
      sources: [],
      priceGaps: [],
      pricesFetchedAt: null,
    });
    assert.equal(feeds.some((feed) => /gold|bitcoin/i.test(feed.name)), false);
  });

  it('surfaces a not-comparable paper mark from the stored reason', () => {
    const reason = 'Marks for 9 Nov 2026 and 10 Nov 2026 used suggested sizes. They are kept and are not comparable with the book.';
    assert.equal(paperComparabilityNote({ marks: 2, latest: { basis: 'held-book', reason } }), reason);
    const fallback = paperComparabilityNote({ marks: 1, latest: { basis: undefined, reason: 'First mark.' } });
    assert.match(fallback ?? '', /not comparable with the book/);
    assert.match(fallback ?? '', /First mark/);
    const gaps = knownGapLines({
      snapshotGaps: ['FRED_API_KEY is not set. No FRED series were fetched.'],
      priceGaps: ['GLD: GLD HTTP 403'],
      deskGaps: ['GLD: GLD HTTP 403'],
      paperNote: reason,
    });
    assert.equal(gaps.filter((gap) => gap.includes('GLD')).length, 1);
    assert.equal(gaps.at(-1), reason);
  });

  it('explains a limit without calling it a return', () => {
    assert.match(budgetMeans('swing', 0.04, false), /Calmer funds get bigger sizes/);
    assert.equal(budgetMeans('swing', 0.06, true, 0.06).includes('Tighter than usual'), false);
    assert.match(budgetMeans('whole', 0.4, true, 0.8), /Tighter than usual \(normally 80%\)/);
    assert.match(componentPlain('credit', -0.8).means, /tighter/);
    assert.equal(componentPlain('credit', -0.8).title, 'Lender nerves');
  });
});
