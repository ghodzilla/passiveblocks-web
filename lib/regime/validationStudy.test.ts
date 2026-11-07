import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { paperMark, readPaperLog, recordPaperSnapshot, type PaperDecisionPayload } from './paperLog';
import type { PriceBook } from './prices';
import type { StoredRefresh } from './refreshStore';
import type { Bar } from './signals';

function decision(lines: PaperDecisionPayload['lines']): PaperDecisionPayload {
  return {
    hypothesisId: 'H1',
    rulesVersion: 'regime-v2',
    ruleVersion: '2026-11-08.2',
    themeConfigVersion: 'test',
    sessionDate: '2026-11-06',
    composite: -0.2,
    regime: 'transitional',
    action: 'do_nothing',
    actionable: true,
    weak: true,
    lines,
    feedDates: [],
    currency: 'AUD',
    costBps: 10,
    cashYieldBps: 0,
    taxes: 'excluded',
    benchmark: 'test',
  };
}

function book(series: { symbol: string; bars: Bar[] }[]): PriceBook {
  return {
    fetchedAt: '2026-11-07T00:00:00.000Z',
    gaps: [],
    series: series.map((item) => ({
      symbol: item.symbol,
      bars: item.bars,
      asOf: item.bars[item.bars.length - 1]?.date ?? null,
      source: 'yahoo',
      error: null,
      adjusted: true,
    })),
  };
}

describe('paper nav mechanics', () => {
  it('charges entry cost before any price change and then applies the held weight in AUD', () => {
    const fx = [{ date: '2026-11-05', close: 0.65 }, { date: '2026-11-06', close: 0.65 }];
    const first = paperMark({
      decision: decision([{ symbol: 'SPY', role: 'tactical', weight: 1, status: 'confirmed' }]),
      sessionDate: '2026-11-05',
      previous: null,
      book: book([{ symbol: 'SPY', bars: [{ date: '2026-11-05', close: 100 }, { date: '2026-11-06', close: 110 }] }]),
      fx,
    });
    assert.equal(first.navStatus, 'awaiting_next_session');
    assert.ok(Math.abs((first.nav ?? 0) - (1 - 0.001)) < 1e-12);
    const second = paperMark({
      decision: decision([{ symbol: 'SPY', role: 'tactical', weight: 1, status: 'confirmed' }]),
      sessionDate: '2026-11-06',
      previous: first,
      book: book([{ symbol: 'SPY', bars: [{ date: '2026-11-05', close: 100 }, { date: '2026-11-06', close: 110 }] }]),
      fx,
    });
    assert.equal(second.navStatus, 'ok');
    assert.ok(Math.abs((second.nav ?? 0) - (1 - 0.001) * 1.1) < 1e-12);
    assert.equal(second.turnover, 0);
  });

  it('leaves NAV empty when AUDUSD or a held price is missing, including an ASX name that does not need FX', () => {
    const missingFx = paperMark({
      decision: decision([{ symbol: 'SPY', role: 'tactical', weight: 0.5, status: 'confirmed' }]),
      sessionDate: '2026-11-06',
      previous: null,
      book: book([{ symbol: 'SPY', bars: [{ date: '2026-11-06', close: 100 }] }]),
      fx: null,
    });
    assert.equal(missingFx.nav, null);
    assert.equal(missingFx.navStatus, 'fx_unavailable');
    const asx = paperMark({
      decision: decision([{ symbol: 'GOLD.AX', role: 'tactical', weight: 0.2, status: 'watch' }]),
      sessionDate: '2026-11-06',
      previous: null,
      book: book([{ symbol: 'GOLD.AX', bars: [{ date: '2026-11-06', close: 30 }] }]),
      fx: null,
    });
    assert.equal(asx.navStatus, 'awaiting_next_session');
    assert.ok((asx.nav ?? 0) > 0.9);
    const missingPrice = paperMark({
      decision: decision([{ symbol: 'SPY', role: 'tactical', weight: 0.5, status: 'confirmed' }]),
      sessionDate: '2026-11-06',
      previous: null,
      book: book([]),
      fx: [{ date: '2026-11-06', close: 0.65 }],
    });
    assert.equal(missingPrice.navStatus, 'prices_incomplete');
    assert.equal(missingPrice.nav, null);
  });
});

describe('paper log storage', () => {
  it('appends one decision and one mark, and a second write does not replace them', async () => {
    const db = new PGlite();
    await db.exec(readFileSync('db/regime/001_durable_state.sql', 'utf8'));
    await db.exec(readFileSync('db/regime/002_paper_decisions.sql', 'utf8'));
    const sql: RegimeSql = {
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
    const refresh = {
      health: { sources: [{ id: 'WALCL', observationDate: '2026-11-04', fetchedAt: null, error: null }] },
      snapshot: {
        rulesVersion: 'regime-v2',
        today: '2026-11-06',
        composite: -0.286,
        regime: 'transitional',
        action: 'do_nothing',
        actionable: true,
        weak: true,
      },
      book: book([{ symbol: 'GOLD.AX', bars: [{ date: '2026-11-06', close: 30 }] }]),
      decision: {
        ruleVersion: '2026-11-08.2',
        themeConfigVersion: 'test',
        lines: [{ symbol: 'GOLD.AX', role: 'tactical', weight: 0, status: 'watch' }],
      },
    } as unknown as StoredRefresh;
    assert.equal(await recordPaperSnapshot(sql, refresh, null), 'recorded');
    assert.equal(await recordPaperSnapshot(sql, refresh, null), 'recorded');
    const log = await readPaperLog(sql);
    assert.equal(log.decisions, 1);
    assert.equal(log.marks, 1);
    const raw = await db.query<{ payload: { composite: number } }>(
      `SELECT payload FROM regime_paper_event WHERE event_type = 'decision'`,
    );
    assert.equal(raw.rows[0]?.payload.composite, -0.286);
    const sqlText = readFileSync('db/regime/002_paper_decisions.sql', 'utf8');
    assert.equal(sqlText.includes('GRANT SELECT, INSERT ON TABLE regime_paper_event'), true);
    assert.equal(sqlText.includes('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE regime_paper_event'), true);
    assert.equal(/postgres(?:ql)?:\/\//.test(sqlText), false);
  });

  it('treats a missing table as unavailable and does not throw', async () => {
    const db = new PGlite();
    const sql: RegimeSql = {
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
    const refresh = {
      health: { sources: [] },
      snapshot: { rulesVersion: 'regime-v2', today: '2026-11-06', composite: 0, regime: null, action: 'do_nothing', actionable: false, weak: true },
      book: book([]),
      decision: { ruleVersion: '2026-11-08.2', themeConfigVersion: 't', lines: [{ symbol: 'SPY', role: 'tactical', weight: 0, status: 'watch' }] },
    } as unknown as StoredRefresh;
    assert.equal(await recordPaperSnapshot(sql, refresh, null), 'missing_schema');
    const log = await readPaperLog(sql);
    assert.equal(log.status, 'missing_schema');
  });
});

describe('validation artifact', () => {
  it('does not report a portfolio result while the full strategy is not validated', () => {
    const study = JSON.parse(readFileSync('research/regime-validation/results.json', 'utf8'));
    assert.equal(study.fullStrategy, 'not_validated');
    assert.equal(study.metrics, null);
    assert.equal(study.hypotheses.every((item: { status: string }) => item.status === 'not_tested'), true);
    assert.equal(JSON.stringify(study).includes('66%'), false);
  });
});
