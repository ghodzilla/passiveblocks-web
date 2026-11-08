import { SINGLE_POSITION_CAP, SYSTEMATIC_CAP } from './ideas';
import { OVERLAP_GROUP_CAP } from './overlap';
import { THEME_WEIGHT_CAP } from './sizing';

/** Approved after the add-and-hold ledger ignored carried holdings. Not the historical journal. */
export const BOOK_LIMITS_VERSION = 'book-limits-2026-11-07';

/** One basis point of equity. Smaller gaps are rounding. */
export const BOOK_LIMIT_TOLERANCE = 0.0001;

export type BookRole = 'tactical' | 'systematic' | 'cash';

export interface LimitHolding {
  symbol: string;
  weight: number;
  role: BookRole;
  defensive: boolean;
  themes: string[];
  /** No usable mark. The shares stay and the reduction is pending. */
  unpriced: boolean;
  /** A mark exists and is older than the stale window. Sell the whole name. */
  forceExit?: boolean;
  tranches: number;
}

export interface LimitProposal {
  symbol: string;
  /** Suggested tranche, as a fraction of decision-time equity. */
  weight: number;
  role: BookRole;
  defensive: boolean;
  themes: string[];
  kind: 'new' | 'pyramid';
}

export interface LimitSpec {
  maxGross: number;
  maxNet: number;
  haltNewEntries: boolean;
  overlapGroups: string[][];
  themeGroups: { id: string; symbols: string[] }[];
}

export interface LimitSell {
  symbol: string;
  /** Weight to remove, in decision-time equity. */
  weight: number;
  reason: 'stale' | 'name' | 'overlap' | 'theme' | 'net' | 'gross';
}

export interface LimitBuy {
  symbol: string;
  weight: number;
  kind: 'new' | 'pyramid';
}

export interface LimitPending {
  symbol: string;
  reason: string;
}

export interface LimitPlan {
  version: typeof BOOK_LIMITS_VERSION;
  sells: LimitSell[];
  buys: LimitBuy[];
  pending: LimitPending[];
  keptWeight: { symbol: string; weight: number }[];
}

export function nameCapFor(role: BookRole): number {
  return role === 'systematic' ? SYSTEMATIC_CAP : SINGLE_POSITION_CAP;
}

/**
 * Caps the carried book and then sizes new tranches into what remains.
 * A holding that is not listed in `proposed` is kept, unless a cap or a missing
 * price requires a sale. Proposal weight 0 is not an input; callers omit holds.
 */
export function planBookLimits(held: LimitHolding[], proposed: LimitProposal[], spec: LimitSpec): LimitPlan {
  const weights = new Map<string, number>();
  const meta = new Map<string, LimitHolding>();
  const sells: LimitSell[] = [];
  const pending: LimitPending[] = [];
  for (const lot of held) {
    meta.set(lot.symbol, lot);
    weights.set(lot.symbol, lot.weight > 0 ? lot.weight : 0);
  }

  for (const lot of held) {
    if (lot.unpriced && lot.weight > BOOK_LIMIT_TOLERANCE) {
      pending.push({ symbol: lot.symbol, reason: 'No usable mark. The name stays until a session can fill the reduction.' });
    }
  }

  const sell = (symbol: string, weight: number, reason: LimitSell['reason']) => {
    if (!(weight > BOOK_LIMIT_TOLERANCE)) return;
    const current = weights.get(symbol) ?? 0;
    const amount = Math.min(current, weight);
    if (!(amount > BOOK_LIMIT_TOLERANCE)) return;
    weights.set(symbol, current - amount);
    const existing = sells.find((row) => row.symbol === symbol && row.reason === reason);
    if (existing) existing.weight += amount;
    else sells.push({ symbol, weight: amount, reason });
  };

  for (const lot of held) {
    if (lot.forceExit && !lot.unpriced && (weights.get(lot.symbol) ?? 0) > BOOK_LIMIT_TOLERANCE) {
      sell(lot.symbol, weights.get(lot.symbol) ?? 0, 'stale');
    }
  }

  for (const lot of held) {
    if (lot.unpriced) continue;
    const cap = nameCapFor(lot.role);
    const excess = (weights.get(lot.symbol) ?? 0) - cap;
    if (excess > BOOK_LIMIT_TOLERANCE) sell(lot.symbol, excess, 'name');
  }

  const trimGroup = (symbols: string[], cap: number, reason: 'overlap' | 'theme') => {
    const members = Array.from(new Set(symbols)).filter((symbol) => !meta.get(symbol)?.unpriced);
    const sum = () => members.reduce((total, symbol) => total + (weights.get(symbol) ?? 0), 0);
    while (sum() > cap + BOOK_LIMIT_TOLERANCE) {
      const ranked = members
        .filter((symbol) => (weights.get(symbol) ?? 0) > BOOK_LIMIT_TOLERANCE)
        .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0) || a.localeCompare(b));
      if (!ranked.length) break;
      const symbol = ranked[0];
      const excess = sum() - cap;
      sell(symbol, Math.min(weights.get(symbol) ?? 0, excess), reason);
    }
  };

  const overlapGroups = spec.overlapGroups
    .map((group) => Array.from(new Set(group)).sort())
    .sort((a, b) => a.join('|').localeCompare(b.join('|')));
  for (const group of overlapGroups) trimGroup(group, OVERLAP_GROUP_CAP, 'overlap');

  const themeGroups = [...spec.themeGroups].sort((a, b) => a.id.localeCompare(b.id));
  for (const theme of themeGroups) trimGroup(theme.symbols, THEME_WEIGHT_CAP, 'theme');

  const priced = (symbol: string) => !meta.get(symbol)?.unpriced;
  const nonCash = () => Array.from(weights.entries())
    .filter(([symbol, weight]) => weight > BOOK_LIMIT_TOLERANCE && meta.get(symbol)?.role !== 'cash' && priced(symbol))
    .reduce((total, [, weight]) => total + weight, 0);
  while (nonCash() > spec.maxNet + BOOK_LIMIT_TOLERANCE) {
    const ranked = Array.from(weights.keys())
      .filter((symbol) => (weights.get(symbol) ?? 0) > BOOK_LIMIT_TOLERANCE && meta.get(symbol)?.role !== 'cash' && priced(symbol))
      .sort((a, b) => trimRank(meta.get(a), meta.get(b), weights));
    if (!ranked.length) break;
    sell(ranked[0], nonCash() - spec.maxNet, 'net');
  }

  const gross = () => Array.from(weights.entries())
    .filter(([symbol, weight]) => weight > BOOK_LIMIT_TOLERANCE && priced(symbol))
    .reduce((total, [, weight]) => total + weight, 0);
  while (gross() > spec.maxGross + BOOK_LIMIT_TOLERANCE) {
    const ranked = Array.from(weights.keys())
      .filter((symbol) => (weights.get(symbol) ?? 0) > BOOK_LIMIT_TOLERANCE && priced(symbol))
      .sort((a, b) => trimRank(meta.get(a), meta.get(b), weights));
    if (!ranked.length) break;
    sell(ranked[0], gross() - spec.maxGross, 'gross');
  }

  const sold = new Set(sells.map((row) => row.symbol));
  const buys: LimitBuy[] = [];
  for (const idea of proposed) {
    if (sold.has(idea.symbol)) continue;
    if (idea.kind === 'new' && spec.haltNewEntries) continue;
    const current = weights.get(idea.symbol) ?? 0;
    const lot = meta.get(idea.symbol);
    if (lot?.unpriced) continue;
    if (idea.kind === 'pyramid' && (!(current > BOOK_LIMIT_TOLERANCE) || (lot?.tranches ?? 1) >= 2)) continue;
    if (idea.kind === 'new' && current > BOOK_LIMIT_TOLERANCE) continue;
    let room = idea.weight;
    room = Math.min(room, nameCapFor(idea.role) - current);
    for (const theme of spec.themeGroups) {
      if (!theme.symbols.includes(idea.symbol)) continue;
      const used = theme.symbols.reduce((total, symbol) => total + (weights.get(symbol) ?? 0), 0);
      room = Math.min(room, THEME_WEIGHT_CAP - used);
    }
    for (const group of overlapGroups) {
      if (!group.includes(idea.symbol)) continue;
      const used = group.reduce((total, symbol) => total + (weights.get(symbol) ?? 0), 0);
      room = Math.min(room, OVERLAP_GROUP_CAP - used);
    }
    if (idea.role !== 'cash') room = Math.min(room, spec.maxNet - nonCash());
    room = Math.min(room, spec.maxGross - gross());
    if (!(room > BOOK_LIMIT_TOLERANCE)) continue;
    weights.set(idea.symbol, current + room);
    if (!meta.has(idea.symbol)) {
      meta.set(idea.symbol, {
        symbol: idea.symbol,
        weight: 0,
        role: idea.role,
        defensive: idea.defensive,
        themes: idea.themes,
        unpriced: false,
        tranches: 0,
      });
    }
    buys.push({ symbol: idea.symbol, weight: room, kind: idea.kind });
  }

  const keptWeight = Array.from(weights.entries())
    .filter(([, weight]) => weight > BOOK_LIMIT_TOLERANCE)
    .map(([symbol, weight]) => ({ symbol, weight }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { version: BOOK_LIMITS_VERSION, sells, buys, pending, keptWeight };
}

function trimRank(a: LimitHolding | undefined, b: LimitHolding | undefined, weights: Map<string, number>): number {
  const aCash = a?.role === 'cash' ? 1 : 0;
  const bCash = b?.role === 'cash' ? 1 : 0;
  if (aCash !== bCash) return aCash - bCash;
  const aDef = a?.defensive ? 1 : 0;
  const bDef = b?.defensive ? 1 : 0;
  if (aDef !== bDef) return aDef - bDef;
  const aWeight = weights.get(a?.symbol ?? '') ?? 0;
  const bWeight = weights.get(b?.symbol ?? '') ?? 0;
  if (bWeight !== aWeight) return bWeight - aWeight;
  return (a?.symbol ?? '').localeCompare(b?.symbol ?? '');
}

export interface CashBuy {
  symbol: string;
  /** AUD to spend on shares, before the fee. */
  notional: number;
}

/** Buys in the given order. Cash is never taken below zero. A shortfall is the unfilled notional. */
export function clampBuysToCash(buys: CashBuy[], cash: number, oneWay: number): { filled: CashBuy[]; shortfall: CashBuy[]; cashLeft: number; fees: number } {
  let left = cash;
  let fees = 0;
  const filled: CashBuy[] = [];
  const shortfall: CashBuy[] = [];
  for (const buy of buys) {
    const feeRate = 1 + oneWay;
    const affordable = left / feeRate;
    if (!(affordable > BOOK_LIMIT_TOLERANCE) || !(buy.notional > BOOK_LIMIT_TOLERANCE)) {
      if (buy.notional > BOOK_LIMIT_TOLERANCE) shortfall.push(buy);
      continue;
    }
    const notional = Math.min(buy.notional, affordable);
    const fee = notional * oneWay;
    left -= notional + fee;
    fees += fee;
    filled.push({ symbol: buy.symbol, notional });
    if (buy.notional - notional > BOOK_LIMIT_TOLERANCE) shortfall.push({ symbol: buy.symbol, notional: buy.notional - notional });
  }
  return { filled, shortfall, cashLeft: left, fees };
}
