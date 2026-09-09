import convictionJson from '@/data/os/conviction.json';
import convictionShowJson from '@/data/os/conviction-show.json';
import targetBookJson from '@/data/os/target-book.json';
import paperPortfolioJson from '@/data/os/paper-portfolio.json';
import signalPackJson from '@/data/os/signal-pack.json';
import liquidityCardJson from '@/data/os/liquidity-card.json';

export type SignalCall = { asset: string; stance: string };
export type RecentSignal = {
  figure: string;
  org?: string;
  lane?: string;
  date: string;
  title: string;
  url?: string;
  summary?: string;
  themes: string[];
  calls: SignalCall[];
};

export type ThemeCall = {
  name: string;
  stance: string;
  citation_count: number;
  citations: string[];
};

export const signalPack = signalPackJson as {
  status: {
    gate: string;
    as_of: string;
    valid_until?: string;
    author_sense?: string;
    adopted_by?: string;
    paper_book_action?: string;
    conditions?: string[];
    note?: string;
    signals_json?: { n_records?: number; generated?: string };
  };
  brief: {
    as_of: string;
    timezone?: string;
    gate: string;
    author: string;
    adopted_by?: string;
    adopted_at?: string;
    regime_one_liner: string;
    paper_book_action?: string;
    paper_book_implications?: Record<string, string[]>;
    pending?: string;
    falsifiers: string[];
    themes: ThemeCall[];
    signals_json_n?: number;
    signals_json_generated?: string;
    brief_md?: string;
  };
  recent_signals: RecentSignal[];
};


export type LiquidityCell = {
  id: string;
  status: 'FILLED' | 'INSUFFICIENT';
  group: string;
  label: string;
  headline: string;
  detail?: string;
  as_of?: string;
  publisher?: string;
  source_url?: string;
  tried?: string;
};

export const liquidityCard = liquidityCardJson as {
  id: string;
  as_of: string;
  timezone: string;
  compiled: string;
  source_md: string;
  preamble: string;
  visible_note: string;
  absent: string;
  tradfi_to_crypto: {
    label: string;
    headline: string;
    btc: Record<string, string>;
    eth: Record<string, string>;
    gross_share_creations: string;
  };
  stablecoins: Record<string, string>;
  filled: Omit<LiquidityCell, 'status'>[];
  insufficient: Omit<LiquidityCell, 'status'>[];
  teaser_ids: string[];
};

export function stanceTone(stance: string) {
  const s = stance.toUpperCase();
  if (s === 'OW' || s.startsWith('BULL')) return 'ok' as const;
  if (s === 'UW' || s.startsWith('BEAR')) return 'danger' as const;
  return 'neutral' as const;
}

export type BriefCitation = {
  source?: string;
  figure?: string;
  date?: string;
  title?: string;
  url?: string;
  raw: string;
};

/** Parse Sense brief citation pipes: source|figure|date|title|url (url optional). */
export function parseBriefCitation(raw: string): BriefCitation {
  const parts = raw.split('|').map((p) => p.trim());
  if (parts.length >= 4) {
    const [source, figure, date, title, url] = parts;
    return {
      source,
      figure,
      date,
      title,
      url: url && /^https?:\/\//i.test(url) ? url : undefined,
      raw,
    };
  }
  return { raw, title: raw };
}

export function hasSignalStatus(
  pack: typeof signalPack | null | undefined,
): pack is typeof signalPack {
  return Boolean(pack?.status?.gate && pack?.status?.as_of);
}

export function stanceBadgeClass(stance: string) {
  const tone = stanceTone(stance);
  if (tone === 'ok') {
    return 'border-[var(--status-ok)]/25 bg-[var(--status-ok)]/10 text-[var(--status-ok)]';
  }
  if (tone === 'danger') {
    return 'border-[var(--status-danger)]/25 bg-[var(--status-danger)]/10 text-[var(--status-danger)]';
  }
  return 'border-[var(--border)] bg-white/[0.03] text-[var(--muted)]';
}

/** TOP100 Conviction Show — Vera line-signed (`vera_decision`). Show ≠ Act. */
export type ConvictionShowRow = {
  symbol: string;
  score: number;
  tier: string;
  primary_theme: string;
  jordi_layer: string;
  evidence_grade: string;
  flags: string[];
  writeup: string;
  n_calls: number;
  n_voices: number;
  show_ok: boolean;
  book_eligible: boolean;
  vera_decision: string;
  vera_note: string;
};

export type ConvictionBookRow = {
  symbol: string;
  weight_pct: number;
  instrument: string;
  venue: string;
  sleeve: string;
  theme_bucket: string;
  score: number;
  tier: string;
  vera_line_sign: string | null;
  vera_book_signed: boolean;
  note: string;
  book_eligible: boolean;
};

export const convictionShow = convictionShowJson as {
  as_of: string;
  mode: string;
  label: string;
  note: string;
  counts: {
    rows: number;
    by_decision: Record<string, number>;
    book_eligible: number;
  };
  vera_signed_at: string;
  attestation: string;
  revised_at?: string;
  revision_note?: string;
  show_rows: ConvictionShowRow[];
  book_rows: ConvictionBookRow[];
};

/** Act/Book view — Vera-signed book lines only (from target-book / slim conviction.json). */
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

export function formatThemeLabel(theme: string) {
  const key = theme.trim().toLowerCase();
  const special: Record<string, string> = {
    ai: 'AI',
    btc: 'BTC',
    eth: 'ETH',
  };
  if (special[key]) return special[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
