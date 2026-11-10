import { BOOK_LIMITS_VERSION, clampBuysToCash, planBookLimits } from './bookLimits';
import { fxStamp, markInAud, type FxBar, type FxStamp } from './fx';
import { priceIsFresh } from './ideas';
import type { Journal, PaperPosition } from './journal';
import { AI_MEGACAP_CLUSTER } from './overlap';
import { THEMES } from './themes.config';
import { themesForSymbol } from './themes';

export const AUD_BOOK_ID = 'aud-paper-v1';

export interface AudExposure {
  gross: number;
  net: number;
  risk: number;
  defensive: number;
  cash: number;
  maxGross: number;
  maxNet: number;
}

export interface AudPaperBook {
  bookId: typeof AUD_BOOK_ID;
  policy: typeof BOOK_LIMITS_VERSION;
  currency: 'AUD';
  cash: number | null;
  peakEquity: number | null;
  positions: PaperPosition[];
  marks: { date: string; equity: number | null; status: 'valued' | 'unvalued' }[];
  pending: { symbol: string; reason: string }[];
  limitStatus: 'enforced' | 'fx_blocked' | 'unvalued' | 'empty';
  exposures: AudExposure | null;
  openedOn: string | null;
  fx: FxStamp | null;
  note: string;
  /** Asset buys and sells from the latest roll. Price drift is not a trade. */
  sessionTrades?: { date: string; symbol: string; side: 'buy' | 'sell'; notionalAud: number }[];
}

export interface PaperLedger {
  policy: string | null;
  currency: 'AUD' | null;
  status: AudPaperBook['limitStatus'] | 'legacy_only';
  legacy: 'uncomparable_mixed_local' | null;
  legacyPositions: number;
  exposures: AudExposure | null;
  pending: { symbol: string; reason: string }[];
  equity: number | null;
  valued: boolean;
  fx: FxStamp | null;
  note: string;
}

export interface RollLine {
  symbol: string;
  weight: number;
  stop: number | null;
  role: 'tactical' | 'systematic' | 'cash';
  defensive: boolean;
}

const OPEN_NOTE = 'New AUD paper book. It does not continue the earlier mixed-currency ledger. Opening cash is the configured capital in AUD.';

export function retainLegacyPaper(journal: Journal): Journal {
  const paper = journal.paper;
  if (paper.valuation === 'uncomparable_mixed_local') return journal;
  const hasHistory = paper.positions.length > 0 || paper.marks.length > 0 || paper.cash != null;
  if (!hasHistory) return journal;
  return {
    ...journal,
    paper: { ...paper, valuation: 'uncomparable_mixed_local', retained: true },
  };
}

export function openAudBook(journal: Journal, date: string, capital: number | null): Journal {
  if (journal.audBook) return journal;
  return {
    ...journal,
    audBook: emptyAudBook(date, capital, OPEN_NOTE),
  };
}

/** Owner action. The previous AUD book is kept. The legacy ledger is not deleted or rewritten. */
export function rebaselineAudBook(journal: Journal, date: string, capital: number | null): Journal {
  return {
    ...journal,
    audBookPrevious: journal.audBook ?? null,
    audBook: emptyAudBook(date, capital, 'The owner started a new AUD paper book. The previous AUD book is kept. The legacy ledger was not deleted.'),
  };
}

function emptyAudBook(date: string, capital: number | null, note: string): AudPaperBook {
  return {
    bookId: AUD_BOOK_ID,
    policy: BOOK_LIMITS_VERSION,
    currency: 'AUD',
    cash: capital,
    peakEquity: capital,
    positions: [],
    marks: [],
    pending: [],
    limitStatus: 'empty',
    exposures: null,
    openedOn: date,
    fx: null,
    note,
    sessionTrades: [],
  };
}

export function paperLedgerFrom(journal: Journal): PaperLedger {
  const legacy = journal.paper.valuation === 'uncomparable_mixed_local'
    || journal.paper.positions.length > 0
    || journal.paper.marks.length > 0
    ? 'uncomparable_mixed_local' as const
    : null;
  const book = journal.audBook;
  if (!book) {
    return {
      policy: null,
      currency: null,
      status: 'legacy_only',
      legacy: journal.paper.positions.length > 0 || journal.paper.marks.length > 0 || journal.paper.cash != null ? 'uncomparable_mixed_local' : null,
      legacyPositions: journal.paper.positions.length,
      exposures: null,
      pending: [],
      equity: null,
      valued: false,
      fx: null,
      note: legacy
        ? 'The earlier paper ledger is retained. Its cash and cost bases are not an AUD value, and this page does not convert them.'
        : 'No AUD paper book is stored yet.',
    };
  }
  const latest = book.marks[book.marks.length - 1];
  const valued = latest?.status === 'valued' && latest.equity != null;
  return {
    policy: book.policy,
    currency: 'AUD',
    status: book.limitStatus,
    legacy: journal.paper.valuation === 'uncomparable_mixed_local' ? 'uncomparable_mixed_local' : null,
    legacyPositions: journal.paper.positions.length,
    exposures: book.exposures,
    pending: book.pending,
    equity: valued ? latest.equity : null,
    valued,
    fx: book.fx,
    note: book.note,
  };
}

export function valuedMarks(book: AudPaperBook | null | undefined): { date: string; equity: number }[] {
  if (!book) return [];
  const marks: { date: string; equity: number }[] = [];
  for (const mark of book.marks) {
    if (mark.status === 'valued' && mark.equity != null) marks.push({ date: mark.date, equity: mark.equity });
  }
  return marks;
}

/**
 * Caps the AUD book. Legacy rows are not an input. A USD name without a fresh
 * AUDUSD rate on or before its price date is not bought and is not given an AUD value.
 * A stop in the instrument's own price is filled in AUD only when that value exists.
 */
export function rollAudPaper(book: AudPaperBook, input: {
  date: string;
  lines: RollLine[];
  local: Record<string, number>;
  asOf: Record<string, string>;
  fxBars: FxBar[] | null;
  fxFetchedAt: string | null;
  fxError: string | null;
  maxGross: number;
  maxNet: number;
  haltNewEntries: boolean;
  overlapGroups: string[][];
}): AudPaperBook {
  const sameDay = book.marks.filter((mark) => mark.date === input.date);
  if (sameDay.some((mark) => mark.status === 'valued')) return book;
  const start = sameDay.length
    ? { ...book, marks: book.marks.filter((mark) => mark.date !== input.date), pending: [] }
    : book;
  const fx = fxStamp(input.fxBars, input.date, input.fxFetchedAt, input.fxError);
  const pending: { symbol: string; reason: string }[] = [];
  const trades: { date: string; symbol: string; side: 'buy' | 'sell'; notionalAud: number }[] = [];
  let cash = start.cash ?? 0;
  const kept: PaperPosition[] = [];
  const stopped = new Set<string>();
  for (const position of start.positions) {
    const local = input.local[position.symbol];
    if (!(local > 0)) {
      kept.push({ ...position });
      pending.push({ symbol: position.symbol, reason: 'No price. The stop and any cap trim stay unfilled.' });
      continue;
    }
    if (local <= position.stop) {
      const aud = audPrice(position.symbol, local, input.asOf[position.symbol] ?? input.date, input.date, input.fxBars);
      if (aud == null) {
        kept.push({ ...position });
        pending.push({ symbol: position.symbol, reason: 'Stop touched in the instrument price. The sell is unfilled because AUDUSD is missing or stale.' });
      } else {
        const notionalAud = position.qty * aud;
        cash += notionalAud;
        stopped.add(position.symbol);
        trades.push({ date: input.date, symbol: position.symbol, side: 'sell', notionalAud });
      }
    } else {
      kept.push({ ...position });
    }
  }
  const valued = new Map<string, number>();
  let blocked = false;
  for (const position of kept) {
    const local = input.local[position.symbol];
    const aud = local > 0 ? audPrice(position.symbol, local, input.asOf[position.symbol] ?? input.date, input.date, input.fxBars) : null;
    if (aud == null) {
      blocked = true;
      if (!pending.some((item) => item.symbol === position.symbol)) {
        pending.push({ symbol: position.symbol, reason: 'No fresh AUDUSD rate on or before the price date. The holding stays, and no AUD value is shown.' });
      }
    } else valued.set(position.symbol, aud);
  }
  const base: AudPaperBook = { ...start, cash, fx, pending, positions: kept, sessionTrades: trades };
  if (blocked || kept.some((position) => !valued.has(position.symbol))) {
    return finish(base, input.date, null, 'unvalued', null);
  }
  let equity = cash;
  valued.forEach((aud, symbol) => {
    const position = kept.find((item) => item.symbol === symbol);
    if (position) equity += position.qty * aud;
  });
  const lineFor = (symbol: string) => input.lines.find((line) => line.symbol === symbol);
  const plan = planBookLimits(
    kept.map((position) => {
      const line = lineFor(position.symbol);
      const aud = valued.get(position.symbol) ?? 0;
      return {
        symbol: position.symbol,
        weight: equity > 0 ? position.qty * aud / equity : 0,
        role: line?.role ?? 'tactical',
        defensive: line?.defensive ?? false,
        themes: themesForSymbol(position.symbol).map((theme) => theme.id),
        unpriced: false,
        forceExit: input.asOf[position.symbol] != null && !priceIsFresh(input.asOf[position.symbol], input.date),
        tranches: position.tranches ?? 1,
      };
    }),
    input.lines.filter((line) => line.weight > 0 && line.stop != null && !stopped.has(line.symbol)).map((line) => ({
      symbol: line.symbol,
      weight: line.weight,
      role: line.role,
      defensive: line.defensive,
      themes: themesForSymbol(line.symbol).map((theme) => theme.id),
      kind: kept.some((position) => position.symbol === line.symbol) ? 'pyramid' as const : 'new' as const,
    })),
    {
      maxGross: input.maxGross,
      maxNet: input.maxNet,
      haltNewEntries: input.haltNewEntries,
      overlapGroups: [Array.from(AI_MEGACAP_CLUSTER), ...input.overlapGroups],
      themeGroups: THEMES.map((theme) => ({ id: theme.id, symbols: theme.symbols.map((item) => item.symbol) })),
    },
  );
  const open = new Map(kept.map((position) => [position.symbol, position]));
  for (const sale of plan.sells) {
    const position = open.get(sale.symbol);
    const aud = valued.get(sale.symbol);
    if (!position || !(aud != null) || !(equity > 0)) {
      pending.push({ symbol: sale.symbol, reason: 'Planned trim has no AUD value. The shares stay.' });
      continue;
    }
    const current = position.qty * aud / equity;
    if (!(current > 0)) continue;
    const sold = position.qty * Math.min(1, sale.weight / current);
    const notionalAud = sold * aud;
    cash += notionalAud;
    trades.push({ date: input.date, symbol: sale.symbol, side: 'sell', notionalAud });
    position.qty -= sold;
    if (!(position.qty > 1e-10)) open.delete(sale.symbol);
  }
  equity = cash;
  open.forEach((position) => {
    equity += position.qty * (valued.get(position.symbol) ?? 0);
  });
  const orders: { symbol: string; notional: number; kind: 'new' | 'pyramid' }[] = [];
  for (const buy of plan.buys) {
    const local = input.local[buy.symbol];
    const aud = local > 0 ? audPrice(buy.symbol, local, input.asOf[buy.symbol] ?? input.date, input.date, input.fxBars) : null;
    if (!(aud != null) || !(aud > 0)) {
      pending.push({ symbol: buy.symbol, reason: 'No fresh AUDUSD rate. The new buy is not added.' });
      continue;
    }
    valued.set(buy.symbol, aud);
    orders.push({ symbol: buy.symbol, notional: buy.weight * equity, kind: buy.kind });
  }
  const clamped = clampBuysToCash(orders.map((order) => ({ symbol: order.symbol, notional: order.notional })), cash, 0);
  cash = clamped.cashLeft;
  for (const buy of clamped.filled) {
    const planned = orders.find((order) => order.symbol === buy.symbol);
    const line = lineFor(buy.symbol);
    const local = input.local[buy.symbol];
    const aud = valued.get(buy.symbol);
    if (!planned || !line || line.stop == null || !(local > line.stop) || !(aud != null) || !(aud > 0)) {
      cash += buy.notional;
      pending.push({ symbol: buy.symbol, reason: 'Fill is through the stop. The buy is not taken.' });
      continue;
    }
    const existing = open.get(buy.symbol);
    if (planned.kind === 'pyramid' && existing && (existing.tranches ?? 1) < 2) {
      existing.qty += buy.notional / aud;
      existing.tranches = 2;
      trades.push({ date: input.date, symbol: buy.symbol, side: 'buy', notionalAud: buy.notional });
    } else if (planned.kind === 'new' && !existing) {
      trades.push({ date: input.date, symbol: buy.symbol, side: 'buy', notionalAud: buy.notional });
      open.set(buy.symbol, {
        symbol: buy.symbol,
        qty: buy.notional / aud,
        entry: local,
        stop: line.stop,
        riskPerShare: local - line.stop,
        openedOn: input.date,
        tranches: 1,
      });
    } else {
      cash += buy.notional;
    }
  }
  for (const short of clamped.shortfall) pending.push({ symbol: short.symbol, reason: 'Cash cannot fund the planned buy. No borrowing.' });
  const positions: PaperPosition[] = [];
  open.forEach((position) => {
    if (position.qty > 1e-10) positions.push(position);
  });
  let marked = cash;
  const audNow = new Map<string, number>();
  open.forEach((position) => {
    const local = input.local[position.symbol];
    const aud = local > 0 ? audPrice(position.symbol, local, input.asOf[position.symbol] ?? input.date, input.date, input.fxBars) : null;
    if (aud == null) {
      pending.push({ symbol: position.symbol, reason: 'No fresh AUDUSD rate on or before the price date. The holding stays, and no AUD value is shown.' });
      return;
    }
    audNow.set(position.symbol, aud);
    marked += position.qty * aud;
  });
  if (pending.some((item) => item.reason.startsWith('No fresh AUDUSD')) && audNow.size !== open.size) {
    return finish({ ...base, cash, positions, pending }, input.date, null, 'unvalued', null);
  }
  const status = pending.some((item) => item.reason.includes('AUDUSD') || item.reason.includes('AUD value')) ? 'fx_blocked' : 'enforced';
  const exposures = exposuresFrom(positions, audNow, cash, marked, input.lines, input.maxGross, input.maxNet);
  return finish({ ...base, cash, positions, pending }, input.date, marked, positions.length === 0 && !(cash > 0) ? 'empty' : status, exposures);
}

function audPrice(symbol: string, local: number, priceDate: string, today: string, fxBars: FxBar[] | null): number | null {
  const marked = markInAud({ symbol, local, priceDate, fxBars });
  if (!marked) return null;
  if (marked.currency === 'USD' && !fxIsUsable(marked.fxDate, today)) return null;
  return marked.aud;
}

function fxIsUsable(fxDate: string | null, today: string): boolean {
  return priceIsFresh(fxDate, today);
}

function exposuresFrom(
  positions: PaperPosition[],
  aud: Map<string, number>,
  cash: number,
  equity: number,
  lines: RollLine[],
  maxGross: number,
  maxNet: number,
): AudExposure {
  let net = 0;
  let risk = 0;
  let defensive = 0;
  for (const position of positions) {
    const price = aud.get(position.symbol) ?? 0;
    const weight = equity > 0 ? position.qty * price / equity : 0;
    const line = lines.find((item) => item.symbol === position.symbol);
    if (line?.role === 'cash') continue;
    net += weight;
    if (line?.defensive) defensive += weight;
    else risk += weight;
  }
  const gross = equity > 0 ? (equity - cash) / equity : 0;
  return {
    gross,
    net,
    risk,
    defensive,
    cash: equity > 0 ? cash / equity : 0,
    maxGross,
    maxNet,
  };
}

function finish(book: AudPaperBook, date: string, equity: number | null, status: AudPaperBook['limitStatus'], exposures: AudExposure | null): AudPaperBook {
  const peak = equity != null ? Math.max(book.peakEquity ?? equity, equity) : book.peakEquity;
  const valued = equity != null && status !== 'unvalued';
  return {
    ...book,
    peakEquity: peak,
    limitStatus: status,
    exposures: valued ? exposures : null,
    marks: book.marks.concat([{ date, equity: valued ? equity : null, status: valued ? 'valued' : 'unvalued' }]),
  };
}
