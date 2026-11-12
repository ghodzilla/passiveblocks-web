import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { actionFor, budgetsFor } from './classify';
import { auditRegime } from './consistency';
import { componentPeriodNote, plainZ, regimeWaitCopy, seriesCadence, waitingOnRegime } from './plain';
import { selfCheckFromReport } from './selfcheck';
import { buildDesk } from './desk';
import { ideaGates, verdictFromGates } from './gates';
import { buildIdeas } from './ideas';
import { emptyJournal } from './journal';
import type { Bar, QuantSignals } from './signals';
import { themesForSymbol } from './themes';
import { melbourneDate, sessionDateLabel } from './time';
import type { RegimeSnapshot } from './types';
import { publishRegime } from './view';

function flatBars(n: number, end = '2026-11-03'): Bar[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, index) => ({
    date: new Date(endMs - (n - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    close: 100,
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

describe('idea gates', () => {
  it('names the 200-day average when the theme is on and that is the first failure', () => {
    const gates = ideaGates({
      themes: [{ id: 'scarcity', label: 'Scarcity', on: true }],
      stance: 'prefer',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({ above200: false, ma200: 110 }),
      halted: false,
      pyramid: 'new',
    });
    const verdict = verdictFromGates(gates, 'prefer');
    assert.match(verdict, /price is below its 200-day average/);
    assert.match(verdict, /Scarcity is on|1 thing/);
    assert.doesNotMatch(verdict, /theme on/);
    assert.equal(gates.find((gate) => gate.id === 'theme')?.pass, true);
    assert.equal(gates.find((gate) => gate.id === 'trend')?.pass, false);
  });

  it('uses Avoid when the playbook avoids the sleeve, even if the theme is the first failure', () => {
    const gates = ideaGates({
      themes: [{ id: 'ai-infrastructure', label: 'AI infrastructure', on: false }],
      stance: 'avoid',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({ above200: false, ma200: 110 }),
      halted: false,
      pyramid: 'new',
    });
    assert.match(verdictFromGates(gates, 'avoid'), /^Avoid —/);
    assert.doesNotMatch(verdictFromGates(gates, 'avoid'), /theme on/);
    const both = ideaGates({
      themes: [
        { id: 'crypto', label: 'Crypto', on: false },
        { id: 'scarcity', label: 'Scarcity', on: false },
      ],
      stance: null,
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({}),
      halted: false,
      pyramid: 'new',
    });
    const bothVerdict = verdictFromGates(both, null);
    assert.match(bothVerdict, /Crypto and Scarcity themes are off/);
    assert.match(bothVerdict, /things in the way/);
    const preferred = ideaGates({
      themes: [{ id: 'ai-infrastructure', label: 'AI infrastructure', on: false }],
      stance: 'prefer',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({}),
      halted: false,
      pyramid: 'new',
    });
    assert.equal(preferred.find((gate) => gate.id === 'theme')?.pass, true);
    assert.match(preferred.find((gate) => gate.id === 'theme')?.detail ?? '', /not a block/);
  });

  it('says a bond has no theme instead of blaming a switch', () => {
    const gates = ideaGates({
      themes: [],
      stance: 'prefer',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({ above200: false, ma200: 110 }),
      halted: false,
      pyramid: 'new',
    });
    assert.match(gates[0].detail, /^No theme/);
    const bondVerdict = verdictFromGates(gates, 'prefer');
    assert.match(bondVerdict, /price is below its 200-day average/);
    assert.doesNotMatch(bondVerdict, /theme on/);
  });

  it('does not confirm a name when momentum and trend are both retired', () => {
    const gates = ideaGates({
      themes: [{ id: 'scarcity', label: 'Scarcity', on: true }],
      stance: 'prefer',
      regimeOpen: true,
      role: 'tactical',
      today: '2026-11-03',
      signals: signals({}),
      health: [
        { id: 'momentum', status: 'retired' },
        { id: 'trend', status: 'retired' },
        { id: 'reversion', status: 'healthy' },
      ],
      halted: false,
      pyramid: 'new',
    });
    assert.equal(gates.every((gate) => gate.pass), false);
    assert.match(verdictFromGates(gates, 'prefer'), /both retired/);
  });
});

describe('theme mapping', () => {
  it('reads the live baskets, including GOLD.AX, and leaves bonds outside them', () => {
    assert.deepEqual(themesForSymbol('GLD').map((theme) => theme.id), ['scarcity']);
    assert.deepEqual(themesForSymbol('GOLD.AX').map((theme) => theme.id), ['scarcity']);
    assert.deepEqual(themesForSymbol('SLV').map((theme) => theme.id), ['scarcity']);
    assert.deepEqual(themesForSymbol('BTC-USD').map((theme) => theme.id), ['crypto', 'scarcity']);
    assert.deepEqual(themesForSymbol('ETH-USD').map((theme) => theme.id), ['crypto']);
    assert.deepEqual(themesForSymbol('SOL-USD').map((theme) => theme.id), ['crypto']);
    for (const symbol of ['SMH', 'XLU', 'EQIX', 'DLR']) {
      assert.deepEqual(themesForSymbol(symbol).map((theme) => theme.id), ['ai-infrastructure']);
    }
    assert.equal(themesForSymbol('IEF').length, 0);
    assert.equal(themesForSymbol('VAF.AX').length, 0);
  });
});

describe('published regime view', () => {
  const today = '2026-11-03';
  const decision = actionFor({ actionable: true, weak: false, regime: 'tightening' });
  const budgets = budgetsFor('tightening', decision.action);
  const snapshot: RegimeSnapshot = {
    rulesVersion: 'test',
    generatedAt: '2026-11-03T05:00:00.000Z',
    today,
    printDate: today,
    regime: 'tightening',
    regimeLabel: 'Tightening/Stress',
    composite: -0.8,
    actionable: true,
    weak: false,
    action: decision.action,
    message: decision.message,
    modelBudget: budgets.modelBudget,
    effectiveBudget: budgets.effectiveBudget,
    budgetOverridden: budgets.budgetOverridden,
    components: [
      { id: 'liquidity', label: 'Liquidity', z: -0.4, included: true, weight: 0.3, asOf: today, gap: null, detail: '', reading: '' },
      { id: 'policy', label: 'Policy path', z: -0.2, included: true, weight: 0.2, asOf: today, gap: null, detail: '', reading: '' },
      { id: 'credit', label: 'Credit', z: -0.3, included: true, weight: 0.25, asOf: today, gap: null, detail: '', reading: '' },
      { id: 'growth', label: 'Growth differential', z: -0.1, included: true, weight: 0.15, asOf: today, gap: null, detail: '', reading: '' },
      { id: 'positioning', label: 'Positioning extremes', z: null, included: false, weight: 0, asOf: null, gap: null, detail: '', reading: '' },
      { id: 'ai', label: 'AI capex', z: 0.2, included: true, weight: 0.08, asOf: today, gap: null, detail: '', reading: '' },
    ],
    history: [],
    freshness: [],
    gaps: [],
  };
  const down = flatBars(220, today);
  const book = {
    fetchedAt: '2026-11-03T05:00:00.000Z',
    gaps: [] as string[],
    series: ['GLD', 'GOLD.AX', 'IEF', 'AAA.AX', 'BILL.AX', 'SHY'].map((symbol) => ({
      symbol,
      bars: down,
      asOf: down[down.length - 1].date,
      source: 'yahoo' as const,
      error: null,
    })),
  };

  it('keeps the banner, the gates, the sizes, and the history text on one object', () => {
    const ideas = buildIdeas({ snapshot, book, watchlist: '' });
    const desk = buildDesk({
      snapshot,
      ideas,
      book,
      realYield: [{ date: '2026-11-02', value: 2 }, { date: '2026-11-03', value: 1.4 }],
      dollar: [{ date: '2026-11-02', value: 120 }, { date: '2026-11-03', value: 121 }],
      journal: emptyJournal(),
    });
    const view = publishRegime({ snapshot, ideas, desk });
    const failed = view.consistency.rules.filter((rule) => !rule.pass);
    assert.deepEqual(failed.map((rule) => `${rule.id}: ${rule.detail}`), []);
    const gld = view.desk.lines.find((line) => line.symbol === 'GLD');
    const gold = view.desk.lines.find((line) => line.symbol === 'GOLD.AX');
    const ief = view.desk.lines.find((line) => line.symbol === 'IEF');
    assert.equal(gld?.theme, 'scarcity');
    assert.equal(gold?.theme, 'scarcity');
    assert.match(gld?.verdict ?? '', /below its 200-day/);
    assert.doesNotMatch(gld?.verdict ?? '', /theme on/);
    assert.equal(gld?.weight, 0);
    assert.notEqual(gld?.status, 'confirmed');
    assert.match(ief?.gates[0].detail ?? '', /^No theme/);
    assert.equal(ief?.weight, 0);
    assert.equal(view.desk.realisedText, 'Not enough history yet');
    assert.equal(view.desk.maxDrawdownText, 'Not enough history yet');
    assert.equal(view.ideas.rows.find((row) => row.symbol === 'GLD')?.status, gld?.status);
    assert.equal(view.ideas.rows.find((row) => row.symbol === 'GLD')?.maxWeight, gld?.weight);
    assert.equal(view.ideas.banner, snapshot.message);

    const broken = {
      snapshot,
      ideas: view.ideas,
      desk: {
        ...view.desk,
        lines: view.desk.lines.map((line) => (
          line.symbol === 'GLD' ? { ...line, status: 'watch' as const, weight: 0.2 } : line
        )),
      },
    };
    const breach = auditRegime(broken);
    assert.equal(breach.rules.find((rule) => rule.id === 'tag-size')?.pass, false);

    const confirmedAtZero = auditRegime({
      snapshot,
      ideas: view.ideas,
      desk: {
        ...view.desk,
        lines: view.desk.lines.map((line) => (
          line.symbol === 'GLD'
            ? { ...line, dip: 'Buy the dip — confirmed. 12.5% below the 60-day high and back above the 20-day average.', weight: 0, status: 'watch' as const }
            : line
        )),
      },
    });
    assert.equal(confirmedAtZero.rules.find((rule) => rule.id === 'dip-label')?.pass, false);
  });
});

describe('plain English', () => {
  it('turns a liquidity z-score into a short phrase and keeps the number', () => {
    assert.equal(plainZ('Liquidity', -0.38), 'Liquidity: slightly tight (-0.38)');
  });

  it('lists names waiting only on the regime, and says what has to change', () => {
    const gates = (passTheme: boolean, failRegime: boolean) => [
      { id: 'theme', pass: passTheme, detail: passTheme ? 'Crypto is on.' : 'the Crypto theme is off.' },
      { id: 'regime', pass: !failRegime, detail: failRegime ? 'the market score does not allow a new buy yet' : 'The market score allows a new buy.' },
      { id: 'trend', pass: true, detail: 'Price is above its 200-day average.' },
    ];
    const lines = [
      { symbol: 'ETH-USD', name: 'Ether', role: 'tactical' as const, weight: 0, verdict: 'Watching', gates: gates(true, true) },
      { symbol: 'GLD', name: 'Gold', role: 'tactical' as const, weight: 0, verdict: 'Watching', gates: [
        { id: 'theme', pass: true, detail: 'Scarcity is on.' },
        { id: 'regime', pass: true, detail: 'Today’s lean includes this group.' },
        { id: 'trend', pass: false, detail: 'price is below its 200-day average' },
      ] },
      { symbol: 'AAA.AX', name: 'Cash', role: 'cash' as const, weight: 0.1, verdict: 'Confirmed', gates: gates(true, false) },
    ];
    assert.deepEqual(waitingOnRegime(lines).map((line) => line.symbol), ['ETH-USD']);
    const wait = regimeWaitCopy({ action: 'do_nothing', actionable: true, weak: true, regimeLabel: 'Transitional', composite: -0.2, liquidity: -0.2 });
    assert.match(wait, /\+0\.65/);
    assert.match(wait, /\+0\.10/);
    assert.doesNotMatch(wait, /above \+0\.35 into Risk-On/);
  });

  it('does not label a blended score with only the older monthly date', () => {
    const rows = [
      { id: 'T10Y2Y', asOf: '2026-11-06' },
      { id: 'USALOLITOAASTSAM', asOf: '2026-09-01' },
      { id: 'AUSLOLITOAASTSAM', asOf: '2026-09-01' },
      { id: 'SPY', asOf: '2026-11-06' },
      { id: 'RSP', asOf: '2026-11-06' },
      { id: 'SMH', asOf: '2026-11-06' },
      { id: 'IPG3344S', asOf: '2026-09-01' },
    ];
    const growth = componentPeriodNote('growth', rows);
    const ai = componentPeriodNote('ai', rows);
    assert.match(growth, /2026-11-06/);
    assert.match(growth, /2026-09-01/);
    assert.match(growth, /monthly/);
    assert.match(growth, /month being measured/);
    assert.match(growth, /snapshot clock/);
    assert.equal(growth.includes('as of 2026-09-01'), false);
    assert.match(ai, /2026-11-06/);
    assert.match(ai, /2026-09-01/);
    assert.match(ai, /newest month published/);
    assert.equal(seriesCadence(75), 'monthly release');
    assert.equal(seriesCadence(10), 'daily');
  });

  it('stores a failed daily self-check as not ok', () => {
    const record = selfCheckFromReport({
      rules: [
        { id: 'dip-label', pass: false, detail: 'A dip says confirmed without a size.' },
        { id: 'tag-size', pass: true, detail: 'ok' },
      ],
    }, '2026-11-04T13:15:00.000Z');
    assert.equal(record.ok, false);
    assert.equal(record.failures.length, 1);
    assert.equal(record.asOf, '2026-11-04T13:15:00.000Z');
  });
});

describe('clocks', () => {
  it('moves an instant into Australia/Melbourne and leaves a session date alone', () => {
    assert.equal(melbourneDate(new Date('2026-11-04T13:30:00.000Z')), '2026-11-05');
    assert.equal(sessionDateLabel('2026-11-04'), '2026-11-04');
  });
});

describe('retired copy', () => {
  it('does not blame the theme switch for a watch name', () => {
    const source = readFileSync('lib/regime/desk.ts', 'utf8');
    assert.equal(source.includes('theme switch is not on'), false);
  });
});
