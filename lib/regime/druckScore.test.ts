import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { DRUCK_RULE } from './druck.config';
import { sampleMarket, sampleStep, type CloseBar } from './druck';
import { runDruckRefresh } from './druckRefresh';
import { addDays, actionExcess, actionHit, bookFromPrices, decisionCallsOf, presentScorecard, scoreCall, type StoredCall } from './druckScore';
import { readCallsAndScores } from './druckContextStore';

const WEEK_SQL = readFileSync('db/regime/004_druck_snapshots.sql', 'utf8');
const CONTEXT_SQL = readFileSync('db/regime/006_druck_context.sql', 'utf8');

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

function flat(symbol: string, start: string, count: number, closeAt: (index: number, date: string) => number): CloseBar[] {
  const bars: CloseBar[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(start, i);
    bars.push({ date, close: closeAt(i, date) });
  }
  return bars;
}

describe('call scorecard', () => {
  it('keeps the action and the price from the decision after a fill changes the card', () => {
    const step = sampleStep();
    const snapshot = step.snapshot;
    assert.ok(snapshot?.decisionCalls?.length);
    const ntra = snapshot.names.find((name) => name.symbol === 'NTRA');
    const recorded = snapshot.decisionCalls?.find((call) => call.symbol === 'NTRA');
    assert.equal(recorded?.action, ntra?.call);
    assert.equal(recorded?.priceAud, ntra?.priceAud);
    const filled = {
      ...snapshot,
      phase: 'filled' as const,
      names: snapshot.names.map((name) => name.symbol === 'NTRA' ? { ...name, call: 'Hold' as const, priceAud: name.priceAud + 5 } : name),
    };
    const kept = decisionCallsOf(filled).find((call) => call.symbol === 'NTRA');
    assert.equal(kept?.action, ntra?.call);
    assert.equal(kept?.priceAud, ntra?.priceAud);
    assert.equal(decisionCallsOf({ ...snapshot, decisionCalls: undefined, phase: 'filled' }).length, 0);
  });

  it('scores a buy that beat SPY as a hit, and a sell of a winner as a miss', () => {
    assert.equal(actionHit('Buy', 0.1, 0.02), true);
    assert.equal(actionHit('Hold', 0.01, 0.02), false);
    assert.equal(actionHit('Sell', 0.1, 0.02), false);
    assert.equal(actionHit('Wait', -0.05, 0.01), true);
    assert.equal(actionHit('Trim', 0, 0), false);
    assert.ok(actionExcess('Wait', -0.04, 0.02) > 0);
  });

  it('uses the close on or after 4 weeks, not an earlier jump, and waits when that close is missing', () => {
    const decision = '2026-01-05';
    const due = addDays(decision, 28);
    assert.equal(due, '2026-02-02');
    const prices: Record<string, CloseBar[]> = {
      'HACK.AX': flat('HACK.AX', '2025-12-01', 80, (_i, date) => (date === due ? 110 : date < due ? 200 : 110)),
      SPY: flat('SPY', '2025-12-01', 80, () => 500),
      'AAA.AX': flat('AAA.AX', '2025-12-01', 80, () => 50),
      'AUDUSD=X': flat('AUDUSD=X', '2025-12-01', 80, () => 0.65),
    };
    const spyDue = prices.SPY.find((bar) => bar.date === due);
    assert.ok(spyDue);
    spyDue.close = 510;
    const call: StoredCall = {
      decisionDate: decision,
      nameId: 'hack',
      symbol: 'HACK.AX',
      action: 'Buy',
      priceAud: 100,
      priceLocal: 100,
    };
    const score = scoreCall(call, 4, bookFromPrices(prices));
    assert.ok(score);
    assert.equal(score.scoredOn, due);
    assert.ok(Math.abs(score.nameReturn - 0.1) < 1e-9);
    assert.ok(Math.abs(score.spyReturn - 0.02) < 1e-9);
    assert.equal(score.hit, true);
    const early = flat('HACK.AX', '2025-12-01', 40, () => 150);
    const tooSoon = scoreCall(call, 4, bookFromPrices({ ...prices, 'HACK.AX': early.filter((bar) => bar.date < due) }));
    assert.equal(tooSoon, null);
    const late = prices['HACK.AX'].filter((bar) => bar.date < due || bar.date > addDays(due, 11));
    assert.equal(scoreCall(call, 4, bookFromPrices({ ...prices, 'HACK.AX': late })), null);
  });

  it('says nothing has been scored until a call is old enough', () => {
    const empty = presentScorecard({ status: 'empty', calls: [], scores: [] });
    assert.match(empty.empty ?? '', /No call has been scored yet/);
    assert.match(empty.empty ?? '', /4 weeks/);
    assert.match(empty.empty ?? '', /12 weeks/);
    assert.match(empty.empty ?? '', /AAA\.AX/);
    assert.equal(empty.rows.length, 0);
    const waiting = presentScorecard({
      status: 'ok',
      calls: [{ decisionDate: '2026-11-20', nameId: 'ntra', symbol: 'NTRA', action: 'Buy', priceAud: 1, priceLocal: 1 }],
      scores: [],
    });
    assert.match(waiting.empty ?? '', /None are 4 weeks old/);
    assert.match(presentScorecard({ status: 'missing_schema', calls: [], scores: [] }).empty ?? '', /006_druck_context\.sql/);
    const shown = presentScorecard({
      status: 'ok',
      calls: [],
      scores: [{
        decisionDate: '2026-08-14', nameId: 'ntra', symbol: 'NTRA', action: 'Buy', horizonWeeks: 4,
        scoredOn: '2026-09-11', nameReturn: 0.08, spyReturn: 0.02, aaaReturn: 0, excessSpy: 0.06, excessAaa: 0.08, hit: true,
      }],
    });
    assert.equal(shown.empty, null);
    assert.match(shown.rows[0]?.hitRate ?? '', /100% of 1/);
    assert.equal(shown.rows[0]?.caution, 'Too few to trust.');
    assert.match(shown.footnote, /does not validate/);
  });

  it('records each decision once, and a missing context table does not drop the week', async () => {
    const db = new PGlite();
    await db.exec(WEEK_SQL);
    await db.exec(CONTEXT_SQL);
    await db.exec(CONTEXT_SQL);
    const sql = adapter(db);
    const market = sampleMarket();
    const sample = sampleStep();
    assert.equal(sample.outcome, 'saved');
    const first = await runDruckRefresh({ now: market.now, trigger: 'cron', sql, market });
    assert.equal(first.outcome, 'saved');
    const stored = await readCallsAndScores(sql);
    const names = sample.snapshot?.names.length ?? 0;
    assert.equal(stored.calls.length, names);
    const ntra = stored.calls.find((call) => call.symbol === 'NTRA');
    assert.equal(ntra?.action, 'Buy');
    assert.ok((ntra?.priceAud ?? 0) > 0);
    const again = await runDruckRefresh({ now: new Date('2026-11-21T16:00:00.000Z'), trigger: 'owner', sql, market: sampleMarket() });
    assert.equal(again.outcome, 'unchanged');
    const second = await readCallsAndScores(sql);
    assert.equal(second.calls.length, names);
    assert.equal(second.scores.length, 0);
    const bare = new PGlite();
    await bare.exec(WEEK_SQL);
    const bareSql = adapter(bare);
    const without = await runDruckRefresh({
      now: new Date('2026-11-21T15:00:00.000Z'),
      trigger: 'cron',
      sql: bareSql,
      market: sampleMarket(),
    });
    assert.equal(without.outcome, 'saved');
    assert.match(CONTEXT_SQL, /REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_druck_call /);
    assert.equal(DRUCK_RULE, 'DRUCK-2026-11-21');
  });
});
