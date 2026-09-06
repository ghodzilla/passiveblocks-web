import convictionJson from '@/data/os/conviction.json';
import targetBookJson from '@/data/os/target-book.json';
import paperPortfolioJson from '@/data/os/paper-portfolio.json';

export type ConvictionRow = {
  symbol: string;
  score: number;
  tier: string;
  sleeve: string;
  theme_bucket: string;
  instrument: string;
  why: string;
  vera_book_signed: boolean;
};

export type BookPosition = {
  symbol: string;
  weight_pct: number;
  instrument: string;
  venue: string;
  sleeve: string;
  theme_bucket: string;
  score: number;
  tier: string;
};

export const conviction = convictionJson as {
  as_of: string;
  vera_signed: boolean;
  mode: string;
  rows: ConvictionRow[];
  note: string;
  vera_line_sign_ref?: {
    status: string;
    signed_at: string;
    signed_by: string;
    book_eligible_symbols: string[];
    vetoed_symbols: string[];
  };
};

export const targetBook = targetBookJson as {
  as_of: string;
  mode: string;
  status: string;
  cash_pct: number;
  invested_pct: number;
  theme_exposure_pct: Record<string, number>;
  risk_ceilings_ref: {
    max_drawdown_pct: number;
    max_il_budget_pct: number;
    max_single_name_pct: number;
    max_single_theme_pct: number;
    kill_switch: boolean;
  };
  vera_book_signed: boolean;
  vera_book_signed_by: string;
  vera_book_signed_at: string;
  positions: BookPosition[];
};

export const paperPortfolio = paperPortfolioJson as {
  mode: string;
  live_blocked: boolean;
  cash_pct: number;
  equity: number;
  currency: string;
  updated: string;
  last_fill_count: number;
  positions: Array<{
    symbol: string;
    weight_pct: number;
    sleeve: string;
    score: number;
    instrument: string;
    venue: string;
    asset_class: string;
  }>;
};

export function formatPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function formatScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatAsOf(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}
