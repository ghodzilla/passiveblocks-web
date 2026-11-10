import type { AudPaperBook } from './audPaper';
import { storeProblem, type RegimeSql } from './db';
import type { StoredDecision } from './decision';
import { RULE_VERSION } from './decision';
import type { PriceBook } from './prices';
import { RULES_VERSION } from './constants';
import type { Bar } from './signals';
import type { StoredRefresh } from './refreshStore';

export const PAPER_COST_BPS = 10;
export const PAPER_CASH_YIELD_BPS = 0;
export const PAPER_HYPOTHESIS = 'H1';

const INSERT_EVENT = `INSERT INTO regime_paper_event
  (rule_version, event_type, session_date, payload)
  VALUES ($1, $2, $3::date, $4::jsonb)
  ON CONFLICT (rule_version, event_type, session_date) DO NOTHING`;

export interface PaperLine {
  symbol: string;
  role: 'tactical' | 'systematic' | 'cash';
  weight: number;
  status: string;
}

export interface PaperPrice {
  symbol: string;
  date: string;
  aud: number;
}

export interface PaperReferencePrice {
  symbol: string;
  priceDate: string | null;
  close: number | null;
  quoteCurrency: 'AUD' | 'USD';
  fxDate: string | null;
  fxUsdPerAud: number | null;
  aud: number | null;
}

export interface PaperDecisionPayload {
  recordKind: 'prospective_target_weights';
  hypothesisId: typeof PAPER_HYPOTHESIS;
  rulesVersion: string;
  ruleVersion: string;
  themeConfigVersion: string;
  /** Snapshot clock. This is the decision time, not the database insert time. */
  storedAt: string | null;
  sessionDate: string;
  composite: number | null;
  regime: string | null;
  action: string;
  actionable: boolean;
  weak: boolean;
  lines: PaperLine[];
  /** Close, FX, and AUD for every line, including a zero weight. Nulls stay null. */
  referencePrices: PaperReferencePrice[];
  feedDates: { id: string; observationDate: string | null }[];
  currency: 'AUD';
  costBps: number;
  cashYieldBps: number;
  taxes: 'excluded';
  benchmark: string;
  valuation: {
    unit: 'time-weighted AUD NAV excluding contributions';
    needs: string;
  };
}

export interface PaperMarkPayload {
  currency: 'AUD';
  nav: number | null;
  navStatus: 'ok' | 'fx_unavailable' | 'prices_incomplete' | 'awaiting_next_session';
  reason: string;
  gross: number;
  cashWeight: number;
  turnover: number;
  costsPaid: number;
  weights: { symbol: string; weight: number }[];
  prices: PaperPrice[];
  /** Present when the weights come from the AUD book rather than suggestion lines. */
  basis?: 'held-book';
}

function asMark(value: unknown): PaperMarkPayload | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<PaperMarkPayload>;
  if (!Array.isArray(row.prices) || !Array.isArray(row.weights) || typeof row.gross !== 'number') return null;
  return row as PaperMarkPayload;
}

export function referencePrice(book: PriceBook | null, fx: Bar[] | null, symbol: string, sessionDate: string): PaperReferencePrice {
  const quotedInAud = symbol.endsWith('.AX');
  const bar = book ? priceOnOrBefore(book, symbol, sessionDate) : null;
  const fxBar = !quotedInAud && bar ? fxBarOnOrBefore(fx, bar.date) : null;
  const rate = fxBar?.close ?? null;
  const aud = bar ? audClose(symbol, bar, rate) : null;
  return {
    symbol,
    priceDate: bar?.date ?? null,
    close: bar?.close ?? null,
    quoteCurrency: quotedInAud ? 'AUD' : 'USD',
    fxDate: fxBar?.date ?? null,
    fxUsdPerAud: quotedInAud ? null : rate,
    aud,
  };
}

function fxBarOnOrBefore(fx: Bar[] | null, date: string): Bar | null {
  if (!fx) return null;
  let found: Bar | null = null;
  for (const bar of fx) {
    if (bar.date <= date && bar.close > 0) found = bar;
  }
  return found;
}

export function decisionFromRefresh(refresh: StoredRefresh, fx: Bar[] | null = null): PaperDecisionPayload | null {
  const decision: StoredDecision | null | undefined = refresh.decision;
  const snapshot = refresh.snapshot;
  if (!decision || !snapshot || !decision.lines?.length) return null;
  const lines: PaperLine[] = decision.lines.map((line) => ({
    symbol: line.symbol,
    role: line.role,
    weight: line.weight,
    status: line.status,
  }));
  return {
    recordKind: 'prospective_target_weights',
    hypothesisId: PAPER_HYPOTHESIS,
    rulesVersion: snapshot.rulesVersion || RULES_VERSION,
    ruleVersion: decision.ruleVersion || RULE_VERSION,
    themeConfigVersion: decision.themeConfigVersion,
    storedAt: decision.storedAt || snapshot.generatedAt || null,
    sessionDate: snapshot.today,
    composite: snapshot.composite,
    regime: snapshot.regime,
    action: snapshot.action,
    actionable: snapshot.actionable,
    weak: snapshot.weak,
    lines,
    referencePrices: lines.map((line) => referencePrice(refresh.book, fx, line.symbol, snapshot.today)),
    feedDates: (refresh.health?.sources ?? []).map((source) => ({
      id: source.id,
      observationDate: source.observationDate,
    })),
    currency: 'AUD',
    costBps: PAPER_COST_BPS,
    cashYieldBps: PAPER_CASH_YIELD_BPS,
    taxes: 'excluded',
    benchmark: '60% SPY and 40% cash in AUD, same cost and zero cash yield, only once AUDUSD and the prices exist.',
    valuation: {
      unit: 'time-weighted AUD NAV excluding contributions',
      needs: 'A later mark values the shares the AUD book still holds. A suggestion of 0% is not a sale. The price change uses the previous mark’s stored AUD prices. A missing price or AUDUSD leaves NAV empty. The first insert for a session date is kept. This is not a historical backtest.',
    },
  };
}

function audClose(symbol: string, bar: Bar, fx: number | null): number | null {
  if (symbol.endsWith('.AX') || symbol === 'AUDUSD=X') return bar.close;
  if (!(fx != null) || !(fx > 0)) return null;
  return bar.close / fx;
}

function fxOnOrBefore(fx: Bar[] | null, date: string): number | null {
  if (!fx) return null;
  let rate: number | null = null;
  for (const bar of fx) {
    if (bar.date <= date && bar.close > 0) rate = bar.close;
  }
  return rate;
}

function priceOnOrBefore(book: PriceBook, symbol: string, date: string): Bar | null {
  const series = book.series.find((item) => item.symbol === symbol);
  if (!series) return null;
  let found: Bar | null = null;
  for (const bar of series.bars) {
    if (bar.date <= date && bar.close > 0) found = bar;
  }
  return found;
}

export interface HeldPortfolio {
  weights: { symbol: string; weight: number }[];
  trades: { symbol: string; side: 'buy' | 'sell'; notionalAud: number }[];
  equity: number;
}

/** Half the sum of asset-weight changes and the matching cash change. Drift is not included. */
export function turnoverFromTrades(trades: { side: 'buy' | 'sell'; notionalAud: number }[], equity: number): number {
  if (!(equity > 0)) return 0;
  let asset = 0;
  let signed = 0;
  for (const trade of trades) {
    if (!(trade.notionalAud > 0)) continue;
    const weight = trade.notionalAud / equity;
    asset += weight;
    signed += trade.side === 'buy' ? weight : -weight;
  }
  return (asset + Math.abs(signed)) / 2;
}

/**
 * Newest first. An all-cash suggestion mark is not the portfolio while the book
 * still holds names. Those rows stay in the table; the chain steps back to the
 * last mark that still listed a holding, or to a held-book mark.
 */
export function selectPreviousMark(marksNewestFirst: PaperMarkPayload[], heldSymbols: string[]): PaperMarkPayload | null {
  const held = heldSymbols.length > 0;
  for (const mark of marksNewestFirst) {
    if (mark.basis === 'held-book') return mark;
    const invested = mark.weights.some((row) => row.symbol !== 'CASH' && row.weight > 0);
    if (!invested && held) continue;
    return mark;
  }
  return null;
}

export function heldPortfolioFromBook(book: AudPaperBook, priceBook: PriceBook, fx: Bar[] | null, sessionDate: string): HeldPortfolio | null {
  const latest = book.marks[book.marks.length - 1];
  if (!latest || latest.date !== sessionDate || latest.status !== 'valued' || latest.equity == null || !(latest.equity > 0)) return null;
  const equity = latest.equity;
  const weights: { symbol: string; weight: number }[] = [];
  for (const position of book.positions) {
    if (!(position.qty > 0)) continue;
    const bar = priceOnOrBefore(priceBook, position.symbol, sessionDate);
    if (!bar) return null;
    const rate = position.symbol.endsWith('.AX') ? null : fxOnOrBefore(fx, bar.date);
    const aud = audClose(position.symbol, bar, rate);
    if (aud == null || !(aud > 0)) return null;
    weights.push({ symbol: position.symbol, weight: position.qty * aud / equity });
  }
  weights.push({ symbol: 'CASH', weight: Math.max(0, (book.cash ?? 0) / equity) });
  const trades = (book.sessionTrades ?? [])
    .filter((trade) => trade.date === sessionDate)
    .map((trade) => ({ symbol: trade.symbol, side: trade.side, notionalAud: trade.notionalAud }));
  return { weights, trades, equity };
}

function weightsOf(lines: PaperLine[]): { symbol: string; weight: number }[] {
  const invested = lines.filter((line) => line.weight > 0 && line.role !== 'cash');
  const namedCash = lines.filter((line) => line.weight > 0 && line.role === 'cash').reduce((sum, line) => sum + line.weight, 0);
  const gross = invested.reduce((sum, line) => sum + line.weight, 0);
  const cash = namedCash + Math.max(0, 1 - gross - namedCash);
  return [
    ...invested.map((line) => ({ symbol: line.symbol, weight: line.weight })),
    { symbol: 'CASH', weight: cash },
  ];
}

function tradedFraction(next: { symbol: string; weight: number }[], prev: { symbol: string; weight: number }[]): number {
  const names = Array.from(new Set([...next.map((row) => row.symbol), ...prev.map((row) => row.symbol)]));
  let moved = 0;
  for (const symbol of names) {
    const left = next.find((row) => row.symbol === symbol)?.weight ?? 0;
    const right = prev.find((row) => row.symbol === symbol)?.weight ?? 0;
    moved += Math.abs(left - right);
  }
  return moved / 2;
}

/**
 * Unit NAV in AUD from the frozen weights.
 * The first mark sets NAV to 1 minus entry cost and stores prices. It does not
 * include that session’s price change. A later mark earns the close-to-close
 * move from the stored AUD prices. Cash yield is 0. Taxes are excluded.
 * A missing price or AUDUSD rate leaves NAV null instead of dropping the name.
 */
export function paperMark(input: {
  decision: PaperDecisionPayload;
  sessionDate: string;
  previous: PaperMarkPayload | null;
  book: PriceBook;
  fx: Bar[] | null;
  /** Post-policy AUD book. When present, suggestion weights are not the portfolio. */
  held?: HeldPortfolio | null;
  /** Set when earlier all-cash suggestion marks were left in the log and skipped. */
  skippedSuggestionMarks?: boolean;
}): PaperMarkPayload {
  const suggested = weightsOf(input.decision.lines);
  const carried = input.previous && suggested.every((row) => row.symbol === 'CASH' || !(row.weight > 0))
    ? input.previous.weights
    : suggested;
  const weights = input.held?.weights?.length ? input.held.weights : carried;
  const gross = weights.filter((row) => row.symbol !== 'CASH').reduce((sum, row) => sum + row.weight, 0);
  const cashWeight = weights.find((row) => row.symbol === 'CASH')?.weight ?? 0;
  const turnover = input.held
    ? turnoverFromTrades(input.held.trades, input.held.equity)
    : tradedFraction(weights, input.previous?.weights ?? [{ symbol: 'CASH', weight: 1 }]);
  const cost = turnover * (input.decision.costBps / 10_000);
  const prices: PaperPrice[] = [];
  const missing: string[] = [];
  let fxMissing = false;
  const needed = new Set<string>();
  for (const row of weights) if (row.symbol !== 'CASH' && row.weight > 0) needed.add(row.symbol);
  for (const row of input.previous?.weights ?? []) if (row.symbol !== 'CASH' && row.weight > 0) needed.add(row.symbol);
  for (const symbol of Array.from(needed)) {
    const bar = priceOnOrBefore(input.book, symbol, input.sessionDate);
    if (!bar) {
      missing.push(symbol);
      continue;
    }
    const fx = symbol.endsWith('.AX') ? null : fxOnOrBefore(input.fx, bar.date);
    if (!symbol.endsWith('.AX') && fx == null) fxMissing = true;
    const aud = audClose(symbol, bar, fx);
    if (aud == null || !(aud > 0)) continue;
    prices.push({ symbol, date: bar.date, aud });
  }
  const basis = input.held ? 'held-book' as const : undefined;
  const heldReason = input.skippedSuggestionMarks
    ? 'Held book. A suggestion of 0% is not a sale. Earlier marks that dropped the holdings are kept and are not comparable. This row continues the last mark that still listed holdings.'
    : 'Held book. A suggestion of 0% is not a sale. Costs follow buys, stops, cap trims, and stale-price exits.';
  const base = { currency: 'AUD' as const, gross, cashWeight, turnover, costsPaid: cost, weights, prices, basis };
  if (missing.length > 0) {
    return { ...base, nav: null, costsPaid: 0, navStatus: 'prices_incomplete', reason: `No price on or before ${input.sessionDate} for ${missing.join(', ')}.` };
  }
  if (fxMissing) {
    return { ...base, nav: null, costsPaid: 0, navStatus: 'fx_unavailable', reason: 'A US or crypto weight needs AUDUSD on or before its price date. No AUD return is reported.' };
  }
  if (!input.previous || input.previous.nav == null) {
    return {
      ...base,
      nav: input.previous?.nav == null && input.previous ? null : 1 - cost,
      navStatus: input.previous ? 'prices_incomplete' : 'awaiting_next_session',
      reason: input.previous
        ? 'The previous mark has no NAV, so this one does not invent a continuation.'
        : input.held
          ? `First mark. Entry cost is charged on the shares bought into the AUD book. The next session’s price change is not in this NAV. ${heldReason}`
          : 'First mark. Entry cost is charged. The next session’s price change is not in this NAV.',
    };
  }
  let gain = 0;
  for (const row of input.previous.weights) {
    if (row.symbol === 'CASH' || !(row.weight > 0)) continue;
    const now = prices.find((price) => price.symbol === row.symbol);
    const then = input.previous.prices.find((price) => price.symbol === row.symbol);
    if (!now || !then || !(then.aud > 0)) {
      return { ...base, nav: null, costsPaid: 0, navStatus: 'prices_incomplete', reason: `${row.symbol} has no stored AUD price to measure from.` };
    }
    gain += row.weight * (now.aud / then.aud - 1);
  }
  return {
    ...base,
    nav: input.previous.nav * (1 + gain - cost),
    navStatus: 'ok',
    reason: input.held
      ? heldReason
      : 'Time-weighted AUD NAV from the frozen weights. Contributions are not included. Taxes are excluded. Cash yield is 0.',
  };
}

export async function recordPaperSnapshot(
  sql: RegimeSql,
  refresh: StoredRefresh,
  fx: Bar[] | null,
  audBook?: AudPaperBook | null,
): Promise<'recorded' | 'skipped' | 'missing_schema' | 'outage'> {
  const decision = decisionFromRefresh(refresh, fx);
  if (!decision || !refresh.book) return 'skipped';
  try {
    await sql.query(INSERT_EVENT, [decision.ruleVersion, 'decision', decision.sessionDate, JSON.stringify(decision)]);
    const priorRows = await sql.query<{ payload: unknown }>(
      `SELECT payload FROM regime_paper_event
       WHERE rule_version = $1 AND event_type = 'mark' AND session_date < $2::date
       ORDER BY session_date DESC, id DESC
       LIMIT 30`,
      [decision.ruleVersion, decision.sessionDate],
    );
    const held = audBook ? heldPortfolioFromBook(audBook, refresh.book, fx, decision.sessionDate) : null;
    const priorMarks: PaperMarkPayload[] = [];
    for (const row of priorRows) {
      const parsed = asMark(row.payload);
      if (parsed) priorMarks.push(parsed);
    }
    const heldSymbols = (held?.weights ?? []).filter((row) => row.symbol !== 'CASH' && row.weight > 0).map((row) => row.symbol);
    const linked = held ? selectPreviousMark(priorMarks, heldSymbols) : (priorMarks[0] ?? null);
    const previous = linked;
    const skippedSuggestionMarks = Boolean(held && priorMarks.length > 0 && previous !== priorMarks[0]);
    const mark = paperMark({
      decision,
      sessionDate: decision.sessionDate,
      previous,
      book: refresh.book,
      fx,
      held,
      skippedSuggestionMarks,
    });
    await sql.query(INSERT_EVENT, [decision.ruleVersion, 'mark', decision.sessionDate, JSON.stringify(mark)]);
    return 'recorded';
  } catch (error) {
    const problem = storeProblem(error);
    if (problem === 'missing_schema') return 'missing_schema';
    return 'outage';
  }
}

export async function readPaperLog(sql?: RegimeSql | null): Promise<{
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage';
  decisions: number;
  marks: number;
  latest: PaperMarkPayload | null;
}> {
  if (sql === null || sql === undefined) {
    const { openRegimeSql } = await import('./db');
    if (sql === null) return { status: 'unconfigured', decisions: 0, marks: 0, latest: null };
    const opened = await openRegimeSql();
    if (!opened) return { status: 'unconfigured', decisions: 0, marks: 0, latest: null };
    return readPaperLog(opened);
  }
  try {
    const counts = await sql.query<{ event_type: string; n: string }>(
      `SELECT event_type, count(*)::text AS n FROM regime_paper_event GROUP BY event_type`,
    );
    const latestRows = await sql.query<{ payload: unknown }>(
      `SELECT payload FROM regime_paper_event WHERE event_type = 'mark' ORDER BY session_date DESC, id DESC LIMIT 1`,
    );
    let decisions = 0;
    let marks = 0;
    for (const row of counts) {
      const n = Number(row.n);
      if (row.event_type === 'decision') decisions = n;
      if (row.event_type === 'mark') marks = n;
    }
    return { status: 'ok', decisions, marks, latest: latestRows.length ? asMark(latestRows[0].payload) : null };
  } catch (error) {
    const problem = storeProblem(error);
    if (problem === 'missing_schema') return { status: 'missing_schema', decisions: 0, marks: 0, latest: null };
    return { status: 'outage', decisions: 0, marks: 0, latest: null };
  }
}

