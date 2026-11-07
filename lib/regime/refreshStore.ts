import { list, put } from '@vercel/blob';
import type { PriceBook } from './prices';
import type { RefreshHealth } from './refreshHealth';
import type { SeriesPoint } from './series';
import { openJournal, sealJournal } from './journal';
import type { RegimeSnapshot } from './types';

export const REFRESH_PATHNAME = 'regime/refresh.json';

export interface StoredRefresh {
  health: RefreshHealth;
  /** Last snapshot whose mandatory feeds arrived. Null until the first partial or full save. */
  snapshot: RegimeSnapshot | null;
  book: PriceBook | null;
  realYield: SeriesPoint[];
  dollar: SeriesPoint[];
}

export interface RefreshStore {
  durable: boolean;
  read(): Promise<StoredRefresh | null>;
  write(record: StoredRefresh): Promise<void>;
}

export function memoryRefreshStore(): RefreshStore & { saved: StoredRefresh | null } {
  const box: { saved: StoredRefresh | null } = { saved: null };
  return {
    durable: true,
    saved: null,
    async read() {
      return box.saved;
    },
    async write(record) {
      box.saved = record;
      this.saved = record;
    },
  };
}

function blobConfigured(): { token: string; secret: string } | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const secret = process.env.REGIME_SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return null;
  return { token, secret };
}

export function durableRefreshStore(): RefreshStore | null {
  const config = blobConfigured();
  if (!config) return null;
  return {
    durable: true,
    async read() {
      const found = await list({ prefix: REFRESH_PATHNAME, token: config.token, limit: 10 });
      const blob = found.blobs.find((item) => item.pathname === REFRESH_PATHNAME);
      if (!blob) return null;
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Refresh blob HTTP ${response.status}`);
      const parsed = JSON.parse(openJournal(await response.text(), config.secret)) as StoredRefresh;
      if (!parsed || !parsed.health || !Array.isArray(parsed.health.sources)) return null;
      return parsed;
    },
    async write(record) {
      await put(REFRESH_PATHNAME, sealJournal(JSON.stringify(record), config.secret), {
        access: 'public',
        token: config.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'text/plain',
      });
    },
  };
}

export async function readStoredRefresh(): Promise<StoredRefresh | null> {
  const store = durableRefreshStore();
  if (!store) return null;
  try {
    return await store.read();
  } catch {
    return null;
  }
}
