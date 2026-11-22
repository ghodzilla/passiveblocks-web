import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { sampleStep } from './druck';
import { toControlRoom } from './controlRoom';
import { sampleContext } from './previewFixture';
import {
  EARNINGS_FLAG,
  earningsCopy,
  earningsFresh,
  parseEarningsPayload,
  type EarningsCheck,
} from './druckEarnings';
import { readEarningsRows, writeEarnings } from './druckContextStore';
import { refreshEarnings } from './druckContext';

const SQL = readFileSync('db/regime/006_druck_context.sql', 'utf8');

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

const NTRA = {
  quoteSummary: {
    result: [{
      calendarEvents: { earnings: { earningsDate: [{ raw: 1793912400, fmt: '2026-11-05' }] } },
      earningsHistory: {
        history: [{
          epsActual: { raw: -0.42 },
          epsEstimate: { raw: -0.28 },
          surprisePercent: { raw: -0.4916, fmt: '-49.16%' },
          quarter: { fmt: '2026-09-30' },
        }],
      },
      earnings: { financialsChart: { quarterly: [{ revenue: { raw: 793981000 } }] } },
      earningsTrend: { trend: [{ period: '0q', epsTrend: { current: { raw: -0.15 }, '90daysAgo': { raw: -0.07 } } }] },
    }],
    error: null,
  },
};

describe('earnings check', () => {
  it('reads the last quarter and leaves revenue consensus as n/a', () => {
    const check = parseEarningsPayload('NTRA', NTRA, '2026-11-22T00:00:00.000Z');
    assert.equal(check.error, null);
    assert.equal(check.nextDate, '2026-11-05');
    assert.equal(check.epsActual, -0.42);
    assert.equal(check.epsEstimate, -0.28);
    assert.equal(check.epsSurprise, '−49.16%');
    assert.equal(check.revenueActual, 793981000);
    assert.equal(check.revenueEstimate, null);
    assert.equal(check.revenueSurprise, null);
    assert.equal(check.revision, 'down');
    const copy = earningsCopy(check, '2026-11-22');
    assert.match(copy.next, /n\/a/);
    assert.match(copy.next, /5 Nov 2026/);
    assert.equal(copy.flag, null);
    assert.match(copy.eps, /-0\.42/);
    assert.match(copy.eps, /-0\.28/);
    assert.match(copy.revenue, /n\/a/);
    assert.match(copy.revenue, /US\$794m/);
    assert.match(copy.revision, /revised down/);
    const upcoming = earningsCopy({ ...check, nextDate: '2026-11-26' }, '2026-11-21');
    assert.equal(upcoming.flag, EARNINGS_FLAG);
    assert.match(upcoming.next, /26 Nov 2026/);
  });

  it('prints n/a when the source has no fundamentals or a field is missing', () => {
    const missing = parseEarningsPayload('HACK.AX', { quoteSummary: { result: null, error: { code: 'Not Found' } } }, '2026-11-22T00:00:00.000Z');
    assert.equal(missing.unavailable, true);
    assert.equal(missing.error, null);
    assert.equal(missing.epsActual, null);
    const copy = earningsCopy(missing, '2026-11-22');
    assert.match(copy.next, /n\/a/);
    assert.match(copy.eps, /n\/a/);
    assert.match(copy.revenue, /n\/a/);
    assert.match(copy.revision, /n\/a/);
    assert.equal(copy.flag, null);
    const down = parseEarningsPayload('AMZN', { quoteSummary: { result: null, error: { code: 'Unauthorized' } } }, '2026-11-22T00:00:00.000Z');
    assert.equal(down.error, 'The earnings check did not arrive.');
    assert.equal(down.epsActual, null);
  });

  it('keeps the last good check when a later download fails', async () => {
    const db = new PGlite();
    await db.exec(SQL);
    const sql = adapter(db);
    const good = parseEarningsPayload('NTRA', NTRA, '2026-11-22T00:00:00.000Z');
    await writeEarnings(sql, good);
    const snaps = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_druck_earnings_snap');
    assert.equal(snaps[0].n, '1');
    const failed: EarningsCheck = { ...good, error: 'The earnings check did not arrive.', epsActual: null, fetchedAt: '2026-11-23T00:00:00.000Z' };
    await refreshEarnings(sql, new Date('2026-11-23T00:00:00.000Z'), async () => [failed]);
    const rows = await readEarningsRows(sql);
    assert.equal(rows.find((row) => row.symbol === 'NTRA')?.check.epsActual, -0.42);
    const still = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_druck_earnings_snap');
    assert.equal(still[0].n, '1');
    assert.equal(earningsFresh('2026-11-22T00:00:00.000Z', new Date('2026-11-22T10:00:00.000Z')), true);
    assert.equal(earningsFresh('2026-11-22T00:00:00.000Z', new Date('2026-11-23T00:00:00.000Z')), false);
  });

  it('flags earnings within 7 days on the holding card and on a watched name', () => {
    const step = sampleStep();
    const room = toControlRoom({
      status: 'ok',
      snapshot: step.snapshot,
      banner: null,
      outcome: 'saved',
      now: new Date('2026-11-21T21:00:00.000Z'),
      context: sampleContext(),
    });
    const ntra = room.cards.find((card) => card.symbol === 'NTRA');
    assert.equal(ntra?.earnings.flag, EARNINGS_FLAG);
    assert.match(ntra?.earnings.eps ?? '', /consensus/);
    assert.match(ntra?.earnings.revenue ?? '', /n\/a/);
    const hack = room.cards.find((card) => card.symbol === 'HACK.AX');
    assert.equal(hack?.earnings.flag, null);
    assert.match(hack?.earnings.eps ?? '', /n\/a/);
    const stx = room.watch.find((chip) => chip.symbol === 'STX');
    assert.equal(stx?.earningsFlag, EARNINGS_FLAG);
    assert.match(room.scorecard.rows.find((row) => row.action === 'Buy')?.hitRate ?? '', /100% of 1/);
    assert.match(room.filings.flags.join(' '), /15%/);
  });
});
