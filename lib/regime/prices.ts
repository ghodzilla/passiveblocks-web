import type { Bar } from './signals';
import type { Instrument } from './universe';

export interface PriceSeries {
  symbol: string;
  bars: Bar[];
  asOf: string | null;
  source: 'yahoo' | null;
  error: string | null;
  /** True when Yahoo adjusted close was present. Absent on snapshots saved before this field. */
  adjusted?: boolean | null;
}

export interface PriceBook {
  fetchedAt: string;
  series: PriceSeries[];
  gaps: string[];
}

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

/** US listings use New York. ASX listings (.AX) use Sydney. FX uses the New York clock. */
export function exchangeTimeZone(yahooSymbol: string): string {
  return yahooSymbol.endsWith('.AX') ? 'Australia/Sydney' : 'America/New_York';
}

export function sessionDate(unixSeconds: number, yahooSymbol: string): string {
  const timeZone = exchangeTimeZone(yahooSymbol);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(unixSeconds * 1000));
}

const SESSION_CLOSE_MINUTES = 16 * 60;

function zonedClock(now: Date, timeZone: string): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    date: `${bag.year}-${bag.month}-${bag.day}`,
    minutes: hour * 60 + Number(bag.minute),
  };
}

/**
 * A daily bar is a close only after that exchange's cash session ends.
 * US listings close at 16:00 New York. ASX listings close at 16:00 Sydney.
 * A later calendar day has already closed. A session still in progress has not.
 */
export function sessionHasClosed(session: string, yahooSymbol: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session)) return false;
  const clock = zonedClock(now, exchangeTimeZone(yahooSymbol));
  if (session < clock.date) return true;
  if (session > clock.date) return false;
  return clock.minutes >= SESSION_CLOSE_MINUTES;
}

/**
 * Read adjusted closes from a Yahoo chart payload. Null closes are skipped.
 * Nothing is forward-filled. The current session is omitted until it has closed.
 */
export function parseYahooChart(body: unknown, yahooSymbol: string, now: Date = new Date()): Bar[] {
  if (!body || typeof body !== 'object') return [];
  const result = (body as { chart?: { result?: unknown[] } }).chart?.result?.[0];
  if (!result || typeof result !== 'object') return [];
  const row = result as {
    timestamp?: unknown;
    indicators?: {
      adjclose?: { adjclose?: unknown }[];
      quote?: { close?: unknown; high?: unknown; low?: unknown }[];
    };
  };
  const timestamps = Array.isArray(row.timestamp) ? row.timestamp : [];
  const adjusted = row.indicators?.adjclose?.[0]?.adjclose;
  const quote = row.indicators?.quote?.[0];
  const raw = quote?.close;
  const closes = Array.isArray(adjusted) ? adjusted : Array.isArray(raw) ? raw : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const bars: Bar[] = [];
  const n = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < n; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) continue;
    const high = highs[i];
    const low = lows[i];
    const date = sessionDate(ts, yahooSymbol);
    if (!sessionHasClosed(date, yahooSymbol, now)) continue;
    const bar: Bar = { date, close };
    if (typeof high === 'number' && Number.isFinite(high) && high > 0) bar.high = high;
    if (typeof low === 'number' && Number.isFinite(low) && low > 0) bar.low = low;
    bars.push(bar);
  }
  bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const deduped: Bar[] = [];
  for (const bar of bars) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.date === bar.date) deduped[deduped.length - 1] = bar;
    else deduped.push(bar);
  }
  return deduped;
}

async function fetchYahooOnce(host: string, yahoo: string): Promise<{ bars: Bar[]; adjusted: boolean }> {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahoo)}?range=5y&interval=1d&includeAdjustedClose=true`;
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
    headers: { 'user-agent': 'passiveblocks-regime/1.0 (owner research dashboard)' },
  });
  if (!response.ok) throw new Error(`${yahoo} HTTP ${response.status}`);
  const body: unknown = await response.json();
  return { bars: parseYahooChart(body, yahoo), adjusted: chartUsesAdjustedClose(body) };
}

function chartUsesAdjustedClose(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const result = (body as { chart?: { result?: unknown[] } }).chart?.result?.[0];
  if (!result || typeof result !== 'object') return false;
  const adjusted = (result as { indicators?: { adjclose?: { adjclose?: unknown }[] } }).indicators?.adjclose?.[0]?.adjclose;
  return Array.isArray(adjusted);
}

export async function fetchYahooBars(yahoo: string): Promise<{ bars: Bar[]; adjusted: boolean | null; error: string | null }> {
  let last = 'price request failed';
  for (const host of HOSTS) {
    try {
      const fetched = await fetchYahooOnce(host, yahoo);
      if (fetched.bars.length === 0) {
        last = `${yahoo} returned no prices`;
        continue;
      }
      return { bars: fetched.bars, adjusted: fetched.adjusted, error: null };
    } catch (error) {
      last = error instanceof Error ? error.message : `${yahoo} price request failed`;
    }
  }
  return { bars: [], adjusted: null, error: last };
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

export async function fetchPriceBook(instruments: Instrument[]): Promise<PriceBook> {
  const series = await mapPool(instruments, 6, async (instrument): Promise<PriceSeries> => {
    const fetched = await fetchYahooBars(instrument.yahoo);
    const bars = fetched.bars;
    return {
      symbol: instrument.symbol,
      bars,
      asOf: bars.length > 0 ? bars[bars.length - 1].date : null,
      source: bars.length > 0 ? 'yahoo' : null,
      error: fetched.error,
      adjusted: fetched.adjusted,
    };
  });
  const gaps: string[] = [];
  for (const row of series) {
    if (row.error) gaps.push(`${row.symbol}: ${row.error}`);
  }
  return { fetchedAt: new Date().toISOString(), series, gaps };
}
