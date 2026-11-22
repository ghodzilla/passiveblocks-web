import { DRUCK_RULE } from './druck.config';
import { openRegimeSql, storeProblem, type RegimeSql } from './db';
import type { DruckSnapshot } from './druck';
import type { EarningsCheck } from './druckEarnings';
import type { FilingRef, FilingReport, HoldingLine } from './druck13f';
import {
  decisionCallsOf,
  isDruckCall,
  type StoredCall,
  type StoredScore,
} from './druckScore';

const INSERT_CALL = `INSERT INTO regime_druck_call
  (rule_version, decision_date, name_id, symbol, action, price_aud, price_local)
  VALUES ($1, $2::date, $3, $4, $5, $6, $7)
  ON CONFLICT (rule_version, decision_date, name_id) DO NOTHING`;

const INSERT_SCORE = `INSERT INTO regime_druck_call_score
  (rule_version, decision_date, name_id, horizon_weeks, payload)
  VALUES ($1, $2::date, $3, $4, $5::jsonb)
  ON CONFLICT (rule_version, decision_date, name_id, horizon_weeks) DO NOTHING`;

const UPSERT_EARNINGS = `INSERT INTO regime_druck_earnings (symbol, payload, fetched_at, ok)
  VALUES ($1, $2::jsonb, $3::timestamptz, $4)
  ON CONFLICT (symbol) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at, ok = EXCLUDED.ok`;

const INSERT_EARNINGS_SNAP = `INSERT INTO regime_druck_earnings_snap (symbol, payload, fetched_at)
  VALUES ($1, $2::jsonb, $3::timestamptz)`;

const UPSERT_13F = `INSERT INTO regime_druck_13f (id, payload, fetched_at)
  VALUES (1, $1::jsonb, $2::timestamptz)
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`;

const INSERT_13F_SNAP = `INSERT INTO regime_druck_13f_snap (accession, payload)
  VALUES ($1, $2::jsonb)
  ON CONFLICT (accession) DO NOTHING`;

export interface ContextStatus {
  status: 'ok' | 'missing_schema' | 'unconfigured' | 'empty';
}

export interface DruckContextData extends ContextStatus {
  calls: StoredCall[];
  scores: StoredScore[];
  earnings: EarningsCheck[];
  filing: { latest: FilingRef; previous: FilingRef | null; analysis: FilingReport['analysis'] } | null;
  filingFetchedAt: string | null;
}

function jsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

async function resolveSql(sql?: RegimeSql | null): Promise<RegimeSql | null> {
  if (sql === null) return null;
  return sql === undefined ? openRegimeSql() : sql;
}

export async function insertDecisionCalls(sql: RegimeSql, snapshot: DruckSnapshot): Promise<void> {
  const calls = decisionCallsOf(snapshot);
  for (const call of calls) {
    await sql.query(INSERT_CALL, [
      DRUCK_RULE,
      snapshot.decisionDate,
      call.id,
      call.symbol,
      call.action,
      call.priceAud,
      call.priceLocal,
    ]);
  }
}

export async function insertScores(sql: RegimeSql, scores: readonly StoredScore[]): Promise<void> {
  for (const score of scores) {
    await sql.query(INSERT_SCORE, [
      DRUCK_RULE,
      score.decisionDate,
      score.nameId,
      score.horizonWeeks,
      JSON.stringify(score),
    ]);
  }
}

export async function readCallsAndScores(sql: RegimeSql): Promise<{ calls: StoredCall[]; scores: StoredScore[] }> {
  const calls = await sql.query<{
    decision_date: string | Date;
    name_id: string;
    symbol: string;
    action: string;
    price_aud: number;
    price_local: number;
  }>(`SELECT decision_date, name_id, symbol, action, price_aud, price_local
      FROM regime_druck_call WHERE rule_version = $1 ORDER BY decision_date ASC, name_id ASC`, [DRUCK_RULE]);
  const scores = await sql.query<{ payload: unknown }>(
    `SELECT payload FROM regime_druck_call_score WHERE rule_version = $1`,
    [DRUCK_RULE],
  );
  return {
    calls: calls.flatMap((row) => {
      if (!isDruckCall(row.action)) return [];
      const decisionDate = row.decision_date instanceof Date
        ? row.decision_date.toISOString().slice(0, 10)
        : String(row.decision_date).slice(0, 10);
      return [{
        decisionDate,
        nameId: row.name_id,
        symbol: row.symbol,
        action: row.action,
        priceAud: Number(row.price_aud),
        priceLocal: Number(row.price_local),
      }];
    }),
    scores: scores.flatMap((row) => {
      const payload = jsonValue(row.payload) as Partial<StoredScore> | null;
      if (!payload || !isDruckCall(String(payload.action ?? ''))) return [];
      if (payload.horizonWeeks !== 4 && payload.horizonWeeks !== 12) return [];
      if (typeof payload.decisionDate !== 'string' || typeof payload.nameId !== 'string') return [];
      return [payload as StoredScore];
    }),
  };
}

function parseCheck(symbol: string, payload: unknown, fetchedAt: string): EarningsCheck | null {
  const row = jsonValue(payload) as Partial<EarningsCheck> | null;
  if (!row || row.symbol !== symbol) return null;
  return { ...row, symbol, fetchedAt: row.fetchedAt ?? fetchedAt } as EarningsCheck;
}

export async function readEarningsRows(sql: RegimeSql): Promise<{ symbol: string; check: EarningsCheck; fetchedAt: string; ok: boolean }[]> {
  const rows = await sql.query<{ symbol: string; payload: unknown; fetched_at: string | Date; ok: boolean }>(
    'SELECT symbol, payload, fetched_at, ok FROM regime_druck_earnings',
  );
  return rows.flatMap((row) => {
    const fetchedAt = row.fetched_at instanceof Date ? row.fetched_at.toISOString() : String(row.fetched_at);
    const check = parseCheck(row.symbol, row.payload, fetchedAt);
    if (!check) return [];
    return [{ symbol: row.symbol, check, fetchedAt, ok: row.ok === true }];
  });
}

export async function writeEarnings(sql: RegimeSql, check: EarningsCheck): Promise<void> {
  const ok = check.error == null;
  await sql.query(UPSERT_EARNINGS, [check.symbol, JSON.stringify(check), check.fetchedAt ?? new Date().toISOString(), ok]);
  if (ok) await sql.query(INSERT_EARNINGS_SNAP, [check.symbol, JSON.stringify(check), check.fetchedAt ?? new Date().toISOString()]);
}

export interface StoredFiling {
  report: FilingReport;
  fetchedAt: string;
}

function parseFiling(payload: unknown, fetchedAt: string): StoredFiling | null {
  const row = jsonValue(payload) as { report?: FilingReport } | null;
  if (!row?.report?.latest?.filed || !row.report.analysis) return null;
  return { report: row.report, fetchedAt };
}

export async function readFiling(sql: RegimeSql): Promise<StoredFiling | null> {
  const rows = await sql.query<{ payload: unknown; fetched_at: string | Date }>('SELECT payload, fetched_at FROM regime_druck_13f WHERE id = 1');
  if (!rows.length) return null;
  const fetchedAt = rows[0].fetched_at instanceof Date ? rows[0].fetched_at.toISOString() : String(rows[0].fetched_at);
  return parseFiling(rows[0].payload, fetchedAt);
}

export async function writeFiling(sql: RegimeSql, report: FilingReport, fetchedAt: string): Promise<void> {
  await sql.query(UPSERT_13F, [JSON.stringify({ report }), fetchedAt]);
  await sql.query(INSERT_13F_SNAP, [report.latest.accession, JSON.stringify({
    accession: report.latest.accession,
    filed: report.latest.filed,
    report: report.latest.report,
    holdings: report.holdings satisfies HoldingLine[],
  })]);
  if (report.previous && report.previousHoldings) {
    await sql.query(INSERT_13F_SNAP, [report.previous.accession, JSON.stringify({
      accession: report.previous.accession,
      filed: report.previous.filed,
      report: report.previous.report,
      holdings: report.previousHoldings,
    })]);
  }
}

export async function readDruckContext(sql?: RegimeSql | null): Promise<DruckContextData> {
  const db = await resolveSql(sql);
  if (!db) {
    return { status: 'unconfigured', calls: [], scores: [], earnings: [], filing: null, filingFetchedAt: null };
  }
  try {
    const [{ calls, scores }, earnings, filing] = await Promise.all([
      readCallsAndScores(db),
      readEarningsRows(db),
      readFiling(db),
    ]);
    const empty = calls.length === 0 && scores.length === 0 && earnings.length === 0 && !filing;
    return {
      status: empty ? 'empty' : 'ok',
      calls,
      scores,
      earnings: earnings.map((row) => row.check),
      filing: filing
        ? { latest: filing.report.latest, previous: filing.report.previous, analysis: filing.report.analysis }
        : null,
      filingFetchedAt: filing?.fetchedAt ?? null,
    };
  } catch (error) {
    if (storeProblem(error) === 'missing_schema') {
      return { status: 'missing_schema', calls: [], scores: [], earnings: [], filing: null, filingFetchedAt: null };
    }
    return { status: 'empty', calls: [], scores: [], earnings: [], filing: null, filingFetchedAt: null };
  }
}
