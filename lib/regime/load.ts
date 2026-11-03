import { revalidateTag, unstable_cache } from 'next/cache';
import { buildRegimeSnapshot } from './engine';
import { buildIdeas, type IdeasReport } from './ideas';
import { fetchPriceBook, type PriceBook } from './prices';
import type { RegimeSnapshot } from './types';
import { resolveUniverse } from './universe';

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
export const getCachedPriceBook = unstable_cache(
  async () => fetchPriceBook(resolveUniverse(process.env.REGIME_WATCHLIST)),
  ['regime-prices-v1'],
  { revalidate: 60 * 60 * 24, tags: [TAG] },
);

async function loadPriceBook(): Promise<PriceBook> {
  try {
    return await getCachedPriceBook();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Price book fetch failed';
    return { fetchedAt: new Date().toISOString(), series: [], gaps: [message] };
  }
}

export async function getRegimeWithIdeas(): Promise<{ snapshot: RegimeSnapshot; ideas: IdeasReport }> {
  const [snapshot, book] = await Promise.all([getCachedRegimeSnapshot(), loadPriceBook()]);
  return {
    snapshot,
    ideas: buildIdeas({ snapshot, book, watchlist: process.env.REGIME_WATCHLIST }),
  };
}

export async function refreshRegimeSnapshot() {
  revalidateTag(TAG);
  const { snapshot, ideas } = await getRegimeWithIdeas();
  return { ...snapshot, ideas };
}
