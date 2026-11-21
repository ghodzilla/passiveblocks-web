import { openRegimeSql, safeDbMessage, type RegimeSql } from './db';
import { paperLedgerFrom } from './audPaper';
import { readJournal } from './state';
import { resolveCapital } from './sizing';
import { fetchYahooBars } from './prices';
import {
  VISSER_BOOK_ID,
  VISSER_RULE,
  VISSER_SLEEVES,
  satelliteShare,
  plainDate,
  stepVisser,
  type CloseBar,
  type SleeveId,
  type VisserMarket,
  type VisserOutcome,
  type VisserSnapshot,
} from './visser';
import { readVisser, writeVisser, type VisserRecord } from './visserStore';

export interface VisserRefreshResult {
  outcome: VisserOutcome | 'unconfigured' | 'missing_schema' | 'outage';
  banner: string | null;
  errors: string[];
  decisionDate: string | null;
  phase: VisserSnapshot['phase'] | null;
}

function log(fields: Record<string, string | number | boolean | null>): void {
  const line = JSON.stringify({ event: 'visser_refresh', ...fields });
  if (fields.outcome === 'outage' || fields.outcome === 'feed_failed') console.error(line);
  else console.log(line);
}

async function portfolioFor(sql: RegimeSql): Promise<{ aud: number; basis: 'paper value' | 'starting amount' } | { error: string }> {
  const journal = await readJournal(sql);
  if (journal.gap) return { error: 'The main paper book could not be read. No new buys.' };
  const ledger = paperLedgerFrom(journal);
  if (ledger.currency === 'AUD' && ledger.valued && ledger.equity != null && ledger.equity > 0) {
    return { aud: ledger.equity, basis: 'paper value' };
  }
  const capital = resolveCapital(process.env.REGIME_CAPITAL, journal.settings.capital);
  if (!(capital > 0)) return { error: 'No Australian dollar portfolio value is stored. No new buys.' };
  return { aud: capital, basis: 'starting amount' };
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

function wantedSymbols(): { symbol: string; kind: 'signal' | 'buy'; sleeve: SleeveId }[] {
  const rows: { symbol: string; kind: 'signal' | 'buy'; sleeve: SleeveId }[] = [];
  const seen = new Set<string>();
  for (const sleeve of VISSER_SLEEVES) {
    if (!seen.has(sleeve.signal)) {
      seen.add(sleeve.signal);
      rows.push({ symbol: sleeve.signal, kind: 'signal', sleeve: sleeve.id });
    }
    if (!seen.has(sleeve.buy)) {
      seen.add(sleeve.buy);
      rows.push({ symbol: sleeve.buy, kind: 'buy', sleeve: sleeve.id });
    }
  }
  return rows;
}

export async function loadVisserMarket(
  now: Date,
  fetchBars: (symbol: string) => Promise<{ bars: CloseBar[]; error: string | null }> = async (symbol) => {
    const fetched = await fetchYahooBars(symbol);
    return {
      bars: fetched.bars.map((bar) => ({ date: bar.date, close: bar.close })),
      error: fetched.error,
    };
  },
): Promise<VisserMarket> {
  const quotes = await mapPool(wantedSymbols(), 6, async (row) => {
    try {
      const fetched = await fetchBars(row.symbol);
      return { ...row, bars: fetched.bars, error: fetched.error };
    } catch (error) {
      return { ...row, bars: [], error: error instanceof Error ? error.message : `${row.symbol} did not arrive.` };
    }
  });
  const signals = {} as VisserMarket['signals'];
  const tradables = {} as VisserMarket['tradables'];
  for (const sleeve of VISSER_SLEEVES) {
    signals[sleeve.id] = [];
    tradables[sleeve.id] = [];
  }
  const errors: string[] = [];
  for (const quote of quotes) {
    if (quote.error || quote.bars.length === 0) errors.push(quote.error ?? `${quote.symbol} did not arrive.`);
    if (quote.kind === 'signal') signals[quote.sleeve] = quote.bars;
    else tradables[quote.sleeve] = quote.bars;
  }
  return { now, signals, tradables, errors };
}

function recordFrom(
  step: ReturnType<typeof stepVisser>,
  shareNote: string | null,
  at: string,
): VisserRecord {
  return {
    ruleVersion: VISSER_RULE,
    bookId: VISSER_BOOK_ID,
    updatedAt: at,
    shareNote,
    attempt: {
      at,
      outcome: step.outcome,
      errors: step.errors,
      banner: step.banner,
    },
    snapshot: step.snapshot,
  };
}

export async function runVisserRefresh(input: {
  now?: Date;
  trigger: 'cron' | 'owner';
  sql?: RegimeSql | null;
  market?: VisserMarket;
}): Promise<VisserRefreshResult> {
  const now = input.now ?? new Date();
  const sql = input.sql === undefined ? await openRegimeSql() : input.sql;
  log({ phase: 'start', trigger: input.trigger, at: now.toISOString() });
  if (!sql) {
    log({ phase: 'end', trigger: input.trigger, outcome: 'unconfigured' });
    return { outcome: 'unconfigured', banner: 'No database is configured for this page. Nothing is bought.', errors: [], decisionDate: null, phase: null };
  }
  try {
    const read = await readVisser(sql);
    if (read.status === 'missing_schema' || read.status === 'outage') {
      log({ phase: 'end', trigger: input.trigger, outcome: read.status });
      return {
        outcome: read.status,
        banner: read.status === 'missing_schema'
          ? 'The Visser tables are not in the database yet. Apply db/regime/003_visser_snapshots.sql. Nothing is bought before that.'
          : 'The saved Visser week could not be read. Nothing new is bought.',
        errors: [],
        decisionDate: null,
        phase: null,
      };
    }
    const previous = read.record?.snapshot ?? null;
    const portfolio = await portfolioFor(sql);
    const share = satelliteShare(process.env.VISSER_SATELLITE_SHARE);
    const at = now.toISOString();
    if ('error' in portfolio) {
      const step = {
        outcome: 'feed_failed' as const,
        banner: `${portfolio.error} ${previous ? `Showing the saved week of ${plainDate(previous.decisionDate)}. ` : ''}No new buys. Nothing is sold just because a feed is down.`,
        errors: [portfolio.error],
        snapshot: previous,
        week: null,
      };
      const wrote = await writeVisser(sql, recordFrom(step, read.record?.shareNote ?? share.note, at), null);
      log({ phase: 'end', trigger: input.trigger, outcome: wrote === 'saved' ? 'feed_failed' : wrote });
      return {
        outcome: wrote === 'saved' ? 'feed_failed' : wrote,
        banner: step.banner,
        errors: step.errors,
        decisionDate: previous?.decisionDate ?? null,
        phase: previous?.phase ?? null,
      };
    }
    const market = input.market ?? await loadVisserMarket(now);
    const step = stepVisser(previous, market, portfolio, share.share);
    const wrote = await writeVisser(sql, recordFrom(step, share.note, at), step.week);
    const outcome: VisserRefreshResult['outcome'] = wrote === 'saved' ? step.outcome : wrote;
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
    return { outcome: 'outage', banner: 'The Visser refresh stopped before a week was saved. Nothing new is bought.', errors: [], decisionDate: null, phase: null };
  }
}
