import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { RegimeSql } from './db';
import { bookExposureSentence, paperLogSentence } from './exposureCopy';
import { decisionFromRefresh, paperMark, readPaperLog, recordPaperSnapshot, type PaperDecisionPayload } from './paperLog';
import { replayResults, validationStudy } from './validationArtifacts';
import { creditSpan, nextCalendarDay } from '../../research/regime-validation/creditSpan';
import type { PriceBook } from './prices';
import type { StoredRefresh } from './refreshStore';
import type { Bar } from './signals';

function decision(lines: PaperDecisionPayload['lines']): PaperDecisionPayload {
  return {
    recordKind: 'prospective_target_weights',
    hypothesisId: 'H1',
    rulesVersion: 'regime-v2',
    ruleVersion: '2026-11-08.2',
    themeConfigVersion: 'test',
    storedAt: '2026-11-06T13:15:00.000Z',
    sessionDate: '2026-11-06',
    composite: -0.2,
    regime: 'transitional',
    action: 'do_nothing',
    actionable: true,
    weak: true,
    lines,
    referencePrices: [],
    feedDates: [],
    currency: 'AUD',
    costBps: 10,
    cashYieldBps: 0,
    taxes: 'excluded',
    benchmark: 'test',
    valuation: {
      unit: 'time-weighted AUD NAV excluding contributions',
      needs: 'test',
    },
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
        storedAt: '2026-11-06T13:15:00.000Z',
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
    const stored = raw.rows[0]?.payload as unknown as PaperDecisionPayload;
    assert.equal(stored.recordKind, 'prospective_target_weights');
    assert.equal(stored.storedAt, '2026-11-06T13:15:00.000Z');
    assert.equal(stored.referencePrices[0]?.symbol, 'GOLD.AX');
    assert.equal(stored.referencePrices[0]?.close, 30);
    assert.equal(stored.referencePrices[0]?.aud, 30);
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

describe('credit warmup on the tested FRED file', () => {
  it('keeps a z-score empty until 252 observations and dates the decision the next calendar day', () => {
    const dates = Array.from({ length: 756 }, (_, index) => {
      const ms = Date.parse('2023-11-07T00:00:00Z') + index * 86_400_000;
      return new Date(ms).toISOString().slice(0, 10);
    });
    const short = creditSpan(dates.slice(0, 251));
    assert.equal(short.firstCreditZObservation, null);
    assert.equal(short.creditZObservationCount, 0);
    const ready = creditSpan(dates);
    assert.equal(ready.firstCreditZObservation, dates[251]);
    assert.equal(ready.earliestDecisionDate, nextCalendarDay(dates[251]));
    assert.equal(ready.firstFullWindowObservation, dates[755]);
    assert.equal(ready.fullWindowObservationCount, 1);
    assert.equal(ready.completedReplayDates, 0);
  });
});

describe('decision record', () => {
  it('stores the snapshot clock and a separate close and FX, and leaves AUD empty when FX is missing', () => {
    const payload = decisionFromRefresh({
      health: { sources: [] },
      snapshot: {
        rulesVersion: 'regime-v2',
        today: '2026-11-06',
        generatedAt: '2026-11-06T13:15:00.000Z',
        composite: 0,
        regime: 'transitional',
        action: 'do_nothing',
        actionable: false,
        weak: true,
      },
      book: book([{ symbol: 'SPY', bars: [{ date: '2026-11-06', close: 100 }] }]),
      decision: {
        ruleVersion: '2026-11-08.2',
        themeConfigVersion: 't',
        storedAt: '2026-11-06T13:15:00.000Z',
        lines: [{ symbol: 'SPY', role: 'tactical', weight: 0, status: 'watch' }],
      },
    } as unknown as StoredRefresh, null);
    assert.ok(payload);
    assert.equal(payload.storedAt, '2026-11-06T13:15:00.000Z');
    assert.equal(payload.ruleVersion, '2026-11-08.2');
    assert.equal(payload.referencePrices[0]?.close, 100);
    assert.equal(payload.referencePrices[0]?.fxUsdPerAud, null);
    assert.equal(payload.referencePrices[0]?.aud, null);
  });
});

describe('validation artifact', () => {
  it('resolves the study and the replay for the production page', () => {
    assert.notEqual(validationStudy, null);
    assert.notEqual(replayResults, null);
    assert.equal(validationStudy.fullStrategy, 'not_validated');
    assert.equal(validationStudy.metrics, null);
    assert.ok(validationStudy.rows.length > 0);
    assert.equal(replayResults.policy, 'book-limits-2026-11-07');
    assert.ok(replayResults.production.summary);
    const page = readFileSync('app/private/regime/page.tsx', 'utf8');
    const artifacts = readFileSync('lib/regime/validationArtifacts.ts', 'utf8');
    const config = readFileSync('next.config.mjs', 'utf8');
    assert.equal(page.includes('readFileSync'), false);
    assert.equal(page.includes('validationStudy'), true);
    assert.equal(page.includes('replayResults'), true);
    assert.equal(artifacts.includes('prices/book.json'), false);
    assert.equal(config.includes('./research/regime-validation/results.json'), true);
    assert.equal(config.includes('./research/regime-validation/replay-results.json'), true);
    assert.equal(config.includes('prices/book.json'), false);
    const built = '.next/server/app/private/regime/page.js';
    if (!existsSync(built)) return;
    const bundle = readFileSync(built, 'utf8');
    const nftPath = `${built}.nft.json`;
    const files: string[] = existsSync(nftPath) ? JSON.parse(readFileSync(nftPath, 'utf8')).files : [];
    const inlined = bundle.includes('not_validated') && bundle.includes('repaired_policy_not_the_historical_rule');
    const traced = files.some((file) => file.endsWith('research/regime-validation/results.json'))
      && files.some((file) => file.endsWith('research/regime-validation/replay-results.json'));
    assert.equal(inlined || traced, true);
    assert.equal(files.some((file) => file.endsWith('prices/book.json')), false);
  });

  it('states the live paper log and names the two gross definitions', () => {
    const active = paperLogSentence({
      status: 'ok',
      decisions: 1,
      marks: 1,
      latest: {
        currency: 'AUD',
        nav: 0.999,
        navStatus: 'awaiting_next_session',
        reason: 'First mark. Entry cost is charged. The next session’s price change is not in this NAV.',
        gross: 0.1,
        cashWeight: 0.9,
        turnover: 0.1,
        costsPaid: 0.0001,
        weights: [],
        prices: [],
      },
    });
    assert.match(active, /Paper log active: 1 decisions, 1 marks; first mark includes entry cost only, not a performance record/);
    assert.equal(active.includes('not applied'), false);
    assert.match(active, /Mark gross 10\.0%/);
    assert.match(active, /Mark cash weight 90\.0%/);
    const missing = paperLogSentence({ status: 'missing_schema', decisions: 0, marks: 0, latest: null });
    assert.match(missing, /not applied/);
    const book = bookExposureSentence({
      gross: 0.4,
      net: 0.1,
      risk: 0.1,
      defensive: 0,
      cash: 0.6,
      maxGross: 0.4,
      maxNet: 0.2,
    });
    assert.match(book, /Held gross 40\.0%/);
    assert.match(book, /AAA\.AX, BILL\.AX, and SHY count in it/);
    assert.match(book, /AUD cash balance 60\.0%/);
  });

  it('does not report a portfolio result while the full strategy is not validated', () => {
    const study = JSON.parse(readFileSync('research/regime-validation/results.json', 'utf8'));
    assert.equal(study.fullStrategy, 'not_validated');
    assert.equal(study.metrics, null);
    assert.equal(study.completedReplayDates, 0);
    assert.equal(study.hypotheses.every((item: { status: string }) => item.status === 'not_tested'), true);
    assert.equal(study.credit.minObs, 252);
    assert.equal(study.credit.window, 756);
    assert.equal(study.credit.firstObservation, '2023-11-07');
    assert.equal(study.credit.creditZObservationCount, study.credit.observationCount - 251);
    assert.equal(study.credit.completedReplayDates, 0);
    assert.equal(study.paperLog.activated, false);
    assert.equal(JSON.stringify(study).includes('pre-registered'), false);
    assert.equal(JSON.stringify(study).includes('66%'), false);
  });
});
