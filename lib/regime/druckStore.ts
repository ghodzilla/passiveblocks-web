import { DRUCK_BOOK_ID, DRUCK_RULE } from './druck.config';
import { openRegimeSql, storeProblem, type RegimeSql } from './db';
import type { DruckOutcome, DruckSnapshot } from './druck';

const WEEKS = `SELECT payload FROM regime_druck_week
  WHERE rule_version = $1
  ORDER BY decision_date ASC`;

const UPSERT = `INSERT INTO regime_druck (id, payload, updated_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;

const INSERT_WEEK = `INSERT INTO regime_druck_week (rule_version, decision_date, payload)
  VALUES ($1, $2::date, $3::jsonb)
  ON CONFLICT (rule_version, decision_date) DO NOTHING`;

export interface DruckAttempt {
  at: string;
  outcome: DruckOutcome;
  errors: string[];
  banner: string | null;
}

export interface DruckRecord {
  ruleVersion: typeof DRUCK_RULE;
  bookId: typeof DRUCK_BOOK_ID;
  updatedAt: string;
  attempt: DruckAttempt;
  snapshot: DruckSnapshot | null;
}

export interface DruckRead {
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage' | 'empty';
  record: DruckRecord | null;
}

function jsonValue(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value) as unknown;
  return value;
}

export function parseDruckRecord(value: unknown): DruckRecord | null {
  const row = jsonValue(value) as Partial<DruckRecord> | null;
  if (!row || row.ruleVersion !== DRUCK_RULE || row.bookId !== DRUCK_BOOK_ID) return null;
  if (!row.attempt || typeof row.attempt.at !== 'string' || typeof row.attempt.outcome !== 'string') return null;
  if (row.snapshot != null && (row.snapshot.ruleVersion !== DRUCK_RULE || !row.snapshot.decisionDate || !Array.isArray(row.snapshot.names))) return null;
  return {
    ruleVersion: DRUCK_RULE,
    bookId: DRUCK_BOOK_ID,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.attempt.at,
    attempt: {
      at: row.attempt.at,
      outcome: row.attempt.outcome,
      errors: Array.isArray(row.attempt.errors) ? row.attempt.errors.filter((item) => typeof item === 'string') : [],
      banner: typeof row.attempt.banner === 'string' ? row.attempt.banner : null,
    },
    snapshot: row.snapshot ?? null,
  };
}

async function resolveSql(sql?: RegimeSql | null): Promise<RegimeSql | null> {
  if (sql === null) return null;
  return sql === undefined ? openRegimeSql() : sql;
}

export function parseDruckSnapshot(value: unknown): DruckSnapshot | null {
  const row = jsonValue(value) as Partial<DruckSnapshot> | null;
  if (!row || row.ruleVersion !== DRUCK_RULE || typeof row.decisionDate !== 'string' || !Array.isArray(row.names)) return null;
  return row as DruckSnapshot;
}

export async function readDruckWeeks(sql?: RegimeSql | null): Promise<DruckSnapshot[]> {
  const db = await resolveSql(sql);
  if (!db) return [];
  try {
    const rows = await db.query<{ payload: unknown }>(WEEKS, [DRUCK_RULE]);
    const weeks: DruckSnapshot[] = [];
    for (const row of rows) {
      const snapshot = parseDruckSnapshot(row.payload);
      if (snapshot) weeks.push(snapshot);
    }
    return weeks;
  } catch {
    return [];
  }
}

export async function readDruck(sql?: RegimeSql | null): Promise<DruckRead> {
  const db = await resolveSql(sql);
  if (!db) return { status: 'unconfigured', record: null };
  try {
    const rows = await db.query<{ payload: unknown }>('SELECT payload FROM regime_druck WHERE id = $1', [1]);
    if (!rows.length) return { status: 'empty', record: null };
    const record = parseDruckRecord(rows[0].payload);
    if (!record) return { status: 'outage', record: null };
    return { status: 'ok', record };
  } catch (error) {
    const problem = storeProblem(error);
    if (problem === 'missing_schema') return { status: 'missing_schema', record: null };
    return { status: 'outage', record: null };
  }
}

export async function writeDruck(
  sql: RegimeSql,
  record: DruckRecord,
  week: DruckSnapshot | null,
): Promise<'saved' | 'missing_schema' | 'outage'> {
  try {
    await sql.transaction(async (query) => {
      await query.query(UPSERT, [JSON.stringify(record)]);
      if (week) await query.query(INSERT_WEEK, [week.ruleVersion, week.decisionDate, JSON.stringify(week)]);
    });
    return 'saved';
  } catch (error) {
    const problem = storeProblem(error);
    if (problem === 'missing_schema') return 'missing_schema';
    return 'outage';
  }
}
