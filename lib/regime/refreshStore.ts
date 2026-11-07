import type { PriceBook } from './prices';
import type { RefreshHealth } from './refreshHealth';
import type { SeriesPoint } from './series';
import type { RegimeSnapshot } from './types';

export interface StoredRefresh {
  health: RefreshHealth;
  /** Last snapshot whose mandatory feeds arrived. Null until the first partial or full save. */
  snapshot: RegimeSnapshot | null;
  book: PriceBook | null;
  realYield: SeriesPoint[];
  dollar: SeriesPoint[];
}
