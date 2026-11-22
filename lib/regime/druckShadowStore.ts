import { openRegimeSql, safeDbMessage, storeProblem, type RegimeSql } from './db';
import { DRUCK_SHADOW_BOOK_ID, DRUCK_SHADOW_RULE } from './druck.config';
import { stepDruck, type DruckMarket, type DruckSnapshot } from './druck';
import { liveV2Read } from './druckShadow';
import { fetchFredCsv } from './fredCsv';
import { fetchYahooBars } from './prices';
import { decisionSession, type CloseBar } from './visser';

const READ_CURRENT = `SELECT payload FROM regime_druck_shadow WHERE id = 1`;
const UPSERT = `
  INSERT INTO regime_druck_shadow (id, rule_version, book_id, payload, updated_at)
  VALUES (1, $1, $2, $3::jsonb, now())
  ON CONFLICT (id) DO UPDATE
    SET rule_version = EXCLUDED.rule_version,
        book_id = EXCLUDED.book_id,
        payload = EXCLUDED.payload,
        updated_at = now()
`;
const INSERT_WEEK = `
  INSERT INTO regime_druck_shadow_week (rule_version, decision_date, payload)
  VALUES ($1, $2, $3::jsonb)
  ON CONFLICT (rule_version, decision_date) DO NOTHING
`;

function log(fields: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: 'druck_shadow', ...fields }));
}

export type ShadowRead = {
  status: 'ok' | 'empty' | 'missing_schema' | 'unconfigured';
  snapshot: DruckSnapshot | null;
};

function asSnapshot(value: unknown): DruckSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as DruckSnapshot;
  if (row.bookId !== DRUCK_SHADOW_BOOK_ID || row.ruleVersion !== DRUCK_SHADOW_RULE) return null;
  if (!row.decisionDate || !Array.isArray(row.names)) return null;
  return row;
}

export async function readShadowPage(): Promise<ShadowRead> {
  const sql = await openRegimeSql();
  if (!sql) return { status: 'unconfigured', snapshot: null };
  return readShadow(sql);
}

export async function readShadow(sql: RegimeSql): Promise<ShadowRead> {
  try {
    const rows = await sql.query<{ payload: unknown }>(READ_CURRENT);
    const snapshot = asSnapshot(rows[0]?.payload);
    return snapshot ? { status: 'ok', snapshot } : { status: 'empty', snapshot: null };
  } catch (error) {
    if (storeProblem(error) === 'missing_schema') return { status: 'missing_schema', snapshot: null };
    log({ phase: 'read', message: safeDbMessage(error) });
    return { status: 'empty', snapshot: null };
  }
}

export async function writeShadow(sql: RegimeSql, snapshot: DruckSnapshot): Promise<void> {
  if (snapshot.bookId !== DRUCK_SHADOW_BOOK_ID || snapshot.ruleVersion !== DRUCK_SHADOW_RULE) return;
  const payload = JSON.stringify(snapshot);
  await sql.query(UPSERT, [DRUCK_SHADOW_RULE, DRUCK_SHADOW_BOOK_ID, payload]);
  await sql.query(INSERT_WEEK, [DRUCK_SHADOW_RULE, snapshot.decisionDate, payload]);
}

async function dollarBars(): Promise<CloseBar[]> {
  const fetched = await fetchYahooBars('DX-Y.NYB', 'max');
  if (fetched.error || fetched.bars.length === 0) throw new Error(fetched.error ?? 'DX-Y.NYB did not arrive.');
  return fetched.bars.map((bar) => ({ date: bar.date, close: bar.close }));
}

/**
 * Fill the extra v2 checks from keyless sources. Does not change the live liquidity score or the live errors.
 * Throws when a source fails. The caller leaves the previous shadow week in place.
 */
export async function withV2Read(market: DruckMarket): Promise<DruckMarket> {
  const calendar: string[] = [];
  for (const bar of market.prices.SPY ?? []) {
    if (bar.close > 0 && calendar[calendar.length - 1] !== bar.date) calendar.push(bar.date);
  }
  const decision = decisionSession(calendar, market.now);
  if (!decision) throw new Error('No decision date for the shadow read.');
  const [dgs10, dgs2, walcl, tga, rrp, dollar] = await Promise.all([
    fetchFredCsv('DGS10'),
    fetchFredCsv('DGS2'),
    fetchFredCsv('WALCL'),
    fetchFredCsv('WTREGEN'),
    fetchFredCsv('RRPONTSYD'),
    dollarBars(),
  ]);
  const extra = liveV2Read({ decision, dgs10, dgs2, dollar, walcl, tga, rrp });
  if (!extra) throw new Error('A v2 market check is missing.');
  return { ...market, v2: extra };
}

/**
 * Step the shadow book after the live book has already been saved.
 * A failure here does not change the live outcome. A missing table is ignored.
 */
export async function attachDruckShadow(input: {
  sql: RegimeSql;
  market: DruckMarket;
  liveFeeds: boolean;
}): Promise<void> {
  try {
    const market = input.liveFeeds ? await withV2Read(input.market) : input.market;
    const saved = await readShadow(input.sql);
    if (saved.status === 'missing_schema') {
      log({ phase: 'skip', message: 'relation "regime_druck_shadow" does not exist' });
      return;
    }
    const step = stepDruck(saved.snapshot, market, { rules: 'v2' });
    if (!step.snapshot || step.outcome === 'feed_failed' || step.outcome === 'unchanged') {
      if (step.errors.length > 0) log({ phase: 'step', message: step.errors[0] });
      return;
    }
    await writeShadow(input.sql, step.snapshot);
  } catch (error) {
    log({ phase: 'shadow', message: safeDbMessage(error) });
  }
}
