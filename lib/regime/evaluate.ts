import type { PriceBook } from './prices';
import { MOMENTUM_LOOKBACK, MOMENTUM_SKIP, TREND_WINDOW, type Bar } from './signals';
import { RULE_VERSION } from './decision';

const WARMUP = Math.max(MOMENTUM_LOOKBACK, TREND_WINDOW);

export interface EvalPath {
  id: 'lump_sum' | 'monthly_invest' | 'tactical_price';
  label: string;
  contributed: number;
  endEquity: number;
  maxDrawdown: number | null;
  turnover: number;
  sessionsInvested: number;
  sessions: number;
}

export interface SymbolEvaluation {
  symbol: string;
  bars: number;
  firstDate: string | null;
  lastDate: string | null;
  adjusted: boolean | null;
  skipped: string | null;
  months: number;
  paths: EvalPath[];
  inSample: { monthly: number | null; tactical: number | null } | null;
  outOfSample: { monthly: number | null; tactical: number | null } | null;
}

export interface EvaluationReport {
  ruleVersion: string;
  fullStrategy: 'not_validated';
  fullStrategyReason: string;
  priceOnly: true;
  fees: 'not_applied';
  slippage: 'not_applied';
  cashYield: 0;
  dividendNote: string;
  lookAhead: string;
  sampleNote: string;
  symbols: SymbolEvaluation[];
  included: number;
  skipped: number;
}

function pathResult(input: {
  id: EvalPath['id'];
  label: string;
  equity: number[];
  contributed: number;
  invested: boolean[];
  turnover: number;
}): EvalPath {
  let peak = input.equity[0] ?? 0;
  let maxDrawdown: number | null = null;
  for (const value of input.equity) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const dd = (peak - value) / peak;
      if (maxDrawdown == null || dd > maxDrawdown) maxDrawdown = dd;
    }
  }
  const sessionsInvested = input.invested.filter(Boolean).length;
  return {
    id: input.id,
    label: input.label,
    contributed: input.contributed,
    endEquity: input.equity[input.equity.length - 1] ?? 0,
    maxDrawdown,
    turnover: input.turnover,
    sessionsInvested,
    sessions: input.invested.length,
  };
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

/** Position marked at index i was chosen from the signal at i - 1. */
export function laggedInvested(bars: Bar[]): boolean[] {
  const closes = bars.map((bar) => bar.close);
  const on = closes.map((_, index) => (index >= WARMUP ? signalOn(closes, index) : null));
  return on.map((_, index) => index > 0 && on[index - 1] === true);
}

/**
 * Price-only comparison on saved bars.
 * Monthly invest and the tactical path receive 1 unit on the same dates.
 * The tactical position that earns the return into day t was chosen from the
 * signal at t-1, so the signal does not trade the move that created it.
 * Macro vintages are not in this book, so the full strategy is not validated.
 */
export function evaluateSymbol(symbol: string, bars: Bar[], adjusted: boolean | null): SymbolEvaluation {
  const base: SymbolEvaluation = {
    symbol,
    bars: bars.length,
    firstDate: bars[0]?.date ?? null,
    lastDate: bars[bars.length - 1]?.date ?? null,
    adjusted,
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
  const on: Array<boolean | null> = closes.map((_, index) => (index >= WARMUP ? signalOn(closes, index) : null));

  const monthKey = (date: string) => date.slice(0, 7);
  const contributionAt = new Array<number>(bars.length).fill(0);
  let lastMonth = '';
  for (let i = WARMUP; i < bars.length - 1; i++) {
    const key = monthKey(bars[i].date);
    if (key === lastMonth) continue;
    lastMonth = key;
    contributionAt[i + 1] += 1;
  }
  const months = contributionAt.reduce((sum, value) => sum + value, 0);
  if (months < 2) {
    return { ...base, skipped: `${symbol} does not have two contribution months after the warmup.` };
  }

  const lumpIndex = WARMUP + 1;
  const lumpShares = months / closes[lumpIndex];
  const lumpEquity: number[] = [];
  const lumpInvested: boolean[] = [];
  for (let i = lumpIndex; i < bars.length; i++) {
    lumpEquity.push(lumpShares * closes[i]);
    lumpInvested.push(true);
  }

  let monthlyCash = 0;
  let monthlyShares = 0;
  let tacticalCash = 0;
  let tacticalShares = 0;
  let tacticalTurnover = 0;
  let prevWeight = 0;
  const monthlyEquity: number[] = [];
  const tacticalEquity: number[] = [];
  const monthlyInvested: boolean[] = [];
  const tacticalInvested: boolean[] = [];
  const monthlyMarks: number[] = [];
  const tacticalMarks: number[] = [];
  for (let i = lumpIndex; i < bars.length; i++) {
    const contribution = contributionAt[i];
    monthlyCash += contribution;
    const buy = monthlyCash / closes[i];
    monthlyShares += buy;
    monthlyCash = 0;
    monthlyEquity.push(monthlyShares * closes[i]);
    monthlyInvested.push(true);
    monthlyMarks.push(monthlyShares * closes[i]);

    tacticalCash += contribution;
    const signalIndex = i - 1;
    const invested = on[signalIndex] === true;
    const equityBefore = tacticalCash + tacticalShares * closes[i];
    const targetShares = invested ? equityBefore / closes[i] : 0;
    const targetCash = invested ? 0 : equityBefore;
    const weight = equityBefore > 0 && invested ? 1 : 0;
    tacticalTurnover += Math.abs(weight - prevWeight);
    prevWeight = weight;
    tacticalShares = targetShares;
    tacticalCash = targetCash;
    tacticalEquity.push(tacticalCash + tacticalShares * closes[i]);
    tacticalInvested.push(invested);
    tacticalMarks.push(tacticalCash + tacticalShares * closes[i]);
  }

  const half = Math.floor(months / 2);
  const split = half >= 12 ? splitGrowth(contributionAt, closes, on, lumpIndex, half) : null;

  return {
    ...base,
    months,
    paths: [
      pathResult({
        id: 'lump_sum',
        label: 'All cash at the first tradable session',
        equity: lumpEquity,
        contributed: months,
        invested: lumpInvested,
        turnover: 1,
      }),
      pathResult({
        id: 'monthly_invest',
        label: 'Same cash, invested on each contribution date',
        equity: monthlyEquity,
        contributed: months,
        invested: monthlyInvested,
        turnover: months,
      }),
      pathResult({
        id: 'tactical_price',
        label: 'Same cash, invested only when the lagged price rules are on',
        equity: tacticalEquity,
        contributed: months,
        invested: tacticalInvested,
        turnover: tacticalTurnover,
      }),
    ],
    inSample: split ? split.inSample : null,
    outOfSample: split ? split.outOfSample : null,
  };
}

function splitGrowth(
  contributionAt: number[],
  closes: number[],
  on: Array<boolean | null>,
  start: number,
  halfMonths: number,
): {
  inSample: { monthly: number | null; tactical: number | null };
  outOfSample: { monthly: number | null; tactical: number | null };
} {
  const grow = (fromMonth: number, toMonth: number) => {
    let seen = 0;
    let monthlyCash = 0;
    let monthlyShares = 0;
    let tacticalCash = 0;
    let tacticalShares = 0;
    let lastIndex = start;
    for (let i = start; i < closes.length; i++) {
      if (contributionAt[i] > 0) seen += 1;
      if (seen <= fromMonth || seen > toMonth) continue;
      lastIndex = i;
      const contribution = contributionAt[i];
      monthlyCash += contribution;
      monthlyShares += monthlyCash / closes[i];
      monthlyCash = 0;
      tacticalCash += contribution;
      const invested = on[i - 1] === true;
      const equity = tacticalCash + tacticalShares * closes[i];
      tacticalShares = invested ? equity / closes[i] : 0;
      tacticalCash = invested ? 0 : equity;
    }
    const contributed = toMonth - fromMonth;
    if (contributed <= 0) return { monthly: null, tactical: null };
    return {
      monthly: (monthlyShares * closes[lastIndex]) / contributed,
      tactical: (tacticalCash + tacticalShares * closes[lastIndex]) / contributed,
    };
  };
  return {
    inSample: grow(0, halfMonths),
    outOfSample: grow(halfMonths, halfMonths * 2),
  };
}

export function evaluateBook(book: PriceBook | null): EvaluationReport {
  const symbols = (book?.series ?? []).map((series) => evaluateSymbol(series.symbol, series.bars, series.adjusted ?? null));
  const included = symbols.filter((symbol) => symbol.skipped == null).length;
  const adjustedKnown = symbols.some((symbol) => symbol.adjusted === true);
  const adjustedMissing = symbols.some((symbol) => symbol.adjusted == null);
  return {
    ruleVersion: RULE_VERSION,
    fullStrategy: 'not_validated',
    fullStrategyReason: 'The saved snapshot has the latest macro print, not the vintage that was public on each past date. This check does not copy today’s macro score onto old dates. A backtest of the full regime strategy is not validated.',
    priceOnly: true,
    fees: 'not_applied',
    slippage: 'not_applied',
    cashYield: 0,
    dividendNote: adjustedKnown
      ? 'Symbols marked adjusted use Yahoo’s adjusted close, so splits and dividends are inside the price when Yahoo adjusted them. There is no separate dividend ledger.'
      : adjustedMissing
        ? 'This saved book does not say whether each close is adjusted. The fetch asks Yahoo for adjusted closes, and a raw close is used only when the adjusted series is absent. Do not treat these paths as an audited total-return record.'
        : 'Yahoo did not return an adjusted close for these symbols. Dividends are not added on top.',
    lookAhead: 'The price rule uses only closes up to the prior session. It does not trade the move that flipped the rule. Thresholds are the live ones: above the 200-day average and a positive 12–1 move. They were not searched.',
    sampleNote: 'A split into an earlier and a later half is shown only when each half has at least 12 contribution months. A short book stays unsplit. Software tests of this arithmetic are not investment validation.',
    symbols,
    included,
    skipped: symbols.length - included,
  };
}
