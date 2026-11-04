import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { applyPaperDay, type Desk, type RiskLine } from './desk';
import { dipSignal } from './dip';
import { changeAllowed, chooseTweak, neighbors, PARAM_BOUNDS, snapToBound, type FoldMetric } from './improve';
import { emptyJournal, openJournal, sealJournal } from './journal';
import type { Bar } from './signals';
import { reviewBook } from './weekly';
import type { IdeasReport } from './ideas';
import { priceUniverse } from './load';
import { applyOverlapCaps, OVERLAP_GROUP_CAP } from './overlap';
import { SINGLE_POSITION_CAP, SYSTEMATIC_CAP } from './ideas';
import {
  ASPIRATION_LABEL,
  DEFAULT_TARGET_CAGR,
  DRAWDOWN_HALT,
  MAX_RISK_PCT,
  MIN_RISK_PCT,
  THEME_WEIGHT_CAP,
  drawdownState,
  pyramidState,
  resolveCapital,
  resolveTargetCagr,
  riskSize,
  roleCap,
} from './sizing';
import { evaluateThemes } from './themes';
import { THEME_CHANGELOG, THEME_CONFIG_VERSION, THEMES } from './themes.config';

function metric(sharpe: number, calmar: number): FoldMetric {
  return { sharpe, calmar, cagr: 0.1, maxDrawdown: 0.1 };
}

function dipCloses(last: number): number[] {
  const closes = Array.from({ length: 40 }, () => 100);
  for (let i = 0; i < 19; i++) closes.push(70);
  closes.push(last);
  return closes;
}

function line(partial: Partial<RiskLine> & Pick<RiskLine, 'symbol'>): RiskLine {
  return {
    name: partial.symbol,
    stop: partial.stop ?? null,
    qty: partial.qty ?? null,
    weight: partial.weight ?? 0,
    note: partial.note ?? '',
    dip: partial.dip ?? null,
    theme: partial.theme ?? null,
    symbol: partial.symbol,
  };
}

function stubDesk(lines: RiskLine[]): Desk {
  return {
    themes: [],
    lines,
    capital: 100000,
    targetCagr: 0.3,
    drawdown: null,
    halted: false,
    equity: null,
    peakEquity: null,
    realisedCagr: null,
    backtestedCagr: null,
    maxDrawdown: null,
    gapToTarget: null,
    changes: [],
    configVersion: THEME_CONFIG_VERSION,
    changelog: [],
    gaps: [],
    params: emptyJournal().params,
  };
}

describe('theme switches', () => {
  const rest = {
    liquidityLatest: 0.2,
    liquidityPrior: 0.1,
    btcAbove200: true as boolean | null,
    realYield: 'flat' as const,
    dollar: 'flat' as const,
  };

  it('turns AI infrastructure on only when the capex z-score is rising', () => {
    const on = evaluateThemes({ ...rest, aiLatest: 1, aiPrior: 0.2 }).find((theme) => theme.id === 'ai-infrastructure');
    const flat = evaluateThemes({ ...rest, aiLatest: 0.2, aiPrior: 0.2 }).find((theme) => theme.id === 'ai-infrastructure');
    const missing = evaluateThemes({ ...rest, aiLatest: null, aiPrior: null }).find((theme) => theme.id === 'ai-infrastructure');
    assert.equal(on?.on, true);
    assert.match(on?.reason ?? '', /On/);
    assert.equal(flat?.on, false);
    assert.equal(missing?.on, false);
    assert.match(missing?.reason ?? '', /two prints/);
  });

  it('keeps a disabled objective switch off', () => {
    const themes = evaluateThemes({
      themes: [{ ...THEMES[0], enabled: false }],
      ...rest,
      aiLatest: 2,
      aiPrior: 0,
    });
    assert.equal(themes[0].on, false);
    assert.match(themes[0].reason, /Objective switch is off/);
  });

  it('requires Bitcoin above its 200-day average and rising liquidity', () => {
    const on = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, btcAbove200: true, liquidityLatest: 0.4, liquidityPrior: 0.1 })
      .find((theme) => theme.id === 'crypto');
    const oneLeg = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, btcAbove200: false, liquidityLatest: 0.4, liquidityPrior: 0.1 })
      .find((theme) => theme.id === 'crypto');
    const missing = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, btcAbove200: null, liquidityLatest: null, liquidityPrior: null })
      .find((theme) => theme.id === 'crypto');
    assert.equal(on?.on, true);
    assert.equal(oneLeg?.on, false);
    assert.equal(missing?.on, false);
    assert.match(missing?.reason ?? '', /Both conditions are required/);
  });

  it('turns scarcity on when real yields fall or the dollar weakens', () => {
    const yields = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, realYield: 'falling', dollar: 'rising' })
      .find((theme) => theme.id === 'scarcity');
    const dollar = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, realYield: 'unknown', dollar: 'falling' })
      .find((theme) => theme.id === 'scarcity');
    const neither = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, realYield: 'rising', dollar: 'flat' })
      .find((theme) => theme.id === 'scarcity');
    const unknown = evaluateThemes({ ...rest, aiLatest: 0, aiPrior: 0, realYield: 'unknown', dollar: 'unknown' })
      .find((theme) => theme.id === 'scarcity');
    assert.equal(yields?.on, true);
    assert.equal(dollar?.on, true);
    assert.match(dollar?.reason ?? '', /unavailable/);
    assert.equal(neither?.on, false);
    assert.equal(unknown?.on, false);
  });

  it('keeps the theme list versioned for a quarterly human review', () => {
    assert.equal(THEME_CONFIG_VERSION, '2026-Q4.1');
    assert.match(THEME_CHANGELOG[0].note, /quarter/);
    assert.equal(THEMES.length, 3);
  });
});

describe('risk sizing', () => {
  it('sizes from ATR and refuses a risk percent outside 0.5–1%', () => {
    const sized = riskSize({ capital: 100000, riskPct: 0.0075, entry: 100, atr: 2, k: 2.5, cap: 0.2 });
    assert.equal(sized.stop, 95);
    assert.equal(sized.qty, 150);
    assert.equal(sized.weight, 0.15);
    const stock = riskSize({ capital: 100000, riskPct: 0.0075, entry: 100, atr: 2, k: 2.5, cap: roleCap('stock') });
    assert.equal(stock.weight, 0.02);
    assert.equal(riskSize({ capital: 100000, riskPct: 0.02, entry: 100, atr: 2, k: 2.5, cap: 0.2 }).weight, null);
    assert.equal(riskSize({ capital: 100000, riskPct: 0.0075, entry: 100, atr: null, k: 2.5, cap: 0.2 }).qty, null);
    assert.equal(roleCap('crypto'), 0.2);
  });

  it('adds only after +1R and halts new risk after a 10% drawdown', () => {
    assert.equal(pyramidState({ hasPosition: false, entry: null, riskPerShare: null, last: 100 }), 'new');
    assert.equal(pyramidState({ hasPosition: true, entry: 100, riskPerShare: 5, last: 100 }), 'no-add-loser');
    assert.equal(pyramidState({ hasPosition: true, entry: 100, riskPerShare: 5, last: 102.5 }), 'hold');
    assert.equal(pyramidState({ hasPosition: true, entry: 100, riskPerShare: 5, last: 105 }), 'add');
    assert.equal(drawdownState(90, 100).halted, true);
    assert.equal(drawdownState(90.1, 100).halted, false);
    assert.equal(drawdownState(100, 0).halted, false);
    assert.equal(resolveCapital(undefined, null), 100000);
    assert.equal(resolveCapital('250000', 80000), 80000);
  });
});

describe('dip buying', () => {
  it('flags a confirmed dip only in Risk-On or Transitional with the theme on', () => {
    const flagged = dipSignal({ regime: 'risk_on', themeOn: true, halted: false, closes: dipCloses(85) });
    assert.equal(flagged.flagged, true);
    assert.match(flagged.reason, /Buy the dip — confirmed/);
    assert.equal(dipSignal({ regime: 'transitional', themeOn: true, halted: false, closes: dipCloses(85) }).flagged, true);
    assert.equal(dipSignal({ regime: 'risk_on', themeOn: true, halted: false, closes: dipCloses(95) }).flagged, false);
    assert.equal(dipSignal({ regime: 'risk_on', themeOn: true, halted: false, closes: dipCloses(75) }).flagged, false);
    assert.equal(dipSignal({ regime: 'crisis', themeOn: true, halted: false, closes: dipCloses(85) }).flagged, false);
    assert.equal(dipSignal({ regime: 'tightening', themeOn: true, halted: false, closes: dipCloses(85) }).flagged, false);
    assert.equal(dipSignal({ regime: 'risk_on', themeOn: true, halted: true, closes: dipCloses(85) }).flagged, false);
    assert.equal(dipSignal({ regime: 'risk_on', themeOn: false, halted: false, closes: dipCloses(85) }).flagged, false);
  });
});

describe('crypto overlap and the price book', () => {
  it('puts Bitcoin inside the 25% overlap group and still fetches it', () => {
    const capped = applyOverlapCaps(
      [
        { symbol: 'QQQ', status: 'confirmed', weight: 0.2 },
        { symbol: 'BTC-USD', status: 'confirmed', weight: 0.2 },
        { symbol: 'SPY', status: 'confirmed', weight: 0.2 },
      ],
      null,
    );
    assert.ok(Math.abs(capped.weights[0] + capped.weights[1] - 0.25) < 1e-4);
    assert.equal(capped.weights[2], 0.2);
    assert.equal(capped.groups[0].symbols.includes('BTC-USD'), true);
    assert.equal(capped.groups[0].symbols.includes('SPY'), false);
    const symbols = priceUniverse(undefined).map((item) => item.symbol);
    assert.equal(symbols.includes('BTC-USD'), true);
    assert.equal(symbols.includes('ETH-USD'), true);
    assert.equal(symbols.includes('SOL-USD'), true);
    assert.equal(symbols.includes('SPY'), true);
    assert.equal(symbols.includes('EQIX'), true);
  });
});

describe('walk-forward acceptance', () => {
  it('accepts a tweak on at least 2 of 3 folds and ignores a lower Sharpe', () => {
    const weak = metric(0.2, 0.4);
    const strong = metric(0.8, 0.5);
    const accepted = chooseTweak({
      incumbent: [weak, weak, strong],
      candidates: [{ value: 3, folds: [strong, strong, weak] }],
    });
    assert.deepEqual(accepted, { value: 3, wins: 2 });
    assert.equal(chooseTweak({
      incumbent: [weak, strong, strong],
      candidates: [{ value: 3, folds: [strong, weak, weak] }],
    }), null);
    const equal = metric(0.5, 0.2);
    const richer = metric(0.5, 0.9);
    assert.equal(chooseTweak({
      incumbent: [equal, equal, equal],
      candidates: [{ value: 2, folds: [richer, richer, equal] }],
    })?.wins, 2);
    assert.equal(chooseTweak({
      incumbent: [strong, strong, strong],
      candidates: [{ value: 4, folds: [metric(0.1, 9), metric(0.1, 9), metric(0.1, 9)] }],
    }), null);
  });

  it('stays on the grid and allows one change per rule per month', () => {
    const bound = { id: 'atr-k', label: 'ATR multiple', min: 1.5, max: 4, step: 0.5, default: 2.5 };
    assert.equal(snapToBound(2.6, bound), null);
    assert.equal(snapToBound(2.5, bound), 2.5);
    assert.deepEqual(neighbors(2.5, bound), [2, 3]);
    const now = '2026-11-04T22:00:00.000Z';
    assert.equal(changeAllowed([{ ruleId: 'atr-k', at: '2026-11-02T00:00:00.000Z' }], 'atr-k', now), false);
    assert.equal(changeAllowed([{ ruleId: 'atr-k', at: '2026-10-02T00:00:00.000Z' }], 'atr-k', now), true);
  });

  it('does not raise the risk percent just because leverage changes Calmar', () => {
    const bars: Bar[] = [];
    let price = 100;
    for (let i = 0; i < 420; i++) {
      price *= 1.001;
      const date = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      bars.push({ date, close: price, high: price * 1.01, low: price * 0.99 });
    }
    const reviewed = reviewBook({
      journal: emptyJournal(),
      spyBars: bars,
      sixty: [],
      ideas: { signalHealth: [] } as unknown as IdeasReport,
      nowIso: '2026-11-04T22:00:00.000Z',
    });
    assert.equal(reviewed.changes.some((change) => change.ruleId === 'risk-pct'), false);
  });

  it('does not loosen risk bounds when the aspiration gap widens', () => {
    assert.equal(resolveTargetCagr(undefined, null), 0.66);
    assert.equal(DEFAULT_TARGET_CAGR, 0.66);
    assert.equal(Math.round(DEFAULT_TARGET_CAGR * 100), 66);
    assert.equal(ASPIRATION_LABEL, 'Aspiration (Medallion gross ceiling 1988-2018) — not a forecast');
    assert.equal(DRAWDOWN_HALT, 0.1);
    assert.equal(MIN_RISK_PCT, 0.005);
    assert.equal(MAX_RISK_PCT, 0.01);
    assert.equal(THEME_WEIGHT_CAP, 0.2);
    assert.equal(SINGLE_POSITION_CAP, 0.2);
    assert.equal(SYSTEMATIC_CAP, 0.02);
    assert.equal(OVERLAP_GROUP_CAP, 0.25);
    assert.equal(roleCap('stock'), SYSTEMATIC_CAP);
    assert.equal(roleCap('etf'), SINGLE_POSITION_CAP);
    const riskBound = PARAM_BOUNDS.find((bound) => bound.id === 'risk-pct');
    assert.equal(riskBound?.min, MIN_RISK_PCT);
    assert.equal(riskBound?.max, MAX_RISK_PCT);
    assert.equal(snapToBound(0.0125, riskBound!), null);
    assert.equal(drawdownState(80, 100, DRAWDOWN_HALT).halted, true);

    const bars: Bar[] = [];
    let price = 100;
    for (let i = 0; i < 420; i++) {
      price *= 1.001;
      const date = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      bars.push({ date, close: price, high: price * 1.01, low: price * 0.99 });
    }
    const run = (target: number) => {
      const journal = emptyJournal();
      journal.settings.targetCagr = target;
      return reviewBook({
        journal,
        spyBars: bars,
        sixty: [],
        ideas: { signalHealth: [] } as unknown as IdeasReport,
        nowIso: '2026-11-04T22:00:00.000Z',
      });
    };
    const tight = run(0.01);
    const aspiration = run(DEFAULT_TARGET_CAGR);
    const widest = run(2);
    assert.deepEqual(aspiration.journal.params, tight.journal.params);
    assert.deepEqual(widest.journal.params, tight.journal.params);
    assert.deepEqual(aspiration.changes, tight.changes);
    assert.ok(aspiration.journal.params.riskPct >= MIN_RISK_PCT);
    assert.ok(aspiration.journal.params.riskPct <= MAX_RISK_PCT);
    for (const change of aspiration.changes) {
      if (change.to == null) continue;
      const bound = PARAM_BOUNDS.find((item) => item.id === change.ruleId);
      assert.ok(bound);
      assert.ok(change.to >= bound.min);
      assert.ok(change.to <= bound.max);
    }

    const weekly = readFileSync('lib/regime/weekly.ts', 'utf8');
    const improve = readFileSync('lib/regime/improve.ts', 'utf8');
    const desk = readFileSync('lib/regime/desk.ts', 'utf8');
    const panel = readFileSync('components/regime/DeskPanels.tsx', 'utf8');
    assert.equal(weekly.includes('targetCagr'), false);
    assert.equal(weekly.includes('gapToTarget'), false);
    assert.equal(improve.includes('targetCagr'), false);
    assert.equal(improve.includes('gapToTarget'), false);
    assert.match(desk, /drawdownState\(equity, peak\)/);
    assert.match(panel, /\{ASPIRATION_LABEL\}/);
  });
});

describe('paper journal', () => {
  it('seals and opens the journal and rejects a tampered payload', () => {
    const secret = 'a'.repeat(32);
    const sealed = sealJournal('{"version":1}', secret);
    assert.equal(openJournal(sealed, secret), '{"version":1}');
    const raw = Buffer.from(sealed, 'base64');
    raw[30] ^= 1;
    assert.throws(() => openJournal(raw.toString('base64'), secret));
  });

  it('marks a day once, stops out, and adds only after +1R', () => {
    const journal = emptyJournal();
    journal.paper.cash = 50000;
    journal.paper.peakEquity = 50000;
    journal.paper.positions = [{
      symbol: 'QQQ', qty: 10, entry: 100, stop: 95, riskPerShare: 5, openedOn: '2026-01-01',
    }];
    const held = applyPaperDay({
      journal,
      desk: stubDesk([line({ symbol: 'QQQ', qty: 2, stop: 90, weight: 0.01 })]),
      prices: { QQQ: 100 },
      date: '2026-11-04',
      capital: 100000,
    });
    assert.equal(held.paper.positions[0].qty, 10);
    const again = applyPaperDay({
      journal: held,
      desk: stubDesk([line({ symbol: 'QQQ', qty: 2, stop: 90, weight: 0.01 })]),
      prices: { QQQ: 106 },
      date: '2026-11-04',
      capital: 100000,
    });
    assert.equal(again, held);

    const added = applyPaperDay({
      journal: held,
      desk: stubDesk([line({ symbol: 'QQQ', qty: 2, stop: 90, weight: 0.01 })]),
      prices: { QQQ: 106 },
      date: '2026-11-05',
      capital: 100000,
    });
    assert.equal(added.paper.positions[0].qty, 12);
    assert.equal(added.paper.positions[0].entry, 100);

    const stopped = applyPaperDay({
      journal,
      desk: stubDesk([line({ symbol: 'QQQ', qty: 2, stop: 80, weight: 0.01 })]),
      prices: { QQQ: 90 },
      date: '2026-11-06',
      capital: 100000,
    });
    assert.equal(stopped.paper.positions.length, 0);
    assert.equal(stopped.paper.cash, 50900);

    const missing = applyPaperDay({
      journal,
      desk: stubDesk([]),
      prices: {},
      date: '2026-11-07',
      capital: 100000,
    });
    assert.equal(missing, journal);
  });
});

describe('new regime routes stay denied by default', () => {
  it('protects settings, the weekly review, and the Sunday cron', () => {
    const middleware = readFileSync('middleware.ts', 'utf8');
    const settings = readFileSync('app/api/regime/settings/route.ts', 'utf8');
    const improve = readFileSync('app/api/regime/improve/route.ts', 'utf8');
    const vercel = readFileSync('vercel.json', 'utf8');
    assert.match(middleware, /\/api\/regime\/improve/);
    assert.match(settings, /regimeApiAllowed\(false\)/);
    assert.match(improve, /regimeApiAllowed\(true\)/);
    assert.match(vercel, /0 22 \* \* 0/);
  });
});
