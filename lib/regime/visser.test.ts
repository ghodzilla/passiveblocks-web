import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { runVisserRefresh } from './visserRefresh';
import { readVisser } from './visserStore';
import {
  VISSER_BACKTEST,
  VISSER_CAVEAT,
  VISSER_SLEEVES,
  ageDays,
  alignToCalendar,
  businessDaysEnding,
  decisionSession,
  newYorkClock,
  sampleMarket,
  sampleStep,
  satelliteShare,
  signalAt,
  sleeveCall,
  stepVisser,
  weekEndingSunday,
  type CloseBar,
  type VisserMarket,
} from './visser';
import { sampleVisserPanel, toVisserPanel, visserCallsMatchBook } from './visserPresent';

const MIGRATION = readFileSync('db/regime/001_durable_state.sql', 'utf8');
const VISSER_SQL = readFileSync('db/regime/003_visser_snapshots.sql', 'utf8');

function flat(values: number[]): (number | null)[] {
  return values;
}

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

describe('VS1 signals', () => {
  it('keeps the published weights at or under 100 percent and caps bitcoin at 20 percent', () => {
    const sum = VISSER_SLEEVES.reduce((total, sleeve) => total + sleeve.base, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(VISSER_SLEEVES.find((sleeve) => sleeve.id === 'bitcoin')?.base, 0.2);
    assert.ok(VISSER_SLEEVES.every((sleeve) => sleeve.base <= 0.2 || sleeve.id === 'chips'));
  });

  it('matches the strict research thresholds', () => {
    const calm = flat(Array.from({ length: 221 }, () => 100));
    calm[220] = 130;
    const full = signalAt(calm, 220, 0.35);
    assert.equal(full.above200, true);
    assert.equal(full.rising, true);
    assert.equal(full.hot, false);
    assert.equal(full.weight, 0.35);

    const equalMa = flat(Array.from({ length: 221 }, () => 100));
    const onTheLine = signalAt(equalMa, 220, 0.35);
    assert.equal(onTheLine.above200, false);
    assert.equal(onTheLine.rising, false);
    assert.equal(onTheLine.weight, 0);

    const gain = flat(Array.from({ length: 221 }, () => 100));
    gain[170] = 100;
    gain[220] = 150;
    const exactGain = signalAt(gain, 220, 0.2);
    assert.ok(Math.abs((exactGain.roc50 ?? 0) - 0.5) < 1e-12);
    assert.equal(exactGain.hot, false);

    gain[220] = 160;
    const hotGain = signalAt(gain, 220, 0.2);
    assert.equal(hotGain.hot, true);
    assert.equal(hotGain.weight, 0.1);

    const extension = flat(Array.from({ length: 221 }, () => 100));
    const base = signalAt(extension, 219, 0.2);
    extension[220] = (base.ma200 ?? 100) * 1.6;
    const exactExtension = signalAt(extension, 220, 0.2);
    assert.ok((exactExtension.premium ?? 0) <= 0.6 + 0.01);
    extension[220] = (signalAt(flat(Array.from({ length: 221 }, () => 100)), 220, 0.2).ma200 ?? 100) * 2;
    const hotExtension = signalAt(extension, 220, 0.2);
    assert.equal(hotExtension.hot, true);
    assert.equal(hotExtension.eligible, true);
    assert.equal(hotExtension.weight, 0.1);
  });

  it('samples bitcoin on the equity calendar and ignores a later weekend print', () => {
    const calendar = ['2026-11-19', '2026-11-20'];
    const aligned = alignToCalendar([
      { date: '2026-11-19', close: 10 },
      { date: '2026-11-21', close: 99 },
    ], calendar);
    assert.deepEqual(aligned, [10, 10]);
  });

  it('decides on the week-ending US session only after that close', () => {
    const calendar = businessDaysEnding('2026-11-20', 15);
    assert.equal(calendar[calendar.length - 1], '2026-11-20');
    assert.equal(weekEndingSunday('2026-11-20'), '2026-11-22');
    assert.equal(decisionSession(calendar, new Date('2026-11-20T20:00:00.000Z')), '2026-11-13');
    assert.equal(decisionSession(calendar, new Date('2026-11-20T21:05:00.000Z')), '2026-11-20');
    assert.equal(newYorkClock(new Date('2026-11-20T21:05:00.000Z')).minutes >= 16 * 60, true);
    assert.equal(decisionSession(calendar, new Date('2026-11-21T15:00:00.000Z')), '2026-11-20');
    const holiday = calendar.filter((day) => day !== '2026-11-20');
    assert.equal(decisionSession(holiday, new Date('2026-11-20T21:05:00.000Z')), '2026-11-13');
    assert.equal(decisionSession(holiday, new Date('2026-11-21T15:00:00.000Z')), '2026-11-19');
  });

  it('clamps the sleeve to 10–20 percent', () => {
    assert.equal(satelliteShare(undefined).share, 0.15);
    assert.equal(satelliteShare('12').share, 0.12);
    assert.equal(satelliteShare('0.18').share, 0.18);
    assert.equal(satelliteShare('0.05').share, 0.1);
    assert.equal(satelliteShare('40').share, 0.2);
  });
});

describe('VS1 calls and the paper sleeve', () => {
  it('shows buy, trim, hold, sell, and wait against the held sleeve', () => {
    const step = sampleStep();
    assert.equal(step.outcome, 'saved');
    assert.equal(step.snapshot?.phase, 'pending');
    assert.equal(step.snapshot?.decisionDate, '2026-11-20');
    assert.equal(step.snapshot?.bookId, 'visser-aud-paper-v1');
    assert.equal(step.snapshot?.budgetAud, 15_000);
    const calls = Object.fromEntries((step.snapshot?.sleeves ?? []).map((sleeve) => [sleeve.id, sleeve.call]));
    assert.deepEqual(calls, {
      chips: 'Buy',
      nasdaq: 'Trim',
      bitcoin: 'Wait',
      gold: 'Hold',
      silver: 'Sell',
    });
    const chips = step.snapshot?.sleeves.find((sleeve) => sleeve.id === 'chips');
    const nasdaq = step.snapshot?.sleeves.find((sleeve) => sleeve.id === 'nasdaq');
    assert.equal(chips?.targetAud, 5250);
    assert.equal(chips?.targetWeight, 0.35);
    assert.equal(nasdaq?.targetWeight, 0.075);
    assert.equal(nasdaq?.hot, true);
    const invested = (step.snapshot?.sleeves ?? []).reduce((total, sleeve) => total + sleeve.targetWeight, 0);
    assert.ok(invested <= 1);
    assert.equal(step.snapshot && visserCallsMatchBook(step.snapshot), true);
    assert.equal(sleeveCall(0, 0, 15_000), 'Wait');
  });

  it('fills at the next close and then holds, without borrowing', () => {
    const sample = sampleMarket();
    const pending = stepVisser(sample.previous, sample.market, sample.portfolio, 0.15);
    assert.ok(pending.snapshot);
    const monday = '2026-11-23';
    const extend = (bars: CloseBar[], close: number): CloseBar[] => bars.concat([{ date: monday, close }]);
    const market: VisserMarket = {
      now: new Date('2026-11-24T15:00:00.000Z'),
      signals: {
        chips: extend(sample.market.signals.chips, 90),
        nasdaq: extend(sample.market.signals.nasdaq, sample.market.signals.nasdaq[sample.market.signals.nasdaq.length - 1].close),
        bitcoin: extend(sample.market.signals.bitcoin, 40),
        gold: extend(sample.market.signals.gold, 90),
        silver: extend(sample.market.signals.silver, 40),
      },
      tradables: {
        chips: extend(sample.market.tradables.chips, 30),
        nasdaq: extend(sample.market.tradables.nasdaq, 57),
        bitcoin: extend(sample.market.tradables.bitcoin, 19),
        gold: extend(sample.market.tradables.gold, 48),
        silver: extend(sample.market.tradables.silver, 60),
      },
      errors: [],
    };
    const filled = stepVisser(pending.snapshot, market, sample.portfolio, 0.15);
    assert.equal(filled.outcome, 'filled');
    assert.equal(filled.week, null);
    assert.equal(filled.snapshot?.phase, 'filled');
    assert.equal(filled.snapshot?.actionDate, monday);
    const calls = Object.fromEntries((filled.snapshot?.sleeves ?? []).map((sleeve) => [sleeve.id, sleeve.call]));
    assert.deepEqual(calls, {
      chips: 'Hold',
      nasdaq: 'Hold',
      bitcoin: 'Wait',
      gold: 'Hold',
      silver: 'Wait',
    });
    assert.ok((filled.snapshot?.cashAud ?? 0) >= 0);
    const qty = (filled.snapshot?.positions ?? []).reduce((total, position) => total + position.qty, 0);
    assert.ok(qty > 0);
    assert.equal((filled.snapshot?.positions ?? []).some((position) => position.sleeve === 'silver'), false);
    assert.equal((filled.snapshot?.positions ?? []).some((position) => position.sleeve === 'bitcoin'), false);
    const bought = filled.snapshot?.trades.find((trade) => trade.sleeve === 'chips');
    assert.equal(bought?.side, 'buy');
    assert.equal(bought?.symbol, 'SEMI.AX');
    assert.ok((filled.snapshot?.costAud ?? 0) > 0);
  });

  it('keeps the previous week when a required price is missing and does not trade', () => {
    const pending = sampleStep();
    assert.ok(pending.snapshot);
    const broken: VisserMarket = {
      ...sampleMarket().market,
      errors: ['SMH did not arrive.'],
    };
    const failed = stepVisser(pending.snapshot, broken, { aud: 100_000, basis: 'starting amount' }, 0.15);
    assert.equal(failed.outcome, 'feed_failed');
    assert.equal(failed.week, null);
    assert.equal(failed.snapshot, pending.snapshot);
    assert.match(failed.banner ?? '', /No new buys/);
    assert.match(failed.banner ?? '', /not being forced|Nothing is sold/);
    const again = stepVisser(pending.snapshot, { ...broken, errors: ['SEMI.AX did not arrive.'] }, { aud: 100_000, basis: 'starting amount' }, 0.15);
    assert.equal(again.snapshot?.positions.length, pending.snapshot.positions.length);
    assert.equal(again.snapshot?.cashAud, pending.snapshot.cashAud);
  });

  it('does not replace a missed fill with a late trade once the next week exists', () => {
    const sample = sampleMarket();
    const pending = stepVisser(sample.previous, sample.market, sample.portfolio, 0.15);
    assert.equal(pending.snapshot?.phase, 'pending');
    const laterDays = businessDaysEnding('2026-11-27', 270);
    const repeat = (bars: CloseBar[]): CloseBar[] => {
      const last = bars[bars.length - 1].close;
      return laterDays.map((date, index) => bars[index] ? { date, close: bars[Math.min(index, bars.length - 1)].close } : { date, close: last });
    };
    const market: VisserMarket = {
      now: new Date('2026-11-28T15:00:00.000Z'),
      signals: {
        chips: repeat(sample.market.signals.chips),
        nasdaq: repeat(sample.market.signals.nasdaq),
        bitcoin: repeat(sample.market.signals.bitcoin),
        gold: repeat(sample.market.signals.gold),
        silver: repeat(sample.market.signals.silver),
      },
      tradables: {
        chips: repeat(sample.market.tradables.chips),
        nasdaq: repeat(sample.market.tradables.nasdaq),
        bitcoin: repeat(sample.market.tradables.bitcoin),
        gold: repeat(sample.market.tradables.gold),
        silver: repeat(sample.market.tradables.silver),
      },
      errors: [],
    };
    const next = stepVisser(pending.snapshot, market, sample.portfolio, 0.15);
    assert.equal(next.snapshot?.decisionDate, '2026-11-27');
    assert.equal(next.snapshot?.skippedFill, '2026-11-20');
    assert.equal(next.snapshot?.positions.length, pending.snapshot?.positions.length);
    assert.equal(next.week?.phase, 'pending');
  });
});

describe('Visser page copy', () => {
  it('uses the attached backtest figures once, including the hindsight note', () => {
    assert.equal(VISSER_BACKTEST.usdCagr2005, 0.141);
    assert.equal(VISSER_BACKTEST.usdWorstFall, -0.23);
    assert.equal(VISSER_BACKTEST.usdCagr2015, 0.223);
    assert.equal(VISSER_BACKTEST.audCagr2015, 0.245);
    assert.equal(VISSER_BACKTEST.usdNoBitcoin2015, 0.129);
    assert.equal(VISSER_BACKTEST.usdCagr2005to2014, 0.051);
    const panel = sampleVisserPanel();
    assert.equal(panel.caveat, VISSER_CAVEAT);
    assert.match(panel.paperRule, /Paper only/);
    assert.match(panel.paperRule, /QQQ/);
    assert.match(panel.frozen, /frozen/);
    assert.match(panel.record, /No week is saved yet/);
    assert.match(panel.cashYield, /4\.85%/);
    assert.match(panel.cashYield, /Tax and franking/);
    assert.equal(panel.cards.map((card) => card.call).join(','), 'Buy,Trim,Wait,Hold,Sell');
    assert.match(panel.summary ?? '', /Buy Chips/);
    assert.match(panel.summary ?? '', /5,250/);
    assert.match(panel.stats.map((stat) => stat.value).join(' '), /14\.1%/);
    assert.match(panel.stats.map((stat) => stat.value).join(' '), /22\.3%/);
    assert.match(panel.stats.map((stat) => stat.value).join(' '), /24\.5%/);
    assert.match(panel.stats.map((stat) => stat.value).join(' '), /12\.9%/);
    assert.match(panel.stats.map((stat) => stat.value).join(' '), /5\.1%/);
    assert.match(panel.audHistory, /15\.0%/);
    assert.match(panel.audHistory, /36%/);
    const paused = toVisserPanel({
      status: 'ok',
      snapshot: sampleStep().snapshot,
      banner: 'SMH did not arrive. Showing the saved week of 20 Nov 2026. No new buys. Nothing is sold just because a feed is down.',
      outcome: 'feed_failed',
      shareNote: null,
    });
    assert.equal(paused.banner?.includes('No new buys'), true);
    assert.equal(paused.cards.find((card) => card.id === 'chips')?.call, 'Wait');
    assert.match(paused.cards.find((card) => card.id === 'chips')?.sentence ?? '', /not sent/);
    assert.equal(paused.cards.find((card) => card.id === 'silver')?.call, 'Hold');
    assert.match(paused.cards.find((card) => card.id === 'silver')?.sentence ?? '', /not being forced/);
    assert.equal((panel.caveat.match(/NOT VALIDATED/g) ?? []).length, 1);
  });
});

describe('Visser storage', () => {
  it('stores one week, and a failed feed does not replace it or the sleeve', async () => {
    const db = new PGlite();
    await db.exec(MIGRATION);
    await db.exec(VISSER_SQL);
    await db.exec(VISSER_SQL);
    const sql = adapter(db);
    const sample = sampleMarket();
    const first = await runVisserRefresh({
      now: sample.market.now,
      trigger: 'cron',
      sql,
      market: sample.market,
    });
    assert.equal(first.outcome, 'saved');
    const stored = await readVisser(sql);
    assert.equal(stored.status, 'ok');
    assert.equal(stored.record?.snapshot?.decisionDate, '2026-11-20');
    const weeks = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_visser_week');
    assert.equal(weeks[0].n, '1');
    const positions = stored.record?.snapshot?.positions.map((position) => position.qty).join(',');
    const failed = await runVisserRefresh({
      now: new Date('2026-11-21T16:00:00.000Z'),
      trigger: 'cron',
      sql,
      market: { ...sample.market, now: new Date('2026-11-21T16:00:00.000Z'), errors: ['QQQ did not arrive.'] },
    });
    assert.equal(failed.outcome, 'feed_failed');
    const again = await readVisser(sql);
    assert.equal(again.record?.snapshot?.decisionDate, '2026-11-20');
    assert.equal(again.record?.snapshot?.positions.map((position) => position.qty).join(','), positions);
    assert.equal(again.record?.attempt.outcome, 'feed_failed');
    const weekCount = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_visser_week');
    assert.equal(weekCount[0].n, '1');
    assert.match(readFileSync('db/regime/003_visser_snapshots.sql', 'utf8'), /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_visser_week/);
    assert.equal(readFileSync('lib/regime/refreshRun.ts', 'utf8').includes('visser'), false);
    assert.equal(readFileSync('lib/regime/audPaper.ts', 'utf8').includes('visser'), false);
    assert.match(readFileSync('middleware.ts', 'utf8'), /\/api\/regime\/visser/);
    assert.match(readFileSync('vercel.json', 'utf8'), /\/api\/regime\/visser/);
    assert.equal(ageDays('2026-11-20', '2026-11-21'), 1);
  });
});
