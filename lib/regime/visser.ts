import { CASH_YIELD_ANNUAL } from './cashYield';
import { accrueCash } from './evaluate';

/**
 * VS1 Visser basket. Rules fixed in the 21 Nov 2026 research script:
 * weekly decision on the last US session of the week, trade at the next close.
 * Price above its 200-day average AND that average higher than 20 sessions ago.
 * Half size when the 50-day gain is above 50% or the price is more than 60%
 * above the 200-day average. Long only, no leverage, weights at most 100%.
 * Signals use the US series. Orders are the AUD listings in VISSER_SLEEVES.
 */

export const VISSER_RULE = 'VS1-2026-11-21';
export const VISSER_BOOK_ID = 'visser-aud-paper-v1';
export const VISSER_COST = 0.001;
export const VISSER_SHARE_DEFAULT = 0.15;
export const VISSER_SHARE_MIN = 0.1;
export const VISSER_SHARE_MAX = 0.2;
export const VISSER_CAVEAT = 'NOT VALIDATED — results lean heavily on bitcoin and the AI chip run, themes chosen with hindsight';

export const VISSER_BACKTEST = {
  usdCagr2005: 0.141,
  usdWorstFall: -0.23,
  usdCagr2015: 0.223,
  audCagr2015: 0.245,
  usdNoBitcoin2015: 0.129,
  usdCagr2005to2014: 0.051,
  audCagr2005: 0.15,
  audWorstFall: -0.36,
} as const;

export type SleeveId = 'chips' | 'nasdaq' | 'bitcoin' | 'gold' | 'silver';
export type VisserCall = 'Buy' | 'Hold' | 'Trim' | 'Sell' | 'Wait';
export type VisserOutcome = 'saved' | 'filled' | 'feed_failed' | 'waiting' | 'unchanged';

export interface VisserSleeveDef {
  id: SleeveId;
  label: string;
  base: number;
  signal: string;
  signalName: string;
  buy: string;
  buyName: string;
  why: string;
}

export const VISSER_SLEEVES: readonly VisserSleeveDef[] = [
  {
    id: 'chips',
    label: 'Chips',
    base: 0.35,
    signal: 'SMH',
    signalName: 'VanEck Semiconductor ETF',
    buy: 'SEMI.AX',
    buyName: 'Global X Semiconductor ETF',
    why: 'The rule watches SMH, the US chip fund in the backtest. The order is SEMI.AX, the semiconductor fund on the ASX, priced in Australian dollars.',
  },
  {
    id: 'nasdaq',
    label: 'Nasdaq',
    base: 0.15,
    signal: 'QQQ',
    signalName: 'Invesco QQQ',
    buy: 'NDQ.AX',
    buyName: 'BetaShares NASDAQ 100 ETF',
    why: 'The rule watches QQQ. The order is NDQ.AX, an unhedged Nasdaq-100 fund on the ASX.',
  },
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    base: 0.2,
    signal: 'BTC-USD',
    signalName: 'Bitcoin',
    buy: 'VBTC.AX',
    buyName: 'VanEck Bitcoin ETF',
    why: 'The rule watches the bitcoin price in US dollars, and the weight never goes above 20%. The order is VBTC.AX. The iShares ASX bitcoin fund had no Yahoo price, so the order is VanEck.',
  },
  {
    id: 'gold',
    label: 'Gold',
    base: 0.2,
    signal: 'GLD',
    signalName: 'SPDR Gold Shares',
    buy: 'GOLD.AX',
    buyName: 'Global X Physical Gold',
    why: 'The rule watches GLD. The order is GOLD.AX, physical gold on the ASX.',
  },
  {
    id: 'silver',
    label: 'Silver',
    base: 0.1,
    signal: 'SLV',
    signalName: 'iShares Silver Trust',
    buy: 'ETPMAG.AX',
    buyName: 'Global X Physical Silver',
    why: 'The rule watches SLV. The order is ETPMAG.AX, physical silver on the ASX.',
  },
];

export interface CloseBar {
  date: string;
  close: number;
}

export interface SleeveSignal {
  id: SleeveId;
  price: number | null;
  ma200: number | null;
  ma20Ago: number | null;
  above200: boolean | null;
  rising: boolean | null;
  roc50: number | null;
  premium: number | null;
  hot: boolean | null;
  eligible: boolean;
  weight: number;
}

export interface VisserPosition {
  sleeve: SleeveId;
  qty: number;
}

export interface VisserTrade {
  sleeve: SleeveId;
  symbol: string;
  side: 'buy' | 'sell';
  notionalAud: number;
  priceAud: number;
  date: string;
}

export interface VisserSleeveState {
  id: SleeveId;
  label: string;
  signal: string;
  signalName: string;
  buy: string;
  buyName: string;
  baseWeight: number;
  targetWeight: number;
  heldWeight: number;
  targetAud: number;
  heldAud: number;
  call: VisserCall;
  above200: boolean | null;
  rising: boolean | null;
  hot: boolean | null;
  price: number | null;
  ma200: number | null;
  ma20Ago: number | null;
  roc50: number | null;
  premium: number | null;
}

export interface VisserSnapshot {
  ruleVersion: typeof VISSER_RULE;
  bookId: typeof VISSER_BOOK_ID;
  decisionDate: string;
  actionDate: string | null;
  filledOn: string | null;
  phase: 'pending' | 'filled';
  share: number;
  portfolioAud: number;
  portfolioBasis: 'paper value' | 'starting amount';
  budgetAud: number;
  cashAud: number;
  /** Interest added to idle cash since the previous fill. Zero on a week with no previous cash. */
  cashInterestAud: number;
  targetCashAud: number;
  investedAud: number;
  costAud: number;
  /** Sleeve value, starting at 1. A top-up that resizes the sleeve to the main book is not part of this. */
  sleeveNav: number;
  /** Cash plus holdings at the previous fill, before this week's price move. Null on the first week. */
  prevEndAud: number | null;
  sleeves: VisserSleeveState[];
  positions: VisserPosition[];
  trades: VisserTrade[];
  skippedFill: string | null;
  fetchedAt: string;
  signalAsOf: string;
}

export interface VisserMarket {
  now: Date;
  signals: Record<SleeveId, CloseBar[]>;
  tradables: Record<SleeveId, CloseBar[]>;
  errors: string[];
}

export interface VisserStep {
  outcome: VisserOutcome;
  banner: string | null;
  errors: string[];
  snapshot: VisserSnapshot | null;
  /** Pending decision to insert once. Null when this step does not open a new week. */
  week: VisserSnapshot | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function sleeveDef(id: SleeveId): VisserSleeveDef {
  const found = VISSER_SLEEVES.find((sleeve) => sleeve.id === id);
  if (!found) throw new Error(`Unknown Visser sleeve ${id}`);
  return found;
}

export function plainDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function weekEndingSunday(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday !== 0) date.setUTCDate(date.getUTCDate() + (7 - weekday));
  return date.toISOString().slice(0, 10);
}

export interface NyClock {
  date: string;
  minutes: number;
  weekday: number;
}

export function newYorkClock(now: Date): NyClock {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) bag[part.type] = part.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    date: `${bag.year}-${bag.month}-${bag.day}`,
    minutes: hour * 60 + Number(bag.minute),
    weekday: weekdays[bag.weekday] ?? 0,
  };
}

/** A week is closed after the Friday US cash close, or once the calendar has moved past it. */
export function weekIsClosed(session: string, ny: NyClock): boolean {
  const sessionWeek = weekEndingSunday(session);
  const todayWeek = weekEndingSunday(ny.date);
  if (sessionWeek < todayWeek) return true;
  if (sessionWeek > todayWeek) return false;
  if (ny.weekday === 6 || ny.weekday === 0) return true;
  return ny.weekday === 5 && ny.minutes >= 16 * 60 && session === ny.date;
}

export function decisionSession(calendar: readonly string[], now: Date): string | null {
  const ny = newYorkClock(now);
  let chosen: string | null = null;
  for (let i = 0; i < calendar.length; i++) {
    const next = calendar[i + 1];
    const lastOfWeek = !next || weekEndingSunday(calendar[i]) !== weekEndingSunday(next);
    if (!lastOfWeek) continue;
    if (!weekIsClosed(calendar[i], ny)) continue;
    chosen = calendar[i];
  }
  return chosen;
}

export function nextSession(calendar: readonly string[], decision: string): string | null {
  for (const day of calendar) {
    if (day > decision) return day;
  }
  return null;
}

export function ageDays(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 999;
  return Math.round((end - start) / 86_400_000);
}

export function satelliteShare(raw: string | undefined): { share: number; note: string | null } {
  if (raw == null || raw.trim() === '') return { share: VISSER_SHARE_DEFAULT, note: null };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return { share: VISSER_SHARE_DEFAULT, note: null };
  const share = parsed > 1 ? parsed / 100 : parsed;
  if (share < VISSER_SHARE_MIN) {
    return { share: VISSER_SHARE_MIN, note: 'The sleeve size was under 10%, so it is set to 10%.' };
  }
  if (share > VISSER_SHARE_MAX) {
    return { share: VISSER_SHARE_MAX, note: 'The sleeve size was over 20%, so it is set to 20%.' };
  }
  return { share, note: null };
}

/** Idle sleeve cash earns the RBA cash-rate constant across the calendar gap. */
export function idleInterest(cash: number, from: string | null, to: string): { cash: number; interest: number } {
  if (!from || !(cash > 0)) return { cash: round2(Math.max(0, cash)), interest: 0 };
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 86_400_000) : 0;
  const next = round2(accrueCash(cash, CASH_YIELD_ANNUAL, days));
  return { cash: next, interest: round2(next - cash) };
}

function roundNav(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function rollingMean(values: readonly (number | null)[], end: number, length: number): number | null {
  const start = end - length + 1;
  if (start < 0 || end < 0 || end >= values.length) return null;
  let sum = 0;
  for (let i = start; i <= end; i++) {
    const value = values[i];
    if (value == null || !(value > 0)) return null;
    sum += value;
  }
  return sum / length;
}

/** Last close on or before each calendar date. A later close is not used. */
export function alignToCalendar(bars: readonly CloseBar[], calendar: readonly string[]): (number | null)[] {
  const sorted = sortedBars(bars);
  const out: (number | null)[] = [];
  let index = 0;
  let last: number | null = null;
  for (const day of calendar) {
    while (index < sorted.length && sorted[index].date <= day) {
      last = sorted[index].close;
      index += 1;
    }
    out.push(last);
  }
  return out;
}

function sortedBars(bars: readonly CloseBar[]): CloseBar[] {
  return bars.filter((bar) => bar.close > 0 && Boolean(bar.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function closeOnOrBefore(bars: readonly CloseBar[], date: string): number | null {
  let price: number | null = null;
  for (const bar of sortedBars(bars)) {
    if (bar.date <= date) price = bar.close;
  }
  return price;
}

export function closeOnOrAfter(bars: readonly CloseBar[], date: string): CloseBar | null {
  for (const bar of sortedBars(bars)) {
    if (bar.date >= date) return bar;
  }
  return null;
}

export function signalAt(values: readonly (number | null)[], index: number, base: number): Omit<SleeveSignal, 'id'> {
  const price = index >= 0 && index < values.length ? values[index] : null;
  const ma200 = rollingMean(values, index, 200);
  const ma20Ago = rollingMean(values, index - 20, 200);
  const ago = index - 50 >= 0 ? values[index - 50] : null;
  const roc50 = price != null && ago != null && ago > 0 ? price / ago - 1 : null;
  const above200 = price != null && ma200 != null ? price > ma200 : null;
  const rising = ma200 != null && ma20Ago != null ? ma200 > ma20Ago : null;
  const premium = price != null && ma200 != null && ma200 > 0 ? price / ma200 - 1 : null;
  const gainHot = roc50 != null && roc50 > 0.5;
  const extensionHot = premium != null && premium > 0.6;
  const hot = ma200 == null ? null : gainHot || extensionHot;
  const eligible = above200 === true && rising === true;
  const weight = eligible && hot != null ? round6(hot ? base / 2 : base) : 0;
  return { price, ma200, ma20Ago, above200, rising, roc50, premium, hot, eligible, weight };
}

export function sleeveCall(heldAud: number, targetAud: number, budgetAud: number): VisserCall {
  const band = Math.max(1, budgetAud * 0.005);
  if (targetAud <= band && heldAud <= band) return 'Wait';
  if (targetAud <= band) return 'Sell';
  if (heldAud <= band) return 'Buy';
  if (targetAud < heldAud - band) return 'Trim';
  if (targetAud > heldAud + band) return 'Buy';
  return 'Hold';
}

function calendarOf(bars: readonly CloseBar[]): string[] {
  const dates: string[] = [];
  for (const bar of sortedBars(bars)) {
    if (dates[dates.length - 1] !== bar.date) dates.push(bar.date);
  }
  return dates;
}

function lastDate(bars: readonly CloseBar[]): string | null {
  const sorted = sortedBars(bars);
  return sorted.length ? sorted[sorted.length - 1].date : null;
}

export function failureBanner(errors: string[], previous: VisserSnapshot | null): string {
  const why = errors[0] ?? 'A required price did not arrive.';
  if (previous) {
    return `${why} Showing the saved week of ${plainDate(previous.decisionDate)}. No new buys. Nothing is sold just because a feed is down.`;
  }
  return `${why} No week is saved, so nothing is bought.`;
}

function fail(errors: string[], previous: VisserSnapshot | null): VisserStep {
  return {
    outcome: 'feed_failed',
    banner: failureBanner(errors, previous),
    errors,
    snapshot: previous,
    week: null,
  };
}

function seriesProblems(market: VisserMarket, decision: string, nyDate: string): string[] {
  const problems: string[] = [];
  for (const sleeve of VISSER_SLEEVES) {
    const signalLast = lastDate(market.signals[sleeve.id] ?? []);
    const buyLast = lastDate(market.tradables[sleeve.id] ?? []);
    if (!signalLast) problems.push(`${sleeve.signal} did not arrive.`);
    else if (ageDays(signalLast, nyDate) > 7) problems.push(`${sleeve.signal} last closed on ${plainDate(signalLast)}, which is too old to use.`);
    else if (ageDays(signalLast, decision) > 5) problems.push(`${sleeve.signal} has no close near ${plainDate(decision)}.`);
    if (!buyLast) problems.push(`${sleeve.buy} did not arrive.`);
    else if (ageDays(buyLast, nyDate) > 7) problems.push(`${sleeve.buy} last closed on ${plainDate(buyLast)}, which is too old to use.`);
  }
  return problems;
}

function heldAt(
  positions: readonly VisserPosition[],
  tradables: VisserMarket['tradables'],
  date: string,
): { held: Map<SleeveId, number> } | { error: string } {
  const held = new Map<SleeveId, number>();
  for (const position of positions) {
    if (!(position.qty > 0)) continue;
    const price = closeOnOrBefore(tradables[position.sleeve] ?? [], date);
    if (price == null) return { error: `${sleeveDef(position.sleeve).buy} has no price to value the shares already held.` };
    held.set(position.sleeve, position.qty * price);
  }
  return { held };
}

function buildSleeves(
  signals: Record<SleeveId, Omit<SleeveSignal, 'id'>>,
  held: Map<SleeveId, number>,
  budgetAud: number,
): { sleeves: VisserSleeveState[]; targetCashAud: number; investedAud: number } | { error: string } {
  const sleeves: VisserSleeveState[] = [];
  let invested = 0;
  let weightSum = 0;
  for (const def of VISSER_SLEEVES) {
    const signal = signals[def.id];
    if (signal.price == null || signal.ma200 == null || signal.rising == null) {
      return { error: `${def.signal} does not have a full 200-day average yet.` };
    }
    const targetAud = round2(signal.weight * budgetAud);
    const heldAud = round2(held.get(def.id) ?? 0);
    invested += targetAud;
    weightSum += signal.weight;
    sleeves.push({
      id: def.id,
      label: def.label,
      signal: def.signal,
      signalName: def.signalName,
      buy: def.buy,
      buyName: def.buyName,
      baseWeight: def.base,
      targetWeight: signal.weight,
      heldWeight: budgetAud > 0 ? heldAud / budgetAud : 0,
      targetAud,
      heldAud,
      call: sleeveCall(heldAud, targetAud, budgetAud),
      above200: signal.above200,
      rising: signal.rising,
      hot: signal.hot,
      price: signal.price,
      ma200: signal.ma200,
      ma20Ago: signal.ma20Ago,
      roc50: signal.roc50,
      premium: signal.premium,
    });
  }
  if (weightSum > 1 + 1e-9) return { error: 'The weights add up to more than 100%. No order was built.' };
  return { sleeves, targetCashAud: round2(budgetAud - invested), investedAud: round2(invested) };
}

function shell(input: {
  decisionDate: string;
  actionDate: string | null;
  share: number;
  portfolioAud: number;
  portfolioBasis: VisserSnapshot['portfolioBasis'];
  budgetAud: number;
  cashAud: number;
  cashInterestAud?: number;
  sleeveNav?: number;
  prevEndAud?: number | null;
  sleeves: VisserSleeveState[];
  targetCashAud: number;
  investedAud: number;
  positions: VisserPosition[];
  skippedFill: string | null;
  fetchedAt: string;
}): VisserSnapshot {
  return {
    ruleVersion: VISSER_RULE,
    bookId: VISSER_BOOK_ID,
    decisionDate: input.decisionDate,
    actionDate: input.actionDate,
    filledOn: null,
    phase: 'pending',
    share: input.share,
    portfolioAud: input.portfolioAud,
    portfolioBasis: input.portfolioBasis,
    budgetAud: input.budgetAud,
    cashAud: round2(input.cashAud),
    cashInterestAud: round2(input.cashInterestAud ?? 0),
    targetCashAud: input.targetCashAud,
    investedAud: input.investedAud,
    costAud: 0,
    sleeveNav: input.sleeveNav ?? 1,
    prevEndAud: input.prevEndAud ?? null,
    sleeves: input.sleeves,
    positions: input.positions.filter((position) => position.qty > 1e-10),
    trades: [],
    skippedFill: input.skippedFill,
    fetchedAt: input.fetchedAt,
    signalAsOf: input.decisionDate,
  };
}

function tryFill(pending: VisserSnapshot, market: VisserMarket): { ok: true; snapshot: VisserSnapshot } | { ok: false } {
  const actionDate = pending.actionDate;
  if (!actionDate) return { ok: false };
  const prices = new Map<SleeveId, CloseBar>();
  for (const def of VISSER_SLEEVES) {
    const held = pending.positions.some((position) => position.sleeve === def.id && position.qty > 0);
    const target = pending.sleeves.find((sleeve) => sleeve.id === def.id)?.targetWeight ?? 0;
    const needed = target > 0 || held;
    if (!needed) continue;
    const bar = closeOnOrAfter(market.tradables[def.id] ?? [], actionDate);
    if (!bar) return { ok: false };
    prices.set(def.id, bar);
  }
  let cash = pending.cashAud;
  const qty = new Map<SleeveId, number>();
  for (const position of pending.positions) qty.set(position.sleeve, position.qty);
  let marked = cash;
  let missingMark = false;
  qty.forEach((size, sleeve) => {
    if (!(size > 0) || missingMark) return;
    const bar = prices.get(sleeve) ?? closeOnOrAfter(market.tradables[sleeve] ?? [], actionDate);
    if (!bar) {
      missingMark = true;
      return;
    }
    prices.set(sleeve, bar);
    marked += size * bar.close;
  });
  if (missingMark) return { ok: false };
  const opening = marked;
  cash += pending.budgetAud - marked;
  const trades: VisserTrade[] = [];
  let traded = 0;
  const next = new Map<SleeveId, number>();
  let invested = 0;
  let filledOn: string | null = null;
  for (const sleeve of pending.sleeves) {
    const bar = prices.get(sleeve.id);
    const prev = qty.get(sleeve.id) ?? 0;
    if (sleeve.targetAud <= 0) {
      if (prev > 0) {
        if (!bar) return { ok: false };
        const notional = prev * bar.close;
        cash += notional;
        traded += notional;
        trades.push({
          sleeve: sleeve.id,
          symbol: sleeve.buy,
          side: 'sell',
          notionalAud: round2(notional),
          priceAud: bar.close,
          date: bar.date,
        });
        if (!filledOn || bar.date > filledOn) filledOn = bar.date;
      }
      continue;
    }
    if (!bar) return { ok: false };
    const targetQty = sleeve.targetAud / bar.close;
    const delta = targetQty - prev;
    const notional = delta * bar.close;
    cash -= notional;
    traded += Math.abs(notional);
    if (Math.abs(notional) >= 0.5) {
      trades.push({
        sleeve: sleeve.id,
        symbol: sleeve.buy,
        side: delta > 0 ? 'buy' : 'sell',
        notionalAud: round2(Math.abs(notional)),
        priceAud: bar.close,
        date: bar.date,
      });
    }
    next.set(sleeve.id, targetQty);
    invested += targetQty * bar.close;
    if (!filledOn || bar.date > filledOn) filledOn = bar.date;
  }
  const cost = round2(traded * VISSER_COST);
  cash -= cost;
  if (cash < -0.05) return { ok: false };
  if (cash < 0) cash = 0;
  const prevNav = pending.sleeveNav ?? 1;
  const sleeveNav = pending.prevEndAud && pending.prevEndAud > 0
    ? roundNav(prevNav * (opening / pending.prevEndAud))
    : prevNav;
  const sleeves = pending.sleeves.map((sleeve) => {
    const bar = prices.get(sleeve.id);
    const size = next.get(sleeve.id) ?? 0;
    const heldAud = bar ? round2(size * bar.close) : 0;
    return {
      ...sleeve,
      heldAud,
      heldWeight: pending.budgetAud > 0 ? heldAud / pending.budgetAud : 0,
      call: sleeveCall(heldAud, sleeve.targetAud, pending.budgetAud),
    };
  });
  return {
    ok: true,
    snapshot: {
      ...pending,
      phase: 'filled',
      filledOn,
      cashAud: round2(cash),
      investedAud: round2(invested),
      costAud: cost,
      sleeveNav,
      sleeves,
      positions: VISSER_SLEEVES.map((def) => ({ sleeve: def.id, qty: next.get(def.id) ?? 0 })).filter((position) => position.qty > 1e-10),
      trades,
    },
  };
}

export function stepVisser(
  previous: VisserSnapshot | null,
  market: VisserMarket,
  portfolio: { aud: number; basis: VisserSnapshot['portfolioBasis'] },
  share: number,
): VisserStep {
  if (!(share >= VISSER_SHARE_MIN && share <= VISSER_SHARE_MAX)) {
    return fail(['The sleeve size is outside 10% to 20%.'], previous);
  }
  if (!(portfolio.aud > 0)) return fail(['No Australian dollar portfolio value is stored.'], previous);
  if (market.errors.length > 0) return fail(market.errors, previous);
  const ny = newYorkClock(market.now);
  const calendar = calendarOf(market.signals.nasdaq ?? []);
  if (calendar.length === 0) return fail(['QQQ did not arrive.'], previous);
  const decision = decisionSession(calendar, market.now);
  if (!decision) {
    return { outcome: 'waiting', banner: null, errors: [], snapshot: previous, week: null };
  }
  const problems = seriesProblems(market, decision, ny.date);
  if (problems.length > 0) return fail(problems, previous);
  if (previous?.decisionDate === decision && previous.phase === 'filled') {
    return { outcome: 'unchanged', banner: null, errors: [], snapshot: previous, week: null };
  }
  if (previous?.decisionDate === decision && previous.phase === 'pending') {
    const pending = { ...previous, actionDate: previous.actionDate ?? nextSession(calendar, decision) };
    const filled = tryFill(pending, market);
    if (filled.ok) {
      return { outcome: 'filled', banner: null, errors: [], snapshot: filled.snapshot, week: null };
    }
    if (pending.actionDate !== previous.actionDate) {
      return { outcome: 'saved', banner: null, errors: [], snapshot: pending, week: null };
    }
    return { outcome: 'unchanged', banner: null, errors: [], snapshot: previous, week: null };
  }

  const index = calendar.indexOf(decision);
  const aligned: Record<SleeveId, (number | null)[]> = {
    chips: [],
    nasdaq: [],
    bitcoin: [],
    gold: [],
    silver: [],
  };
  const signals = {} as Record<SleeveId, Omit<SleeveSignal, 'id'>>;
  for (const def of VISSER_SLEEVES) {
    aligned[def.id] = alignToCalendar(market.signals[def.id] ?? [], calendar);
    signals[def.id] = signalAt(aligned[def.id], index, def.base);
  }
  const carried = previous?.positions ?? [];
  const marked = heldAt(carried, market.tradables, decision);
  if ('error' in marked) return fail([marked.error], previous);
  const budgetAud = round2(portfolio.aud * share);
  const built = buildSleeves(signals, marked.held, budgetAud);
  if ('error' in built) return fail([built.error], previous);
  const skipped = previous && previous.phase === 'pending' ? previous.decisionDate : null;
  const accrued = previous
    ? idleInterest(previous.cashAud, previous.filledOn ?? previous.decisionDate, decision)
    : { cash: 0, interest: 0 };
  const pending = shell({
    decisionDate: decision,
    actionDate: nextSession(calendar, decision),
    share,
    portfolioAud: portfolio.aud,
    portfolioBasis: portfolio.basis,
    budgetAud,
    cashAud: accrued.cash,
    cashInterestAud: accrued.interest,
    sleeveNav: previous?.sleeveNav ?? 1,
    prevEndAud: previous ? round2(previous.cashAud + previous.investedAud) : null,
    sleeves: built.sleeves,
    targetCashAud: built.targetCashAud,
    investedAud: built.investedAud,
    positions: carried,
    skippedFill: skipped,
    fetchedAt: market.now.toISOString(),
  });
  const filled = tryFill(pending, market);
  if (filled.ok) {
    return { outcome: 'filled', banner: null, errors: [], snapshot: filled.snapshot, week: pending };
  }
  return { outcome: 'saved', banner: null, errors: [], snapshot: pending, week: pending };
}

export function businessDaysEnding(end: string, count: number): string[] {
  const [year, month, day] = end.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dates: string[] = [];
  while (dates.length < count) {
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() - 1);
  }
  dates.reverse();
  return dates;
}

function uptrend(count: number): number[] {
  return Array.from({ length: count }, (_, index) => 50 + index * 0.15);
}

/** A Saturday after Friday 20 Nov 2026, with holdings that show every call. */
export function sampleMarket(): { market: VisserMarket; previous: VisserSnapshot; portfolio: { aud: number; basis: 'starting amount' } } {
  const calendar = businessDaysEnding('2026-11-20', 260);
  const count = calendar.length;
  const chips = uptrend(count);
  const gold = uptrend(count);
  const nasdaq = uptrend(count);
  const probe = signalAt(nasdaq, count - 1, 0.15);
  nasdaq[count - 1] = (probe.ma200 ?? 100) * 1.85;
  const bitcoin = uptrend(count);
  const silver = uptrend(count);
  for (let i = count - 12; i < count; i++) {
    bitcoin[i] = 40;
    silver[i] = 40;
  }
  const bars = (values: number[]): CloseBar[] => calendar.map((date, index) => ({ date, close: values[index] }));
  const flat = (price: number): CloseBar[] => calendar.map((date) => ({ date, close: price }));
  const previous: VisserSnapshot = {
    ruleVersion: VISSER_RULE,
    bookId: VISSER_BOOK_ID,
    decisionDate: '2026-11-13',
    actionDate: '2026-11-16',
    filledOn: '2026-11-16',
    phase: 'filled',
    share: 0.15,
    portfolioAud: 100_000,
    portfolioBasis: 'starting amount',
    budgetAud: 15_000,
    cashAud: 8_250,
    cashInterestAud: 0,
    targetCashAud: 8_250,
    investedAud: 6_750,
    costAud: 0,
    sleeveNav: 1,
    prevEndAud: null,
    sleeves: [],
    positions: [
      { sleeve: 'nasdaq', qty: 2250 / 57 },
      { sleeve: 'gold', qty: 3000 / 48 },
      { sleeve: 'silver', qty: 1500 / 60 },
    ],
    trades: [],
    skippedFill: null,
    fetchedAt: '2026-11-16T22:30:00.000Z',
    signalAsOf: '2026-11-13',
  };
  return {
    market: {
      now: new Date('2026-11-21T15:00:00.000Z'),
      signals: {
        chips: bars(chips),
        nasdaq: bars(nasdaq),
        bitcoin: bars(bitcoin),
        gold: bars(gold),
        silver: bars(silver),
      },
      tradables: {
        chips: flat(30),
        nasdaq: flat(57),
        bitcoin: flat(19),
        gold: flat(48),
        silver: flat(60),
      },
      errors: [],
    },
    previous,
    portfolio: { aud: 100_000, basis: 'starting amount' },
  };
}

export function sampleStep(): VisserStep {
  const sample = sampleMarket();
  return stepVisser(sample.previous, sample.market, sample.portfolio, 0.15);
}
