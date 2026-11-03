import type { ActionId } from './classify';
import type { ComponentId, RegimeId, RiskBudget } from './constants';

export interface FreshnessRow {
  id: string;
  label: string;
  asOf: string | null;
  ageDays: number | null;
  stale: boolean;
  staleAfterDays: number;
  source: string;
  href: string;
  latest: number | null;
}

export interface ComponentScore {
  id: ComponentId;
  label: string;
  z: number | null;
  included: boolean;
  weight: number;
  asOf: string | null;
  gap: string | null;
  detail: string;
  reading: string;
}

export interface HistoryPoint {
  date: string;
  composite: number | null;
  regime: RegimeId | null;
  liquidity: number | null;
  policy: number | null;
  credit: number | null;
  growth: number | null;
  positioning: number | null;
  ai: number | null;
}

export interface RegimeSnapshot {
  rulesVersion: string;
  generatedAt: string;
  today: string;
  printDate: string | null;
  regime: RegimeId | null;
  regimeLabel: string;
  composite: number | null;
  actionable: boolean;
  weak: boolean;
  action: ActionId;
  message: string;
  modelBudget: RiskBudget | null;
  effectiveBudget: RiskBudget;
  budgetOverridden: boolean;
  components: ComponentScore[];
  history: HistoryPoint[];
  freshness: FreshnessRow[];
  gaps: string[];
}
