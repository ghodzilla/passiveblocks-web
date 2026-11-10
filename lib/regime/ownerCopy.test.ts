import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FreshnessRow } from './types';
import {
  bookAudValue,
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
    assert.match(action.steps.join(' '), /Hold cash and short-term government bonds, about \$60,000 \(40% of the book\)/);
  });

  it('says hold when the window is shut, and does not invent a sale', () => {
    const action = todayAction({
      actionable: true,
      action: 'do_nothing',
      halted: false,
      bookAud: 100_000,
      lines: [line('XLV', 'Health care', 0.05, 'tactical', 'hold')],
    });
    assert.match(action.headline, /^Hold\./);
    assert.match(action.steps[0], /^Hold Health care/);
    assert.equal(action.steps.some((step) => step.startsWith('Sell')), false);
    assert.match(action.means, /0% is not an instruction to sell/);
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
    assert.match(action.headline, /Do not buy/);
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
    assert.match(held.sentence, /holds cash and Gold/);
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
    assert.match(done.sentence, /up, at \$103,000 from \$100,000/);
    assert.match(done.sentence, /yearly pace so far is 4\.2%/);
    assert.match(done.sentence, /not comparable/);
    assert.match(done.means, /not a forecast/);
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
    assert.equal(
      unsupported,
      'These rules have not yet beaten a simple index fund on the tested history. Treat sizes as a starting point.',
    );
    assert.equal(unsupported.includes('66'), false);
    assert.equal(/\d/.test(unsupported), false);
    const open = trustLine({ verdict: 'inconclusive', fullStrategy: 'not_validated', h1: null });
    assert.match(open, /still open/);
    const passed = trustLine({ verdict: 'pass', fullStrategy: 'validated', h1: 'supported' });
    assert.match(passed, /not a forecast/);
    assert.match(researchPlain({ h1: 'unsupported', h2: 'not_tested' }), /Test 1 is marked unsupported/);
    assert.match(researchPlain({ h1: 'unsupported', h2: 'not_tested' }), /Test 2 is marked not tested/);
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
    assert.equal(sydneyWhen('2026-11-09'), '9 Nov 2026 (the day this figure describes)');
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /10 Nov 2026/);
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /11:30/);
    assert.match(sydneyWhen('2026-11-10T00:30:00.000Z'), /Sydney time/);
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
    assert.match(byId.get('WALCL')?.updated ?? '', /Sydney time/);
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
    assert.match(budgetMeans('swing', 0.04, false), /risk limit, not a return target/);
    assert.match(componentPlain('credit', -0.8).means, /tighter/);
    assert.equal(componentPlain('credit', -0.8).title, 'Lender nerves');
  });
});
