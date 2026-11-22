import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { FX_SYMBOL } from './fx';
import {
  DRUCK_CANDIDATES,
  DRUCK_BACKTEST,
  DRUCK_BOOK_ID,
  DRUCK_CAVEAT,
  DRUCK_COST,
  DRUCK_LIST,
  DRUCK_RULE,
  DRUCK_START_AUD,
} from './druck.config';
import {
  businessDaysEnding,
  callFrom,
  classifyRead,
  closesFor,
  nextBrake,
  nextRung,
  planBook,
  sampleMarket,
  sampleStep,
  spreadPair,
  stepDruck,
  threeMonthsBefore,
  type DruckCandidate,
  type DruckMarket,
  type PlanMark,
} from './druck';
import { loadDruckMarket, runDruckRefresh } from './druckRefresh';
import { sampleDruckPanel, toDruckPanel } from './druckPresent';
import { parseDruckRecord, readDruck, readDruckWeeks } from './druckStore';
import { sessionHasClosed } from './prices';
import { retiredBookLines } from './retiredBooks';
import type { DruckSnapshot } from './druck';

const MIGRATION = readFileSync('db/regime/001_durable_state.sql', 'utf8');
const DRUCK_SQL = readFileSync('db/regime/004_druck_snapshots.sql', 'utf8');

function adapter(db: PGlite): RegimeSql {
  return {
    async query(text, params) {
      const result = await db.query(text, params as unknown[] | undefined);
      return result.rows;
    },
    transaction(run) {
      return db.transaction(async (tx) => run({
        async query(text, params) {
          const result = await tx.query(text, params as unknown[] | undefined);
          return result.rows;
        },
      }));
    },
  };
}

function mark(partial: Partial<PlanMark> & { id: string }): PlanMark {
  return {
    heldAud: 0,
    avgCostAud: null,
    priceAud: 100,
    above200: true,
    premium: 0.01,
    ...partial,
  };
}

describe('Druckenmiller weekly read', () => {
  it('is green only when all three pass, amber on one miss, and red on two', () => {
    const green = classifyRead({ liquidity: 0.1, spreadNow: 3, spreadThen: 3, spyAbove200: true });
    assert.equal(green.ok, true);
    if (green.ok) assert.equal(green.colour, 'green');
    const amber = classifyRead({ liquidity: 0.1, spreadNow: 3.2, spreadThen: 3, spyAbove200: true });
    assert.equal(amber.ok, true);
    if (amber.ok) {
      assert.equal(amber.colour, 'amber');
      assert.equal(amber.cap, 0.5);
    }
    const red = classifyRead({ liquidity: 0.04, spreadNow: 4.2, spreadThen: 3.4, spyAbove200: false });
    assert.equal(red.ok, true);
    if (red.ok) {
      assert.equal(red.colour, 'red');
      assert.equal(red.cap, 0.25);
    }
    assert.equal(classifyRead({ liquidity: null, spreadNow: 3, spreadThen: 3, spyAbove200: true }).ok, false);
  });

  it('drops the cap to red after a 15% fall and clears it only on green', () => {
    const hit = nextBrake({ brake: false, peak: 100_000, equity: 85_000, colour: 'amber' });
    assert.equal(hit.brake, true);
    assert.equal(hit.cap, 0.25);
    const justAbove = nextBrake({ brake: false, peak: 100_000, equity: 85_001, colour: 'amber' });
    assert.equal(justAbove.brake, false);
    assert.equal(justAbove.cap, 0.5);
    const held = nextBrake({ brake: true, peak: 100_000, equity: 95_000, colour: 'amber' });
    assert.equal(held.brake, true);
    assert.equal(held.cap, 0.25);
    const cleared = nextBrake({ brake: true, peak: 100_000, equity: 80_000, colour: 'green' });
    assert.equal(cleared.brake, false);
    assert.equal(cleared.cap, 1);
  });

  it('pairs the high-yield spread with the print three months earlier', () => {
    assert.equal(threeMonthsBefore('2026-11-20'), '2026-08-20');
    const pair = spreadPair([
      { date: '2026-08-18', value: 3.4 },
      { date: '2026-11-19', value: 4.2 },
    ], '2026-11-20');
    assert.equal('error' in pair, false);
    if (!('error' in pair)) {
      assert.equal(pair.now, 4.2);
      assert.equal(pair.then, 3.4);
    }
    const gap = spreadPair([{ date: '2026-07-01', value: 3 }, { date: '2026-11-19', value: 4 }], '2026-11-20');
    assert.equal('error' in gap, true);
  });
});

describe('Druckenmiller sizing', () => {
  it('keeps the quarterly list inside the starter, name, and theme caps', () => {
    const symbols = DRUCK_CANDIDATES.map((candidate) => candidate.symbol);
    assert.deepEqual(symbols, ['NTRA', 'HACK.AX', 'AMZN', 'INSM', 'STX', 'WDC', 'GDX.AX', 'SEMI.AX', 'SE', 'YPF', 'EWZ']);
    assert.ok(DRUCK_CANDIDATES.every((candidate) => candidate.openWeight <= 0.1 && candidate.addWeight <= 0.25 && candidate.addWeight >= candidate.openWeight));
    const core = DRUCK_CANDIDATES.filter((candidate) => candidate.role === 'core');
    const open = core.reduce((sum, candidate) => sum + candidate.openWeight, 0);
    assert.equal(Math.round(open * 1000) / 1000, 0.25);
    assert.equal(new Set(symbols).size, symbols.length);
  });

  it('opens the red book at NTRA 7%, HACK.AX 8%, AMZN 5%, INSM 5%, and refuses names under the average', () => {
    const rows = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 0.25,
      marks: DRUCK_CANDIDATES.map((candidate) => mark({
        id: candidate.id,
        above200: candidate.role === 'core',
        premium: candidate.role === 'core' ? 0.01 : -0.2,
      })),
    });
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    assert.equal(byId.ntra.weight, 0.07);
    assert.equal(byId.hack.weight, 0.08);
    assert.equal(byId.amzn.weight, 0.05);
    assert.equal(byId.insm.weight, 0.05);
    assert.equal(byId.ntra.tag, 'buy');
    assert.equal(byId.stx.weight, 0);
    assert.equal(byId.stx.tag, 'wait-trend');
    assert.equal(byId.gdx.tag, 'wait-trend');
    const invested = rows.reduce((sum, row) => sum + row.weight, 0);
    assert.ok(invested <= 0.25 + 1e-9);
    assert.ok(rows.every((row) => row.weight >= 0 && row.weight <= 0.25));
  });

  it('adds only after a 15% gain above the average, and never averages down', () => {
    assert.equal(nextRung(0.07, 0.2), 0.1);
    assert.equal(nextRung(0.1, 0.2), 0.2);
    assert.equal(nextRung(0.2, 0.2), 0.2);
    assert.equal(nextRung(0.05, 0.08), 0.08);
    const earned = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: DRUCK_CANDIDATES.map((candidate) => mark({
        id: candidate.id,
        above200: candidate.id === 'ntra',
        heldAud: candidate.id === 'ntra' ? 7_000 : 0,
        avgCostAud: candidate.id === 'ntra' ? 100 : null,
        priceAud: candidate.id === 'ntra' ? 115 : 100,
        premium: 0.05,
      })),
    });
    assert.equal(earned.find((row) => row.id === 'ntra')?.weight, 0.1);
    assert.equal(earned.find((row) => row.id === 'ntra')?.tag, 'add');
    const early = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 114, above200: true, premium: 0.02 })],
    });
    assert.equal(early.find((row) => row.id === 'ntra')?.weight, 0.07);
    const down = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 90, above200: true, premium: 0.02 })],
    });
    assert.equal(down.find((row) => row.id === 'ntra')?.weight, 0.07);
    assert.notEqual(down.find((row) => row.id === 'ntra')?.tag, 'add');
  });

  it('sells at 20% under cost or more than 10% under the average, and trims half above 60%', () => {
    const sold = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 80, above200: true, premium: 0.02 })],
    });
    assert.equal(sold.find((row) => row.id === 'ntra')?.tag, 'sell-cost');
    assert.equal(sold.find((row) => row.id === 'ntra')?.weight, 0);
    const kept = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 80.1, above200: true, premium: -0.1 })],
    });
    assert.equal(kept.find((row) => row.id === 'ntra')?.tag, 'hold');
    const trend = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 100, above200: false, premium: -0.1001 })],
    });
    assert.equal(trend.find((row) => row.id === 'ntra')?.tag, 'sell-trend');
    const onTheLine = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 7_000, avgCostAud: 100, priceAud: 100, above200: false, premium: -0.1 })],
    });
    assert.equal(onTheLine.find((row) => row.id === 'ntra')?.tag, 'hold');
    const hot = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 10_000, avgCostAud: 50, priceAud: 200, above200: true, premium: 0.61 })],
    });
    assert.equal(hot.find((row) => row.id === 'ntra')?.tag, 'trim-extension');
    assert.ok(Math.abs((hot.find((row) => row.id === 'ntra')?.weight ?? 0) - 0.05) < 1e-9);
    const exactHot = planBook({
      candidates: DRUCK_CANDIDATES,
      equity: 100_000,
      cap: 1,
      marks: [mark({ id: 'ntra', heldAud: 10_000, avgCostAud: 180, priceAud: 200, above200: true, premium: 0.6 })],
    });
    assert.equal(exactHot.find((row) => row.id === 'ntra')?.tag, 'hold');
  });

  it('stops a theme at 40% and the book at six positions', () => {
    const pair: DruckCandidate[] = [
      { ...DRUCK_CANDIDATES[0], addWeight: 0.25 },
      { ...DRUCK_CANDIDATES[3], id: 'insm', addWeight: 0.25 },
    ];
    const capped = planBook({
      candidates: pair,
      equity: 100_000,
      cap: 1,
      marks: pair.map((candidate, index) => mark({
        id: candidate.id,
        heldAud: index === 0 ? 20_000 : 10_000,
        avgCostAud: 100,
        priceAud: 120,
        above200: true,
        premium: 0.05,
      })),
    });
    const sum = capped.reduce((total, row) => total + row.weight, 0);
    assert.ok(sum <= 0.4 + 1e-9);
    assert.equal(capped[0]?.weight, 0.25);
    assert.ok(Math.abs((capped[1]?.weight ?? 0) - 0.15) < 1e-9);
    const many: DruckCandidate[] = Array.from({ length: 8 }, (_, index) => ({
      id: `n${index}`,
      symbol: `N${index}`,
      name: `Name ${index}`,
      theme: `t${index}`,
      themeLabel: `Theme ${index}`,
      role: 'core' as const,
      openWeight: 0.05,
      addWeight: 0.05,
      active: true,
      thesis: 'Test',
      sellIf: 'Test',
      also: null,
    }));
    const booked = planBook({
      candidates: many,
      equity: 100_000,
      cap: 1,
      marks: many.map((candidate) => mark({ id: candidate.id })),
    });
    assert.equal(booked.filter((row) => row.weight > 0).length, 6);
    assert.equal(booked[6]?.tag, 'wait-slots');
    assert.equal(callFrom(0, 0.07), 'Buy');
    assert.equal(callFrom(0.07, 0), 'Sell');
  });
});

describe('Druckenmiller paper book', () => {
  it('writes the 20 Nov 2026 red call in Australian dollars', () => {
    const step = sampleStep();
    assert.equal(step.outcome, 'saved');
    assert.equal(step.snapshot?.bookId, DRUCK_BOOK_ID);
    assert.equal(step.snapshot?.decisionDate, '2026-11-20');
    assert.equal(step.snapshot?.colour, 'red');
    assert.equal(step.snapshot?.cap, 0.25);
    assert.equal(step.snapshot?.brakeOn, false);
    assert.equal(step.snapshot?.equityAud, DRUCK_START_AUD);
    const weights = Object.fromEntries((step.snapshot?.names ?? []).map((name) => [name.symbol, name.targetWeight]));
    assert.equal(weights.NTRA, 0.07);
    assert.equal(weights['HACK.AX'], 0.08);
    assert.equal(weights.AMZN, 0.05);
    assert.equal(weights.INSM, 0.05);
    assert.equal(weights.STX, 0);
    assert.equal(weights['GDX.AX'], 0);
    assert.equal(weights['SEMI.AX'], 0);
    assert.equal(weights.EWZ, 0);
    const ntra = step.snapshot?.names.find((name) => name.symbol === 'NTRA');
    assert.equal(ntra?.call, 'Buy');
    assert.equal(ntra?.targetAud, 7_000);
    assert.ok(Math.abs((ntra?.priceAud ?? 0) - 273.4 / 0.65) < 0.01);
    assert.equal(ntra?.currency, 'USD');
    assert.equal(step.snapshot?.names.find((name) => name.symbol === 'HACK.AX')?.currency, 'AUD');
    assert.equal(step.snapshot?.fxRate, 0.65);
    assert.equal(step.snapshot?.targetCashAud, 75_000);
    const invested = (step.snapshot?.names ?? []).reduce((sum, name) => sum + name.targetWeight, 0);
    assert.ok(invested <= 0.25 + 1e-9);
    assert.ok((step.snapshot?.names ?? []).every((name) => name.targetWeight >= 0));
  });

  it('fills at the next close, charges 0.10%, and does not borrow', () => {
    const sample = sampleMarket();
    const pending = stepDruck(null, sample);
    assert.equal(pending.snapshot?.phase, 'pending');
    const monday = '2026-11-23';
    const extend = (bars: { date: string; close: number }[]) => bars.concat([{ date: monday, close: bars[bars.length - 1].close }]);
    const prices: DruckMarket['prices'] = {};
    for (const [symbol, bars] of Object.entries(sample.prices)) prices[symbol] = extend(bars);
    const filled = stepDruck(pending.snapshot, {
      ...sample,
      now: new Date('2026-11-24T15:00:00.000Z'),
      prices,
    });
    assert.equal(filled.outcome, 'filled');
    assert.equal(filled.snapshot?.phase, 'filled');
    assert.equal(filled.snapshot?.filledOn, monday);
    assert.equal(filled.snapshot?.costAud, 25);
    assert.ok((filled.snapshot?.cashAud ?? 0) > 0);
    assert.equal((filled.snapshot?.positions ?? []).length, 4);
    assert.ok((filled.snapshot?.positions ?? []).every((position) => position.qty > 0));
    assert.ok((filled.snapshot?.trades ?? []).every((trade) => trade.side === 'buy'));
    assert.equal(filled.snapshot?.names.find((name) => name.symbol === 'NTRA')?.call, 'Hold');
  });

  it('keeps the saved week when a price is missing and does not trade', () => {
    const pending = sampleStep();
    assert.ok(pending.snapshot);
    const failed = stepDruck(pending.snapshot, { ...sampleMarket(), errors: ['NTRA did not arrive.'] });
    assert.equal(failed.outcome, 'feed_failed');
    assert.equal(failed.week, null);
    assert.equal(failed.snapshot, pending.snapshot);
    assert.match(failed.banner ?? '', /No new buys/);
    assert.match(failed.banner ?? '', /Nothing is sold/);
    const stale = stepDruck(null, { ...sampleMarket(), liquidityAsOf: '2026-10-01' });
    assert.equal(stale.outcome, 'feed_failed');
    assert.equal(stale.week, null);
  });

  it('uses the red cap after a 15% fall even when only one read fails', () => {
    const started = sampleStep();
    assert.ok(started.snapshot);
    const previous = {
      ...started.snapshot,
      phase: 'filled' as const,
      decisionDate: '2026-11-13',
      filledOn: '2026-11-13',
      cashAud: 80_000,
      investedAud: 0,
      positions: [],
      peakAud: 100_000,
      brakeOn: false,
    };
    const market = sampleMarket();
    market.liquidity = 0.2;
    market.spreadNow = 3;
    market.spreadThen = 3.4;
    const stepped = stepDruck(previous, market);
    assert.equal(stepped.snapshot?.colour, 'amber');
    assert.equal(stepped.snapshot?.brakeOn, true);
    assert.equal(stepped.snapshot?.cap, 0.25);
    const green = sampleMarket();
    green.liquidity = 0.2;
    green.spreadNow = 3;
    green.spreadThen = 3.4;
    const dates = businessDaysEnding('2026-11-20', 260);
    green.prices.SPY = closesFor(dates, 560, 0.05);
    const released = stepDruck({ ...previous, brakeOn: true }, green);
    assert.equal(released.snapshot?.colour, 'green');
    assert.equal(released.snapshot?.brakeOn, false);
    assert.equal(released.snapshot?.cap, 1);
    const invested = (released.snapshot?.names ?? []).reduce((sum, name) => sum + name.targetWeight, 0);
    assert.ok(Math.abs(invested - 0.25) < 1e-9);
  });
});

describe('Druckenmiller page copy', () => {
  it('states the backtest, the paper rule, and the direct call once', () => {
    assert.equal(DRUCK_BACKTEST.top10Cagr, 0.204);
    assert.equal(DRUCK_BACKTEST.top10Worst, -0.36);
    assert.equal(DRUCK_BACKTEST.top10EarlyCagr, 0.126);
    assert.equal(DRUCK_COST, 0.001);
    const panel = sampleDruckPanel();
    assert.equal(panel.caveat, DRUCK_CAVEAT);
    assert.equal((panel.caveat.match(/NOT VALIDATED/g) ?? []).length, 1);
    assert.match(panel.caveat, /20\.4%/);
    assert.match(panel.caveat, /12\.6%/);
    assert.match(panel.caveat, /10–16%/);
    assert.match(panel.caveat, /3–5%/);
    assert.match(panel.paperRule, /Paper only/);
    assert.match(panel.paperRule, /60\/40/);
    assert.match(panel.paperRule, /QQQ/);
    assert.match(panel.cashYield, /4\.85%/);
    assert.match(panel.summary ?? '', /Buy NTRA 7%/);
    assert.match(panel.summary ?? '', /Buy HACK\.AX 8%/);
    assert.match(panel.summary ?? '', /Buy AMZN 5%/);
    assert.match(panel.summary ?? '', /Buy INSM 5%/);
    assert.match(panel.summary ?? '', /75%/);
    assert.match(panel.summary ?? '', /AAA\.AX/);
    assert.match(panel.aside ?? '', /STX/);
    assert.equal(panel.colourId, 'red');
    assert.match(panel.lede, /no shorts/);
    assert.match(panel.record, /two filled weeks/);
    const paused = toDruckPanel({
      status: 'ok',
      snapshot: sampleStep().snapshot,
      banner: 'NTRA did not arrive. Showing the saved week of 20 Nov 2026. No new buys. Nothing is sold just because a feed is down.',
      outcome: 'feed_failed',
    });
    assert.match(paused.banner ?? '', /No new buys/);
    assert.equal(paused.cards.find((card) => card.symbol === 'NTRA')?.call, 'Wait');
    assert.match(paused.cards.find((card) => card.symbol === 'NTRA')?.sentence ?? '', /not sent/);
  });
});

describe('Druckenmiller storage', () => {
  it('stores one week, and a failed feed does not replace it', async () => {
    const db = new PGlite();
    await db.exec(MIGRATION);
    await db.exec(DRUCK_SQL);
    await db.exec(DRUCK_SQL);
    const sql = adapter(db);
    const sample = sampleMarket();
    const first = await runDruckRefresh({
      now: sample.now,
      trigger: 'cron',
      sql,
      market: sample,
    });
    assert.equal(first.outcome, 'saved');
    const stored = await readDruck(sql);
    assert.equal(stored.status, 'ok');
    assert.equal(stored.record?.snapshot?.decisionDate, '2026-11-20');
    assert.equal(stored.record?.bookId, DRUCK_BOOK_ID);
    const weeks = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_druck_week');
    assert.equal(weeks[0].n, '1');
    const failed = await runDruckRefresh({
      now: new Date('2026-11-21T16:00:00.000Z'),
      trigger: 'cron',
      sql,
      market: { ...sample, now: new Date('2026-11-21T16:00:00.000Z'), errors: ['SPY did not arrive.'] },
    });
    assert.equal(failed.outcome, 'feed_failed');
    const again = await readDruck(sql);
    assert.equal(again.record?.snapshot?.decisionDate, '2026-11-20');
    assert.equal(again.record?.attempt.outcome, 'feed_failed');
    const weekCount = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_druck_week');
    assert.equal(weekCount[0].n, '1');
    assert.match(DRUCK_SQL, /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_week/);
    assert.equal(readFileSync('lib/regime/refreshRun.ts', 'utf8').includes('druck'), false);
    assert.equal(readFileSync('lib/regime/audPaper.ts', 'utf8').includes('druck'), false);
    assert.equal(readFileSync('lib/regime/visser.ts', 'utf8').includes('druck'), false);
    assert.match(readFileSync('middleware.ts', 'utf8'), /\/api\/regime\/druck/);
    assert.match(readFileSync('vercel.json', 'utf8'), /\/api\/regime\/druck/);
    assert.match(readFileSync('vercel.json', 'utf8'), /45 22 \* \* 1-5/);
    assert.doesNotMatch(readFileSync('vercel.json', 'utf8'), /visser/);
    assert.equal(readFileSync('components/regime/RegimeDashboard.tsx', 'utf8').includes('VisserPanel'), false);
    assert.equal(readFileSync('components/regime/RegimeDashboard.tsx', 'utf8').includes('PathToBuyPanel'), false);
    assert.equal(readFileSync('components/regime/DruckPanel.tsx', 'utf8').includes('Update basket'), false);
    const retired = retiredBookLines(
      { equity: 100_464, valued: true, asOf: '2026-11-19', nav: 1.0046, decisions: 40 },
      { status: 'ok', decisionDate: '2026-11-13', equityAud: 15_000, sleeveNav: 1 },
    );
    assert.match(retired[0] ?? '', /aud-paper-v1/);
    assert.match(retired[0] ?? '', /100,464/);
    assert.match(retired[0] ?? '', /database/);
    assert.match(retired[1] ?? '', /visser-aud-paper-v1/);
    assert.match(retired[1] ?? '', /15,000/);
    const missing = retiredBookLines(
      { equity: null, valued: false, asOf: null, nav: null, decisions: 0 },
      { status: 'missing_schema', decisionDate: null, equityAud: null, sleeveNav: null },
    );
    assert.match(missing[1] ?? '', /Nothing was deleted/);
    assert.equal(sample.prices[FX_SYMBOL][0].close, 0.65);
  });
});

const SAMPLE_PREMIUM: Record<string, number> = {
  SPY: -0.055,
  'AAA.AX': 0.002,
  NTRA: 0.001,
  'HACK.AX': 0.18,
  AMZN: 0.007,
  INSM: 0.15,
  STX: -0.35,
  WDC: -0.38,
  'GDX.AX': -0.18,
  'SEMI.AX': -0.12,
  SE: -0.22,
  YPF: -0.28,
  EWZ: -0.34,
};

function marketEnding(
  end: string,
  now: Date,
  opts?: { premiums?: Record<string, number>; bumps?: Record<string, number>; extra?: string[] },
): DruckMarket {
  const calendar = businessDaysEnding(end, 260);
  const sample = sampleMarket();
  const prices: DruckMarket['prices'] = {};
  for (const [symbol, bars] of Object.entries(sample.prices)) {
    if (symbol === FX_SYMBOL) {
      prices[symbol] = calendar.map((date) => ({ date, close: 0.65 }));
      continue;
    }
    const last = bars[bars.length - 1].close * (opts?.bumps?.[symbol] ?? 1);
    prices[symbol] = closesFor(calendar, last, opts?.premiums?.[symbol] ?? SAMPLE_PREMIUM[symbol] ?? 0.01);
  }
  for (const date of opts?.extra ?? []) {
    for (const bars of Object.values(prices)) bars.push({ date, close: bars[bars.length - 1].close });
  }
  prices.QQQ = prices.SPY.map((bar) => ({ date: bar.date, close: 400 }));
  prices.IEF = prices.SPY.map((bar) => ({ date: bar.date, close: 95 }));
  return {
    ...sample,
    now,
    prices,
    liquidityAsOf: end,
    spreadAsOf: end,
  };
}

function positionQty(snapshot: DruckSnapshot | null | undefined, id: string): number {
  return snapshot?.positions.find((position) => position.id === id)?.qty ?? 0;
}

describe('Druckenmiller week history', () => {
  it('records a filled week over the pending row and renders 60/40 and QQQ', async () => {
    const db = new PGlite();
    await db.exec(MIGRATION);
    await db.exec(DRUCK_SQL);
    const fillSql = readFileSync('db/regime/005_druck_week_fill.sql', 'utf8');
    await db.exec(fillSql);
    await db.exec(fillSql);
    assert.match(fillSql, /GRANT UPDATE ON TABLE regime_druck_week/);
    assert.doesNotMatch(fillSql, /GRANT DELETE/);
    const base = adapter(db);
    let denyUpdate = true;
    const sql: RegimeSql = {
      query(text, params) {
        if (denyUpdate && text.includes('UPDATE regime_druck_week')) {
          const error = new Error('permission denied for table regime_druck_week') as Error & { code: string };
          error.code = '42501';
          throw error;
        }
        return base.query(text, params);
      },
      transaction: (run) => base.transaction(run),
    };
    const opened = await runDruckRefresh({ now: sampleMarket().now, trigger: 'cron', sql, market: sampleMarket() });
    assert.equal(opened.outcome, 'saved');
    const tuesday = new Date('2026-11-23T22:45:00.000Z');
    const fillMarket = marketEnding('2026-11-20', tuesday, { extra: ['2026-11-23'] });
    const filled = await runDruckRefresh({ now: tuesday, trigger: 'owner', sql, market: fillMarket });
    assert.equal(filled.outcome, 'filled');
    const pendingRow = await sql.query<{ payload: { phase?: string } }>('SELECT payload FROM regime_druck_week');
    assert.equal(pendingRow[0]?.payload.phase, 'pending');
    const live = await readDruck(sql);
    assert.equal(live.record?.snapshot?.phase, 'filled');

    denyUpdate = false;
    const sealed = await runDruckRefresh({ now: tuesday, trigger: 'cron', sql, market: fillMarket });
    assert.equal(sealed.outcome, 'unchanged');
    const weekRows = await sql.query<{ payload: DruckSnapshot }>('SELECT payload FROM regime_druck_week ORDER BY decision_date');
    assert.equal(weekRows[0]?.payload.phase, 'filled');
    assert.ok((weekRows[0]?.payload.trades.length ?? 0) >= 4);
    assert.ok((weekRows[0]?.payload.nav ?? 0) > 0);
    assert.equal(weekRows[0]?.payload.benchmarks?.qqq, 400);
    assert.ok((weekRows[0]?.payload.benchmarks?.spy ?? 0) > 0);
    assert.equal(weekRows[0]?.payload.benchmarks?.ief, 95);

    const secondNow = new Date('2026-11-30T22:45:00.000Z');
    const second = await runDruckRefresh({
      now: secondNow,
      trigger: 'cron',
      sql,
      market: marketEnding('2026-11-27', secondNow, { extra: ['2026-11-30'] }),
    });
    assert.equal(second.outcome, 'filled');
    const weeks = await readDruckWeeks(sql);
    assert.equal(weeks.filter((week) => week.phase === 'filled').length, 2);
    const panel = toDruckPanel({
      status: 'ok',
      snapshot: (await readDruck(sql)).record?.snapshot ?? null,
      banner: null,
      outcome: 'filled',
      weeks,
    });
    assert.match(panel.record, /Book [+-]/);
    assert.match(panel.record, /60\/40 [+-]/);
    assert.match(panel.record, /QQQ [+-]/);
    assert.doesNotMatch(panel.record, /needs two filled weeks/);
    assert.doesNotMatch(panel.record, /not priced/);
  });

  it('loads a book saved before the candidate list had its own version', async () => {
    const db = new PGlite();
    await db.exec(MIGRATION);
    await db.exec(DRUCK_SQL);
    const sql = adapter(db);
    const snapshot = structuredClone(sampleStep().snapshot) as DruckSnapshot;
    delete snapshot.listVersion;
    delete snapshot.benchmarks;
    const record = {
      ruleVersion: DRUCK_RULE,
      bookId: DRUCK_BOOK_ID,
      updatedAt: '2026-11-21T15:00:00.000Z',
      attempt: { at: '2026-11-21T15:00:00.000Z', outcome: 'saved', errors: [], banner: null },
      snapshot,
    };
    await sql.query('INSERT INTO regime_druck (id, payload) VALUES (1, $1::jsonb)', [JSON.stringify(record)]);
    const oldWeek = { ...snapshot, listVersion: '2026-08', phase: 'filled' as const, nav: 1.01 };
    await sql.query(
      'INSERT INTO regime_druck_week (rule_version, decision_date, payload) VALUES ($1, $2::date, $3::jsonb)',
      [DRUCK_RULE, snapshot.decisionDate, JSON.stringify(oldWeek)],
    );
    const stored = await readDruck(sql);
    assert.equal(stored.status, 'ok');
    assert.equal(stored.record?.snapshot?.decisionDate, '2026-11-20');
    assert.equal(stored.record?.snapshot?.listVersion, undefined);
    assert.notEqual(DRUCK_LIST, '2026-08');
    const weeks = await readDruckWeeks(sql);
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0]?.listVersion, '2026-08');
    assert.equal(parseDruckRecord({ ...record, ruleVersion: 'DRUCK-OTHER' }), null);
  });
});

describe('Druckenmiller stretch trim', () => {
  it('sells half once while the price stays extended, then again after it dips', () => {
    const opened = stepDruck(null, sampleMarket());
    const first = stepDruck(opened.snapshot, marketEnding('2026-11-20', new Date('2026-11-23T22:45:00.000Z'), { extra: ['2026-11-23'] }));
    assert.equal(first.outcome, 'filled');
    const startQty = positionQty(first.snapshot, 'ntra');
    assert.ok(startQty > 0);

    const hot = { premiums: { NTRA: 0.7 } };
    const trim = stepDruck(first.snapshot, marketEnding('2026-11-27', new Date('2026-11-30T22:45:00.000Z'), { ...hot, extra: ['2026-11-30'] }));
    assert.equal(trim.outcome, 'filled');
    assert.equal(trim.snapshot?.trades.some((trade) => trade.symbol === 'NTRA' && trade.side === 'sell'), true);
    const halved = positionQty(trim.snapshot, 'ntra');
    assert.ok(Math.abs(halved - startQty / 2) / startQty < 0.05);
    assert.equal(trim.snapshot?.positions.find((position) => position.id === 'ntra')?.extensionTrimmed, true);

    const held = stepDruck(trim.snapshot, marketEnding('2026-12-04', new Date('2026-12-07T22:45:00.000Z'), { ...hot, extra: ['2026-12-07'] }));
    assert.equal(held.outcome, 'filled');
    assert.equal(held.snapshot?.trades.some((trade) => trade.symbol === 'NTRA' && trade.side === 'sell'), false);
    assert.ok(Math.abs(positionQty(held.snapshot, 'ntra') - halved) / halved < 0.02);
    assert.equal(held.snapshot?.positions.find((position) => position.id === 'ntra')?.extensionTrimmed, true);

    const cool = stepDruck(held.snapshot, marketEnding('2026-12-11', new Date('2026-12-14T22:45:00.000Z'), { premiums: { NTRA: 0.2 }, extra: ['2026-12-14'] }));
    assert.equal(cool.outcome, 'filled');
    assert.equal(cool.snapshot?.positions.find((position) => position.id === 'ntra')?.extensionTrimmed, false);
    const cooledQty = positionQty(cool.snapshot, 'ntra');

    const again = stepDruck(cool.snapshot, marketEnding('2026-12-18', new Date('2026-12-21T22:45:00.000Z'), { ...hot, extra: ['2026-12-21'] }));
    assert.equal(again.outcome, 'filled');
    assert.equal(again.snapshot?.trades.some((trade) => trade.symbol === 'NTRA' && trade.side === 'sell'), true);
    assert.ok(Math.abs(positionQty(again.snapshot, 'ntra') - cooledQty / 2) / cooledQty < 0.05);
    assert.equal(again.snapshot?.positions.find((position) => position.id === 'ntra')?.extensionTrimmed, true);
  });
});

describe('Druckenmiller session close', () => {
  it('fills the 20 Nov week at the Monday close on Tuesday morning, and not at a live bar', () => {
    const opened = stepDruck(null, sampleMarket());
    assert.equal(opened.snapshot?.phase, 'pending');
    assert.equal(opened.snapshot?.decisionDate, '2026-11-20');

    const liveMonday = new Date('2026-11-23T20:00:00.000Z');
    assert.equal(sessionHasClosed('2026-11-23', 'SPY', liveMonday), false);
    const early = stepDruck(opened.snapshot, marketEnding('2026-11-20', liveMonday, { extra: ['2026-11-23'] }));
    assert.notEqual(early.outcome, 'filled');
    assert.equal(early.snapshot?.phase, 'pending');

    const tuesday = new Date('2026-11-23T22:45:00.000Z');
    assert.equal(sessionHasClosed('2026-11-23', 'SPY', tuesday), true);
    assert.equal(sessionHasClosed('2026-11-24', 'HACK.AX', tuesday), false);
    const ready = marketEnding('2026-11-20', tuesday, { extra: ['2026-11-23'] });
    ready.prices['HACK.AX'].push({ date: '2026-11-24', close: 99 });
    const filled = stepDruck(opened.snapshot, ready);
    assert.equal(filled.outcome, 'filled');
    assert.equal(filled.snapshot?.filledOn, '2026-11-23');
    const hack = filled.snapshot?.trades.find((trade) => trade.symbol === 'HACK.AX');
    assert.ok(hack);
    assert.ok(Math.abs((hack?.priceAud ?? 0) - 18.26) < 0.01);

    const missingMonday = marketEnding('2026-11-20', tuesday, { extra: ['2026-11-23'] });
    missingMonday.prices['HACK.AX'] = missingMonday.prices['HACK.AX'].filter((bar) => bar.date !== '2026-11-23');
    missingMonday.prices['HACK.AX'].push({ date: '2026-11-24', close: 99 });
    const refused = stepDruck(opened.snapshot, missingMonday);
    assert.notEqual(refused.outcome, 'filled');
    assert.equal(refused.snapshot?.trades.some((trade) => trade.priceAud === 99), false);
  });
});

describe('Druckenmiller book value', () => {
  it('keeps the gain when the next week fills after a missed fill', () => {
    const opened = stepDruck(null, sampleMarket());
    const first = stepDruck(opened.snapshot, marketEnding('2026-11-20', new Date('2026-11-23T22:45:00.000Z'), { extra: ['2026-11-23'] }));
    assert.equal(first.outcome, 'filled');
    assert.ok(first.snapshot);
    const bumps = { NTRA: 1.4, 'HACK.AX': 1.4, AMZN: 1.4, INSM: 1.4 };
    const skipped = stepDruck(first.snapshot, marketEnding('2026-11-27', new Date('2026-11-28T04:00:00.000Z'), { bumps }));
    assert.equal(skipped.outcome, 'saved');
    assert.equal(skipped.snapshot?.phase, 'pending');
    assert.equal(skipped.snapshot?.decisionDate, '2026-11-27');
    const marked = (skipped.snapshot?.cashAud ?? 0) + (skipped.snapshot?.investedAud ?? 0);
    const base = first.snapshot.cashAud + first.snapshot.investedAud;
    const gain = marked / base;
    assert.ok(gain > 1.05);

    const next = stepDruck(skipped.snapshot, marketEnding('2026-12-04', new Date('2026-12-07T22:45:00.000Z'), { bumps, extra: ['2026-12-07'] }));
    assert.equal(next.outcome, 'filled');
    assert.ok(next.snapshot);
    assert.ok(next.snapshot.nav > first.snapshot.nav * 1.05);
    assert.ok(Math.abs(next.snapshot.nav / first.snapshot.nav - gain) < 0.03);
  });
});

describe('Druckenmiller benchmark feed', () => {
  it('does not block the book when QQQ is missing', async () => {
    const market = await loadDruckMarket({
      now: new Date('2026-11-21T15:00:00.000Z'),
      symbols: ['SPY'],
      optionalSymbols: ['QQQ'],
      liquidity: { z: 0.2, asOf: '2026-11-20', error: null },
      fetchBars: async (symbol) => {
        if (symbol === 'QQQ') return { bars: [], error: 'QQQ returned no prices' };
        return { bars: [{ date: '2026-11-20', close: 560 }], error: null };
      },
      fetchSpreads: async () => [
        { date: '2026-08-20', value: 3 },
        { date: '2026-11-20', value: 3.1 },
      ],
    });
    assert.equal(market.errors.some((error) => error.includes('QQQ')), false);
    assert.equal(market.prices.SPY.length, 1);
    assert.deepEqual(market.prices.QQQ, []);
  });
});
