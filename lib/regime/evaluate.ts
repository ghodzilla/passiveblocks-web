import type { PriceBook } from './prices';
import { MOMENTUM_LOOKBACK, MOMENTUM_SKIP, TREND_WINDOW, type Bar } from './signals';
import { RULE_VERSION } from './decision';

const WARMUP = Math.max(MOMENTUM_LOOKBACK, TREND_WINDOW);
const YEAR_DAYS = 365.25;

export const DEFAULT_ONE_WAY_BPS = 10;
export const DEFAULT_CASH_YIELD_BPS = 0;
export const MAX_ONE_WAY_BPS = 100;
export const MAX_CASH_YIELD_BPS = 500;

export interface ResearchAssumptions {
  oneWayBps: number;
  cashYieldBps: number;
  oneWay: number;
  cashYieldAnnual: number;
  clamped: boolean;
}

export interface EvalPath {
  id: 'lump_sum' | 'monthly_invest' | 'tactical_price';
  label: string;
  /** Lump sum uses one funding date. It is not a skill comparison with the monthly paths. */
  comparable: boolean;
  contributed: number;
  endEquity: number;
  endCash: number;
  endInvested: number;
  /** Ending wealth divided by cash contributed. Not a time-weighted return. */
  wealthPerUnitContributed: number | null;
  maxDrawdown: number | null;
  costsPaid: number;
  tradedNotional: number;
  sessionsInvested: number;
  sessions: number;
}

export interface SymbolEvaluation {
  symbol: string;
  bars: number;
  firstDate: string | null;
  lastDate: string | null;
  adjusted: boolean | null;
  totalReturn: 'adjusted' | 'price_only' | 'unknown';
  skipped: string | null;
  months: number;
  paths: EvalPath[];
  inSample: { monthlyWealthPerUnit: number | null; tacticalWealthPerUnit: number | null } | null;
  outOfSample: { monthlyWealthPerUnit: number | null; tacticalWealthPerUnit: number | null } | null;
}

export interface EvaluationReport {
  ruleVersion: string;
  fullStrategy: 'not_validated';
  fullStrategyReason: string;
  priceOnly: true;
  assumptions: ResearchAssumptions;
  costNote: string;
  cashNote: string;
  dividendNote: string;
  lookAhead: string;
  sampleNote: string;
  returnLabel: string;
  symbols: SymbolEvaluation[];
  included: number;
  skipped: number;
  unavailableReason: string | null;
}

function firstParam(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readBps(raw: string | null, fallback: number, max: number): { value: number; clamped: boolean } {
  if (raw == null || raw.trim() === '') return { value: fallback, clamped: false };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { value: fallback, clamped: false };
  const rounded = Math.round(parsed * 100) / 100;
  if (rounded < 0) return { value: 0, clamped: true };
  if (rounded > max) return { value: max, clamped: true };
  return { value: rounded, clamped: false };
}

export function parseResearchAssumptions(input?: {
  costBps?: string | string[] | null;
  cashBps?: string | string[] | null;
}): ResearchAssumptions {
  const cost = readBps(firstParam(input?.costBps), DEFAULT_ONE_WAY_BPS, MAX_ONE_WAY_BPS);
  const cash = readBps(firstParam(input?.cashBps), DEFAULT_CASH_YIELD_BPS, MAX_CASH_YIELD_BPS);
  return {
    oneWayBps: cost.value,
    cashYieldBps: cash.value,
    oneWay: cost.value / 10_000,
    cashYieldAnnual: cash.value / 10_000,
    clamped: cost.clamped || cash.clamped,
  };
}

export function accrueCash(cash: number, annual: number, days: number): number {
  if (!(cash > 0) || !(annual > 0) || !(days > 0)) return cash;
  return cash * (1 + annual) ** (days / YEAR_DAYS);
}

export function buyWithCost(cash: number, price: number, oneWayBps: number): { shares: number; cash: number; cost: number; traded: number } {
  const fraction = oneWayBps / 10_000;
  if (!(cash > 0) || !(price > 0)) return { shares: 0, cash, cost: 0, traded: 0 };
  const fee = cash * fraction;
  return { shares: (cash - fee) / price, cash: 0, cost: fee, traded: cash };
}

export function sellWithCost(shares: number, price: number, oneWayBps: number): { shares: number; cash: number; cost: number; traded: number } {
  const fraction = oneWayBps / 10_000;
  if (!(shares > 0) || !(price > 0)) return { shares, cash: 0, cost: 0, traded: 0 };
  const gross = shares * price;
  const fee = gross * fraction;
  return { shares: 0, cash: gross - fee, cost: fee, traded: gross };
}

function signalOn(closes: number[], index: number): boolean | null {
  if (index < MOMENTUM_LOOKBACK || index + 1 < TREND_WINDOW) return null;
  let sum = 0;
  for (let k = index - TREND_WINDOW + 1; k <= index; k += 1) sum += closes[k];
  const recent = closes[index - MOMENTUM_SKIP];
  const past = closes[index - MOMENTUM_LOOKBACK];
  if (!(recent > 0) || !(past > 0) || !(sum > 0)) return null;
  const above200 = closes[index] > sum / TREND_WINDOW;
  const momentum = recent / past - 1;
  return above200 && momentum > 0;
}

/** True after the fill at index i. The fill uses the signal from index i - 1. */
export function laggedInvested(bars: Bar[]): boolean[] {
  const closes = bars.map((bar) => bar.close);
  const known = closes.map((_, index) => (index >= WARMUP ? signalOn(closes, index) : null));
  return known.map((_, index) => index > 0 && known[index - 1] === true);
}

function calendarDays(left: string, right: string): number {
  const start = Date.parse(`${left}T00:00:00Z`);
  const end = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function wealthPerUnit(equity: number, contributed: number): number | null {
  if (!(contributed > 0) || !Number.isFinite(equity)) return null;
  return equity / contributed;
}

function pathResult(input: {
  id: EvalPath['id'];
  label: string;
  comparable: boolean;
  equity: number[];
  contributed: number;
  endCash: number;
  endInvested: number;
  costsPaid: number;
  tradedNotional: number;
  invested: boolean[];
}): EvalPath {
  let peak = 0;
  let maxDrawdown: number | null = null;
  for (const value of input.equity) {
    if (!(value > 0)) continue;
    if (value > peak) peak = value;
    if (peak > 0) {
      const drawdown = (peak - value) / peak;
      if (maxDrawdown == null || drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  const endEquity = input.equity[input.equity.length - 1] ?? 0;
  return {
    id: input.id,
    label: input.label,
    comparable: input.comparable,
    contributed: input.contributed,
    endEquity,
    endCash: input.endCash,
    endInvested: input.endInvested,
    wealthPerUnitContributed: wealthPerUnit(endEquity, input.contributed),
    maxDrawdown,
    costsPaid: input.costsPaid,
    tradedNotional: input.tradedNotional,
    sessionsInvested: input.invested.filter(Boolean).length,
    sessions: input.invested.length,
  };
}

function runLedger(input: {
  closes: number[];
  dates: string[];
  contributionAt: number[];
  wantLong: boolean[];
  assumptions: ResearchAssumptions;
}): { equity: number[]; invested: boolean[]; contributed: number; endCash: number; endInvested: number; costsPaid: number; tradedNotional: number } {
  let cash = 0;
  let shares = 0;
  let costsPaid = 0;
  let tradedNotional = 0;
  let contributed = 0;
  const equity: number[] = [];
  const invested: boolean[] = [];
  const fraction = input.assumptions.oneWayBps / 10_000;
  for (let i = 0; i < input.closes.length; i += 1) {
    const price = input.closes[i];
    if (i > 0) cash = accrueCash(cash, input.assumptions.cashYieldAnnual, calendarDays(input.dates[i - 1], input.dates[i]));
    const contribution = input.contributionAt[i] ?? 0;
    if (contribution > 0) {
      cash += contribution;
      contributed += contribution;
    }
    const wantLong = input.wantLong[i] === true;
    if (wantLong && cash > 0 && price > 0) {
      const fee = cash * fraction;
      shares += (cash - fee) / price;
      tradedNotional += cash;
      costsPaid += fee;
      cash = 0;
    } else if (!wantLong && shares > 0 && price > 0) {
      const gross = shares * price;
      const fee = gross * fraction;
      cash += gross - fee;
      tradedNotional += gross;
      costsPaid += fee;
      shares = 0;
    }
    const investedValue = shares * price;
    equity.push(cash + investedValue);
    invested.push(shares > 0);
  }
  const endPrice = input.closes[input.closes.length - 1] ?? 0;
  return {
    equity,
    invested,
    contributed,
    endCash: cash,
    endInvested: shares * endPrice,
    costsPaid,
    tradedNotional,
  };
}

function totalReturnOf(adjusted: boolean | null): SymbolEvaluation['totalReturn'] {
  if (adjusted === true) return 'adjusted';
  if (adjusted === false) return 'price_only';
  return 'unknown';
}

/**
 * Price-only comparison on saved bars.
 * Monthly and tactical paths receive the same cash on the same sessions.
 * A fill uses the previous session’s signal and this session’s close.
 * Lump sum is the same total cash on the first fill only.
 */
export function evaluateSymbol(
  symbol: string,
  bars: Bar[],
  adjusted: boolean | null,
  assumptions: ResearchAssumptions = parseResearchAssumptions(),
): SymbolEvaluation {
  const base: SymbolEvaluation = {
    symbol,
    bars: bars.length,
    firstDate: bars[0]?.date ?? null,
    lastDate: bars[bars.length - 1]?.date ?? null,
    adjusted,
    totalReturn: totalReturnOf(adjusted),
    skipped: null,
    months: 0,
    paths: [],
    inSample: null,
    outOfSample: null,
  };
  if (bars.length < WARMUP + 3) {
    return { ...base, skipped: `${symbol} has ${bars.length} bars. The price-only check needs more than ${WARMUP + 2}.` };
  }
  const closes = bars.map((bar) => bar.close);
  const dates = bars.map((bar) => bar.date);
  const known = closes.map((_, index) => (index >= WARMUP ? signalOn(closes, index) : null));
  const wantLong = known.map((_, index) => index > 0 && known[index - 1] === true);

  const contributionAt = new Array<number>(bars.length).fill(0);
  let lastMonth = '';
  for (let i = WARMUP + 1; i < bars.length; i += 1) {
    const key = dates[i].slice(0, 7);
    if (key === lastMonth) continue;
    lastMonth = key;
    contributionAt[i] += 1;
  }
  const months = contributionAt.reduce((sum, value) => sum + value, 0);
  if (months < 2) {
    return { ...base, skipped: `${symbol} does not have two contribution months after the warmup.` };
  }

  const alwaysLong = wantLong.map(() => true);
  const lumpAt = contributionAt.map(() => 0);
  const firstFill = contributionAt.findIndex((value) => value > 0);
  if (firstFill >= 0) lumpAt[firstFill] = months;

  const monthly = runLedger({ closes, dates, contributionAt, wantLong: alwaysLong, assumptions });
  const tactical = runLedger({ closes, dates, contributionAt, wantLong, assumptions });
  const lump = runLedger({ closes, dates, contributionAt: lumpAt, wantLong: alwaysLong, assumptions });

  const half = Math.floor(months / 2);
  const split = half >= 12 ? {
    inSample: wealthSplit(closes, dates, contributionAt, wantLong, assumptions, 1, half),
    outOfSample: wealthSplit(closes, dates, contributionAt, wantLong, assumptions, half + 1, half * 2),
  } : null;

  return {
    ...base,
    months,
    paths: [
      pathResult({
        id: 'lump_sum',
        label: 'Same total cash, all on the first contribution session',
        comparable: false,
        equity: lump.equity,
        contributed: lump.contributed,
        endCash: lump.endCash,
        endInvested: lump.endInvested,
        costsPaid: lump.costsPaid,
        tradedNotional: lump.tradedNotional,
        invested: lump.invested,
      }),
      pathResult({
        id: 'monthly_invest',
        label: 'Each contribution invested at that session',
        comparable: true,
        equity: monthly.equity,
        contributed: monthly.contributed,
        endCash: monthly.endCash,
        endInvested: monthly.endInvested,
        costsPaid: monthly.costsPaid,
        tradedNotional: monthly.tradedNotional,
        invested: monthly.invested,
      }),
      pathResult({
        id: 'tactical_price',
        label: 'Same contributions, invested only when the prior session’s price rules are on',
        comparable: true,
        equity: tactical.equity,
        contributed: tactical.contributed,
        endCash: tactical.endCash,
        endInvested: tactical.endInvested,
        costsPaid: tactical.costsPaid,
        tradedNotional: tactical.tradedNotional,
        invested: tactical.invested,
      }),
    ],
    inSample: split?.inSample ?? null,
    outOfSample: split?.outOfSample ?? null,
  };
}

function wealthSplit(
  closes: number[],
  dates: string[],
  contributionAt: number[],
  wantLong: boolean[],
  assumptions: ResearchAssumptions,
  fromMonth: number,
  toMonth: number,
): { monthlyWealthPerUnit: number | null; tacticalWealthPerUnit: number | null } {
  let seen = 0;
  const sliced = contributionAt.map((value) => {
    if (!(value > 0)) return 0;
    seen += 1;
    return seen >= fromMonth && seen <= toMonth ? value : 0;
  });
  const alwaysLong = wantLong.map(() => true);
  const monthly = runLedger({ closes, dates, contributionAt: sliced, wantLong: alwaysLong, assumptions });
  const tactical = runLedger({ closes, dates, contributionAt: sliced, wantLong, assumptions });
  return {
    monthlyWealthPerUnit: wealthPerUnit(monthly.equity[monthly.equity.length - 1] ?? 0, monthly.contributed),
    tacticalWealthPerUnit: wealthPerUnit(tactical.equity[tactical.equity.length - 1] ?? 0, tactical.contributed),
  };
}

function dividendNote(symbols: SymbolEvaluation[]): string {
  const included = symbols.filter((symbol) => symbol.skipped == null);
  if (included.length === 0) return 'No symbol was long enough to describe dividends.';
  if (included.every((symbol) => symbol.totalReturn === 'adjusted')) {
    return 'These symbols have an adjusted close, so the path uses that total-return price when the provider adjusted it. There is no separate dividend ledger.';
  }
  if (included.every((symbol) => symbol.totalReturn === 'price_only')) {
    return 'Adjusted closes were not available. These paths are price changes only. Dividends are not added.';
  }
  return 'Adjusted close was not recorded for every symbol. A row marked unknown or price only is not a total return. Dividends are not added unless that row says adjusted.';
}

export function evaluateBook(book: PriceBook | null, assumptions: ResearchAssumptions = parseResearchAssumptions()): EvaluationReport {
  const symbols = (book?.series ?? []).map((series) => evaluateSymbol(series.symbol, series.bars, series.adjusted ?? null, assumptions));
  const included = symbols.filter((symbol) => symbol.skipped == null).length;
  const empty = (book?.series.length ?? 0) === 0;
  return {
    ruleVersion: RULE_VERSION,
    fullStrategy: 'not_validated',
    fullStrategyReason: 'The saved snapshot has the latest macro print, not the vintage that was public on each past date. This check does not copy today’s macro score onto old dates. A backtest of the full regime strategy is not validated.',
    priceOnly: true,
    assumptions,
    costNote: `One-way cost assumption is ${assumptions.oneWayBps} bps on every buy and every sell, including the first entry and later rebalances. Monthly and tactical use that same charge. It is an assumption, not a broker quote.${assumptions.clamped ? ' An entered value was outside 0–100 bps for costs or 0–500 bps for cash yield and was clamped.' : ''}`,
    cashNote: assumptions.cashYieldAnnual > 0
      ? `Leftover cash accrues ${assumptions.cashYieldBps} bps a year, compounded by the calendar gap between sessions. That yield is an assumption.`
      : 'Leftover cash earns nothing in this table. Cash yield is an explicit assumption and is currently zero.',
    dividendNote: dividendNote(symbols),
    lookAhead: 'The fill at a session uses the signal from the previous session of that symbol. It trades at that session’s close, so it does not use the move after the fill, and it does not trade the close that created the signal. Holidays with no bar are not sessions.',
    sampleNote: 'Monthly and tactical receive the same cash on the same dates. Ending wealth per unit contributed is not a time-weighted return. The lump sum funds the same total on the first date only, so it is a different funding schedule, not a measure of tactical skill. A later half is shown only when each half has at least 12 contribution months. Thresholds are not searched.',
    returnLabel: 'Ending wealth per unit contributed. Not a time-weighted return.',
    symbols,
    included,
    skipped: symbols.length - included,
    unavailableReason: empty ? 'No saved price book is available, so this table has no results.' : null,
  };
}
