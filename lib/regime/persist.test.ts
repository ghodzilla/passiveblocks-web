import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { regimeDatabaseUrl, safeDbMessage, type RegimeSql } from './db';
import { getRegimeDesk } from './load';
import { boundJournal, emptyJournal, JOURNAL_MARK_LIMIT } from './journal';
import { settleRefresh, type ProviderSource } from './refreshHealth';
import type { StoredRefresh } from './refreshStore';
import { ATTEMPT_KEEP, readJournal, readRefresh, readSelfCheck, writeJournal, writeRefreshBundle, writeSelfCheck } from './state';

const MIGRATION = readFileSync('db/regime/001_durable_state.sql', 'utf8');
const NOW = '2026-11-07T13:16:00.000Z';

function feed(): ProviderSource[] {
  return [
    { id: 'WALCL', label: 'WALCL', mandatory: true, observationDate: '2026-11-04', fetchedAt: NOW, error: null },
    { id: 'WTREGEN', label: 'WTREGEN', mandatory: true, observationDate: '2026-11-04', fetchedAt: NOW, error: null },
    { id: 'RRPONTSYD', label: 'RRPONTSYD', mandatory: true, observationDate: '2026-11-06', fetchedAt: NOW, error: null },
    { id: 'DGS2', label: 'DGS2', mandatory: true, observationDate: '2026-11-05', fetchedAt: NOW, error: null },
    { id: 'DFEDTARU', label: 'DFEDTARU', mandatory: true, observationDate: '2026-11-07', fetchedAt: NOW, error: null },
    { id: 'BAMLH0A0HYM2', label: 'BAMLH0A0HYM2', mandatory: true, observationDate: '2026-11-05', fetchedAt: NOW, error: null },
  ];
}

function healthAt(at: string) {
  return settleRefresh({
    now: new Date(at),
    previous: null,
    sources: feed(),
    durable: true,
    writeOk: true,
  });
}

function bundle(at: string, cash: number): { refresh: StoredRefresh; journal: ReturnType<typeof emptyJournal> } {
  const journal = emptyJournal();
  journal.paper.cash = cash;
  journal.calls = [{ date: '2026-11-07', ruleId: 'regime', symbol: 'book', call: 'risk_on', entry: null }];
  const refresh: StoredRefresh = {
    health: healthAt(at),
    snapshot: null,
    book: {
      fetchedAt: at,
      series: [{ symbol: 'SPY', bars: [{ date: '2026-11-06', close: 591.23 }], asOf: '2026-11-06', source: 'yahoo', error: null }],
      gaps: [],
    },
    realYield: [],
    dollar: [],
  };
  return { refresh, journal };
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

async function database(): Promise<{ db: PGlite; sql: RegimeSql }> {
  const db = new PGlite();
  await db.exec(MIGRATION);
  await db.exec(MIGRATION);
  return { db, sql: adapter(db) };
}

describe('neon regime persistence', () => {
  it('keeps the migration idempotent and the retention numbers in the SQL', () => {
    for (const phrase of ['800 paper marks', '4000 signal calls', '12000 forward outcomes', '156 weekly reviews', 'newest 45']) {
      assert.equal(MIGRATION.includes(phrase), true, phrase);
    }
    assert.equal(ATTEMPT_KEEP, 45);
    assert.equal(JOURNAL_MARK_LIMIT, 800);
    assert.doesNotMatch(MIGRATION, /postgres(?:ql)?:\/\//i);
    assert.doesNotMatch(MIGRATION, /PASSWORD '/);
  });

  it('shows one save to a second connection and hides it from another database', async () => {
    const first = await database();
    const second = adapter(first.db);
    const other = await database();
    const saved = bundle(NOW, 42000);
    await writeRefreshBundle(first.sql, { ...saved, selfCheck: { ok: true, failures: [], asOf: NOW } });
    const seen = await readJournal(second);
    const check = await readSelfCheck(second);
    const refresh = await readRefresh(second);
    assert.equal(seen.paper.cash, 42000);
    assert.equal(seen.calls[0]?.call, 'risk_on');
    assert.equal(seen.gap, null);
    assert.equal(check.value?.ok, true);
    assert.equal(refresh.value?.health.outcome, 'success');
    assert.equal((await readJournal(other.sql)).paper.cash, null);
    const attempts = await second.query<{ payload: unknown }>('SELECT payload FROM regime_refresh_attempts');
    assert.equal(JSON.stringify(attempts[0]?.payload).includes('591.23'), false);
    await assert.rejects(() => first.db.query('INSERT INTO regime_journal (id, payload) VALUES ($1, $2::jsonb)', [2, '{}']));
  });

  it('rolls back the snapshot and the journal together when a later statement fails', async () => {
    const { sql } = await database();
    const original = bundle('2026-11-06T13:16:00.000Z', 10000);
    await writeRefreshBundle(sql, { ...original, selfCheck: null });
    let calls = 0;
    const failing: RegimeSql = {
      query: sql.query.bind(sql),
      transaction(run) {
        return sql.transaction(async (query) => run({
          async query(text, params) {
            calls += 1;
            if (calls === 2) throw new Error('connection reset');
            return query.query(text, params);
          },
        }));
      },
    };
    const next = bundle(NOW, 88000);
    await assert.rejects(() => writeRefreshBundle(failing, { ...next, selfCheck: { ok: false, failures: [{ id: 'x', detail: 'no' }], asOf: NOW } }));
    const journal = await readJournal(sql);
    const refresh = await readRefresh(sql);
    assert.equal(journal.paper.cash, 10000);
    assert.equal(refresh.value?.health.attemptedAt, '2026-11-06T13:16:00.000Z');
    const count = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_refresh_attempts');
    assert.equal(count[0]?.n, '1');
  });

  it('drops attempt rows past the newest 45 and trims the journal', async () => {
    const { sql } = await database();
    for (let i = 0; i < ATTEMPT_KEEP + 5; i += 1) {
      const at = new Date(Date.parse('2026-10-01T13:16:00.000Z') + i * 86400000).toISOString();
      await writeRefreshBundle(sql, { ...bundle(at, i), selfCheck: null });
    }
    const count = await sql.query<{ n: string }>('SELECT count(*)::text AS n FROM regime_refresh_attempts');
    assert.equal(Number(count[0]?.n), ATTEMPT_KEEP);
    const journal = emptyJournal();
    journal.paper.marks = Array.from({ length: JOURNAL_MARK_LIMIT + 1 }, (_, index) => ({
      date: '2024-01-01',
      equity: index,
    }));
    await writeJournal(journal, sql);
    const stored = await readJournal(sql);
    assert.equal(stored.paper.marks.length, JOURNAL_MARK_LIMIT);
    assert.equal(stored.paper.marks[0]?.equity, 1);
    assert.equal(stored.paper.marks[stored.paper.marks.length - 1]?.equity, JOURNAL_MARK_LIMIT);
    assert.equal(boundJournal(journal).paper.marks.length, JOURNAL_MARK_LIMIT);
  });

  it('does not read or write serverless disk when Neon is unset or down', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'regime-persist-'));
    const file = path.join(dir, 'passiveblocks-regime-journal.json');
    await writeFile(file, JSON.stringify({ version: 1, paper: { cash: 1, peakEquity: 1, positions: [], marks: [] } }), 'utf8');
    const previousUrl = process.env.REGIME_DATABASE_URL;
    const previousPath = process.env.REGIME_JOURNAL_PATH;
    const previousDatabase = process.env.DATABASE_URL;
    process.env.REGIME_JOURNAL_PATH = file;
    process.env.DATABASE_URL = 'postgres://supabase-user:supabase-secret@example.invalid/postgres';
    delete process.env.REGIME_DATABASE_URL;
    try {
      assert.equal(regimeDatabaseUrl(), null);
      const journal = await readJournal();
      assert.equal(journal.paper.cash, null);
      assert.match(journal.gap ?? '', /REGIME_DATABASE_URL/);
      assert.equal((journal.gap ?? '').includes('supabase-secret'), false);
      await assert.rejects(() => writeJournal(emptyJournal()));
      assert.match(await readFile(file, 'utf8'), /"cash":1/);
      const check = await readSelfCheck();
      assert.equal(check.status, 'unconfigured');
      assert.equal(check.value, null);
      const down: RegimeSql = {
        async query() {
          throw Object.assign(new Error('connect ECONNREFUSED postgres://app:secret-token@ep-example.neon.tech/regime'), { code: 'ECONNREFUSED' });
        },
        async transaction() {
          throw new Error('connect ECONNREFUSED');
        },
      };
      const failed = await readJournal(down);
      assert.match(failed.gap ?? '', /could not be read/);
      assert.equal((failed.gap ?? '').includes('secret-token'), false);
      assert.equal(safeDbMessage(new Error('connect ECONNREFUSED postgres://app:secret-token@ep-example.neon.tech/regime')).includes('secret-token'), false);
      await assert.rejects(() => writeJournal(emptyJournal(), down));
      await assert.rejects(() => writeSelfCheck({ ok: true, failures: [], asOf: null }, down));
      const missing: RegimeSql = {
        async query() {
          throw Object.assign(new Error('relation "regime_refresh" does not exist'), { code: '42P01' });
        },
        async transaction() {
          throw Object.assign(new Error('relation "regime_refresh" does not exist'), { code: '42P01' });
        },
      };
      const view = await getRegimeDesk(new Date(NOW), null, missing);
      assert.match(view.blockReason ?? '', /001_durable_state\.sql/);
      assert.equal(view.snapshot.actionable, false);
      assert.equal(view.snapshot.action, 'reduce_risk');
      const outage = await getRegimeDesk(new Date(NOW), null, down);
      assert.match(outage.blockReason ?? '', /could not be read/);
      assert.equal(outage.snapshot.actionable, false);
      assert.match(await readFile(file, 'utf8'), /"cash":1/);
    } finally {
      if (previousUrl === undefined) delete process.env.REGIME_DATABASE_URL;
      else process.env.REGIME_DATABASE_URL = previousUrl;
      if (previousPath === undefined) delete process.env.REGIME_JOURNAL_PATH;
      else process.env.REGIME_JOURNAL_PATH = previousPath;
      if (previousDatabase === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabase;
    }
  });

  it('refuses to overwrite Neon from a journal that was not read', async () => {
    const { sql } = await database();
    await writeJournal(bundle(NOW, 25000).journal, sql);
    const unread = await readJournal({
      async query() {
        throw Object.assign(new Error('relation "regime_journal" does not exist'), { code: '42P01' });
      },
      async transaction() {
        throw new Error('no');
      },
    });
    unread.paper.cash = 1;
    await assert.rejects(() => writeJournal(unread, sql));
    assert.equal((await readJournal(sql)).paper.cash, 25000);
  });

  it('does not point the regime store at Blob, tmp, or the Supabase URL', () => {
    for (const file of ['lib/regime/db.ts', 'lib/regime/state.ts', 'lib/regime/journal.ts', 'lib/regime/selfcheck.ts', 'lib/regime/refreshStore.ts']) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /@vercel\/blob/);
      assert.doesNotMatch(source, /tmpdir/);
      assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
      assert.doesNotMatch(source, /BLOB_READ_WRITE_TOKEN/);
      assert.doesNotMatch(source, /REGIME_JOURNAL_PATH/);
    }
    const db = readFileSync('lib/regime/db.ts', 'utf8');
    assert.match(db, /REGIME_DATABASE_URL/);
    assert.match(db, /attachDatabasePool/);
    assert.match(db, /max: 1/);
  });
});
