import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOOK_LIMITS_VERSION, clampBuysToCash, planBookLimits, type LimitHolding, type LimitSpec } from './bookLimits';
import { executionBar } from './replay';
import type { PriceSeries } from './prices';

function lot(partial: Partial<LimitHolding> & Pick<LimitHolding, 'symbol' | 'weight'>): LimitHolding {
  return {
    role: partial.role ?? 'tactical',
    defensive: partial.defensive ?? false,
    themes: partial.themes ?? [],
    unpriced: partial.unpriced ?? false,
    forceExit: partial.forceExit ?? false,
    tranches: partial.tranches ?? 1,
    symbol: partial.symbol,
    weight: partial.weight,
  };
}

function spec(partial: Partial<LimitSpec> = {}): LimitSpec {
  return {
    maxGross: partial.maxGross ?? 1.5,
    maxNet: partial.maxNet ?? 1,
    haltNewEntries: partial.haltNewEntries ?? false,
    overlapGroups: partial.overlapGroups ?? [],
    themeGroups: partial.themeGroups ?? [],
  };
}

describe('whole-book limits', () => {
  it('names the repaired policy', () => {
    assert.equal(BOOK_LIMITS_VERSION, 'book-limits-2026-11-07');
  });

  it('trims a carried book when the budget shrinks from risk-on to transitional', () => {
    const plan = planBookLimits(
      [lot({ symbol: 'SPY', weight: 0.5 }), lot({ symbol: 'QQQ', weight: 0.3 })],
      [],
      spec({ maxGross: 0.4, maxNet: 0.2 }),
    );
    const kept = plan.keptWeight.reduce((sum, row) => sum + row.weight, 0);
    assert.ok(kept <= 0.2 + 1e-9);
    assert.ok(plan.keptWeight.every((row) => row.weight <= 0.2 + 1e-9));
    assert.equal(plan.keptWeight.length, 1);
    assert.equal(plan.buys.length, 0);
  });

  it('keeps a hold whose suggestion is absent', () => {
    const plan = planBookLimits(
      [lot({ symbol: 'IEF', weight: 0.1, defensive: true })],
      [],
      spec({ maxGross: 0.4, maxNet: 0.2 }),
    );
    assert.equal(plan.sells.length, 0);
    assert.equal(plan.keptWeight[0].weight, 0.1);
  });

  it('sells every non-cash name when the composite is missing and the net cap is zero', () => {
    const plan = planBookLimits(
      [
        lot({ symbol: 'GLD', weight: 0.3, defensive: true }),
        lot({ symbol: 'SHY', weight: 0.1, role: 'cash', defensive: true }),
      ],
      [],
      spec({ maxGross: 0.2, maxNet: 0 }),
    );
    assert.ok(plan.sells.some((row) => row.symbol === 'GLD' && row.reason === 'net'));
    assert.equal(plan.sells.some((row) => row.symbol === 'SHY'), false);
    assert.ok(plan.keptWeight.some((row) => row.symbol === 'SHY' && row.weight === 0.1));
  });

  it('trims cash-role only after non-cash names when gross is still over the cap', () => {
    const plan = planBookLimits(
      [lot({ symbol: 'SHY', weight: 0.15, role: 'cash', defensive: true })],
      [],
      spec({ maxGross: 0.1, maxNet: 0 }),
    );
    const shy = plan.sells.find((row) => row.symbol === 'SHY');
    assert.equal(shy?.reason, 'gross');
    assert.ok(shy && Math.abs(shy.weight - 0.05) < 1e-9);
  });

  it('allows one pyramid tranche and refuses the same add on later days', () => {
    const first = planBookLimits(
      [lot({ symbol: 'QQQ', weight: 0.05, tranches: 1 })],
      [{ symbol: 'QQQ', weight: 0.05, role: 'tactical', defensive: false, themes: [], kind: 'pyramid' }],
      spec(),
    );
    assert.equal(first.buys.length, 1);
    assert.equal(first.buys[0].kind, 'pyramid');
    const second = planBookLimits(
      [lot({ symbol: 'QQQ', weight: 0.1, tranches: 2 })],
      [{ symbol: 'QQQ', weight: 0.05, role: 'tactical', defensive: false, themes: [], kind: 'pyramid' }],
      spec(),
    );
    assert.equal(second.buys.length, 0);
    assert.equal(second.sells.length, 0);
  });

  it('cuts a name, a theme, and an overlap group to their caps', () => {
    const plan = planBookLimits(
      [
        lot({ symbol: 'NVDA', weight: 0.3, themes: ['ai-infrastructure'] }),
        lot({ symbol: 'MSFT', weight: 0.1, themes: ['ai-infrastructure'] }),
        lot({ symbol: 'AAPL', weight: 0.1, themes: ['ai-infrastructure'] }),
      ],
      [],
      spec({
        overlapGroups: [['NVDA', 'MSFT', 'AAPL']],
        themeGroups: [{ id: 'ai-infrastructure', symbols: ['NVDA', 'MSFT', 'AAPL'] }],
      }),
    );
    assert.ok(plan.sells.some((row) => row.symbol === 'NVDA' && row.reason === 'name'));
    const weights = new Map(plan.keptWeight.map((row) => [row.symbol, row.weight]));
    const sum = (weights.get('NVDA') ?? 0) + (weights.get('MSFT') ?? 0) + (weights.get('AAPL') ?? 0);
    assert.ok(sum <= 0.2 + 1e-9);
    assert.ok((weights.get('NVDA') ?? 0) <= 0.2 + 1e-9);
  });

  it('does not buy a name that was just sold, and a halt blocks a new name only', () => {
    const stopped = planBookLimits(
      [lot({ symbol: 'SPY', weight: 0.5, forceExit: true })],
      [{ symbol: 'SPY', weight: 0.1, role: 'tactical', defensive: false, themes: [], kind: 'new' }],
      spec({ maxGross: 0.4, maxNet: 0.2 }),
    );
    assert.ok(stopped.sells.some((row) => row.symbol === 'SPY'));
    assert.equal(stopped.buys.length, 0);
    const halted = planBookLimits(
      [lot({ symbol: 'IEF', weight: 0.05, defensive: true, tranches: 1 })],
      [
        { symbol: 'SPY', weight: 0.05, role: 'tactical', defensive: false, themes: [], kind: 'new' },
        { symbol: 'IEF', weight: 0.02, role: 'tactical', defensive: true, themes: [], kind: 'pyramid' },
      ],
      spec({ haltNewEntries: true, maxGross: 0.4, maxNet: 0.2 }),
    );
    assert.equal(halted.buys.length, 1);
    assert.equal(halted.buys[0].symbol, 'IEF');
  });

  it('leaves an unpriced name in place and lists it as pending', () => {
    const plan = planBookLimits(
      [lot({ symbol: 'SPY', weight: 0.5, unpriced: true })],
      [],
      spec({ maxGross: 0.4, maxNet: 0.2 }),
    );
    assert.equal(plan.sells.length, 0);
    assert.equal(plan.pending[0].symbol, 'SPY');
    assert.equal(plan.keptWeight[0].weight, 0.5);
  });

  it('refuses to borrow and reports the unfilled notional', () => {
    const result = clampBuysToCash(
      [{ symbol: 'SPY', notional: 0.8 }, { symbol: 'QQQ', notional: 0.4 }],
      0.5,
      0.001,
    );
    assert.ok(result.cashLeft >= -1e-12);
    assert.ok(result.filled.reduce((sum, row) => sum + row.notional, 0) <= 0.5);
    assert.ok(result.shortfall.length >= 1);
    assert.ok(result.fees > 0);
    const nav = 1;
    const cost = result.fees;
    assert.ok(nav - cost < nav);
  });

  it('fills the next session, not the decision session, on a mixed calendar', () => {
    const spy: PriceSeries = {
      symbol: 'SPY',
      bars: [
        { date: '2024-11-27', close: 100 },
        { date: '2024-11-29', close: 101 },
      ],
      asOf: '2024-11-29',
      source: 'yahoo',
      error: null,
      adjusted: true,
    };
    const asx: PriceSeries = {
      symbol: 'GOLD.AX',
      bars: [
        { date: '2024-11-28', close: 40 },
        { date: '2024-11-29', close: 41 },
      ],
      asOf: '2024-11-29',
      source: 'yahoo',
      error: null,
      adjusted: true,
    };
    assert.equal(executionBar(spy, '2024-11-27')?.date, '2024-11-29');
    assert.equal(executionBar(asx, '2024-11-28')?.date, '2024-11-29');
    assert.notEqual(executionBar(spy, '2024-11-27')?.close, 100);
  });
});
