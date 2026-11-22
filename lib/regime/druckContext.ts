import { DRUCK_CANDIDATES } from './druck.config';
import type { RegimeSql } from './db';
import { safeDbMessage } from './db';
import type { DruckMarket, DruckSnapshot } from './druck';
import {
  earningsFresh,
  fetchEarningsMany,
  type EarningsCheck,
} from './druckEarnings';
import { fetchDuquesne13f, filingFresh, type FilingReport } from './druck13f';
import {
  insertDecisionCalls,
  insertScores,
  readCallsAndScores,
  readEarningsRows,
  readFiling,
  writeEarnings,
  writeFiling,
} from './druckContextStore';
import { bookFromPrices, scoresDue } from './druckScore';

function log(fields: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: 'druck_context', ...fields }));
}

/**
 * Save the week's calls, score any that are 4 or 12 weeks old, and refresh
 * earnings and the 13F when this is a live run. A failure here does not
 * change the book. Missing tables are ignored until db/regime/006 is applied.
 */
export async function attachDruckContext(input: {
  sql: RegimeSql;
  week: DruckSnapshot | null;
  market: DruckMarket;
  now: Date;
  liveFeeds: boolean;
  fetchEarnings?: typeof fetchEarningsMany;
  fetchFiling?: typeof fetchDuquesne13f;
}): Promise<void> {
  try {
    if (input.week) await insertDecisionCalls(input.sql, input.week);
    const { calls, scores } = await readCallsAndScores(input.sql);
    const due = scoresDue(calls, scores, bookFromPrices(input.market.prices));
    if (due.length > 0) await insertScores(input.sql, due);
  } catch (error) {
    log({ phase: 'calls', message: safeDbMessage(error) });
    return;
  }
  if (!input.liveFeeds) return;
  try {
    await refreshEarnings(input.sql, input.now, input.fetchEarnings ?? fetchEarningsMany);
  } catch (error) {
    log({ phase: 'earnings', message: safeDbMessage(error) });
  }
  try {
    await refreshFiling(input.sql, input.now, input.fetchFiling ?? fetchDuquesne13f);
  } catch (error) {
    log({ phase: '13f', message: safeDbMessage(error) });
  }
}

export async function refreshEarnings(
  sql: RegimeSql,
  now: Date,
  fetchMany: typeof fetchEarningsMany,
): Promise<void> {
  const saved = await readEarningsRows(sql);
  const fresh = new Set(saved.filter((row) => row.ok && earningsFresh(row.fetchedAt, now)).map((row) => row.symbol));
  const symbols = DRUCK_CANDIDATES.map((candidate) => candidate.symbol).filter((symbol) => !fresh.has(symbol));
  if (symbols.length === 0) return;
  const checks = await fetchMany(symbols, now);
  for (const check of checks) {
    const prior = saved.find((row) => row.symbol === check.symbol);
    if (check.error && prior?.ok) continue;
    await writeEarnings(sql, check);
  }
}

export async function refreshFiling(
  sql: RegimeSql,
  now: Date,
  fetchFiling: typeof fetchDuquesne13f,
): Promise<FilingReport | null> {
  const saved = await readFiling(sql);
  if (saved && filingFresh(saved.fetchedAt, now)) return saved.report;
  const report = await fetchFiling();
  if (!report) return saved?.report ?? null;
  await writeFiling(sql, report, now.toISOString());
  return report;
}

export type { EarningsCheck };
