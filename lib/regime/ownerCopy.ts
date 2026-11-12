import { THRESHOLDS, type ComponentId, type RegimeId } from './constants';
import { sydneyClock } from './time';
import type { FreshnessRow } from './types';

export type OwnerAction = 'risk_budget_open' | 'do_nothing' | 'reduce_risk';

export interface OwnerLine {
  symbol: string;
  name: string;
  role: 'tactical' | 'systematic' | 'cash';
  weight: number;
  defensive?: boolean;
  pyramid?: 'new' | 'add' | 'hold' | 'no-add-loser';
}

export interface OwnerExposure {
  gross: number;
  net: number;
  risk: number;
  defensive: number;
  cash: number;
  maxGross: number;
  maxNet: number;
}

export type FeedStatus = 'fresh' | 'stale' | 'blocked';

export interface FeedLine {
  id: string;
  name: string;
  source: string;
  updated: string;
  status: FeedStatus;
  means: string;
  detail: string;
}

const CASH = new Set(['SHY', 'AAA.AX', 'BILL.AX', 'CASH']);
const CASH_LIKE = ['SHY', 'AAA.AX', 'BILL.AX'];

export interface BookParts {
  cash: number;
  cashLike: number;
  defensive: number;
  risk: number;
  invested: number;
  nonCash: number;
}

/**
 * One split for the sentence, the invested bar and the allocation bar.
 * Invested is the engine's gross (everything except the cash balance) when that
 * exists, so a mismatched weight list cannot print a different total.
 * Cash-like funds sit inside invested and outside non-cash. They are not added again as defensive.
 */
export function bookParts(input: {
  weights: { symbol: string; weight: number }[] | null;
  exposures: Pick<OwnerExposure, 'gross' | 'net' | 'risk' | 'defensive' | 'cash'> | null;
}): BookParts {
  const weights = input.weights ?? [];
  const cashLikeWeights = weights
    .filter((row) => CASH_LIKE.includes(row.symbol))
    .reduce((sum, row) => sum + row.weight, 0);
  const holdingsWeight = weights
    .filter((row) => row.symbol !== 'CASH')
    .reduce((sum, row) => sum + row.weight, 0);
  const exp = input.exposures;
  const invested = exp ? exp.gross : holdingsWeight;
  const nonCash = exp ? exp.net : Math.max(0, holdingsWeight - cashLikeWeights);
  const cash = exp
    ? exp.cash
    : (weights.find((row) => row.symbol === 'CASH')?.weight ?? Math.max(0, 1 - invested));
  const cashLike = exp ? Math.max(0, exp.gross - exp.net) : cashLikeWeights;
  const room = Math.max(0, invested - cashLike);
  let defensive = exp?.defensive ?? room;
  let risk = exp?.risk ?? 0;
  const bucket = defensive + risk;
  if (!(room > 0)) {
    defensive = 0;
    risk = 0;
  } else if (!(bucket > 0)) {
    defensive = room;
    risk = 0;
  } else if (Math.abs(bucket - room) > 1e-6) {
    const scale = room / bucket;
    defensive *= scale;
    risk *= scale;
  }
  return { cash, cashLike, defensive, risk, invested, nonCash };
}

const COMPONENT_PLAIN: Record<ComponentId, { title: string; about: string }> = {
  liquidity: {
    title: 'Money in the system',
    about: 'It tracks how much money is moving through the financial system.',
  },
  policy: {
    title: 'Interest rates',
    about: 'It tracks whether interest rates are helping or squeezing borrowers.',
  },
  credit: {
    title: 'Lender nerves',
    about: 'It tracks how much extra lenders demand from risky borrowers.',
  },
  growth: {
    title: 'Growth',
    about: 'It tracks whether the economy looks like it is picking up or fading.',
  },
  positioning: {
    title: 'Crowded bets',
    about: 'It tracks whether traders are already piled into the same bets.',
  },
  ai: {
    title: 'AI spending',
    about: 'It tracks spending on AI and how concentrated the share market is.',
  },
};

const FEED_PLAIN: Record<string, string> = {
  WALCL: 'Money at the US central bank',
  WTREGEN: 'US government cash account',
  RRPONTSYD: 'Overnight cash parked at the US central bank',
  DGS2: 'US 2-year interest rate',
  DFEDTARU: 'US policy interest rate',
  DFF: 'US policy interest rate',
  DFII10: 'US interest rate after inflation (10-yr)',
  DTWEXBGS: 'US dollar vs trading partners',
  'AUDUSD=X': 'A$ in US$',
  BAMLH0A0HYM2: 'Extra yield lenders demand from risky bonds',
  T10Y2Y: 'Gap between long and short US interest rates',
  USALOLITOAASTSAM: 'US growth indicator',
  AUSLOLITOAASTSAM: 'Australian growth indicator',
  SPY: 'US share market',
  RSP: 'US share market, equal weight',
  SMH: 'Semiconductor shares',
  IPG3344S: 'Semiconductor factory output',
  GLD: 'Gold',
  'GOLD.AX': 'Gold (Australian shares)',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ether',
  'SOL-USD': 'Solana',
};

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function audMoney(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function bookPercent(weight: number): string {
  const pct = weight * 100;
  const digits = Math.abs(pct - Math.round(pct)) < 0.05 ? 0 : 1;
  return `${pct.toFixed(digits)}%`;
}

/** Current paper value when the book is in AUD. Otherwise null, so the page does not invent a dollar figure. */
export function bookAudValue(input: {
  currency: 'AUD' | null;
  equity: number | null;
  capital: number;
  valued: boolean;
}): { amount: number | null; basis: 'value' | 'starting amount' | 'unavailable' } {
  if (input.currency !== 'AUD') return { amount: null, basis: 'unavailable' };
  if (input.valued && input.equity != null && Number.isFinite(input.equity)) {
    return { amount: input.equity, basis: 'value' };
  }
  if (Number.isFinite(input.capital) && input.capital > 0) {
    return { amount: input.capital, basis: 'starting amount' };
  }
  return { amount: null, basis: 'unavailable' };
}

export function plainRegime(regime: RegimeId | null): { title: string; means: string } {
  if (regime === 'risk_on') {
    return { title: 'Supportive', means: 'Money is flowing and lenders are relaxed. New buys are allowed inside the limits; each name must still pass its checks.' };
  }
  if (regime === 'tightening') {
    return { title: 'Cautious', means: 'Conditions look tighter than usual, so the plan favours defence and cash.' };
  }
  if (regime === 'crisis') {
    return { title: 'Stressed', means: 'Conditions look dangerous, so the plan favours cash and cuts risky bets.' };
  }
  if (regime === 'transitional') {
    return { title: 'Mixed', means: `Not clearly good or bad for investors. The rules hold and wait. Buying restarts at a score of +${THRESHOLDS.riskOnEnter.toFixed(2)}.` };
  }
  return { title: 'No call', means: 'There is not enough current data to say what the market is doing.' };
}

export function marketCall(input: {
  actionable: boolean;
  action: OwnerAction;
  regime: RegimeId | null;
}): string {
  if (!input.actionable || input.regime == null) {
    return 'The data is not solid enough for a market call, so the plan is to hold and not buy anything new.';
  }
  if (input.regime === 'crisis') {
    return 'Markets look stressed, so the plan is to hold mostly cash and cut back on risky assets.';
  }
  if (input.action === 'reduce_risk' || input.regime === 'tightening') {
    return 'Markets look cautious, so the plan is to hold mostly defensive assets and cash.';
  }
  if (input.action === 'do_nothing' || input.regime === 'transitional') {
    return 'Markets look mixed, so the plan is to hold what you have and not buy anything new.';
  }
  return 'Markets look supportive, so the plan allows new buys, kept small against the whole book.';
}

function sizedAmount(weight: number, bookAud: number | null): string {
  const pct = `${bookPercent(weight)} of the book`;
  if (bookAud == null) return pct;
  return `about ${audMoney(weight * bookAud)} (${pct})`;
}

function cashLike(line: OwnerLine): boolean {
  return line.role === 'cash' || CASH.has(line.symbol);
}

export interface HeldSlice {
  symbol: string;
  name: string;
  weight: number;
  role?: OwnerLine['role'];
}

export interface SessionTrade {
  symbol: string;
  side: 'buy' | 'sell';
  notionalAud: number;
}

export function todayAction(input: {
  actionable: boolean;
  action: OwnerAction;
  halted: boolean;
  lines: OwnerLine[];
  bookAud: number | null;
  pending?: { symbol: string; reason: string }[];
  held?: HeldSlice[] | null;
  trades?: SessionTrade[];
  drawdown?: number | null;
  composite?: number | null;
  maxGross?: number | null;
  maxNet?: number | null;
  staleFeed?: string | null;
}): { verb: 'HOLD' | 'BUY' | 'TRIM' | 'SELL' | 'PLAY SAFE'; headline: string; reason: string; steps: string[]; means: string } {
  const planned = (input.held && input.held.length > 0)
    ? input.held
    : input.lines.filter((line) => line.weight > 0).map((line) => ({
      symbol: line.symbol,
      name: line.name,
      weight: line.weight,
      role: line.role,
    }));
  const cashRows = planned.filter((row) => row.symbol === 'CASH');
  const holdings = planned.filter((row) => row.symbol !== 'CASH');
  const cashWeight = cashRows.reduce((sum, row) => sum + row.weight, 0);
  const investedWeight = holdings.reduce((sum, row) => sum + row.weight, 0);
  const sells = (input.trades ?? []).filter((trade) => trade.side === 'sell');
  const buys = (input.trades ?? []).filter((trade) => trade.side === 'buy');
  const open = input.actionable && input.action === 'risk_budget_open' && !input.halted;
  const steps: string[] = [];
  const means = input.bookAud == null
    ? 'Percentages are shares of the paper book. Dollar amounts are left blank because this book has no Australian-dollar value.'
    : `A$ amounts use the paper book's value of ${audMoney(input.bookAud)}.`;

  if (!input.actionable) {
    return {
      verb: 'PLAY SAFE',
      headline: `PLAY SAFE — ${input.staleFeed ?? 'a key feed'} is missing or out of date. No buys, and the book can be trimmed back to 20% invested.`,
      reason: 'A missing or old key feed makes the rules play safe.',
      steps: holdings.length ? [`Keep the ${holdings.length} holdings already in the book.`] : ['No new buys.'],
      means,
    };
  }
  if (input.halted) {
    const below = input.drawdown != null ? `${(input.drawdown * 100).toFixed(1)}%` : '10% or more';
    return {
      verb: 'HOLD',
      headline: `HOLD — the book is ${below} below its high (limit 10%). New buys are paused; top-ups of winners are still allowed.`,
      reason: 'The loss limit is on.',
      steps: [`Keep the holdings already in the book. Buy nothing new.`],
      means,
    };
  }

  const score = input.composite == null ? 'unknown' : `${input.composite > 0 ? '+' : ''}${input.composite.toFixed(2)}`;
  if (sells.length > 0 || (input.action === 'reduce_risk' && (input.pending?.length ?? 0) > 0)) {
    const sold = sells.map((trade) => `${trade.symbol} ${input.bookAud == null ? '' : audMoney(trade.notionalAud)}`.trim());
    const waiting = (input.pending ?? []).map((item) => `${item.symbol}: ${item.reason}`);
    const cap = input.maxGross != null && input.maxNet != null
      ? `cut back to ${bookPercent(input.maxGross)} invested / ${bookPercent(input.maxNet)} non-cash`
      : 'cut the book back';
    return {
      verb: 'TRIM',
      headline: `TRIM — ${cap}${sold.length ? `: sell ${sold.join(', ')}` : ''}.`,
      reason: 'The rules are reducing the book.',
      steps: waiting.length ? waiting : (sold.length ? sold.map((item) => `Sell ${item}.`) : ['Sell enough to get back inside the limits.']),
      means,
    };
  }
  if (open && (buys.length > 0 || input.lines.some((line) => line.weight > 0 && line.pyramid !== 'hold' && line.pyramid !== 'no-add-loser' && line.symbol !== 'CASH' && !cashLike(line)))) {
    for (const line of input.lines.filter((item) => item.weight > 0 && item.symbol !== 'CASH')) {
      const verb = line.pyramid === 'add' ? 'Top up' : line.pyramid === 'hold' || line.pyramid === 'no-add-loser' || cashLike(line) ? 'Hold' : 'Buy';
      const joiner = verb === 'Hold' || input.bookAud == null ? ',' : ' for';
      steps.push(`${verb} ${line.name} (${line.symbol})${joiner} ${sizedAmount(line.weight, input.bookAud)}.`);
    }
    return {
      verb: 'BUY',
      headline: 'New buys are allowed today, inside the size limits.',
      reason: 'The market mood is Supportive and each named buy passed its checks.',
      steps: steps.length ? steps : ['Buy only the names that passed every check.'],
      means,
    };
  }
  if (holdings.length === 0 && cashWeight >= 0.999) {
    return {
      verb: 'HOLD',
      headline: 'Cash is the position.',
      reason: 'The book is entirely cash.',
      steps: [`Keep ${input.bookAud == null ? 'the cash' : audMoney(cashWeight * input.bookAud)} in cash.`],
      means,
    };
  }
  if (holdings.length > 0) {
    steps.push(`Keep all ${holdings.length} holdings as they are (${input.bookAud == null ? bookPercent(investedWeight) : `${audMoney(investedWeight * input.bookAud)}, ${bookPercent(investedWeight)} of the book`}). Buy nothing. Sell nothing.`);
    if (cashWeight > 0 && input.bookAud != null) steps.push(`Keep ${audMoney(cashWeight * input.bookAud)} in cash.`);
    else if (input.bookAud != null && investedWeight < 0.999) steps.push(`Keep ${audMoney((1 - investedWeight) * input.bookAud)} in cash.`);
    return {
      verb: 'HOLD',
      headline: 'No buys, no sells today.',
      reason: `Reason: no clear market signal (score ${score}; buys need +${THRESHOLDS.riskOnEnter.toFixed(2)}).`,
      steps,
      means,
    };
  }
  return {
    verb: 'HOLD',
    headline: 'Cash is the position.',
    reason: `Reason: no clear market signal (score ${score}; buys need +${THRESHOLDS.riskOnEnter.toFixed(2)}).`,
    steps: ['Buy nothing. Sell nothing.'],
    means,
  };
}

export function holdingsNow(input: {
  lines: OwnerLine[];
  exposures: OwnerExposure | null;
  heldWeights: { symbol: string; weight: number }[] | null;
  heldBasis: string | undefined;
  names?: Record<string, string>;
  bookAud: number | null;
}): { sentence: string; items: string[]; means: string } {
  const names = input.names ?? {};
  const held = input.heldBasis === 'held-book' ? (input.heldWeights ?? []).filter((row) => row.weight > 0) : [];
  if (held.length > 0) {
    const ranked = held.slice().sort((a, b) => b.weight - a.weight);
    const items = ranked.map((row) => {
      const name = row.symbol === 'CASH' ? 'Cash' : (names[row.symbol] ?? input.lines.find((line) => line.symbol === row.symbol)?.name ?? row.symbol);
      const label = row.symbol === 'CASH' ? 'Cash' : `${name} (${row.symbol})`;
      return `${label}, ${sizedAmount(row.weight, input.bookAud)}`;
    });
    const labels = ranked.map((row) => (
      row.symbol === 'CASH'
        ? 'cash'
        : (names[row.symbol] ?? input.lines.find((line) => line.symbol === row.symbol)?.name ?? row.symbol)
    ));
    const cashRow = ranked.find((row) => row.symbol === 'CASH');
    const namesOnly = ranked.filter((row) => row.symbol !== 'CASH');
    const cashAud = cashRow && input.bookAud != null ? audMoney(cashRow.weight * input.bookAud) : null;
    const parts = bookParts({ weights: held, exposures: input.exposures });
    const invested = parts.invested;
    const investedAud = input.bookAud != null ? audMoney(invested * input.bookAud) : null;
    const atCap = input.exposures != null
      && invested <= input.exposures.maxGross + 0.005
      && invested >= input.exposures.maxGross - 0.005;
    return {
      sentence: cashAud && investedAud
        ? `${cashAud} in cash (${cashRow ? bookPercent(cashRow.weight) : ''}) and ${namesOnly.length} holdings worth ${investedAud} (${bookPercent(invested)}${atCap ? ', the most allowed today' : ''}).`
        : `The paper book holds ${joinAnd(labels)}.`,
      items,
      means: '',
    };
  }

  const items: string[] = [];
  if (input.exposures) {
    const exp = input.exposures;
    items.push(`Cash in the account: ${bookPercent(exp.cash)}.`);
    items.push(`Defensive holdings: ${bookPercent(exp.defensive)}.`);
    items.push(`Riskier holdings: ${bookPercent(exp.risk)}.`);
    items.push(`Everything except the cash balance adds up to ${bookPercent(exp.gross)}, against a limit of ${bookPercent(exp.maxGross)}.`);
  }
  const planned = input.lines.filter((line) => line.weight > 0);
  if (items.length === 0 && planned.length > 0) {
    return {
      sentence: 'There is no saved list of shares held. The sizes below are today’s plan, which can differ from what is already held.',
      items: planned.map((line) => `${line.name} (${line.symbol}), ${bookPercent(line.weight)}`),
      means: 'A plan is not the same thing as shares already in the book.',
    };
  }
  return {
    sentence: items.length
      ? 'A name-by-name holding list is not available, so this is the split of the paper book.'
      : 'The paper book does not have a holding list yet.',
    items,
    means: 'Cash in the account is the Australian-dollar balance. Defensive and riskier shares are the other holdings.',
  };
}

export function performanceSinceStart(input: {
  capital: number;
  equity: number | null;
  currency: 'AUD' | null;
  valued: boolean;
  realisedText: string;
  drawdown: number | null;
  comparable: boolean;
}): { sentence: string; means: string } {
  if (input.currency !== 'AUD' || !input.valued || input.equity == null) {
    return {
      sentence: 'The paper book has no Australian-dollar result yet, so there is nothing to judge since it started.',
      means: 'A missing price or a missing Australian-dollar exchange rate leaves the result blank on purpose.',
    };
  }
  const delta = input.equity - input.capital;
  const direction = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
  const signed = `${delta > 0 ? '+' : ''}${((delta / input.capital) * 100).toFixed(2)}%`;
  const verb = direction === 'down' ? 'Down' : direction === 'flat' ? 'Flat' : 'Up';
  const amount = `${verb} ${audMoney(Math.abs(delta))} (${signed})`;
  const pace = input.realisedText === 'Not enough history yet'
    ? 'There are not enough marks yet for a yearly rate.'
    : `Yearly rate so far ${input.realisedText}.`;
  return {
    sentence: `${amount} from ${audMoney(input.capital)} put in. ${pace}`,
    means: '',
  };
}

/**
 * One honest line from the research file. Status words come from that file.
 * No return figure is copied in, so a target or a backtest number cannot leak into the summary.
 */
export interface ReplaySummary {
  start?: string | null;
  end?: string | null;
  cagr?: number | null;
  maxDrawdown?: number | null;
}

export function trustLine(input: {
  verdict: string | null;
  fullStrategy: string | null;
  h1: string | null;
  rules?: ReplaySummary | null;
  spy?: ReplaySummary | null;
  mix?: ReplaySummary | null;
}): string {
  const rules = input.rules;
  const spy = input.spy;
  if (rules?.cagr != null && rules.maxDrawdown != null && spy?.cagr != null && spy.maxDrawdown != null) {
    const window = rules.start && rules.end ? ` (${rules.start.slice(0, 7)}–${rules.end.slice(0, 7)})` : '';
    const mix = input.mix?.cagr != null && input.mix.maxDrawdown != null
      ? ` A 60/40 mix of the S&P 500 and cash made ${(input.mix.cagr * 100).toFixed(1)}% a year with a worst fall of ${(input.mix.maxDrawdown * 100).toFixed(1)}%.`
      : '';
    return `Not proven yet. In a 2-year replay${window} the rules made about ${(rules.cagr * 100).toFixed(1)}% a year with a worst fall of ${(rules.maxDrawdown * 100).toFixed(1)}%. The S&P 500 with the same deposits made ${(spy.cagr * 100).toFixed(1)}% a year with a worst fall of ${(spy.maxDrawdown * 100).toFixed(1)}%.${mix} Much steadier so far, but it earned less.`;
  }
  return 'Not proven yet. Sizes follow the written rules.';
}

export function researchPlain(input: { h1: string | null; h2: string | null }): string {
  const replay = [
    input.h1 ? `The 2-year replay marks the index-fund test ${input.h1.replaceAll('_', ' ')}.` : 'The 2-year replay is the result to read.',
    input.h2 ? `The sit-tight test is ${input.h2.replaceAll('_', ' ')}.` : '',
  ].filter(Boolean).join(' ');
  return `${replay} The older file is an earlier data-availability check (no returns calculated).`;
}

export function componentPlain(id: ComponentId, z: number | null): { title: string; means: string } {
  const copy = COMPONENT_PLAIN[id];
  const lean = z == null
    ? 'This piece is missing, so it is left out of today’s call.'
    : z > 0.15
      ? 'This piece is making conditions easier.'
      : z < -0.15
        ? 'This piece is making conditions tighter.'
        : 'This piece is about normal.';
  return { title: copy.title, means: `${lean} ${copy.about}` };
}

export function budgetMeans(kind: 'swing' | 'whole' | 'outside', value: number, tightened: boolean, usual?: number | null): string {
  const size = bookPercent(value);
  const lower = usual != null && value < usual - 1e-9;
  const tighter = tightened && lower ? ` Tighter than usual (normally ${bookPercent(usual as number)}).` : '';
  if (kind === 'swing') {
    return `Each new holding is sized so the book should move about ${size} a year. Calmer funds get bigger sizes.${tighter}`;
  }
  if (kind === 'whole') {
    return `Invested (everything except plain cash) can add up to ${size} of the book.${tighter}`;
  }
  return value === 0
    ? 'Nothing new is allowed outside cash and cash-like funds.'
    : `Non-cash (invested minus SHY, AAA.AX and BILL.AX) can add up to ${size} of the book.${tighter}`;
}

export function sydneyWhen(value: string | null): string {
  if (!value) return 'No date';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const formatted = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(Date.UTC(year, month - 1, day)));
    return formatted;
  }
  return sydneyClock(value);
}

function statusMeans(status: FeedStatus, error: string | null): string {
  if (status === 'blocked') {
    return error
      ? `Blocked. ${error}`
      : 'Blocked. This feed did not come through, so a blank is not a real number.';
  }
  if (status === 'stale') return 'Stale. This figure is older than the window the rules allow, so it is not used to justify a new buy.';
  return 'Fresh. This figure is inside the window the rules allow.';
}

function feedStatus(input: { error: string | null; stale: boolean; dated: boolean }): FeedStatus {
  if (input.error || !input.dated) return 'blocked';
  if (input.stale) return 'stale';
  return 'fresh';
}

function priceGap(gap: string): { symbol: string; error: string } | null {
  const match = /^([A-Za-z0-9.\-]+):\s+(.+)$/.exec(gap.trim());
  if (!match) return null;
  return { symbol: match[1], error: match[2] };
}

export function describeFeeds(input: {
  rows: FreshnessRow[];
  sources: { id: string; label: string; observationDate: string | null; fetchedAt: string | null; error: string | null; sourceName?: string | null }[];
  priceGaps: string[];
  names?: Record<string, string>;
  pricesFetchedAt: string | null;
}): FeedLine[] {
  const names = input.names ?? {};
  const sources = new Map(input.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const lines: FeedLine[] = [];

  for (const row of input.rows) {
    seen.add(row.id);
    const source = sources.get(row.id);
    const error = source?.error ?? null;
    const dated = Boolean(row.asOf || source?.observationDate);
    const status = feedStatus({ error, stale: row.stale, dated });
    const observed = row.asOf ?? source?.observationDate ?? null;
    const downloaded = source?.fetchedAt ? ` Downloaded ${sydneyWhen(source.fetchedAt)}.` : '';
    lines.push({
      id: row.id,
      name: names[row.id] ?? FEED_PLAIN[row.id] ?? (row.id.startsWith('CFTC-') ? 'Trader positioning report' : row.label),
      source: row.source,
      updated: `${sydneyWhen(observed)}.${downloaded}`.trim(),
      status,
      means: statusMeans(status, error),
      detail: row.label,
    });
  }

  for (const source of input.sources) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    const status = feedStatus({ error: source.error, stale: false, dated: Boolean(source.observationDate) });
    lines.push({
      id: source.id,
      name: names[source.id] ?? FEED_PLAIN[source.id] ?? source.label,
      source: source.sourceName ?? source.label,
      updated: sydneyWhen(source.observationDate ?? source.fetchedAt),
      status,
      means: statusMeans(status, source.error),
      detail: source.label,
    });
  }

  for (const gap of input.priceGaps) {
    const parsed = priceGap(gap);
    if (!parsed || seen.has(parsed.symbol)) continue;
    seen.add(parsed.symbol);
    lines.push({
      id: parsed.symbol,
      name: names[parsed.symbol] ?? FEED_PLAIN[parsed.symbol] ?? parsed.symbol,
      source: /yahoo/i.test(parsed.error) ? 'Yahoo Finance' : 'Price feed',
      updated: input.pricesFetchedAt ? `Last price download ${sydneyWhen(input.pricesFetchedAt)}.` : 'No successful price download.',
      status: 'blocked',
      means: statusMeans('blocked', parsed.error),
      detail: gap,
    });
  }

  return lines;
}

export function paperComparabilityNote(paper: {
  marks: number;
  latest: { reason?: string | null; basis?: string | null } | null;
}): string | null {
  const reason = paper.latest?.reason?.trim() ?? '';
  if (/not comparable/i.test(reason)) return reason;
  if (paper.latest && paper.latest.basis !== 'held-book' && paper.marks > 0) {
    return reason
      ? `The latest stored mark used suggested sizes, not the shares held, so it is not comparable with the book. ${reason}`
      : 'The latest stored mark used suggested sizes, not the shares held, so it is not comparable with the book.';
  }
  return null;
}

export function knownGapLines(input: {
  snapshotGaps: string[];
  priceGaps: string[];
  deskGaps: string[];
  paperNote: string | null;
}): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const gap of [...input.snapshotGaps, ...input.priceGaps, ...input.deskGaps]) {
    const text = gap.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
  }
  if (input.paperNote && !seen.has(input.paperNote)) lines.push(input.paperNote);
  return lines;
}

export function historyColumn(id: string): { label: string; technical: string } {
  const columns: Record<string, { label: string; technical: string }> = {
    date: { label: 'Week', technical: 'Print date' },
    regime: { label: 'Market call', technical: 'Regime' },
    composite: { label: 'Overall score', technical: 'Composite' },
    liquidity: { label: 'Money in the system', technical: 'Liquidity' },
    policy: { label: 'Interest rates', technical: 'Policy' },
    credit: { label: 'Lender nerves', technical: 'Credit' },
    growth: { label: 'Growth', technical: 'Growth' },
    positioning: { label: 'Crowded bets', technical: 'Positioning' },
    ai: { label: 'AI spending', technical: 'AI' },
  };
  return columns[id] ?? { label: id, technical: id };
}

export function ageInWords(ageDays: number | null): string {
  if (ageDays == null) return 'Age unknown';
  if (ageDays === 0) return 'From today';
  if (ageDays === 1) return '1 day old';
  return `${ageDays} days old`;
}

export function whyLine(components: { id: string; title: string; z: number | null; weight: number }[]): string {
  const live = components.filter((item) => item.z != null && Number.isFinite(item.z));
  if (live.length === 0) return 'The score has no pieces today.';
  const ranked = live.slice().sort((a, b) => Math.abs((b.z as number) * b.weight) - Math.abs((a.z as number) * a.weight));
  const drag = ranked.find((item) => (item.z as number) < 0);
  const help = ranked.find((item) => (item.z as number) > 0);
  const bit = (item: { title: string; z: number | null } | undefined, role: string) => {
    if (!item || item.z == null) return null;
    return `${item.title} ${role} (${item.z > 0 ? '+' : ''}${item.z.toFixed(2)})`;
  };
  const parts = [bit(drag, 'is the biggest drag'), bit(help, 'is the biggest help')].filter((item): item is string => Boolean(item));
  return parts.length ? `${parts.join('; ')}.` : 'The pieces are close to normal.';
}

export function distanceToBuy(input: { composite: number | null; liquidity: number | null }): string {
  const score = input.composite == null ? 'unknown' : `${input.composite > 0 ? '+' : ''}${input.composite.toFixed(2)}`;
  const liq = input.liquidity == null ? 'unknown' : `${input.liquidity > 0 ? '+' : ''}${input.liquidity.toFixed(2)}`;
  const gap = input.composite == null ? '' : ` It needs +${Math.max(0, THRESHOLDS.riskOnEnter - input.composite).toFixed(2)} more.`;
  return `Buying restarts at +${THRESHOLDS.riskOnEnter.toFixed(2)} (today ${score}).${gap} Money in the system must be +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)} or more (today ${liq}). A fall to ${THRESHOLDS.tightEnter.toFixed(2)} would switch the mood to Cautious.`;
}

export function plainReading(id: ComponentId, reading: string): string {
  if (id === 'liquidity') {
    const match = reading.match(/(-?\$[\d.]+bn)/);
    if (match) {
      const down = match[1].startsWith('-') || reading.includes('−');
      return `US money in the system ${down ? 'fell' : 'rose'} ${match[1].replace('-', '')} over 13 weeks`;
    }
  }
  if (id === 'policy') {
    const match = reading.match(/(-?[\d.]+)\s*pp/);
    if (match) return `The 2-year rate is ${match[1].replace('-', '')} points ${Number(match[1]) < 0 ? 'below' : 'above'} the Fed rate`;
  }
  if (id === 'credit') {
    const match = reading.match(/([\d.]+)%/);
    if (match) return `Risky-bond extra yield: ${match[1]}%`;
  }
  if (id === 'growth') return reading
    .replace('Curve', 'Long rates')
    .replace('pp', 'points')
    .replace('US−AU CLI', 'US growth outlook versus Australia');
  if (id === 'positioning') return 'Speculators lean against the crowd in the futures markets';
  if (id === 'ai') return 'Chip shares, market breadth, and factory output, blended into the AI spending score';
  return reading;
}

export const GLOSSARY: { term: string; means: string }[] = [
  { term: 'Market score', means: 'One number for how easy (+) or hard (−) conditions are. 0 is normal, ±1 is noticeably unusual, ±2 is rare.' },
  { term: 'Supportive', means: 'Score of +0.65 or more, with money flowing. Buys are allowed.' },
  { term: 'Mixed', means: 'Between Cautious and Supportive. Hold, and buy nothing new.' },
  { term: 'Cautious', means: 'Score of −0.75 or lower. Defensive holdings only.' },
  { term: 'Stressed', means: 'Score of −1.75 or lower. Mostly cash.' },
  { term: 'No clear signal', means: 'Score between −0.35 and +0.35. Too close to normal to act on.' },
  { term: 'Invested', means: 'Everything except plain cash. Cash-like funds still count.' },
  { term: 'Non-cash', means: 'Invested minus the cash-like funds SHY, AAA.AX and BILL.AX.' },
  { term: '200-day average', means: 'The average price over about 10 months. Above it means an uptrend.' },
  { term: 'Past-year trend', means: 'Price 1 month ago versus 12 months ago. The latest month is skipped.' },
  { term: 'Sudden spike', means: 'The last 5 days moved unusually far, so wait.' },
  { term: 'Sell-stop', means: 'The automatic sell price, 2.5 typical daily moves below the buy price.' },
  { term: 'Top-up', means: 'One extra buy, allowed only after the holding gains as much as it was risking.' },
  { term: 'Loss limit', means: 'New buys pause if the book falls 10% from its high.' },
  { term: 'Theme', means: 'A story basket (AI build-out, Crypto, Scarcity) with a written on/off rule.' },
  { term: 'Buy', means: 'All checks passed and there is room.' },
  { term: 'Hold', means: 'You own it. Keep it.' },
  { term: 'Watch', means: 'Not owned, and something is in the way.' },
  { term: 'Avoid', means: 'This group is not bought in today’s mood.' },
  { term: 'Fresh / Stale / Missing', means: 'Whether a figure is new enough to act on.' },
];
