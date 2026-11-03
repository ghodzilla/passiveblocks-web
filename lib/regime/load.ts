import { revalidateTag, unstable_cache } from 'next/cache';
import { buildRegimeSnapshot } from './engine';

const TAG = 'regime-snapshot';

/**
 * Snapshot cache. This is Next.js unstable_cache (the Vercel runtime cache),
 * not Supabase. Inner FRED and CFTC fetches are no-store; this wrapper is the
 * only cache. Cron calls refreshRegimeSnapshot, which drops the tag and
 * rebuilds. Page views inside the hour reuse the cached snapshot.
 */
export const getCachedRegimeSnapshot = unstable_cache(
  async () => buildRegimeSnapshot(new Date()),
  ['regime-snapshot-v1'],
  { revalidate: 60 * 60, tags: [TAG] },
);

export async function refreshRegimeSnapshot() {
  revalidateTag(TAG);
  return getCachedRegimeSnapshot();
}
