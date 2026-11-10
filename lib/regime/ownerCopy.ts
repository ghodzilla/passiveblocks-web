import type { ComponentId, RegimeId } from './constants';
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
    return { title: 'Supportive', means: 'Conditions look easier than usual, so new buys can be considered.' };
  }
  if (regime === 'tightening') {
    return { title: 'Cautious', means: 'Conditions look tighter than usual, so the plan favours defence and cash.' };
  }
  if (regime === 'crisis') {
    return { title: 'Stressed', means: 'Conditions look dangerous, so the plan favours cash and cuts risky bets.' };
  }
  if (regime === 'transitional') {
    return { title: 'Mixed', means: 'Conditions are neither clearly easy nor clearly tight, so the plan is to wait.' };
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

export function todayAction(input: {
  actionable: boolean;
  action: OwnerAction;
  halted: boolean;
  lines: OwnerLine[];
  bookAud: number | null;
  pending?: { symbol: string; reason: string }[];
}): { headline: string; steps: string[]; means: string } {
  const sized = input.lines.filter((line) => line.weight > 0).slice().sort((a, b) => b.weight - a.weight);
  const cash = sized.filter(cashLike);
  const rest = sized.filter((line) => !cashLike(line));
  const steps: string[] = [];
  const open = input.actionable && input.action === 'risk_budget_open' && !input.halted;

  const cashWeight = cash.reduce((sum, line) => sum + line.weight, 0);
  if (cashWeight > 0) {
    steps.push(`Hold cash and short-term government bonds, ${sizedAmount(cashWeight, input.bookAud)}.`);
  }
  for (const line of rest) {
    const amount = sizedAmount(line.weight, input.bookAud);
    const verb = !open
      ? 'Hold'
      : line.pyramid === 'add'
        ? 'Buy more'
        : line.pyramid === 'hold' || line.pyramid === 'no-add-loser'
          ? 'Hold'
          : 'Buy';
    const joiner = verb === 'Hold' || input.bookAud == null ? ',' : ' for';
    steps.push(`${verb} ${line.name} (${line.symbol})${joiner} ${amount}.`);
  }
  for (const item of input.pending ?? []) {
    const name = input.lines.find((line) => line.symbol === item.symbol)?.name ?? item.symbol;
    steps.push(`A change for ${name} (${item.symbol}) is waiting: ${item.reason}`);
  }

  let headline = 'Hold. Do not buy anything new today.';
  if (input.halted) {
    headline = 'Hold. The paper book is far enough below its high that new buys stay off until it recovers.';
  } else if (!input.actionable) {
    headline = 'Hold. Do not buy anything new until the data is current.';
  } else if (input.action === 'reduce_risk') {
    headline = 'Do not buy. Hold the defensive assets and cash already in the plan.';
  } else if (open && rest.some((line) => line.pyramid !== 'hold' && line.pyramid !== 'no-add-loser')) {
    headline = 'New buys are allowed today, inside the size limits.';
  } else if (input.action === 'do_nothing') {
    headline = 'Hold. Do not buy anything new today.';
  }

  const means = input.bookAud == null
    ? 'Percentages are shares of the paper book. Dollar amounts are left blank because this book has no Australian-dollar value.'
    : 'Dollar amounts are that percentage times the Australian-dollar paper book. A suggested size of 0% is not an instruction to sell.';

  if (steps.length === 0) steps.push('Nothing is sized today. Cash is the position.');
  return { headline, steps, means };
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
    return {
      sentence: `The paper book holds ${joinAnd(labels)}.`,
      items,
      means: 'This list is the shares recorded in the Australian-dollar paper book.',
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
  const pace = input.realisedText === 'Not enough history yet'
    ? 'There is not enough history yet to turn that into a yearly pace.'
    : `The yearly pace so far is ${input.realisedText}.`;
  const dip = input.drawdown != null && input.drawdown > 0
    ? ` It is ${bookPercent(input.drawdown)} below its highest value.`
    : '';
  const compare = input.comparable
    ? ''
    : ' Stored marks that are labelled not comparable are not used as this result.';
  const from = direction === 'flat'
    ? `worth ${audMoney(input.equity)}, the same as the ${audMoney(input.capital)} put in`
    : `${direction}, at ${audMoney(input.equity)} from ${audMoney(input.capital)} put in`;
  return {
    sentence: `Since it started, the paper book is ${from}. ${pace}${dip}${compare}`,
    means: 'Yearly pace compounds the saved paper values. It is the result so far, not a forecast and not a target.',
  };
}

/**
 * One honest line from the research file. Status words come from that file.
 * No return figure is copied in, so a target or a backtest number cannot leak into the summary.
 */
export function trustLine(input: {
  verdict: string | null;
  fullStrategy: string | null;
  h1: string | null;
}): string {
  const h1 = (input.h1 ?? '').trim().toLowerCase();
  const verdict = (input.verdict ?? '').trim().toLowerCase();
  const strategy = (input.fullStrategy ?? '').trim().toLowerCase();
  if (h1 === 'unsupported' || h1 === 'fail' || h1 === 'failed') {
    return 'These rules have not yet beaten a simple index fund on the tested history. Treat sizes as a starting point.';
  }
  if (h1 === 'supported' || h1 === 'pass' || h1 === 'passed') {
    return 'On the tested history these rules beat a simple index fund on the written test. That test is not a forecast. Treat sizes as a starting point.';
  }
  if (verdict === 'inconclusive' || strategy.includes('not_validated') || h1 === 'not_tested' || h1 === '') {
    return 'These rules have not been shown to beat a simple index fund. The research verdict is still open. Treat sizes as a starting point.';
  }
  const status = (input.h1 ?? input.verdict ?? 'unsettled').replaceAll('_', ' ');
  return `The research file marks this comparison as ${status}. Treat sizes as a starting point.`;
}

export function researchPlain(input: { h1: string | null; h2: string | null }): string {
  const test = (id: string, status: string | null, question: string) => {
    if (!status) return `${id} was not in the research file.`;
    return `${id} is marked ${status.replaceAll('_', ' ')}. ${question}`;
  };
  return [
    test('Test 1', input.h1, 'It asks whether these rules beat a simple index fund after costs.'),
    test('Test 2', input.h2, 'It asks whether dropping the sit-tight rule changes how often money is invested.'),
  ].join(' ');
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

export function budgetMeans(kind: 'swing' | 'whole' | 'outside', value: number, tightened: boolean): string {
  const size = bookPercent(value);
  if (kind === 'swing') {
    return `The rules try to keep the book’s yearly up-and-down near ${size}. ${tightened ? 'That limit is tighter than usual today.' : 'This is a risk limit, not a return target.'}`;
  }
  if (kind === 'whole') {
    return `All holdings except the cash sitting in the account can add up to ${size} of the book.`;
  }
  return value === 0
    ? 'Nothing new is allowed outside cash and short-term government bonds.'
    : `Holdings that are not cash or short-term government bonds can add up to ${size} of the book.`;
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
    return `${formatted} (the day this figure describes)`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  return `${formatted} Sydney time`;
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
      name: names[row.id] ?? FEED_PLAIN[row.id] ?? row.label,
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
