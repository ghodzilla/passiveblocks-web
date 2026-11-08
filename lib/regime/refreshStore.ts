import type { StoredDecision } from './decision';
import type { StoredFx } from './fx';
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
  /** Checklist saved with this snapshot. Absent on rows written before rule 2026-11-08.1. */
  decision?: StoredDecision | null;
  /** AUDUSD fetched with this snapshot. USD per 1 AUD. Absent on older rows. */
  fx?: StoredFx | null;
}
