import { revalidateTag, unstable_cache } from 'next/cache';
import { FRED_OBSERVATION_START } from './constants';
import { applyPaperDay, buildDesk, settleForward, type Desk } from './desk';
import type { ConsistencyReport } from './consistency';
import { publishRegime } from './view';
import { buildRegimeSnapshot } from './engine';
import { fetchFredSeries } from './fred';
import { buildIdeas, type IdeasReport } from './ideas';
import { readJournal, writeJournal, type Journal } from './journal';
import { fetchPriceBook, type PriceBook } from './prices';
import type { SeriesPoint } from './series';
import { THEMES } from './themes.config';
import type { RegimeSnapshot } from './types';
import { resolveUniverse, type Instrument } from './universe';

const TAG = 'regime-snapshot';

/**
 * Regime snapshot cache. This is Next.js unstable_cache (the Vercel runtime
 * cache), not Supabase. Inner FRED and CFTC fetches are no-store. The price
 * book below shares the regime-snapshot tag. Cron drops that tag and rebuilds
 * both. Page views inside the hour reuse the cached snapshot.
 */
export const getCachedRegimeSnapshot = unstable_cache(
  async () => buildRegimeSnapshot(new Date()),
  ['regime-snapshot-v2'],
  { revalidate: 60 * 60, tags: [TAG] },
);

/**
 * Daily prices for the playbook and the watchlist. Same tag as the regime
 * snapshot, so the existing cron refreshes both. Inner Yahoo fetches are
 * no-store. A failed symbol is a gap, not a made-up price.
 */
export function priceUniverse(watchlist: string | undefined): Instrument[] {
  const base = resolveUniverse(watchlist);
  const have = new Set(base.map((item) => item.symbol));
  const extras: Instrument[] = [];
  for (const theme of THEMES) {
    for (const symbol of theme.symbols) {
      if (have.has(symbol.symbol)) continue;
      have.add(symbol.symbol);
      extras.push({
        symbol: symbol.symbol,
        name: symbol.name,
        venue: 'US',
        kind: symbol.kind === 'stock' ? 'stock' : 'etf',
        role: symbol.kind === 'stock' ? 'systematic' : 'tactical',
        defensive: false,
        assetClass: 'equities',
        yahoo: symbol.yahoo,
      });
    }
  }
  return base.concat(extras);
}

export const getCachedPriceBook = unstable_cache(
  async () => fetchPriceBook(priceUniverse(process.env.REGIME_WATCHLIST)),
  ['regime-prices-v2'],
  { revalidate: 60 * 60 * 24, tags: [TAG] },
);

async function fetchMacro(seriesId: string): Promise<SeriesPoint[]> {
  if (!process.env.FRED_API_KEY) return [];
  try {
    return await fetchFredSeries(seriesId, FRED_OBSERVATION_START);
  } catch {
    return [];
  }
}

export const getCachedThemeMacro = unstable_cache(
  async () => {
    const [realYield, dollar] = await Promise.all([fetchMacro('DFII10'), fetchMacro('DTWEXBGS')]);
    return { realYield, dollar };
  },
  ['regime-theme-macro-v1'],
  { revalidate: 60 * 60, tags: [TAG] },
);

async function loadPriceBook(): Promise<PriceBook> {
  try {
    return await getCachedPriceBook();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Price book fetch failed';
    return { fetchedAt: new Date().toISOString(), series: [], gaps: [message] };
  }
}

export async function getRegimeWithIdeas(): Promise<{ snapshot: RegimeSnapshot; ideas: IdeasReport; book: PriceBook }> {
  const [snapshot, book] = await Promise.all([getCachedRegimeSnapshot(), loadPriceBook()]);
  return {
    snapshot,
    book,
    ideas: buildIdeas({ snapshot, book, watchlist: process.env.REGIME_WATCHLIST }),
  };
}

export async function getRegimeDesk(): Promise<{ snapshot: RegimeSnapshot; ideas: IdeasReport; book: PriceBook; desk: Desk; journal: Journal; consistency: ConsistencyReport }> {
  const [{ snapshot, ideas, book }, macro, journal] = await Promise.all([
    getRegimeWithIdeas(),
    getCachedThemeMacro().catch(() => ({ realYield: [] as SeriesPoint[], dollar: [] as SeriesPoint[] })),
    readJournal(),
  ]);
  const desk = buildDesk({
    snapshot,
    ideas,
    book,
    realYield: macro.realYield,
    dollar: macro.dollar,
    journal,
    envCapital: process.env.REGIME_CAPITAL,
    envTarget: process.env.REGIME_TARGET_CAGR,
  });
  const published = publishRegime({ snapshot, ideas, desk });
  return { snapshot, ideas: published.ideas, book, desk, journal, consistency: published.consistency };
}

export async function refreshRegimeSnapshot() {
  revalidateTag(TAG);
  const view = await getRegimeDesk();
  try {
    const prices: Record<string, number> = {};
    const bars: Record<string, PriceBook['series'][number]['bars']> = {};
    for (const series of view.book.series) {
      const last = series.bars[series.bars.length - 1];
      if (last && last.close > 0) prices[series.symbol] = last.close;
      bars[series.symbol] = series.bars;
    }
    const rolled = applyPaperDay({
      journal: view.journal,
      desk: view.desk,
      prices,
      date: view.snapshot.today,
      capital: view.desk.capital,
    });
    rolled.outcomes = settleForward(rolled.calls, bars);
    await writeJournal(rolled);
  } catch {
    view.desk.gaps.push('The paper journal was not saved on this refresh.');
  }
  return { ...view.snapshot, ideas: view.ideas, desk: view.desk };
}
