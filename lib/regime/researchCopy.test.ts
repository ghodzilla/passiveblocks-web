import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  costsLine,
  grewTo,
  inMarket,
  researchPathLines,
  researchSpan,
  researchVerdict,
  worstFall,
} from './researchCopy';

describe('research table words', () => {
  it('reads the saved comparison the way the ledger defines it', () => {
    assert.equal(grewTo(1.433), '$1 grew to $1.43');
    assert.equal(grewTo(2.007), '$1 grew to $2.01');
    assert.equal(worstFall(0.18), 'Worst fall 18%');
    assert.equal(inMarket(826, 1255), 'In the market 66% of trading days (826 of 1,255)');
    assert.equal(costsLine(0.41, 49), 'Costs $0.41 (0.8% of the money put in)');
    assert.equal(costsLine(0.05, 49), 'Costs $0.05 (0.1% of the money put in)');
    assert.equal(costsLine(0.41, 49).includes('0.41%'), false);
  });

  it('compares the price rule with monthly investing only', () => {
    assert.equal(researchVerdict(1.433, 1.288).text, 'The price rule lagged steady monthly investing.');
    assert.equal(researchVerdict(1.433, 1.288).tone, 'watch');
    assert.equal(researchVerdict(1.1, 1.4).text, 'The price rule beat steady monthly investing.');
    assert.equal(researchVerdict(1.2, 1.2).text, 'The price rule matched steady monthly investing.');
    assert.equal(researchVerdict(null, 1.2).tone, 'off');
  });

  it('names the span and keeps the in-market line on the price rule', () => {
    assert.match(researchSpan({
      firstDate: '2021-11-15',
      lastDate: '2026-11-13',
      months: 49,
      totalReturn: 'adjusted',
    }), /15 Nov 2021 to 13 Nov 2026/);
    const tactical = researchPathLines({
      id: 'tactical_price',
      wealthPerUnitContributed: 1.288,
      maxDrawdown: 0.12,
      endCash: 0,
      costsPaid: 0.41,
      contributed: 49,
      sessionsInvested: 826,
      sessions: 1255,
    });
    assert.equal(tactical.includes('In the market 66% of trading days (826 of 1,255)'), true);
    const monthly = researchPathLines({
      id: 'monthly_invest',
      wealthPerUnitContributed: 1.433,
      maxDrawdown: 0.2,
      endCash: 0,
      costsPaid: 0.05,
      contributed: 49,
      sessionsInvested: 1200,
      sessions: 1255,
    });
    assert.equal(monthly.some((line) => line.startsWith('In the market')), false);
  });
});
