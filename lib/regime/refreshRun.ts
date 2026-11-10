import { openAudBook, paperLedgerFrom, retainLegacyPaper, rollAudPaper } from './audPaper';
import { FRED_OBSERVATION_START } from './constants';
import { buildDesk, settleForward } from './desk';
import { fetchRegimeBundle } from './engine';
import { fetchFredSeries } from './fred';
import { buildIdeas } from './ideas';
import { openRegimeSql, safeDbMessage, type RegimeSql } from './db';
import type { Journal } from './journal';
import { FX_CONVENTION, FX_SYMBOL, fxForPrice, type StoredFx } from './fx';
import { fetchPriceBook, fetchYahooBars, type PriceBook } from './prices';
import { heldBookRule } from './consistency';
import { providerSource, refreshLogLine, settleRefresh, type ProviderSource, type RefreshHealth } from './refreshHealth';
import type { StoredRefresh } from './refreshStore';
import { selfCheckFromReport, type SelfCheckRecord } from './selfcheck';
import { decisionFromDesk, type StoredDecision } from './decision';
import { recordPaperSnapshot } from './paperLog';
import { readJournal, readRefresh, writeRefreshBundle } from './state';
import { resolveCapital } from './sizing';
import type { SeriesPoint } from './series';
import { snapshotFromBundle } from './assemble';
import { melbourneDate } from './time';
import { publishRegime } from './view';
import { priceUniverse } from './load';

export function writeRefreshLog(phase: 'start' | 'end' | 'failure', fields: Record<string, string | number | boolean | null>): string {
  const line = refreshLogLine(phase, fields);
  if (phase === 'failure' || fields.outcome === 'failure' || fields.outcome === 'persistence_failure') console.error(line);
  else console.log(line);
  return line;
}

async function themeSeries(seriesId: string, fetchedAt: string): Promise<{ points: SeriesPoint[]; source: ProviderSource }> {
  if (!process.env.FRED_API_KEY) {
    return {
      points: [],
      source: providerSource({
        id: seriesId,
        label: seriesId,
        mandatory: false,
        observationDate: null,
        fetchedAt,
        error: 'FRED_API_KEY is not set',
      }),
    };
  }
  try {
    const points = await fetchFredSeries(seriesId, FRED_OBSERVATION_START);
    return {
      points,
      source: providerSource({
        id: seriesId,
        label: seriesId,
        mandatory: false,
        observationDate: points.length ? points[points.length - 1].date : null,
        fetchedAt,
        error: null,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${seriesId} fetch failed`;
    return {
      points: [],
      source: providerSource({
        id: seriesId,
        label: seriesId,
        mandatory: false,
        observationDate: null,
        fetchedAt,
        error: message,
      }),
    };
  }
}

function priceSource(book: PriceBook): ProviderSource {
  let observationDate: string | null = null;
  for (const series of book.series) {
    const last = series.bars[series.bars.length - 1]?.date ?? null;
    if (last && (!observationDate || last > observationDate)) observationDate = last;
  }
  const error = book.series.length === 0
    ? (book.gaps[0] ?? 'Price book returned no prices')
    : book.gaps.length > 0
      ? book.gaps.join('; ')
      : null;
  return providerSource({
    id: 'yahoo-book',
    label: 'Price book',
    mandatory: false,
    observationDate,
    fetchedAt: book.fetchedAt,
    error,
  });
}

async function fetchAudUsd(now: Date): Promise<StoredFx> {
  const fetchedAt = now.toISOString();
  const quote = await fetchYahooBars(FX_SYMBOL);
  const bars = quote.bars.map((bar) => ({ date: bar.date, close: bar.close }));
  const onOrBefore = fxForPrice(bars, melbourneDate(now));
  return {
    symbol: FX_SYMBOL,
    convention: FX_CONVENTION,
    fetchedAt,
    observationDate: onOrBefore?.fxDate ?? null,
    rate: onOrBefore?.rate ?? null,
    adjusted: quote.adjusted,
    error: quote.error ?? (onOrBefore ? null : 'No AUDUSD rate on or before today.'),
    bars,
  };
}

function fxSource(fx: StoredFx): ProviderSource {
  return providerSource({
    id: FX_SYMBOL,
    label: 'AUDUSD (USD per 1 AUD)',
    mandatory: false,
    observationDate: fx.observationDate,
    fetchedAt: fx.fetchedAt,
    error: fx.error,
  });
}

export async function fetchLiveRefresh(now: Date): Promise<{
  sources: ProviderSource[];
  snapshot: ReturnType<typeof snapshotFromBundle>;
  book: PriceBook;
  realYield: SeriesPoint[];
  dollar: SeriesPoint[];
  fx: StoredFx;
}> {
  const fetchedAt = now.toISOString();
  const [bundle, book, realYield, dollar, fx] = await Promise.all([
    fetchRegimeBundle(now),
    fetchPriceBook(priceUniverse(process.env.REGIME_WATCHLIST)),
    themeSeries('DFII10', fetchedAt),
    themeSeries('DTWEXBGS', fetchedAt),
    fetchAudUsd(now),
  ]);
  return {
    sources: bundle.reports.concat([priceSource(book), fxSource(fx), realYield.source, dollar.source]),
    snapshot: snapshotFromBundle(bundle),
    book,
    realYield: realYield.points,
    dollar: dollar.points,
    fx,
  };
}

function nextRecord(
  previous: StoredRefresh | null,
  health: RefreshHealth,
  live: Awaited<ReturnType<typeof fetchLiveRefresh>>,
  decision: StoredDecision | null,
): StoredRefresh {
  const keepPrevious = health.fetchOutcome === 'failure';
  return {
    health,
    snapshot: keepPrevious ? previous?.snapshot ?? null : live.snapshot,
    book: keepPrevious ? previous?.book ?? null : live.book,
    realYield: keepPrevious ? previous?.realYield ?? [] : live.realYield,
    dollar: keepPrevious ? previous?.dollar ?? [] : live.dollar,
    decision: keepPrevious ? previous?.decision ?? null : decision,
    fx: keepPrevious ? previous?.fx ?? null : live.fx,
  };
}

async function rolledState(live: Awaited<ReturnType<typeof fetchLiveRefresh>>, sql: RegimeSql): Promise<{
  journal: Journal | null;
  selfCheck: SelfCheckRecord | null;
  decision: StoredDecision | null;
}> {
  const read = await readJournal(sql);
  if (read.gap) throw new Error('Refusing to roll a journal that was not read from Neon.');
  const capital = resolveCapital(process.env.REGIME_CAPITAL, read.settings.capital);
  const separated = openAudBook(retainLegacyPaper(read), live.snapshot.today, capital);
  const ideas = buildIdeas({ snapshot: live.snapshot, book: live.book, watchlist: process.env.REGIME_WATCHLIST });
  const desk = buildDesk({
    snapshot: live.snapshot,
    ideas,
    book: live.book,
    realYield: live.realYield,
    dollar: live.dollar,
    journal: separated,
    envCapital: process.env.REGIME_CAPITAL,
    envTarget: process.env.REGIME_TARGET_CAGR,
  });
  const published = publishRegime({ snapshot: live.snapshot, ideas, desk });
  const prices: Record<string, number> = {};
  const asOf: Record<string, string> = {};
  const bars: Record<string, PriceBook['series'][number]['bars']> = {};
  for (const series of live.book.series) {
    const last = series.bars[series.bars.length - 1];
    if (last && last.close > 0) {
      prices[series.symbol] = last.close;
      asOf[series.symbol] = last.date;
    }
    bars[series.symbol] = series.bars;
  }
  const aud = separated.audBook;
  if (!aud) throw new Error('The AUD paper book was not opened.');
  separated.audBook = rollAudPaper(aud, {
    date: live.snapshot.today,
    lines: desk.lines.map((line) => ({
      symbol: line.symbol,
      weight: line.weight,
      stop: line.stop,
      role: line.role,
      defensive: line.defensive,
    })),
    local: prices,
    asOf,
    fxBars: live.fx.error ? null : live.fx.bars,
    fxFetchedAt: live.fx.fetchedAt,
    fxError: live.fx.error,
    maxGross: live.snapshot.effectiveBudget.maxGross,
    maxNet: live.snapshot.effectiveBudget.maxNet,
    haltNewEntries: desk.halted,
    overlapGroups: desk.overlap.groups.map((group) => group.symbols),
  });
  const rolled = separated;
  rolled.outcomes = settleForward(rolled.calls, bars);
  const held = heldBookRule(paperLedgerFrom(rolled));
  const rules = published.consistency.rules.some((rule) => rule.id === 'held-book')
    ? published.consistency.rules.map((rule) => (rule.id === 'held-book' ? held : rule))
    : published.consistency.rules.concat(held);
  return {
    journal: rolled,
    selfCheck: selfCheckFromReport({ rules }, live.snapshot.generatedAt),
    decision: decisionFromDesk({
      desk: published.desk,
      signalHealth: published.ideas.signalHealth,
      storedAt: live.snapshot.generatedAt,
    }),
  };
}

export async function executeRegimeRefresh(input: {
  now?: Date;
  trigger: 'cron' | 'owner';
  sql?: RegimeSql | null;
}): Promise<{ health: RefreshHealth; stored: StoredRefresh | null }> {
  const now = input.now ?? new Date();
  const sql = input.sql === undefined ? await openRegimeSql() : input.sql;
  writeRefreshLog('start', { trigger: input.trigger, at: now.toISOString() });
  try {
    const read = sql ? await readRefresh(sql) : { status: 'unconfigured' as const, value: null };
    const previous = read.status === 'ok' ? read.value : null;
    const live = await fetchLiveRefresh(now);
    const durable = Boolean(sql);
    const canWrite = Boolean(sql) && read.status === 'ok';
    if (sql && read.status !== 'ok') {
      writeRefreshLog('failure', {
        trigger: input.trigger,
        message: read.status === 'missing_schema' ? 'regime tables are missing' : 'Neon read failed before the save',
      });
    }
    let journal: Journal | null = null;
    let selfCheck: SelfCheckRecord | null = null;
    let decision: StoredDecision | null = null;
    const preview = settleRefresh({
      now,
      previous: previous?.health ?? null,
      sources: live.sources,
      durable,
      writeOk: true,
    });
    if (preview.fetchOutcome !== 'failure' && sql && canWrite) {
      try {
        const rolled = await rolledState(live, sql);
        journal = rolled.journal;
        selfCheck = rolled.selfCheck;
        decision = rolled.decision;
      } catch (error) {
        writeRefreshLog('failure', { trigger: input.trigger, message: safeDbMessage(error) });
      }
    }
    let writeOk = false;
    if (sql && canWrite) {
      const optimistic = settleRefresh({
        now,
        previous: previous?.health ?? null,
        sources: live.sources,
        durable: true,
        writeOk: true,
      });
      try {
        await writeRefreshBundle(sql, {
          refresh: nextRecord(previous, optimistic, live, decision),
          journal,
          selfCheck,
        });
        writeOk = true;
      } catch (error) {
        writeRefreshLog('failure', { trigger: input.trigger, message: safeDbMessage(error) });
      }
    }
    const health = settleRefresh({
      now,
      previous: previous?.health ?? null,
      sources: live.sources,
      durable,
      writeOk,
    });
    const stored = writeOk ? nextRecord(previous, health, live, decision) : previous;
    if (writeOk && sql && stored?.decision && stored.snapshot) {
      const fx = stored.fx && !stored.fx.error && stored.fx.bars.length > 0 ? stored.fx.bars : null;
      const paper = await recordPaperSnapshot(sql, stored, fx, journal?.audBook ?? null);
      if (paper === 'outage') writeRefreshLog('failure', { trigger: input.trigger, message: 'paper decision log was not appended' });
    }
    writeRefreshLog('end', {
      trigger: input.trigger,
      outcome: health.outcome,
      fetchOutcome: health.fetchOutcome,
      persisted: health.persisted,
      durable: health.durable,
      sourceErrors: health.sources.filter((source) => source.error).length,
    });
    return { health, stored };
  } catch (error) {
    writeRefreshLog('failure', { trigger: input.trigger, message: safeDbMessage(error) });
    throw error;
  }
}
