import { openRegimeSql, safeDbMessage, storeProblem, type RegimeSql, type StoreProblem } from './db';
import { boundJournal, emptyJournal, parseJournal, type Journal } from './journal';
import type { RefreshHealth } from './refreshHealth';
import type { StoredRefresh } from './refreshStore';
import { parseSelfCheckRecord, type SelfCheckRecord } from './selfcheck';

/** Newest attempt rows kept. Matches the comment in db/regime/001_durable_state.sql. */
export const ATTEMPT_KEEP = 45;

const UPSERT_JOURNAL = `INSERT INTO regime_journal (id, payload, updated_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;

const UPSERT_SELF = `INSERT INTO regime_selfcheck (id, payload, updated_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;

const UPSERT_REFRESH = `INSERT INTO regime_refresh (id, payload, updated_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;

const INSERT_ATTEMPT = `INSERT INTO regime_refresh_attempts
  (attempted_at, outcome, fetch_outcome, persisted, payload)
  VALUES ($1::timestamptz, $2, $3, $4, $5::jsonb)`;

const PRUNE_ATTEMPTS = `DELETE FROM regime_refresh_attempts
  WHERE id IN (
    SELECT id FROM regime_refresh_attempts
    ORDER BY attempted_at DESC, id DESC
    OFFSET $1
  )`;

export interface StoreRead<T> {
  status: 'ok' | StoreProblem;
  value: T | null;
}

async function resolveSql(sql?: RegimeSql | null): Promise<RegimeSql | null> {
  return sql === undefined ? openRegimeSql() : sql;
}

function jsonValue(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function unreadJournal(kind: StoreProblem, error?: unknown): Journal {
  const journal = emptyJournal();
  if (kind === 'unconfigured') {
    journal.gap = 'REGIME_DATABASE_URL is not set. The paper portfolio, signal history, and journal are not stored on this instance. Serverless disk is not used.';
  } else if (kind === 'missing_schema') {
    journal.gap = 'The paper journal tables are not in Neon yet. Apply db/regime/001_durable_state.sql. No track record was invented.';
  } else {
    journal.gap = `The paper journal could not be read (${error ? safeDbMessage(error) : 'Neon outage'}). No track record was invented.`;
  }
  return journal;
}

export async function readJournal(sql?: RegimeSql | null): Promise<Journal> {
  const db = await resolveSql(sql);
  if (!db) return unreadJournal('unconfigured');
  try {
    const rows = await db.query<{ payload: unknown }>('SELECT payload FROM regime_journal WHERE id = $1', [1]);
    if (!rows.length) return emptyJournal();
    return parseJournal(JSON.stringify(jsonValue(rows[0].payload)));
  } catch (error) {
    return unreadJournal(storeProblem(error), error);
  }
}

export async function writeJournal(journal: Journal, sql?: RegimeSql | null): Promise<void> {
  if (journal.gap) {
    throw new Error('Refusing to save a journal that was not read from Neon.');
  }
  const db = await resolveSql(sql);
  if (!db) throw new Error('REGIME_DATABASE_URL is not set. The journal was not saved.');
  const stored = boundJournal(journal);
  await db.transaction(async (query) => {
    await query.query(UPSERT_JOURNAL, [JSON.stringify(stored)]);
  });
}

export async function readSelfCheck(sql?: RegimeSql | null): Promise<StoreRead<SelfCheckRecord>> {
  const db = await resolveSql(sql);
  if (!db) return { status: 'unconfigured', value: null };
  try {
    const rows = await db.query<{ payload: unknown }>('SELECT payload FROM regime_selfcheck WHERE id = $1', [1]);
    if (!rows.length) return { status: 'ok', value: null };
    return { status: 'ok', value: parseSelfCheckRecord(JSON.stringify(jsonValue(rows[0].payload))) };
  } catch (error) {
    return { status: storeProblem(error), value: null };
  }
}

export async function writeSelfCheck(record: SelfCheckRecord, sql?: RegimeSql | null): Promise<void> {
  const db = await resolveSql(sql);
  if (!db) throw new Error('REGIME_DATABASE_URL is not set. The self-check was not saved.');
  await db.transaction(async (query) => {
    await query.query(UPSERT_SELF, [JSON.stringify(record)]);
  });
}

export async function readRefresh(sql?: RegimeSql | null): Promise<StoreRead<StoredRefresh>> {
  const db = await resolveSql(sql);
  if (!db) return { status: 'unconfigured', value: null };
  try {
    const rows = await db.query<{ payload: unknown }>('SELECT payload FROM regime_refresh WHERE id = $1', [1]);
    if (!rows.length) return { status: 'ok', value: null };
    const parsed = jsonValue(rows[0].payload) as StoredRefresh;
    if (!parsed || !parsed.health || !Array.isArray(parsed.health.sources)) {
      return { status: 'outage', value: null };
    }
    return { status: 'ok', value: parsed };
  } catch (error) {
    return { status: storeProblem(error), value: null };
  }
}

export async function writeRefreshBundle(sql: RegimeSql, input: {
  refresh: StoredRefresh;
  journal: Journal | null;
  selfCheck: SelfCheckRecord | null;
}): Promise<void> {
  const health: RefreshHealth = input.refresh.health;
  await sql.transaction(async (query) => {
    await query.query(UPSERT_REFRESH, [JSON.stringify(input.refresh)]);
    if (input.journal) {
      if (input.journal.gap) throw new Error('Refusing to save a journal that was not read from Neon.');
      await query.query(UPSERT_JOURNAL, [JSON.stringify(boundJournal(input.journal))]);
    }
    if (input.selfCheck) {
      await query.query(UPSERT_SELF, [JSON.stringify(input.selfCheck)]);
    }
    await query.query(INSERT_ATTEMPT, [
      health.attemptedAt,
      health.outcome,
      health.fetchOutcome,
      health.persisted,
      JSON.stringify(health),
    ]);
    await query.query(PRUNE_ATTEMPTS, [ATTEMPT_KEEP]);
  });
}
