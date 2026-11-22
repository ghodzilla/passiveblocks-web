import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { DRUCK_BOOK_ID, DRUCK_CANDIDATES, DRUCK_RULE, DRUCK_SHADOW_BOOK_ID, type DruckCandidate } from './druck.config';
import {
  classifyReadV2,
  planBook,
  relativeStrength,
  sampleMarket,
  sampleStep,
  stepDruck,
  type PlanMark,
} from './druck';
import { runDruckRefresh } from './druckRefresh';
import { dollarReady, liquidityScore, readV2Extras } from './druckShadowMath';
import { pathStats, walkShadow, type ShadowBundle } from './druckShadow';
import { presentShadow } from './druckShadowPresent';
import { readShadow, writeShadow } from './druckShadowStore';
import { businessDaysEnding, type CloseBar } from './visser';
import type { SeriesPoint } from './series';

const WEEK_SQL = readFileSync('db/regime/004_druck_snapshots.sql', 'utf8');
const SHADOW_SQL = readFileSync('db/regime/007_druck_shadow.sql', 'utf8');

function adapter(db: PGlite): RegimeSql {
  return {
    async query(text, params) {
      const result = await db.query(text, params as unknown[] | undefined);
      return result.rows as never;
    },
    transaction(run) {
      return db.transaction(async (tx) => run({
        async query(text, params) {
          const result = await tx.query(text, params as unknown[] | undefined);
          return result.rows as never;
        },
      }));
    },
  };
}

function candidate(id: string, role: 'core' | 'watch'): DruckCandidate {
  return {
    id,
    symbol: id.toUpperCase(),
    name: id,
    theme: 'healthcare',
    themeLabel: 'Healthcare',
    role,
    openWeight: 0.1,
    addWeight: 0.1,
    active: true,
    thesis: 'Test',
    sellIf: 'Test',
    also: null,
  };
}

function mark(id: string, strength: number | null, above200 = true): PlanMark {
  return {
    id,
    heldAud: 0,
    avgCostAud: null,
    priceAud: 100,
    above200,
    premium: 0.01,
    strength,
  };
}

describe('v2 shadow rules', () => {
  it('ranks a name on the 3-month and 6-month return and ignores the latest month', () => {
    const closes = Array.from({ length: 250 }, () => 100);
    for (let i = 166; i <= 228; i++) closes[i] = 150;
    for (let i = 229; i < closes.length; i++) closes[i] = 40;
    const strength = relativeStrength(closes, 249);
    assert.ok(strength != null && strength > 0);
    const crashed = closes.slice();
    for (let i = 229; i < crashed.length; i++) crashed[i] = 1;
    assert.equal(relativeStrength(crashed, 249), strength);
    assert.equal(relativeStrength(closes.slice(0, 100), 99), null);
  });

  it('keeps the live colour rule and uses six checks only for v2', () => {
    const extra = {
      yield10Now: 4,
      yield10Then: 4.4,
      curveNow: 0.3,
      curveThen: 0.1,
      dollarAbove200: false,
      liquidityUp: true,
    };
    const green = classifyReadV2({ liquidity: 0.2, spreadNow: 3, spreadThen: 3.2, spyAbove200: true, extra });
    assert.equal(green.ok && green.colour, 'green');
    assert.equal(green.ok && green.checks.length, 6);
    const amber = classifyReadV2({ liquidity: 0.2, spreadNow: 4, spreadThen: 3, spyAbove200: true, extra });
    assert.equal(amber.ok && amber.colour, 'amber');
    const red = classifyReadV2({
      liquidity: 0.01,
      spreadNow: 4,
      spreadThen: 3,
      spyAbove200: false,
      extra: { ...extra, dollarAbove200: true, liquidityUp: false },
    });
    assert.equal(red.ok && red.colour, 'red');
    assert.equal(red.ok && red.cap, 0.25);
    const missing = classifyReadV2({ liquidity: 0.2, spreadNow: 3, spreadThen: 3, spyAbove200: true, extra: null });
    assert.equal(missing.ok, false);
  });

  it('buys the stronger name in a theme first, and leaves the live order alone when strength is unset', () => {
    const strong = candidate('strong', 'watch');
    const weak = candidate('weak', 'core');
    const ranked = planBook({
      candidates: [weak, strong],
      marks: [mark('weak', 0.01), mark('strong', 0.2)],
      equity: 100_000,
      cap: 0.1,
    });
    assert.equal(ranked.find((row) => row.id === 'strong')?.tag, 'buy');
    assert.equal(ranked.find((row) => row.id === 'weak')?.tag, 'wait-cap');
    const live = planBook({
      candidates: [strong, weak],
      marks: [mark('strong', null), mark('weak', null)],
      equity: 100_000,
      cap: 0.1,
    });
    assert.equal(live.find((row) => row.id === 'weak')?.tag, 'buy');
    assert.ok(ranked.every((row) => row.weight >= 0 && row.weight <= 0.1 + 1e-9));
  });

  it('does not let a later price change the decision, and skips a name that is not listed yet', () => {
    const market = sampleMarket();
    market.v2 = {
      yield10Now: 4.1,
      yield10Then: 4.4,
      curveNow: 0.4,
      curveThen: 0.2,
      dollarAbove200: false,
      liquidityUp: true,
    };
    const first = stepDruck(null, market, { rules: 'v2' });
    assert.equal(first.snapshot?.bookId, DRUCK_SHADOW_BOOK_ID);
    assert.equal(first.snapshot?.ruleVersion !== DRUCK_RULE, true);
    assert.ok(first.snapshot && first.snapshot.names.every((name) => name.targetWeight >= 0));
    assert.ok(first.snapshot && first.snapshot.names.reduce((sum, name) => sum + name.targetWeight, 0) <= first.snapshot.cap + 1e-6);
    const later = {
      ...market,
      now: new Date('2026-11-24T21:00:00.000Z'),
      prices: {
        ...market.prices,
        NTRA: [...market.prices.NTRA, { date: '2026-11-23', close: 900 }],
      },
    };
    const second = stepDruck(null, later, { rules: 'v2' });
    const before = first.snapshot?.decisionCalls?.find((call) => call.id === 'ntra');
    const after = second.snapshot?.decisionCalls?.find((call) => call.id === 'ntra');
    assert.equal(after?.priceAud, before?.priceAud);
    assert.equal(after?.action, before?.action);
    const live = sampleStep();
    assert.equal(live.snapshot?.bookId, DRUCK_BOOK_ID);
    assert.equal(live.snapshot?.ruleVersion, DRUCK_RULE);

    const short = sampleMarket();
    short.v2 = market.v2;
    short.prices = { ...short.prices, NTRA: short.prices.NTRA.slice(-10) };
    const blocked = stepDruck(null, short);
    assert.equal(blocked.outcome, 'feed_failed');
    assert.match(blocked.errors.join(' '), /NTRA/);
    const skipped = stepDruck(null, short, { rules: 'v2', skipUnlisted: true });
    assert.notEqual(skipped.outcome, 'feed_failed');
    assert.equal(skipped.snapshot?.names.some((name) => name.id === 'ntra'), false);
  });

  it('ignores a yield that was not printed yet', () => {
    const extra = readV2Extras({
      decision: '2014-06-02',
      dgs10: [
        { date: '2014-02-28', value: 3 },
        { date: '2014-06-02', value: 2.5 },
        { date: '2014-08-01', value: 9 },
      ],
      dgs2: [
        { date: '2014-02-28', value: 2 },
        { date: '2014-06-02', value: 1.5 },
        { date: '2014-08-01', value: 8 },
      ],
      dollarAbove200: false,
      liquidityUp: true,
    });
    assert.equal(extra?.yield10Now, 2.5);
    assert.notEqual(extra?.yield10Now, 9);
    const bars: CloseBar[] = businessDaysEnding('2014-06-02', 220).map((date) => ({ date, close: 100 }));
    bars.push({ date: '2014-07-01', close: 400 });
    assert.equal(dollarReady(bars, '2014-06-02'), false);
    const net: SeriesPoint[] = [];
    for (let i = 0; i < 80; i++) net.push({ date: `2013-01-${String((i % 27) + 1).padStart(2, '0')}`, value: 1000 + i });
    const scored = liquidityScore(net.filter((point, index, all) => all.findIndex((row) => row.date === point.date) === index).sort((a, b) => a.date.localeCompare(b.date)), '2013-06-01');
    assert.equal(scored.z == null || Number.isFinite(scored.z), true);
  });

  it('reports CAGR and the worst fall from the path, without inventing a sharpe from two points', () => {
    const stats = pathStats([
      { date: '2020-01-01', nav: 1, turnover: 0.2 },
      { date: '2020-06-01', nav: 0.8, turnover: 0 },
      { date: '2021-01-01', nav: 1.21, turnover: 0 },
    ]);
    assert.ok(stats.cagr != null && Math.abs(stats.cagr - 0.21) < 0.01);
    assert.ok(stats.worst != null && Math.abs(stats.worst - -0.2) < 1e-9);
    assert.equal(stats.sharpe, null);
  });

  it('walks both rules on the same weeks and says plainly when v2 does not grow faster', () => {
    const days = businessDaysEnding('2014-06-20', 420);
    const prices: Record<string, CloseBar[]> = {};
    const line = (pace: number) => days.map((date, index) => ({ date, close: 100 * (1 + pace) ** index }));
    prices.SPY = line(0.0004);
    prices['AAA.AX'] = days.map((date) => ({ date, close: 50 }));
    prices['AUDUSD=X'] = days.map((date) => ({ date, close: 0.65 }));
    prices.QQQ = line(0.0005);
    prices.IEF = days.map((date) => ({ date, close: 100 }));
    prices['DX-Y.NYB'] = days.map((date) => ({ date, close: 100 }));
    for (const candidate of DRUCK_CANDIDATES) prices[candidate.symbol] = line(candidate.id === 'amzn' ? 0.001 : 0.0002);
    const hy = days.map((date) => ({ date, value: 4 }));
    const dgs10 = days.map((date, index) => ({ date, value: 4 - index * 0.0005 }));
    const dgs2 = days.map((date, index) => ({ date, value: 3 - index * 0.001 }));
    const net = days.filter((_, index) => index % 5 === 0).map((date, index) => ({ date, value: 1_000_000 + index * 5000 }));
    const bundle: ShadowBundle = { prices, hy, dgs10, dgs2, dollar: prices['DX-Y.NYB'], netLiquidity: net };
    const report = walkShadow(bundle, '2026-11-22T00:00:00.000Z');
    assert.equal(report.rows.filter((row) => row.book === 'Current rules').length, 2);
    assert.equal(report.rows.filter((row) => row.book === 'v2 rules').length, 2);
    assert.equal(report.rows.some((row) => row.book === '60/40'), true);
    assert.equal(report.rows.some((row) => row.book === 'QQQ'), true);
    assert.match(report.note, /v2/);
    const card = presentShadow({
      read: { status: 'empty', snapshot: null },
      report,
    });
    assert.match(card.caveats.join(' '), /NOT VALIDATED/);
    assert.match(card.headline, /live book is unchanged/);
    assert.match(card.caveats.join(' '), /4\.85%/);
  });

  it('says the 2013 window was not run when the free spread history starts later', () => {
    const report = walkShadow({
      prices: { SPY: [] },
      hy: [{ date: '2023-11-21', value: 4 }],
      dgs10: [],
      dgs2: [],
      dollar: [],
      netLiquidity: [],
    }, '2026-11-22T00:00:00.000Z');
    assert.match(report.note, /2013–22: not enough of a path to compare\. The free high-yield series starts on 2023-11-21/);
  });

  it('stores the shadow week apart from the live book', async () => {
    const db = new PGlite();
    await db.exec(WEEK_SQL);
    await db.exec(SHADOW_SQL);
    const sql = adapter(db);
    const market = sampleMarket();
    market.v2 = {
      yield10Now: 4.1,
      yield10Then: 4.4,
      curveNow: 0.4,
      curveThen: 0.2,
      dollarAbove200: false,
      liquidityUp: true,
    };
    const step = stepDruck(null, market, { rules: 'v2' });
    assert.ok(step.snapshot);
    await writeShadow(sql, step.snapshot);
    const saved = await readShadow(sql);
    assert.equal(saved.snapshot?.bookId, DRUCK_SHADOW_BOOK_ID);
    const live = await sql.query<{ count: string }>('SELECT count(*)::text AS count FROM regime_druck');
    assert.equal(live[0]?.count, '0');
    const bare = new PGlite();
    await bare.exec(WEEK_SQL);
    const refreshed = await runDruckRefresh({ trigger: 'cron', now: market.now, sql: adapter(bare), market: sampleMarket() });
    assert.equal(refreshed.outcome, 'saved');
    assert.match(SHADOW_SQL, /regime_druck_shadow/);
    assert.doesNotMatch(SHADOW_SQL, /ALTER TABLE regime_druck\b/);
    assert.match(SHADOW_SQL, /REVOKE DELETE/);
  });
});
