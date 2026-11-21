import { FRED_SERIES, STALE_AFTER_DAYS } from './constants';
import { openRegimeSql, safeDbMessage, type RegimeSql } from './db';
import { FX_SYMBOL } from './fx';
import { fetchFredSeries } from './fred';
import { fetchYahooBars } from './prices';
import { readRefresh } from './state';
import type { SeriesPoint } from './series';
import {
  DRUCK_CANDIDATES,
  DRUCK_CASH_SYMBOL,
  DRUCK_SPY,
  DRUCK_BOOK_ID,
  DRUCK_RULE,
} from './druck.config';
import {
  plainDate,
  spreadPair,
  stepDruck,
  type CloseBar,
  type DruckMarket,
  type DruckOutcome,
  type DruckSnapshot,
} from './druck';
import { readDruck, writeDruck, type DruckRecord } from './druckStore';

export interface DruckRefreshResult {
  outcome: DruckOutcome | 'unconfigured' | 'missing_schema' | 'outage';
  banner: string | null;
  errors: string[];
  decisionDate: string | null;
  phase: DruckSnapshot['phase'] | null;
}

function log(fields: Record<string, string | number | boolean | null>): void {
  const line = JSON.stringify({ event: 'druck_refresh', ...fields });
  if (fields.outcome === 'outage' || fields.outcome === 'feed_failed') console.error(line);
  else console.log(line);
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers: Promise<void>[] = [];
  const count = Math.min(limit, items.length);
  for (let i = 0; i < count; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

export function liquidityFromSnapshot(snapshot: { today?: string; generatedAt?: string; components?: { id: string; z: number | null; asOf?: string | null }[] } | null): { z: number | null; asOf: string | null; error: string | null } {
  if (!snapshot) return { z: null, asOf: null, error: 'The saved regime snapshot has no liquidity score. No new buys.' };
  const row = snapshot.components?.find((component) => component.id === 'liquidity');
  if (!row || row.z == null || !Number.isFinite(row.z)) {
    return { z: null, asOf: null, error: 'The liquidity score is missing from the regime snapshot. No new buys.' };
  }
  const asOf = (snapshot.today && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.today) ? snapshot.today : null)
    ?? (snapshot.generatedAt ? snapshot.generatedAt.slice(0, 10) : null);
  return { z: row.z, asOf, error: null };
}

export async function loadDruckMarket(input: {
  now: Date;
  symbols: string[];
  liquidity: { z: number | null; asOf: string | null; error: string | null };
  fetchBars?: (symbol: string) => Promise<{ bars: CloseBar[]; error: string | null }>;
  fetchSpreads?: () => Promise<SeriesPoint[]>;
}): Promise<DruckMarket> {
  const fetchBars = input.fetchBars ?? (async (symbol: string) => {
    const fetched = await fetchYahooBars(symbol);
    return { bars: fetched.bars.map((bar) => ({ date: bar.date, close: bar.close })), error: fetched.error };
  });
  const fetchSpreads = input.fetchSpreads ?? (() => fetchFredSeries(FRED_SERIES.hy, '2012-01-01'));
  const errors: string[] = [];
  if (input.liquidity.error) errors.push(input.liquidity.error);
  const symbols = input.symbols.filter((symbol, index) => input.symbols.indexOf(symbol) === index);
  const [quotes, spreads] = await Promise.all([
    mapPool(symbols, 6, async (symbol) => {
      try {
        const fetched = await fetchBars(symbol);
        return { symbol, bars: fetched.bars, error: fetched.error };
      } catch (error) {
        return { symbol, bars: [] as CloseBar[], error: error instanceof Error ? error.message : `${symbol} did not arrive.` };
      }
    }),
    fetchSpreads().then(
      (points) => ({ points, error: null as string | null }),
      (error: unknown) => ({ points: [] as SeriesPoint[], error: error instanceof Error ? error.message : 'The high-yield spread did not arrive.' }),
    ),
  ]);
  const prices: Record<string, CloseBar[]> = {};
  for (const quote of quotes) {
    if (quote.error || quote.bars.length === 0) errors.push(quote.error ?? `${quote.symbol} did not arrive.`);
    prices[quote.symbol] = quote.bars;
  }
  let spreadNow: number | null = null;
  let spreadThen: number | null = null;
  let spreadAsOf: string | null = null;
  if (spreads.error) errors.push(spreads.error.includes('high-yield') ? spreads.error : `The high-yield spread did not arrive. ${spreads.error}`);
  else {
    const spyLast = prices[DRUCK_SPY]?.filter((bar) => bar.close > 0).at(-1)?.date ?? null;
    const decision = spyLast;
    if (decision) {
      const pair = spreadPair(spreads.points, decision);
      if ('error' in pair) errors.push(pair.error);
      else {
        spreadNow = pair.now;
        spreadThen = pair.then;
        spreadAsOf = pair.asOf;
      }
    }
  }
  return {
    now: input.now,
    prices,
    liquidity: input.liquidity.z,
    liquidityAsOf: input.liquidity.asOf,
    spreadNow,
    spreadThen,
    spreadAsOf,
    errors,
  };
}

function wantedSymbols(held: { symbol: string }[]): string[] {
  const symbols = [
    DRUCK_SPY,
    DRUCK_CASH_SYMBOL,
    FX_SYMBOL,
    ...DRUCK_CANDIDATES.map((candidate) => candidate.symbol),
    ...held.map((position) => position.symbol),
  ];
  return symbols.filter((symbol, index) => symbols.indexOf(symbol) === index);
}

function recordFrom(step: ReturnType<typeof stepDruck>, at: string): DruckRecord {
  return {
    ruleVersion: DRUCK_RULE,
    bookId: DRUCK_BOOK_ID,
    updatedAt: at,
    attempt: {
      at,
      outcome: step.outcome,
      errors: step.errors,
      banner: step.banner,
    },
    snapshot: step.snapshot,
  };
}

export async function runDruckRefresh(input: {
  now?: Date;
  trigger: 'cron' | 'owner';
  sql?: RegimeSql | null;
  market?: DruckMarket;
}): Promise<DruckRefreshResult> {
  const now = input.now ?? new Date();
  const sql = input.sql === undefined ? await openRegimeSql() : input.sql;
  log({ phase: 'start', trigger: input.trigger, at: now.toISOString() });
  if (!sql) {
    log({ phase: 'end', trigger: input.trigger, outcome: 'unconfigured' });
    return { outcome: 'unconfigured', banner: 'No database is configured for this page. Nothing is bought.', errors: [], decisionDate: null, phase: null };
  }
  try {
    const read = await readDruck(sql);
    if (read.status === 'missing_schema' || read.status === 'outage') {
      log({ phase: 'end', trigger: input.trigger, outcome: read.status });
      return {
        outcome: read.status,
        banner: read.status === 'missing_schema'
          ? 'The Druckenmiller tables are not in the database yet. Apply db/regime/004_druck_snapshots.sql. Nothing is bought before that.'
          : 'The saved Druckenmiller week could not be read. Nothing new is bought.',
        errors: [],
        decisionDate: null,
        phase: null,
      };
    }
    const previous = read.record?.snapshot ?? null;
    const at = now.toISOString();
    let market = input.market;
    if (!market) {
      const refresh = await readRefresh(sql);
      const liquidity = refresh.status === 'ok'
        ? liquidityFromSnapshot(refresh.value?.snapshot ?? null)
        : { z: null, asOf: null, error: 'The saved regime snapshot could not be read. No new buys.' };
      if (liquidity.asOf && liquidity.error == null) {
        const age = Math.round((now.getTime() - Date.parse(`${liquidity.asOf}T00:00:00Z`)) / 86_400_000);
        if (age > STALE_AFTER_DAYS.daily) {
          liquidity.z = null;
          liquidity.error = `The liquidity score is from ${plainDate(liquidity.asOf)}, which is too old to use.`;
        }
      }
      market = await loadDruckMarket({
        now,
        symbols: wantedSymbols(previous?.positions ?? []),
        liquidity,
      });
    }
    const step = stepDruck(previous, market);
    const wrote = await writeDruck(sql, recordFrom(step, at), step.week);
    const outcome: DruckRefreshResult['outcome'] = wrote === 'saved' ? step.outcome : wrote;
    log({
      phase: 'end',
      trigger: input.trigger,
      outcome,
      decision: step.snapshot?.decisionDate ?? null,
      errors: step.errors.length,
    });
    return {
      outcome,
      banner: step.banner,
      errors: step.errors,
      decisionDate: step.snapshot?.decisionDate ?? null,
      phase: step.snapshot?.phase ?? null,
    };
  } catch (error) {
    log({ phase: 'end', trigger: input.trigger, outcome: 'outage', message: safeDbMessage(error) });
    return { outcome: 'outage', banner: 'The Druckenmiller refresh stopped before a week was saved. Nothing new is bought.', errors: [], decisionDate: null, phase: null };
  }
}
