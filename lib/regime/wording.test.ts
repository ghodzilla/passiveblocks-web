import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ideaGates, sizingVerdict, verdictFromGates } from './gates';
import { regimeWaitCopy } from './plain';
import type { QuantSignals } from './signals';

function signals(partial: Partial<QuantSignals> = {}): QuantSignals {
  return {
    asOf: '2026-11-12',
    lastClose: 100,
    momentum12_1: 0.04,
    ma200: 90,
    above200: true,
    annVol20: 0.12,
    reversionZ: 0.2,
    ...partial,
  };
}

describe('verdict wording', () => {
  it('names every failed check and does not say theme on when the theme is off', () => {
    const gold = ideaGates({
      themes: [{ id: 'scarcity', label: 'Scarcity', on: false }],
      stance: 'prefer',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-12',
      symbol: 'GLD',
      composite: -0.2,
      signals: signals({ above200: false, lastClose: 355.55, ma200: 409.12, momentum12_1: -0.02 }),
      halted: false,
      pyramid: 'new',
    });
    assert.equal(gold.find((gate) => gate.id === 'theme')?.pass, true);
    assert.equal(gold.find((gate) => gate.id === 'theme')?.themeState, 'off-allowed');
    const verdict = verdictFromGates(gold, 'prefer');
    assert.match(verdict, /2 things in the way/);
    assert.match(verdict, /200-day average/);
    assert.match(verdict, /past year/);
    assert.match(verdict, /still allowed as defensive/);
    assert.doesNotMatch(verdict, /theme on/i);

    const btc = ideaGates({
      themes: [
        { id: 'crypto', label: 'Crypto', on: false },
        { id: 'scarcity', label: 'Scarcity', on: false },
      ],
      stance: null,
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-12',
      composite: -0.2,
      signals: signals({ above200: false, ma200: 110 }),
      halted: false,
      pyramid: 'new',
    });
    const btcVerdict = verdictFromGates(btc, null);
    assert.match(btcVerdict, /3 things in the way/);
    assert.match(btcVerdict, /Crypto and Scarcity/);
    assert.match(btcVerdict, /Supportive/);
    assert.match(btcVerdict, /200-day average/);
    assert.doesNotMatch(btcVerdict, /theme on/i);
  });

  it('uses Hold for an owned name and names the top-up level', () => {
    const gates = ideaGates({
      themes: [],
      stance: 'prefer',
      regimeOpen: false,
      role: 'tactical',
      today: '2026-11-12',
      signals: signals({ above200: true }),
      halted: false,
      pyramid: 'hold',
    });
    const held = sizingVerdict({
      gates,
      stance: 'prefer',
      pyramid: 'hold',
      weight: 0,
      owned: { entry: 184.8, stop: 175.94, currency: 'US$' },
    });
    assert.equal(held.status, 'hold');
    assert.match(held.verdict, /^Hold — you own this/);
    assert.match(held.verdict, /US\$193\.66/);
    assert.doesNotMatch(held.verdict, /Watch/);

    const loser = sizingVerdict({ gates, stance: 'prefer', pyramid: 'no-add-loser', weight: 0 });
    assert.equal(loser.status, 'hold');
    assert.match(loser.verdict, /below the buy price/);
  });

  it('says buys need +0.65 and money at +0.10, not +0.35', () => {
    const copy = regimeWaitCopy({
      action: 'do_nothing',
      actionable: true,
      weak: true,
      regimeLabel: 'Transitional',
      composite: -0.2,
      liquidity: -0.2,
    });
    assert.match(copy, /\+0\.65/);
    assert.match(copy, /\+0\.10/);
    assert.match(copy, /today -0\.20/);
    assert.doesNotMatch(copy, /above \+0\.35 into Risk-On/);
  });
});
