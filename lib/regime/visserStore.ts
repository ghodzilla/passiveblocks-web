import { openRegimeSql, storeProblem, type RegimeSql } from './db';
import { VISSER_BOOK_ID, VISSER_RULE, type VisserOutcome, type VisserSnapshot } from './visser';

const WEEKS = `SELECT payload FROM regime_visser_week
  WHERE rule_version = $1
  ORDER BY decision_date ASC`;

const UPSERT = `INSERT INTO regime_visser (id, payload, updated_at)
  VALUES (1, $1::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;

const INSERT_WEEK = `INSERT INTO regime_visser_week (rule_version, decision_date, payload)
  VALUES ($1, $2::date, $3::jsonb)
  ON CONFLICT (rule_version, decision_date) DO NOTHING`;

export interface VisserAttempt {
  at: string;
  outcome: VisserOutcome;
  errors: string[];
  banner: string | null;
}

export interface VisserRecord {
  ruleVersion: typeof VISSER_RULE;
  bookId: typeof VISSER_BOOK_ID;
  updatedAt: string;
  shareNote: string | null;
  attempt: VisserAttempt;
  snapshot: VisserSnapshot | null;
}

export interface VisserRead {
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage' | 'empty';
  record: VisserRecord | null;
}

function jsonValue(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value) as unknown;
  return value;
}

export function parseVisserRecord(value: unknown): VisserRecord | null {
  const row = jsonValue(value) as Partial<VisserRecord> | null;
  if (!row || row.ruleVersion !== VISSER_RULE || row.bookId !== VISSER_BOOK_ID) return null;
  if (!row.attempt || typeof row.attempt.at !== 'string' || typeof row.attempt.outcome !== 'string') return null;
  if (row.snapshot != null && (row.snapshot.ruleVersion !== VISSER_RULE || !row.snapshot.decisionDate || !Array.isArray(row.snapshot.sleeves))) return null;
  return {
    ruleVersion: VISSER_RULE,
    bookId: VISSER_BOOK_ID,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : row.attempt.at,
    shareNote: typeof row.shareNote === 'string' ? row.shareNote : null,
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

export function parseVisserSnapshot(value: unknown): VisserSnapshot | null {
  const row = jsonValue(value) as Partial<VisserSnapshot> | null;
  if (!row || row.ruleVersion !== VISSER_RULE || typeof row.decisionDate !== 'string' || !Array.isArray(row.sleeves)) return null;
  return row as VisserSnapshot;
}

export async function readVisserWeeks(sql?: RegimeSql | null): Promise<VisserSnapshot[]> {
  const db = await resolveSql(sql);
  if (!db) return [];
  try {
    const rows = await db.query<{ payload: unknown }>(WEEKS, [VISSER_RULE]);
    const weeks: VisserSnapshot[] = [];
    for (const row of rows) {
      const snapshot = parseVisserSnapshot(row.payload);
      if (snapshot) weeks.push(snapshot);
    }
    return weeks;
  } catch {
    return [];
  }
}

export async function readVisser(sql?: RegimeSql | null): Promise<VisserRead> {
  const db = await resolveSql(sql);
  if (!db) return { status: 'unconfigured', record: null };
  try {
    const rows = await db.query<{ payload: unknown }>('SELECT payload FROM regime_visser WHERE id = $1', [1]);
    if (!rows.length) return { status: 'empty', record: null };
    const record = parseVisserRecord(rows[0].payload);
    if (!record) return { status: 'outage', record: null };
    return { status: 'ok', record };
  } catch (error) {
    const problem = storeProblem(error);
    if (problem === 'missing_schema') return { status: 'missing_schema', record: null };
    return { status: 'outage', record: null };
  }
}

export async function writeVisser(
  sql: RegimeSql,
  record: VisserRecord,
  week: VisserSnapshot | null,
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
