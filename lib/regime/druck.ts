import { STALE_AFTER_DAYS } from './constants';
import { FX_SYMBOL, markInAud, type FxBar } from './fx';
import {
  DRUCK_ADD_GAIN,
  DRUCK_ADD_RUNGS,
  DRUCK_BOOK_BRAKE,
  DRUCK_BOOK_ID,
  DRUCK_CANDIDATES,
  DRUCK_CAPS,
  DRUCK_CASH_SYMBOL,
  DRUCK_COST,
  DRUCK_LIQUIDITY_MIN,
  DRUCK_MAX_POSITIONS,
  DRUCK_NAME_MAX,
  DRUCK_RULE,
  DRUCK_SPY,
  DRUCK_START_AUD,
  DRUCK_STARTER_MAX,
  DRUCK_STOP_COST,
  DRUCK_STOP_MA,
  DRUCK_THEME_MAX,
  DRUCK_TRIM_MA,
  type DruckCandidate,
} from './druck.config';
import {
  ageDays,
  alignToCalendar,
  businessDaysEnding,
  closeOnOrAfter,
  closeOnOrBefore,
  decisionSession,
  idleInterest,
  newYorkClock,
  nextSession,
  plainDate,
  rollingMean,
  type CloseBar,
} from './visser';

/**
 * Long-only Druckenmiller paper book. No leverage, no shorts.
 * A week is decided after the Friday close in the US (Saturday morning in Sydney)
 * and filled at the next close. A missing price keeps the last week.
 */

export const DRUCK_CALLS = ['Buy', 'Add', 'Hold', 'Trim', 'Sell', 'Wait'] as const;
export type DruckCall = (typeof DRUCK_CALLS)[number];
export type DruckColour = 'green' | 'amber' | 'red';
export type DruckOutcome = 'saved' | 'filled' | 'feed_failed' | 'waiting' | 'unchanged';

export type DruckTag =
  | 'buy'
  | 'add'
  | 'hold'
  | 'trim-extension'
  | 'trim-cap'
  | 'sell-cost'
  | 'sell-trend'
  | 'sell-list'
  | 'wait-trend'
  | 'wait-size'
  | 'wait-cap'
  | 'wait-slots'
  | 'wait';

export interface DruckCheck {
  id: 'liquidity' | 'credit' | 'trend';
  label: string;
  pass: boolean;
  detail: string;
}

export interface DruckPosition {
  id: string;
  symbol: string;
  qty: number;
  avgCostAud: number;
}

export interface DruckTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  notionalAud: number;
  priceAud: number;
  date: string;
}

export interface DruckNameState {
  id: string;
  symbol: string;
  name: string;
  theme: string;
  themeLabel: string;
  role: DruckCandidate['role'];
  currency: 'AUD' | 'USD';
  active: boolean;
  openWeight: number;
  addWeight: number;
  thesis: string;
  sellIf: string;
  also: string | null;
  priceLocal: number;
  priceAud: number;
  ma200: number;
  above200: boolean;
  premium: number;
  vsCost: number | null;
  targetWeight: number;
  heldWeight: number;
  targetAud: number;
  heldAud: number;
  tag: DruckTag;
  call: DruckCall;
  note: string | null;
}

export interface DruckReadState {
  liquidity: number;
  spreadNow: number;
  spreadThen: number;
  spyPrice: number;
  spyMa200: number;
  checks: DruckCheck[];
}

export interface DruckSnapshot {
  ruleVersion: typeof DRUCK_RULE;
  bookId: typeof DRUCK_BOOK_ID;
  decisionDate: string;
  actionDate: string | null;
  filledOn: string | null;
  phase: 'pending' | 'filled';
  colour: DruckColour;
  cap: number;
  brakeOn: boolean;
  peakAud: number;
  equityAud: number;
  cashAud: number;
  cashInterestAud: number;
  investedAud: number;
  targetCashAud: number;
  costAud: number;
  nav: number;
  prevEndAud: number | null;
  fxRate: number | null;
  fxDate: string | null;
  aaaPrice: number | null;
  names: DruckNameState[];
  positions: DruckPosition[];
  trades: DruckTrade[];
  read: DruckReadState;
  skippedFill: string | null;
  fetchedAt: string;
  signalAsOf: string;
}

export interface DruckMarket {
  now: Date;
  prices: Record<string, CloseBar[]>;
  liquidity: number | null;
  liquidityAsOf: string | null;
  spreadNow: number | null;
  spreadThen: number | null;
  spreadAsOf: string | null;
  errors: string[];
}

export interface DruckStep {
  outcome: DruckOutcome;
  banner: string | null;
  errors: string[];
  snapshot: DruckSnapshot | null;
  /** Pending decision to insert once. Null when this step does not open a new week. */
  week: DruckSnapshot | null;
}

export interface PlanMark {
  id: string;
  heldAud: number;
  avgCostAud: number | null;
  priceAud: number | null;
  above200: boolean | null;
  premium: number | null;
}

export interface PlanRow {
  id: string;
  weight: number;
  heldWeight: number;
  heldAud: number;
  tag: DruckTag;
}

interface Signal {
  price: number;
  ma200: number;
  premium: number;
  above200: boolean;
}

const SELL_TAGS = new Set<DruckTag>(['sell-cost', 'sell-trend', 'sell-list']);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundW(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function roundNav(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function failureBanner(errors: string[], previous: DruckSnapshot | null): string {
  const why = errors[0] ?? 'A required price did not arrive.';
  if (previous) {
    return `${why} Showing the saved week of ${plainDate(previous.decisionDate)}. No new buys. Nothing is sold just because a feed is down.`;
  }
  return `${why} No week is saved, so nothing is bought.`;
}

function fail(errors: string[], previous: DruckSnapshot | null): DruckStep {
  return {
    outcome: 'feed_failed',
    banner: failureBanner(errors, previous),
    errors,
    snapshot: previous,
    week: null,
  };
}

export function threeMonthsBefore(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 3);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

export function lastOnOrBefore(points: readonly { date: string; value: number }[], date: string): { date: string; value: number } | null {
  let found: { date: string; value: number } | null = null;
  for (const point of points) {
    if (point.date <= date && Number.isFinite(point.value)) found = { date: point.date, value: point.value };
  }
  return found;
}

/** Latest high-yield spread and the print on or just before three months earlier. */
export function spreadPair(
  points: readonly { date: string; value: number }[],
  decision: string,
): { now: number; then: number; asOf: string } | { error: string } {
  const now = lastOnOrBefore(points, decision);
  if (!now) return { error: 'The high-yield spread did not arrive. No new buys.' };
  if (ageDays(now.date, decision) > STALE_AFTER_DAYS.daily) {
    return { error: `The high-yield spread last printed on ${plainDate(now.date)}, which is too old to use.` };
  }
  const thenDate = threeMonthsBefore(decision);
  const then = lastOnOrBefore(points, thenDate);
  if (!then) return { error: 'The high-yield spread from three months ago did not arrive. No new buys.' };
  if (ageDays(then.date, thenDate) > STALE_AFTER_DAYS.daily) {
    return { error: 'The high-yield spread has a gap around three months ago. No new buys.' };
  }
  return { now: now.value, then: then.value, asOf: now.date };
}

function signedScore(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

export function classifyRead(input: {
  liquidity: number | null;
  spreadNow: number | null;
  spreadThen: number | null;
  spyAbove200: boolean | null;
}): { ok: true; colour: DruckColour; cap: number; checks: DruckCheck[] } | { ok: false; error: string } {
  if (input.liquidity == null || !Number.isFinite(input.liquidity)) {
    return { ok: false, error: 'The liquidity score is missing. No new buys.' };
  }
  if (input.spreadNow == null || !Number.isFinite(input.spreadNow) || input.spreadThen == null || !Number.isFinite(input.spreadThen)) {
    return { ok: false, error: 'The high-yield spread is missing. No new buys.' };
  }
  if (input.spyAbove200 == null) return { ok: false, error: 'The S&P 500 average is not ready. No new buys.' };
  const liquidityPass = input.liquidity >= DRUCK_LIQUIDITY_MIN - 1e-12;
  const creditPass = input.spreadNow <= input.spreadThen + 1e-9;
  const checks: DruckCheck[] = [
    {
      id: 'liquidity',
      label: 'Liquidity',
      pass: liquidityPass,
      detail: liquidityPass
        ? `Liquidity score ${signedScore(input.liquidity)} is at least +0.10.`
        : `Liquidity score ${signedScore(input.liquidity)} is under +0.10.`,
    },
    {
      id: 'credit',
      label: 'Credit spreads',
      pass: creditPass,
      detail: creditPass
        ? `High-yield spreads are ${input.spreadNow.toFixed(2)}%, not wider than ${input.spreadThen.toFixed(2)}% three months ago.`
        : `High-yield spreads are ${input.spreadNow.toFixed(2)}%, wider than ${input.spreadThen.toFixed(2)}% three months ago.`,
    },
    {
      id: 'trend',
      label: 'S&P 500 trend',
      pass: input.spyAbove200,
      detail: input.spyAbove200
        ? 'The S&P 500 is above its 200-day average.'
        : 'The S&P 500 is below its 200-day average.',
    },
  ];
  const fails = checks.filter((check) => !check.pass).length;
  const colour: DruckColour = fails === 0 ? 'green' : fails >= 2 ? 'red' : 'amber';
  return { ok: true, colour, cap: DRUCK_CAPS[colour], checks };
}

export function nextBrake(input: {
  brake: boolean;
  peak: number;
  equity: number;
  colour: DruckColour;
}): { brake: boolean; peak: number; cap: number } {
  const peak = Math.max(input.peak, input.equity);
  let brake = input.brake;
  if (input.colour === 'green') brake = false;
  else if (peak > 0 && round2(input.equity) <= round2(peak * (1 - DRUCK_BOOK_BRAKE))) brake = true;
  return { brake, peak: round2(peak), cap: brake ? DRUCK_CAPS.red : DRUCK_CAPS[input.colour] };
}

/** A percent from a price ratio, stable at exact lines such as 15% and 20%. */
function pct(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

export function nextRung(current: number, addWeight: number): number {
  const ceiling = Math.min(addWeight, DRUCK_NAME_MAX);
  if (!(ceiling > current + 1e-6)) return current;
  for (const rung of DRUCK_ADD_RUNGS) {
    if (rung > current + 1e-6) return Math.min(rung, ceiling);
  }
  return ceiling;
}

export function callFrom(heldWeight: number, targetWeight: number): DruckCall {
  const band = 0.005;
  if (targetWeight <= band && heldWeight <= band) return 'Wait';
  if (targetWeight <= band) return 'Sell';
  if (heldWeight <= band) return 'Buy';
  if (targetWeight < heldWeight - band) return 'Trim';
  if (targetWeight > heldWeight + band) return 'Add';
  return 'Hold';
}

function themeSum(rows: ReadonlyMap<string, { weight: number }>, candidates: readonly DruckCandidate[], theme: string): number {
  let sum = 0;
  for (const candidate of candidates) {
    if (candidate.theme === theme) sum += rows.get(candidate.id)?.weight ?? 0;
  }
  return sum;
}

function sumWeights(rows: ReadonlyMap<string, { weight: number }>): number {
  let sum = 0;
  rows.forEach((row) => {
    sum += row.weight;
  });
  return sum;
}

/** Weights for one week. Long only. Never increases a name that is below its cost. */
export function planBook(input: {
  candidates: readonly DruckCandidate[];
  marks: readonly PlanMark[];
  equity: number;
  cap: number;
}): PlanRow[] {
  const markOf = new Map(input.marks.map((mark) => [mark.id, mark]));
  const rows = new Map<string, { weight: number; heldWeight: number; heldAud: number; tag: DruckTag }>();
  const equity = input.equity;
  const band = Math.max(1, equity * 0.005);
  for (const candidate of input.candidates) {
    const mark = markOf.get(candidate.id);
    const heldAud = mark?.heldAud ?? 0;
    const heldWeight = equity > 0 ? roundW(heldAud / equity) : 0;
    const live = heldAud > band;
    let weight = live ? heldWeight : 0;
    let tag: DruckTag = live ? 'hold' : 'wait';
    if (!candidate.active && live) {
      weight = 0;
      tag = 'sell-list';
    } else if (live && mark) {
      const vsCost = mark.avgCostAud && mark.avgCostAud > 0 && mark.priceAud && mark.priceAud > 0
        ? pct(mark.priceAud / mark.avgCostAud - 1)
        : null;
      if (vsCost != null && vsCost <= -DRUCK_STOP_COST) {
        weight = 0;
        tag = 'sell-cost';
      } else if (mark.premium != null && pct(mark.premium) < -DRUCK_STOP_MA) {
        weight = 0;
        tag = 'sell-trend';
      } else if (mark.premium != null && pct(mark.premium) > DRUCK_TRIM_MA) {
        weight = roundW(heldWeight / 2);
        tag = 'trim-extension';
      }
    }
    rows.set(candidate.id, { weight, heldWeight, heldAud: live ? heldAud : 0, tag });
  }

  const scale = (ids: readonly string[], factor: number) => {
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      const before = row.weight;
      row.weight = roundW(before * factor);
      if (row.weight < before - 1e-6 && row.tag === 'hold') row.tag = 'trim-cap';
    }
  };
  for (const candidate of input.candidates) {
    const row = rows.get(candidate.id);
    if (row && row.weight > DRUCK_NAME_MAX) {
      row.weight = DRUCK_NAME_MAX;
      if (row.tag === 'hold') row.tag = 'trim-cap';
    }
  }
  const themes: string[] = [];
  for (const candidate of input.candidates) {
    if (!themes.includes(candidate.theme)) themes.push(candidate.theme);
  }
  for (const theme of themes) {
    const members = input.candidates.filter((candidate) => candidate.theme === theme).map((candidate) => candidate.id);
    const total = members.reduce((sum, id) => sum + (rows.get(id)?.weight ?? 0), 0);
    if (total > DRUCK_THEME_MAX + 1e-9) scale(members, DRUCK_THEME_MAX / total);
  }
  const invested = sumWeights(rows);
  if (invested > input.cap + 1e-9) scale(input.candidates.map((candidate) => candidate.id), input.cap / invested);

  let used = sumWeights(rows);
  for (const candidate of input.candidates) {
    const row = rows.get(candidate.id);
    const mark = markOf.get(candidate.id);
    if (!row || row.tag !== 'hold' || !mark?.avgCostAud || !mark.priceAud) continue;
    const vsCost = pct(mark.priceAud / mark.avgCostAud - 1);
    if (!(vsCost >= DRUCK_ADD_GAIN && mark.above200 === true && mark.priceAud + 1e-9 >= mark.avgCostAud)) continue;
    const current = row.weight;
    const rung = nextRung(current, candidate.addWeight);
    const extra = Math.min(rung - current, DRUCK_THEME_MAX - themeSum(rows, input.candidates, candidate.theme), input.cap - used, DRUCK_NAME_MAX - current);
    if (!(extra > 0.0005)) continue;
    row.weight = roundW(current + extra);
    row.tag = 'add';
    used = roundW(used + extra);
  }

  const ordered = input.candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      if (a.candidate.role !== b.candidate.role) return a.candidate.role === 'core' ? -1 : 1;
      return a.index - b.index;
    })
    .map((row) => row.candidate);
  let open = 0;
  rows.forEach((row) => {
    if (row.weight > 0.0005) open += 1;
  });
  let slots = DRUCK_MAX_POSITIONS - open;
  for (const candidate of ordered) {
    const row = rows.get(candidate.id);
    if (!row || row.weight > 0.0005 || SELL_TAGS.has(row.tag)) continue;
    const mark = markOf.get(candidate.id);
    if (mark?.above200 !== true) {
      row.tag = 'wait-trend';
      continue;
    }
    if (!candidate.active || !(candidate.openWeight > 0)) {
      row.tag = 'wait-size';
      continue;
    }
    if (slots <= 0) {
      row.tag = 'wait-slots';
      continue;
    }
    const room = Math.min(input.cap - used, DRUCK_THEME_MAX - themeSum(rows, input.candidates, candidate.theme), DRUCK_STARTER_MAX, candidate.openWeight);
    if (!(room > 0.0005)) {
      row.tag = 'wait-cap';
      continue;
    }
    row.weight = roundW(room);
    row.tag = 'buy';
    used = roundW(used + room);
    slots -= 1;
  }

  return input.candidates.map((candidate) => {
    const row = rows.get(candidate.id)!;
    const weight = row.weight < 0 ? 0 : row.weight;
    return { id: candidate.id, weight, heldWeight: row.heldWeight, heldAud: row.heldAud, tag: row.tag };
  });
}

function lastDate(bars: readonly CloseBar[]): string | null {
  let last: string | null = null;
  for (const bar of bars) {
    if (bar.close > 0 && bar.date && (last == null || bar.date > last)) last = bar.date;
  }
  return last;
}

function signalAt(values: readonly (number | null)[], index: number): Signal | null {
  const price = index >= 0 && index < values.length ? values[index] : null;
  const ma200 = rollingMean(values, index, 200);
  if (price == null || ma200 == null || !(price > 0) || !(ma200 > 0)) return null;
  return { price, ma200, premium: pct(price / ma200 - 1), above200: price > ma200 };
}

function audOf(symbol: string, local: number, fx: readonly CloseBar[], date: string): { aud: number; rate: number | null; fxDate: string | null } | null {
  const marked = markInAud({ symbol, local, priceDate: date, fxBars: fx as FxBar[] });
  if (!marked) return null;
  return { aud: marked.aud, rate: marked.rate, fxDate: marked.fxDate };
}

function candidateList(positions: readonly DruckPosition[]): DruckCandidate[] {
  const list = [...DRUCK_CANDIDATES];
  for (const position of positions) {
    if (list.some((candidate) => candidate.id === position.id)) continue;
    list.push({
      id: position.id,
      symbol: position.symbol,
      name: position.symbol,
      theme: 'removed',
      themeLabel: 'Removed',
      role: 'watch',
      openWeight: 0,
      addWeight: 0,
      active: false,
      thesis: 'Taken off the candidate list.',
      sellIf: 'Sell. It is no longer on the list.',
      also: null,
    });
  }
  return list;
}

function seriesProblems(market: DruckMarket, symbols: readonly string[], decision: string, nyDate: string): string[] {
  const problems: string[] = [];
  for (const symbol of symbols) {
    const bars = market.prices[symbol] ?? [];
    const last = lastDate(bars);
    if (!last) problems.push(`${symbol} did not arrive.`);
    else if (ageDays(last, nyDate) > 7) problems.push(`${symbol} last closed on ${plainDate(last)}, which is too old to use.`);
    else if (symbol !== DRUCK_CASH_SYMBOL && ageDays(last, decision) > 5) problems.push(`${symbol} has no close near ${plainDate(decision)}.`);
  }
  if (market.liquidity == null || !Number.isFinite(market.liquidity)) problems.push('The liquidity score is missing. No new buys.');
  else if (market.liquidityAsOf == null || ageDays(market.liquidityAsOf, decision) > STALE_AFTER_DAYS.daily) {
    problems.push(market.liquidityAsOf
      ? `The liquidity score is from ${plainDate(market.liquidityAsOf)}, which is too old to use.`
      : 'The liquidity score has no date. No new buys.');
  }
  if (market.spreadNow == null || !Number.isFinite(market.spreadNow) || market.spreadThen == null || !Number.isFinite(market.spreadThen)) {
    problems.push('The high-yield spread is missing. No new buys.');
  } else if (market.spreadAsOf == null || ageDays(market.spreadAsOf, decision) > STALE_AFTER_DAYS.daily) {
    problems.push(market.spreadAsOf
      ? `The high-yield spread last printed on ${plainDate(market.spreadAsOf)}, which is too old to use.`
      : 'The high-yield spread has no date. No new buys.');
  }
  return problems;
}

function unique(values: readonly string[]): string[] {
  const seen: string[] = [];
  for (const value of values) {
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

function neededSymbols(positions: readonly DruckPosition[]): string[] {
  const symbols = [DRUCK_SPY, DRUCK_CASH_SYMBOL, ...DRUCK_CANDIDATES.map((candidate) => candidate.symbol), ...positions.map((position) => position.symbol)];
  return unique(symbols);
}

export function closesFor(dates: readonly string[], last: number, premium: number): CloseBar[] {
  if (dates.length < 200) throw new Error('Need 200 closes');
  const ma = last / (1 + premium);
  const flat = (ma * 200 - last) / 199;
  if (!(flat > 0) || !(last > 0)) throw new Error('Close is not positive');
  return dates.map((date, index) => ({ date, close: index === dates.length - 1 ? last : flat }));
}

function buildNames(input: {
  candidates: readonly DruckCandidate[];
  plan: readonly PlanRow[];
  signals: ReadonlyMap<string, Signal>;
  aud: ReadonlyMap<string, number>;
  vsCost: ReadonlyMap<string, number | null>;
  equity: number;
}): DruckNameState[] {
  const planOf = new Map(input.plan.map((row) => [row.id, row]));
  return input.candidates.map((candidate) => {
    const signal = input.signals.get(candidate.id)!;
    const row = planOf.get(candidate.id)!;
    const priceAud = input.aud.get(candidate.id)!;
    const heldAud = round2(row.heldAud);
    const targetAud = round2(row.weight * input.equity);
    const currency = candidate.symbol.endsWith('.AX') ? 'AUD' as const : 'USD' as const;
    return {
      id: candidate.id,
      symbol: candidate.symbol,
      name: candidate.name,
      theme: candidate.theme,
      themeLabel: candidate.themeLabel,
      role: candidate.role,
      currency,
      active: candidate.active,
      openWeight: candidate.openWeight,
      addWeight: candidate.addWeight,
      thesis: candidate.thesis,
      sellIf: candidate.sellIf,
      also: candidate.also,
      priceLocal: signal.price,
      priceAud,
      ma200: signal.ma200,
      above200: signal.above200,
      premium: signal.premium,
      vsCost: input.vsCost.get(candidate.id) ?? null,
      targetWeight: row.weight,
      heldWeight: row.heldWeight,
      targetAud,
      heldAud,
      tag: row.tag,
      call: callFrom(row.heldWeight, row.weight),
      note: null,
    };
  });
}

function tryFill(pending: DruckSnapshot, market: DruckMarket): { ok: true; snapshot: DruckSnapshot } | { ok: false } {
  const actionDate = pending.actionDate;
  if (!actionDate) return { ok: false };
  const fx = market.prices[FX_SYMBOL] ?? [];
  const quotes = new Map<string, { date: string; aud: number }>();
  const needed: string[] = [];
  const want = (symbol: string) => {
    if (!needed.includes(symbol)) needed.push(symbol);
  };
  for (const name of pending.names) {
    if (name.targetWeight > 0.0005 || name.heldAud > 1) want(name.symbol);
  }
  for (const position of pending.positions) {
    if (position.qty > 0) want(position.symbol);
  }
  for (const symbol of needed) {
    const bar = closeOnOrAfter(market.prices[symbol] ?? [], actionDate);
    if (!bar) return { ok: false };
    const aud = audOf(symbol, bar.close, fx, bar.date);
    if (!aud) return { ok: false };
    quotes.set(symbol, { date: bar.date, aud: aud.aud });
  }
  let cash = pending.cashAud;
  const qty = new Map(pending.positions.map((position) => [position.id, position.qty]));
  const avg = new Map(pending.positions.map((position) => [position.id, position.avgCostAud]));
  let marked = cash;
  for (const position of pending.positions) {
    if (!(position.qty > 0)) continue;
    const quote = quotes.get(position.symbol);
    if (!quote) return { ok: false };
    marked += position.qty * quote.aud;
  }
  const equity = marked;
  const desired = new Map<string, number>();
  const notes = new Map<string, string>();
  for (const name of pending.names) {
    const prev = qty.get(name.id) ?? 0;
    if (name.targetWeight <= 0.0005) {
      desired.set(name.id, 0);
      continue;
    }
    const quote = quotes.get(name.symbol);
    if (!quote) return { ok: false };
    let targetQty = (name.targetWeight * equity) / quote.aud;
    const cost = avg.get(name.id) ?? 0;
    if (prev > 0 && targetQty > prev + 1e-8 && quote.aud < cost) {
      targetQty = prev;
      notes.set(name.id, 'The add was not filled. The next close was under cost, so it was not averaged down.');
    }
    desired.set(name.id, targetQty);
  }
  const order = [...pending.names].sort((a, b) => {
    const aSell = (desired.get(a.id) ?? 0) < (qty.get(a.id) ?? 0) - 1e-8 ? 0 : 1;
    const bSell = (desired.get(b.id) ?? 0) < (qty.get(b.id) ?? 0) - 1e-8 ? 0 : 1;
    return aSell - bSell;
  });
  let traded = 0;
  const trades: DruckTrade[] = [];
  let filledOn: string | null = null;
  for (const name of order) {
    const prev = qty.get(name.id) ?? 0;
    const next = desired.get(name.id) ?? 0;
    if (Math.abs(next - prev) < 1e-8) continue;
    const quote = quotes.get(name.symbol);
    if (!quote) return { ok: false };
    const delta = next - prev;
    const notional = Math.abs(delta) * quote.aud;
    cash -= delta * quote.aud;
    traded += notional;
    if (notional >= 0.5) {
      trades.push({
        id: name.id,
        symbol: name.symbol,
        side: delta > 0 ? 'buy' : 'sell',
        notionalAud: round2(notional),
        priceAud: quote.aud,
        date: quote.date,
      });
    }
    if (delta > 0) {
      const oldAvg = prev > 0 ? (avg.get(name.id) ?? quote.aud) : quote.aud;
      const newQty = prev + delta;
      avg.set(name.id, newQty > 0 ? (prev * oldAvg + delta * quote.aud) / newQty : 0);
    }
    if (next <= 1e-10) avg.delete(name.id);
    qty.set(name.id, next);
    if (!filledOn || quote.date > filledOn) filledOn = quote.date;
  }
  const cost = round2(traded * DRUCK_COST);
  cash -= cost;
  if (cash < -0.05) return { ok: false };
  if (cash < 0) cash = 0;
  let invested = 0;
  const names = pending.names.map((name) => {
    const quote = quotes.get(name.symbol);
    const size = qty.get(name.id) ?? 0;
    const heldAud = quote ? round2(size * quote.aud) : 0;
    invested += heldAud;
    const heldWeight = equity > 0 ? heldAud / equity : 0;
    const call = callFrom(heldWeight, name.targetWeight);
    const collapsed = heldAud > 1 && Math.abs(heldWeight - name.targetWeight) <= 0.005;
    return {
      ...name,
      priceAud: quote?.aud ?? name.priceAud,
      heldAud,
      heldWeight,
      targetAud: round2(name.targetWeight * equity),
      targetWeight: name.targetWeight,
      call: collapsed ? 'Hold' : call,
      tag: collapsed ? 'hold' as const : name.tag,
      note: notes.get(name.id) ?? null,
      vsCost: avg.get(name.id) && quote ? quote.aud / (avg.get(name.id) as number) - 1 : name.vsCost,
    };
  });
  const settled = names.map((name) => {
    const size = qty.get(name.id) ?? 0;
    if (size <= 1e-10 && name.targetWeight <= 0.0005) {
      return { ...name, call: 'Wait' as const, heldAud: 0, heldWeight: 0, targetAud: 0 };
    }
    return name;
  });
  const post = round2(cash + invested);
  const nav = pending.prevEndAud && pending.prevEndAud > 0
    ? roundNav((pending.nav || 1) * (post / pending.prevEndAud))
    : roundNav(post / DRUCK_START_AUD);
  const positions = pending.names
    .map((name) => ({ id: name.id, symbol: name.symbol, qty: qty.get(name.id) ?? 0, avgCostAud: avg.get(name.id) ?? 0 }))
    .filter((position) => position.qty > 1e-10);
  return {
    ok: true,
    snapshot: {
      ...pending,
      phase: 'filled',
      filledOn,
      cashAud: round2(cash),
      investedAud: round2(invested),
      equityAud: post,
      costAud: cost,
      nav,
      peakAud: Math.max(pending.peakAud, post),
      names: settled,
      positions,
      trades,
    },
  };
}

export function stepDruck(previous: DruckSnapshot | null, market: DruckMarket): DruckStep {
  if (market.errors.length > 0) return fail(market.errors, previous);
  const ny = newYorkClock(market.now);
  const calendar = (() => {
    const dates: string[] = [];
    for (const bar of market.prices[DRUCK_SPY] ?? []) {
      if (bar.close > 0 && dates[dates.length - 1] !== bar.date) dates.push(bar.date);
    }
    return dates;
  })();
  if (calendar.length === 0) return fail([`${DRUCK_SPY} did not arrive.`], previous);
  const decision = decisionSession(calendar, market.now);
  if (!decision) return { outcome: 'waiting', banner: null, errors: [], snapshot: previous, week: null };
  const carried = previous?.positions ?? [];
  const symbols = neededSymbols(carried);
  symbols.push(FX_SYMBOL);
  const problems = seriesProblems(market, unique(symbols), decision, ny.date);
  if (problems.length > 0) return fail(problems, previous);
  if (previous?.decisionDate === decision && previous.phase === 'filled') {
    return { outcome: 'unchanged', banner: null, errors: [], snapshot: previous, week: null };
  }
  if (previous?.decisionDate === decision && previous.phase === 'pending') {
    const pending = { ...previous, actionDate: previous.actionDate ?? nextSession(calendar, decision) };
    const filled = tryFill(pending, market);
    if (filled.ok) return { outcome: 'filled', banner: null, errors: [], snapshot: filled.snapshot, week: null };
    if (pending.actionDate !== previous.actionDate) {
      return { outcome: 'saved', banner: null, errors: [], snapshot: pending, week: null };
    }
    return { outcome: 'unchanged', banner: null, errors: [], snapshot: previous, week: null };
  }

  for (const candidate of DRUCK_CANDIDATES) {
    if (candidate.openWeight < -1e-9 || candidate.openWeight > DRUCK_STARTER_MAX + 1e-9) {
      return fail([`${candidate.symbol} is listed above the 10% starter. No new buys.`], previous);
    }
    if (candidate.addWeight < candidate.openWeight - 1e-9 || candidate.addWeight > DRUCK_NAME_MAX + 1e-9) {
      return fail([`${candidate.symbol} is listed above the 25% name cap. No new buys.`], previous);
    }
  }
  const index = calendar.indexOf(decision);
  const fx = market.prices[FX_SYMBOL] ?? [];
  const fxQuote = audOf(DRUCK_SPY, 1, fx, decision);
  if (!fxQuote?.rate) return fail(['The Australian dollar rate did not arrive. No new buys.'], previous);
  const candidates = candidateList(carried);
  const signals = new Map<string, Signal>();
  const audPrices = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.symbol === DRUCK_SPY) continue;
    const values = alignToCalendar(market.prices[candidate.symbol] ?? [], calendar);
    const signal = signalAt(values, index);
    if (!signal) return fail([`${candidate.symbol} does not have a full 200-day average yet.`], previous);
    const aud = audOf(candidate.symbol, signal.price, fx, decision);
    if (!aud) return fail([`${candidate.symbol} has no Australian dollar price. No new buys.`], previous);
    signals.set(candidate.id, signal);
    audPrices.set(candidate.id, aud.aud);
  }
  const spy = signalAt(alignToCalendar(market.prices[DRUCK_SPY] ?? [], calendar), index);
  if (!spy) return fail(['SPY does not have a full 200-day average yet.'], previous);
  const read = classifyRead({
    liquidity: market.liquidity,
    spreadNow: market.spreadNow,
    spreadThen: market.spreadThen,
    spyAbove200: spy.above200,
  });
  if (!read.ok) return fail([read.error], previous);

  const accrued = previous
    ? idleInterest(previous.cashAud, previous.filledOn ?? previous.decisionDate, decision)
    : { cash: DRUCK_START_AUD, interest: 0 };
  const vsCost = new Map<string, number | null>();
  const marks: PlanMark[] = [];
  let heldValue = 0;
  for (const candidate of candidates) {
    const position = carried.find((item) => item.id === candidate.id);
    const priceAud = audPrices.get(candidate.id) ?? 0;
    const heldAud = position && position.qty > 0 ? position.qty * priceAud : 0;
    if (position && position.qty > 0 && !(priceAud > 0)) {
      return fail([`${candidate.symbol} has no price to value the shares already held.`], previous);
    }
    heldValue += heldAud;
    const signal = signals.get(candidate.id);
    vsCost.set(candidate.id, position && position.avgCostAud > 0 && priceAud > 0 ? priceAud / position.avgCostAud - 1 : null);
    marks.push({
      id: candidate.id,
      heldAud,
      avgCostAud: position?.avgCostAud ?? null,
      priceAud: priceAud > 0 ? priceAud : null,
      above200: signal?.above200 ?? null,
      premium: signal?.premium ?? null,
    });
  }
  const cash = round2(accrued.cash);
  const equity = round2(cash + heldValue);
  if (!(equity > 0)) return fail(['The book has no value. No new buys.'], previous);
  const brake = nextBrake({
    brake: previous?.brakeOn ?? false,
    peak: previous?.peakAud ?? equity,
    equity,
    colour: read.colour,
  });
  const plan = planBook({ candidates, marks, equity, cap: brake.cap });
  const overweight = plan.some((row) => row.weight > DRUCK_NAME_MAX + 1e-6)
    || plan.reduce((sum, row) => sum + row.weight, 0) > brake.cap + 1e-4;
  if (overweight) return fail(['The weights would break a cap. No order was built.'], previous);
  const names = buildNames({ candidates, plan, signals, aud: audPrices, vsCost, equity });
  const targetInvested = round2(names.reduce((sum, name) => sum + name.targetAud, 0));
  const aaa = closeOnOrBefore(market.prices[DRUCK_CASH_SYMBOL] ?? [], decision);
  const pending: DruckSnapshot = {
    ruleVersion: DRUCK_RULE,
    bookId: DRUCK_BOOK_ID,
    decisionDate: decision,
    actionDate: nextSession(calendar, decision),
    filledOn: null,
    phase: 'pending',
    colour: read.colour,
    cap: brake.cap,
    brakeOn: brake.brake,
    peakAud: brake.peak,
    equityAud: equity,
    cashAud: cash,
    cashInterestAud: round2(accrued.interest),
    investedAud: round2(heldValue),
    targetCashAud: round2(equity - targetInvested),
    costAud: 0,
    nav: previous?.nav ?? 1,
    prevEndAud: previous ? round2(previous.cashAud + previous.investedAud) : null,
    fxRate: fxQuote.rate,
    fxDate: fxQuote.fxDate,
    aaaPrice: aaa,
    names,
    positions: carried.filter((position) => position.qty > 1e-10),
    trades: [],
    read: {
      liquidity: market.liquidity as number,
      spreadNow: market.spreadNow as number,
      spreadThen: market.spreadThen as number,
      spyPrice: spy.price,
      spyMa200: spy.ma200,
      checks: read.checks,
    },
    skippedFill: previous && previous.phase === 'pending' ? previous.decisionDate : null,
    fetchedAt: market.now.toISOString(),
    signalAsOf: decision,
  };
  const filled = tryFill(pending, market);
  if (filled.ok) return { outcome: 'filled', banner: null, errors: [], snapshot: filled.snapshot, week: pending };
  return { outcome: 'saved', banner: null, errors: [], snapshot: pending, week: pending };
}

const SAMPLE_LAST: Record<string, { price: number; premium: number }> = {
  [DRUCK_SPY]: { price: 560, premium: -0.055 },
  [DRUCK_CASH_SYMBOL]: { price: 50.2, premium: 0.002 },
  NTRA: { price: 273.4, premium: 0.001 },
  'HACK.AX': { price: 18.26, premium: 0.18 },
  AMZN: { price: 246.82, premium: 0.007 },
  INSM: { price: 141.33, premium: 0.15 },
  STX: { price: 457, premium: -0.35 },
  WDC: { price: 261, premium: -0.38 },
  'GDX.AX': { price: 88.92, premium: -0.18 },
  'SEMI.AX': { price: 29.25, premium: -0.12 },
  SE: { price: 62.63, premium: -0.22 },
  YPF: { price: 32.32, premium: -0.28 },
  EWZ: { price: 28.54, premium: -0.34 },
};

/** Saturday after the Friday 20 Nov 2026 US close. The read is red, matching the brief. */
export function sampleMarket(): DruckMarket {
  const calendar = businessDaysEnding('2026-11-20', 260);
  const prices: Record<string, CloseBar[]> = {};
  for (const [symbol, spec] of Object.entries(SAMPLE_LAST)) {
    prices[symbol] = closesFor(calendar, spec.price, spec.premium);
  }
  prices[FX_SYMBOL] = calendar.map((date) => ({ date, close: 0.65 }));
  return {
    now: new Date('2026-11-21T15:00:00.000Z'),
    prices,
    liquidity: 0.04,
    liquidityAsOf: '2026-11-20',
    spreadNow: 4.2,
    spreadThen: 3.4,
    spreadAsOf: '2026-11-20',
    errors: [],
  };
}

export function sampleStep(): DruckStep {
  return stepDruck(null, sampleMarket());
}

export { businessDaysEnding, plainDate };
export type { CloseBar };
