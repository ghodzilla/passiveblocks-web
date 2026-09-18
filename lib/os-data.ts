import convictionJson from '@/data/os/conviction.json';
import convictionShowJson from '@/data/os/conviction-show.json';
import targetBookJson from '@/data/os/target-book.json';
import paperPortfolioJson from '@/data/os/paper-portfolio.json';
import paperMarksJson from '@/data/os/paper-marks.json';
import paperEquityCurveJson from '@/data/os/paper-equity-curve.json';
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
  confidence?: string;
  stage?: string;
  forward_thesis?: string;
  change_vs_brief_2026_09_14?: string;
  paper_line?: string;
  new_wave_note?: string;
  diego_fork?: string;
};

export type FutureReturnsTriage = {
  watch: { count: number; items: string[] };
  paper_test: { count: number; items: string[] };
  live_promote: { count: number; items: string[] };
  note?: string;
};

export type FutureReturnsReframe = {
  orientation?: string;
  watch_count?: number;
  paper_test_count?: number;
  live_promote_count?: number;
  note?: string;
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
    reframe?: FutureReturnsReframe;
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
    reframe?: FutureReturnsReframe;
    triage?: FutureReturnsTriage;
    name_map_hygiene?: Record<string, string>;
    signals_json_n?: number;
    signals_json_generated?: string;
    brief_md?: string;
    valid_until?: string;
    superseded_brief?: string;
    recommendation?: string;
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
  nav?: number;
  pnl_usd?: number;
  pnl_pct?: number;
  marked_at?: string;
  mark_method?: string;
  entry_reconstructed?: boolean;
  max_dd_ceiling_pct?: number;
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

export type PaperMarkPosition = {
  symbol: string;
  instrument: string;
  weight_pct: number;
  notional_usd: number;
  entry_price: number | string;
  entry_as_of: string | null;
  entry_source_url: string | null;
  units: number | null;
  mark_price: number | string;
  mark_as_of: string | null;
  mark_source_url: string | null;
  market_value: number | string;
  pnl_usd: number | string;
  pnl_pct: number | string;
  status: string;
  entry_reconstructed?: boolean;
  entry_note?: string;
  note?: string;
};

export type PaperEquityPoint = {
  date: string;
  nav: number | string;
  pnl_pct: number | string;
  source: string;
};

export const paperMarks = paperMarksJson as {
  mode: string;
  live_blocked: boolean;
  show_ne_act: boolean;
  notional_equity_usd: number;
  currency: string;
  fill_ts: string;
  entry_date_rule: string;
  entry_reconstructed: boolean;
  entry_reconstructed_note: string;
  marked_at: string;
  mark_method: string;
  max_dd_ceiling_pct: number;
  cash_pct: number;
  invested_pct: number;
  cash_note: string;
  honesty: string[];
  positions: PaperMarkPosition[];
  cash: PaperMarkPosition;
  totals: {
    nav: number | string;
    pnl_usd: number | string;
    pnl_pct: number | string;
    invested_pct: number;
    cash_pct: number;
    max_dd_ceiling_pct: number;
    starting_equity: number;
    invested_market_value: number | string;
    invested_cost: number;
    cash_usd: number;
    latest_mark_as_of: string | null;
    method_note: string;
  };
  insufficient_symbols: string[];
  price_source: string;
};

export const paperEquityCurve = paperEquityCurveJson as {
  mode: string;
  show_ne_act: boolean;
  entry_reconstructed: boolean;
  entry_date_rule: string;
  starting_equity: number;
  cash_pct: number;
  fill_ts: string;
  currency: string;
  max_dd_ceiling_pct: number;
  interval: string;
  points: PaperEquityPoint[];
  latest: PaperEquityPoint | null;
  note: string;
};

/** Live Act desk: Vera book-sign that is not paper-only. Paper HOLD never funds this strip. */
export function hasLiveActBookSign(
  book: typeof targetBook = targetBook,
  paper: typeof paperPortfolio = paperPortfolio,
): boolean {
  if (!book?.vera_book_signed) return false;
  if (paper?.live_blocked) return false;
  if (book.mode === 'paper') return false;
  const status = String(book.status ?? '');
  if (status.includes('paper')) return false;
  return true;
}

/** True when a paper Act book exists (may still HOLD) — used only for empty-state copy. */
export function hasPaperActBook(
  book: typeof targetBook = targetBook,
  show: typeof convictionShow = convictionShow,
): boolean {
  if (book?.mode === 'paper' && Array.isArray(book.positions) && book.positions.length > 0) {
    return true;
  }
  return Array.isArray(show?.book_rows) && show.book_rows.length > 0;
}

/** brief_ref for live Act lines — never invent; only explicit theme_regime_brief_ref. */
export function liveActBriefRef(
  pack: typeof signalPack = signalPack,
): string | null {
  const brief = pack?.brief as { theme_regime_brief_ref?: string } | undefined;
  if (brief?.theme_regime_brief_ref) return brief.theme_regime_brief_ref;
  const status = pack?.status as { theme_regime_brief_ref?: string } | undefined;
  if (status?.theme_regime_brief_ref) return status.theme_regime_brief_ref;
  return null;
}

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

/**
 * One signed US$m string for ETF flow tiles and sums.
 * The source already carries its sign — callers must not prepend another +.
 * Unit is always "US$m" so "$...m" and "US$m" cannot diverge.
 */
export function formatFlowUsdMillions(raw: string, unit = 'US$m'): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  let body = trimmed
    .replace(/US\$m/gi, '')
    .replace(/\$m/gi, '')
    .replace(/\s*m$/i, '')
    .replace(/[$,]/g, '')
    .trim();

  const negative = /^[\u2212-]/.test(body);
  body = body.replace(/^[+\u2212-]+/, '').trim();

  if (!/^\d+(\.\d+)?$/.test(body)) return trimmed;

  const sign = negative ? '\u2212' : '+';
  const decimals = body.includes('.') ? body.split('.')[1].length : 1;
  return `${sign}${Number(body).toFixed(decimals)} ${unit}`;
}

/** Month or day stamp already stored on a panel. Does not invent a date. */
export function formatVintage(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso);
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [year, month] = iso.split('-');
    const name = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
      Number(month) - 1
    ];
    return name ? `${name} ${year}` : iso;
  }
  return iso;
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
