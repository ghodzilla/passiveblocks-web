import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE_WEIGHTS } from './constants';
import { classifyNames, marketPath, type PathNameInput } from './pathToBuy';

function gate(id: string, pass: boolean, detail = id): PathNameInput['gates'][number] {
  const label = id === 'regime' ? 'Market mood allows it?' : id === 'trend' ? 'Price above its 200-day average?' : id === 'momentum' ? 'Up over the past year?' : id === 'stretch' ? 'No sudden spike?' : id === 'halt' ? 'Loss limit clear?' : 'Theme';
  return { id, label, pass, detail };
}

function name(partial: Partial<PathNameInput> & Pick<PathNameInput, 'symbol'>): PathNameInput {
  const pass = [gate('theme', true), gate('regime', true), gate('trend', true), gate('momentum', true), gate('stretch', true), gate('halt', true)];
  return {
    name: partial.symbol,
    role: 'tactical',
    status: 'watch',
    sleeve: 'Shares',
    owned: false,
    weight: 0,
    gates: pass,
    lastClose: 100,
    ma200: 90,
    momentum12_1: 0.1,
    reversionZ: 0.2,
    atCap: false,
    actionable: true,
    ...partial,
  };
}

describe('market path', () => {
  const weights = BASE_WEIGHTS;
  const components = [
    { id: 'liquidity' as const, title: 'Money in the system', z: 0.36, weight: weights.liquidity, included: true },
    { id: 'policy' as const, title: 'Interest rates', z: -2.17, weight: weights.policy, included: true },
    { id: 'credit' as const, title: 'Lender nerves', z: -0.96, weight: weights.credit, included: true },
    { id: 'growth' as const, title: 'Growth', z: 1.16, weight: weights.growth, included: true },
    { id: 'positioning' as const, title: 'Crowded bets', z: 1.2, weight: weights.positioning, included: true },
    { id: 'ai' as const, title: 'AI spending', z: 1.25, weight: weights.ai, included: true },
  ];

  it('measures the published score against +0.65 and leaves liquidity cleared', () => {
    const path = marketPath({
      composite: -0.16,
      liquidity: 0.36,
      components,
      history: [{
        date: '2026-11-12',
        composite: -0.22,
        regime: 'transitional',
        liquidity: 0.3,
        policy: -2,
        credit: -0.9,
        growth: 1.1,
        positioning: 1.1,
        ai: 1.2,
      }],
    });
    assert.equal(path.scoreGap, 0.81);
    assert.equal(path.scoreCleared, false);
    assert.equal(path.liquidityCleared, true);
    assert.equal(path.liquidityGap, 0);
    const policy = path.drivers.find((driver) => driver.id === 'policy');
    const credit = path.drivers.find((driver) => driver.id === 'credit');
    const liquidity = path.drivers.find((driver) => driver.id === 'liquidity');
    assert.ok(policy && policy.push != null && policy.push < -0.39 && policy.push > -0.41);
    assert.ok(credit && credit.push != null && credit.push < -0.21 && credit.push > -0.23);
    assert.equal(policy.direction, 'down');
    assert.equal(liquidity?.direction, 'up');
    assert.equal(policy.role, 'drag');
    assert.equal(liquidity?.role, 'help');
    assert.ok(policy.soloTarget != null && policy.soloTarget > 2 && policy.soloTarget < 2.4);
    assert.equal(policy.soloPossible, true);
    assert.match(path.note, /0\.81 short/);
    assert.match(path.note, /already clears/);
  });

  it('does not invent a distance when the score or liquidity is missing', () => {
    const missing = marketPath({ composite: null, liquidity: null, components: [], history: [] });
    assert.equal(missing.scoreGap, null);
    assert.equal(missing.liquidityGap, null);
    assert.match(missing.note, /not computed/);
    assert.match(missing.note, /Money in the system is missing/);
  });

  it('says a drag cannot close the gap alone once the target passes +3', () => {
    const path = marketPath({
      composite: -1,
      liquidity: 0.2,
      components: [{ id: 'policy', title: 'Interest rates', z: -2, weight: 0.1, included: true }],
      history: [],
    });
    const policy = path.drivers[0];
    assert.ok(policy.soloTarget != null && policy.soloTarget > 3);
    assert.equal(policy.soloPossible, false);
  });
});

describe('path to buy ordering', () => {
  const ownPass = [
    gate('theme', true, 'AI infrastructure is on.'),
    gate('regime', false, 'the market mood must be Supportive (score +0.65 or more; today -0.16)'),
    gate('trend', true),
    gate('momentum', true),
    gate('stretch', true),
    gate('halt', true),
  ];
  const sleeveBlock = [
    gate('theme', true, 'No theme. This holding is not in AI infrastructure, crypto, or scarcity.'),
    gate('regime', false, 'on a no-clear-signal day the rules don\'t buy this group'),
    gate('trend', true),
    gate('momentum', true),
    gate('stretch', true),
    gate('halt', true),
  ];

  it('puts EQIX first and the sleeves that pass their own checks next, in universe order', () => {
    const names = [
      name({ symbol: 'XLY', status: 'avoid', sleeve: 'Cyclicals', gates: sleeveBlock.map((item) => item.id === 'trend' ? gate('trend', false, 'price is below its 200-day average') : item), lastClose: 40, ma200: 80 }),
      name({ symbol: 'XLF', status: 'avoid', sleeve: 'Cyclicals', gates: sleeveBlock }),
      name({ symbol: 'XLE', status: 'avoid', sleeve: 'Cyclicals', gates: sleeveBlock }),
      name({ symbol: 'IOZ.AX', status: 'avoid', sleeve: 'Shares', gates: sleeveBlock }),
      name({ symbol: 'VGS.AX', status: 'avoid', sleeve: 'Shares', gates: sleeveBlock }),
      name({ symbol: 'VAS.AX', status: 'avoid', sleeve: 'Shares', gates: sleeveBlock }),
      name({ symbol: 'SPY', status: 'avoid', sleeve: 'Shares', gates: sleeveBlock }),
      name({ symbol: 'EQIX', status: 'watch', sleeve: 'This group', gates: ownPass, name: 'Equinix' }),
      name({ symbol: 'SHY', role: 'cash', status: 'hold', owned: true }),
      name({ symbol: 'XLV', status: 'watch', owned: true }),
    ];
    const classified = classifyNames({ names, bookEquity: 100000, bookPeak: 100000, bookCurrency: 'AUD' });
    assert.deepEqual(classified.firstInLine.map((row) => row.symbol), ['EQIX']);
    assert.match(classified.firstInLine[0].sentence, /market gate is the only thing/);
    assert.deepEqual(
      classified.readyWhenSupportive.map((row) => row.symbol),
      ['SPY', 'VAS.AX', 'VGS.AX', 'IOZ.AX', 'XLE', 'XLF'],
    );
    assert.equal(classified.ownChecks.some((row) => row.symbol === 'XLY'), true);
    assert.equal(classified.readyWhenSupportive.some((row) => row.symbol === 'XLY'), false);
    assert.equal(classified.firstInLine.some((row) => row.symbol === 'SHY'), false);
    const eqixTrend = classified.firstInLine[0].checks.find((check) => check.id === 'trend');
    assert.match(eqixTrend?.level ?? '', /above today's 200-day average/);
    const spyMom = classified.readyWhenSupportive[0].checks.find((check) => check.id === 'momentum');
    assert.match(spyMom?.level ?? '', /no price target/);
  });

  it('ranks a name closer when it is only a little below its 200-day average', () => {
    const below = (symbol: string, last: number) => name({
      symbol,
      gates: [
        gate('theme', true),
        gate('regime', true),
        gate('trend', false, 'price is below its 200-day average'),
        gate('momentum', true),
        gate('stretch', true),
        gate('halt', true),
      ],
      lastClose: last,
      ma200: 100,
    });
    const classified = classifyNames({
      names: [below('FAR', 50), below('NEAR', 98)],
      bookEquity: null,
      bookPeak: null,
      bookCurrency: null,
    });
    assert.deepEqual(classified.ownChecks.map((row) => row.symbol), ['NEAR', 'FAR']);
    assert.match(classified.ownChecks[0].checks.find((check) => check.id === 'trend')?.level ?? '', /US\$100\.00/);
    assert.match(classified.ownChecks[0].checks.find((check) => check.id === 'trend')?.level ?? '', /2\.0% below/);
  });

  it('does not invent a momentum price', () => {
    const classified = classifyNames({
      names: [name({
        symbol: 'QQQ',
        gates: [
          gate('theme', true),
          gate('regime', true),
          gate('trend', true),
          gate('momentum', false, 'not up over the past year'),
          gate('stretch', true),
          gate('halt', true),
        ],
        momentum12_1: -0.04,
      })],
      bookEquity: null,
      bookPeak: null,
      bookCurrency: null,
    });
    const level = classified.ownChecks[0].checks.find((check) => check.id === 'momentum')?.level ?? '';
    assert.match(level, /no price target/);
    assert.doesNotMatch(level, /needs a close/i);
  });
});
