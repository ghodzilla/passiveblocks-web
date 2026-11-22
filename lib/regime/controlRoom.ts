import { cashYieldSentence } from './cashYield';
import {
  DRUCK_ADD_GAIN,
  DRUCK_CASH_SYMBOL,
  DRUCK_STOP_COST,
  DRUCK_STOP_MA,
  DRUCK_THEME_MAX,
  DRUCK_TRIM_MA,
} from './druck.config';
import { DRUCK_FROZEN } from './druckPresent';
import type { DruckCall, DruckColour, DruckNameState, DruckOutcome, DruckPosition, DruckSnapshot } from './druck';
import { DRUCK_PAPER_RULE, SIXTY_FORTY_ONE_WAY, walkSixtyForty, type ClosePoint } from './judgement';
import { bookPercent } from './ownerCopy';
import { plainDate } from './visser';

export const COMPARISON_EMPTY = 'First comparison appears after the first filled week';

export const COMPARISON_NOTE = '60/40 means 60% US shares (SPY) and 40% US government bonds (IEF), put back to those weights once a month, after a 0.10% trading cost. QQQ is the Nasdaq 100 fund. Each line is the change since the first filled week. Paper performance. Not real trading.';

export const ORDER_NOTE = 'Type these into IBKR yourself. Nothing on this page is sent. The limit is the last close, in US dollars for US names and Australian dollars for ASX names. The quantity is the whole number of shares that fits inside the dollar amount. DAY means the order expires if it does not fill that session. ASX names go in before 4:10 PM Sydney time on the date shown. US names go in before the US close, which is the next morning in Sydney.';

const RULES_NOTE = 'Long only. No leverage and no shorts. A new position starts at 10% or less. One name stops at 25%. One theme stops at 40%. Green can invest up to 100%, Amber 50%, and Red 25%. Checked on Saturday morning in Sydney, after the Friday close in the US. You place every order yourself.';

export interface LevelCell {
  key: 'stop' | 'cost' | 'add' | 'trim';
  label: string;
  text: string;
  tone: 'coral' | 'amber' | 'emerald' | 'muted';
  caption: string;
  title: string;
}

export interface HoldingCard {
  id: string;
  symbol: string;
  name: string;
  weight: number;
  weightLabel: string;
  action: string;
  actionTone: 'buy' | 'hold' | 'trim' | 'sell' | 'wait';
  priceLabel: string;
  versus200: string;
  marker: number;
  levels: LevelCell[];
  levelsNote: string | null;
  themeText: string;
  themeHot: boolean;
}

export interface WatchChip {
  symbol: string;
  name: string;
  text: string;
  below: boolean;
}

export interface CashCardModel {
  symbol: typeof DRUCK_CASH_SYMBOL;
  weight: number;
  weightLabel: string;
  amountLabel: string;
  caption: string;
  priceLabel: string | null;
  untilFill: string | null;
}

export interface OrderRow {
  side: 'BUY' | 'SELL';
  symbol: string;
  qty: number;
  type: 'LMT';
  limit: number;
  limitLabel: string;
  currency: 'USD' | 'AUD';
  placeBy: string;
  status: 'Not sent';
  tif: 'DAY';
}

export interface ChartPoint {
  date: string;
  label: string;
  book: number | null;
  mix: number | null;
  qqq: number | null;
}

export interface CheckPill {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface FreshLine {
  label: string;
  value: string;
}

export interface ControlRoomModel {
  status: 'ready' | 'empty' | 'unconfigured' | 'missing_schema' | 'outage';
  banner: string | null;
  colour: DruckColour | null;
  colourWord: string | null;
  headlineWait: boolean;
  invested: number;
  investedLabel: string | null;
  sharesLabel: string | null;
  brake: string | null;
  skipped: string | null;
  checks: CheckPill[];
  nextRun: string;
  freshWord: string;
  freshTone: 'fresh' | 'old' | 'down' | 'waiting';
  cards: HoldingCard[];
  watch: WatchChip[];
  cash: CashCardModel | null;
  chart: {
    empty: string | null;
    points: ChartPoint[];
    legend: { book: string; mix: string; qqq: string } | null;
    note: string;
    missing: string | null;
  };
  record: string | null;
  orders: OrderRow[];
  ordersEmpty: string;
  orderText: string;
  orderNote: string;
  freshness: FreshLine[];
  paperRule: string;
  about: string[];
}

export interface ControlRoomInput {
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage' | 'empty';
  snapshot: DruckSnapshot | null;
  banner: string | null;
  outcome: DruckOutcome | null;
  weeks?: DruckSnapshot[];
  qqq?: ClosePoint[];
  spy?: ClosePoint[];
  bonds?: ClosePoint[];
  now?: Date;
  liquidityAsOf?: string | null;
  spreadAsOf?: string | null;
  attemptedAt?: string | null;
  benchmarkMissing?: string[];
  paperRule?: string;
  record?: string | null;
}

function audDollars(value: number): string {
  const rounded = Math.round(value);
  const body = Math.abs(rounded).toLocaleString('en-AU');
  return `${rounded < 0 ? '-' : ''}A$${body}`;
}

function listingMoney(value: number, currency: 'AUD' | 'USD'): string {
  const body = value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'AUD' ? `A$${body}` : `US$${body}`;
}

function px(value: number): string {
  return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percentFromFraction(value: number): string {
  const pct = Math.abs(value) * 100;
  const digits = pct >= 10 || Math.abs(pct - Math.round(pct)) < 0.05 ? 0 : 1;
  return `${pct.toFixed(digits)}%`;
}

function signedPct(value: number): string {
  const pct = value * 100;
  const body = `${Math.abs(pct).toFixed(2)}%`;
  if (pct > 0.0005) return `+${body}`;
  if (pct < -0.0005) return `−${body}`;
  return '0.00%';
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!month || !day) return iso;
  return `${day} ${months[month - 1]}`;
}

function dayOrMissing(iso: string | null | undefined): string {
  if (!iso) return 'not on this read';
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? plainDate(day) : 'not on this read';
}

export function sydneyZoneName(date: Date): 'AEDT' | 'AEST' | string {
  const offset = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  if (offset.includes('+11')) return 'AEDT';
  if (offset.includes('+10')) return 'AEST';
  return offset || 'Sydney';
}

/** Wall-clock time in Australia/Sydney, for example "Tue 24 Nov, 9:45 AM AEDT". */
export function formatSydney(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = String(Number(get('hour')));
  const period = get('dayPeriod').toUpperCase();
  return `${get('weekday')} ${get('day')} ${get('month')}, ${hour}:${get('minute')} ${period} ${sydneyZoneName(date)}`;
}

/** Interpret a calendar date and clock time in a named zone. */
export function zonedInstant(isoDate: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]));
  const hourPart = parts.hour === '24' ? '0' : parts.hour;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(hourPart), Number(parts.minute), Number(parts.second));
  return new Date(utcGuess - (asUtc - utcGuess));
}

function nextWeekdayAfter(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * When the owner should have the limit in.
 * ASX: 4:10 PM Sydney on the action date (just after the 4:00 PM close).
 * US: 4:00 PM New York on that date, shown in Sydney. In November that is 8:00 AM the next morning.
 */
export function placeByLabel(actionDate: string, currency: 'AUD' | 'USD'): string {
  if (currency === 'AUD') return formatSydney(zonedInstant(actionDate, 16, 10, 'Australia/Sydney'));
  return formatSydney(zonedInstant(actionDate, 16, 0, 'America/New_York'));
}

/** Next 22:45 UTC Monday–Friday druck job, which is 9:45 AM the next morning in Sydney during AEDT. */
export function nextDruckRun(now: Date): Date {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22, 45, 0);
  for (let i = 0; i < 8; i += 1) {
    const slot = new Date(start + i * 86_400_000);
    const dow = slot.getUTCDay();
    if (dow >= 1 && dow <= 5 && slot.getTime() > now.getTime()) return slot;
  }
  return new Date(start + 8 * 86_400_000);
}

function closeOn(bars: ClosePoint[], date: string): number | null {
  let found: number | null = null;
  for (const bar of bars) {
    if (bar.date <= date && bar.close > 0) found = bar.close;
  }
  return found;
}

function wholeShares(audAmount: number, priceAud: number): number {
  if (!(audAmount > 0) || !(priceAud > 0)) return 0;
  return Math.floor(audAmount / priceAud + 1e-9);
}

function costLocal(name: DruckNameState, position: DruckPosition | undefined): number | null {
  const fromBook = position && position.avgCostAud > 0 ? position.avgCostAud : null;
  const fromMove = name.vsCost != null && name.priceAud > 0 ? name.priceAud / (1 + name.vsCost) : null;
  const costAud = fromBook ?? fromMove;
  if (costAud == null || !(costAud > 0)) return null;
  if (name.currency === 'AUD') return costAud;
  if (name.priceLocal > 0 && name.priceAud > 0) return costAud * (name.priceLocal / name.priceAud);
  return null;
}

function versus200(premium: number): string {
  return premium >= 0
    ? `${percentFromFraction(premium)} above its 200-day`
    : `${percentFromFraction(premium)} below its 200-day`;
}

function buildLevels(name: DruckNameState, position: DruckPosition | undefined): { levels: LevelCell[]; note: string | null; marker: number } {
  const cost = costLocal(name, position);
  const stopMa = name.ma200 > 0 ? name.ma200 * (1 - DRUCK_STOP_MA) : null;
  const stopCost = cost != null ? cost * (1 - DRUCK_STOP_COST) : null;
  const stops = [stopMa, stopCost].filter((level): level is number => level != null && level > 0);
  const stop = stops.length ? Math.max(...stops) : null;
  const add = cost != null && name.above200 ? cost * (1 + DRUCK_ADD_GAIN) : null;
  const trim = name.ma200 > 0 ? name.ma200 * (1 + DRUCK_TRIM_MA) : null;
  const stopCaption = (() => {
    if (stop == null) return '';
    if (stopCost == null) return '200-day';
    if (stopMa == null) return 'cost';
    if (Math.abs(stopCost - stopMa) < 0.005) return 'cost and 200-day';
    if (stopCost > stopMa) return `cost · 200-day ${px(stopMa)}`;
    return `200-day · cost ${px(stopCost)}`;
  })();
  const levels: LevelCell[] = [
    {
      key: 'stop',
      label: 'Stop',
      text: stop == null ? '—' : px(stop),
      tone: stop == null ? 'muted' : 'coral',
      caption: stopCaption,
      title: 'Sell level. The higher of 20% under our cost and 10% under the 200-day average. The price hits the higher one first.',
    },
    {
      key: 'cost',
      label: 'Cost',
      text: cost == null ? '—' : px(cost),
      tone: cost == null ? 'muted' : 'amber',
      caption: cost == null ? 'after buy' : 'what we paid',
      title: 'Average price paid, in this listing\'s own currency. Blank until the first buy fills.',
    },
    {
      key: 'add',
      label: 'Add',
      text: add == null ? '—' : px(add),
      tone: add == null ? 'muted' : 'emerald',
      caption: add == null ? (cost == null ? 'after buy' : 'needs 200-day') : '15% above cost',
      title: '15% above our cost. An add is allowed only while the price is still above its 200-day average.',
    },
    {
      key: 'trim',
      label: 'Trim',
      text: trim == null ? '—' : px(trim),
      tone: trim == null ? 'muted' : 'emerald',
      caption: trim == null ? '' : 'above average',
      title: '60% above the 200-day average. The rule sells half above this.',
    },
  ];
  const scale = [stop, cost, add, trim, name.priceLocal].filter((level): level is number => level != null && level > 0);
  let marker = 0.5;
  if (scale.length > 0) {
    const min = Math.min(...scale);
    const max = Math.max(...scale);
    const pad = (max - min) * 0.08 || 1;
    const raw = (name.priceLocal - (min - pad)) / ((max + pad) - (min - pad));
    marker = Math.min(0.96, Math.max(0.04, raw));
  }
  const note = cost == null
    ? 'Cost and the add price appear after the first buy. The stop shown is 10% under the 200-day average.'
    : null;
  return { levels, note, marker };
}

function actionTone(call: DruckCall): HoldingCard['actionTone'] {
  if (call === 'Buy' || call === 'Add') return 'buy';
  if (call === 'Trim') return 'trim';
  if (call === 'Sell') return 'sell';
  if (call === 'Hold') return 'hold';
  return 'wait';
}

function orderText(rows: OrderRow[]): string {
  const header = ['Side', 'Ticker', 'Qty', 'Order type', 'Limit price', 'Currency', 'Place by', 'Status', 'TIF'].join('\t');
  const lines = rows.map((row) => [
    row.side,
    row.symbol,
    String(row.qty),
    row.type,
    row.limit.toFixed(2),
    row.currency,
    row.placeBy,
    row.status,
    row.tif,
  ].join('\t'));
  return ['Instructions only. Nothing is sent to a broker.', header, ...lines].join('\n');
}

function comparisonOf(
  weeks: DruckSnapshot[] | undefined,
  qqq: ClosePoint[],
  spy: ClosePoint[],
  bonds: ClosePoint[],
  missing: string[],
): ControlRoomModel['chart'] {
  const filled = [...(weeks ?? [])]
    .filter((week) => week.phase === 'filled' && week.nav > 0 && /^\d{4}-\d{2}-\d{2}$/.test(week.decisionDate))
    .sort((a, b) => a.decisionDate.localeCompare(b.decisionDate));
  const missingNote = missing.length ? `${missing.join(', ')} did not arrive on this read.` : null;
  if (filled.length < 2) {
    return { empty: COMPARISON_EMPTY, points: [], legend: null, note: COMPARISON_NOTE, missing: null };
  }
  const dates = filled.map((week) => week.decisionDate);
  const nav0 = filled[0].nav;
  const mix = walkSixtyForty({ dates, spy, bonds });
  const q0 = closeOn(qqq, dates[0]);
  const points: ChartPoint[] = filled.map((week, index) => {
    const qNow = closeOn(qqq, week.decisionDate);
    return {
      date: week.decisionDate,
      label: shortDate(week.decisionDate),
      book: nav0 > 0 ? week.nav / nav0 - 1 : null,
      mix: mix ? mix.values[index] - 1 : null,
      qqq: q0 && qNow ? (1 - SIXTY_FORTY_ONE_WAY) * (qNow / q0) - 1 : null,
    };
  });
  const last = points[points.length - 1];
  return {
    empty: null,
    points,
    legend: {
      book: last.book == null ? 'Book not priced' : `Book ${signedPct(last.book)}`,
      mix: last.mix == null ? '60/40 not priced' : `60/40 ${signedPct(last.mix)}`,
      qqq: last.qqq == null ? 'QQQ not priced' : `QQQ ${signedPct(last.qqq)}`,
    },
    note: COMPARISON_NOTE,
    missing: missingNote,
  };
}

function checksFor(snapshot: DruckSnapshot): CheckPill[] {
  const read = snapshot.read;
  if (!read) return [];
  const byId = new Map((read.checks ?? []).map((check) => [check.id, check]));
  const liquidityPass = byId.get('liquidity')?.pass ?? read.liquidity >= 0.1;
  const creditPass = byId.get('credit')?.pass ?? read.spreadNow <= read.spreadThen;
  const gap = read.spyMa200 > 0 ? read.spyPrice / read.spyMa200 - 1 : 0;
  const trendPass = byId.get('trend')?.pass ?? gap >= 0;
  const liquiditySign = read.liquidity > 0 ? '+' : '';
  return [
    {
      id: 'liquidity',
      label: `Liquidity ${liquiditySign}${read.liquidity.toFixed(2)}`,
      pass: liquidityPass,
      detail: byId.get('liquidity')?.detail ?? 'Needs +0.10 or more.',
    },
    {
      id: 'credit',
      label: `Spreads ${read.spreadNow.toFixed(2)}% vs ${read.spreadThen.toFixed(2)}%`,
      pass: creditPass,
      detail: byId.get('credit')?.detail ?? 'US high-yield spreads now, against three months ago. Wider than three months ago fails this check.',
    },
    {
      id: 'trend',
      label: trendPass
        ? `S&P 500 ${percentFromFraction(gap)} above its 200-day`
        : `S&P 500 ${percentFromFraction(gap)} below its 200-day`,
      pass: trendPass,
      detail: byId.get('trend')?.detail ?? 'The S&P 500 has to be above its 200-day average.',
    },
  ];
}

function freshState(input: ControlRoomInput, snapshot: DruckSnapshot | null, now: Date): { word: string; tone: ControlRoomModel['freshTone'] } {
  if (!snapshot) return { word: 'No week yet', tone: 'waiting' };
  if (input.outcome === 'feed_failed') return { word: 'Feed down', tone: 'down' };
  const day = snapshot.signalAsOf || snapshot.decisionDate;
  const age = (now.getTime() - Date.parse(`${day}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(age) || age > 12) return { word: 'Prices are old', tone: 'old' };
  return { word: 'Data fresh', tone: 'fresh' };
}

function runLine(input: ControlRoomInput, when: string | null): string {
  const failedStatus = input.status === 'outage' || input.status === 'unconfigured' || input.status === 'missing_schema';
  const failed = failedStatus || input.outcome === 'feed_failed';
  const word = failed
    ? 'failed'
    : input.outcome === 'saved' || input.outcome === 'filled' || input.outcome === 'unchanged'
      ? 'succeeded'
      : input.outcome === 'waiting'
        ? 'waiting'
        : 'not run yet';
  return when ? `${word} · ${when}` : word;
}

function holdingAction(
  name: DruckNameState,
  shares: number,
  dollars: number,
  pause: boolean,
): string {
  if (pause && (name.call === 'Buy' || name.call === 'Add')) return 'Waiting. The feed is down, so this buy is not sent.';
  if (pause && (name.call === 'Sell' || name.call === 'Trim')) return 'Hold. A sell is not forced while a feed is down.';
  if (name.call === 'Hold') return 'Hold';
  if (name.call === 'Buy' || name.call === 'Add') {
    const verb = name.call === 'Buy' ? 'Buy' : 'Add';
    const count = shares > 0 ? `${shares} share${shares === 1 ? '' : 's'}` : 'under 1 share';
    return `${verb} ${audDollars(dollars)} · ${count}`;
  }
  if (name.call === 'Trim') return shares > 0 ? `Trim · sell ${shares} share${shares === 1 ? '' : 's'}` : 'Trim';
  if (name.call === 'Sell') return shares > 0 ? `Sell · ${shares} share${shares === 1 ? '' : 's'}` : 'Sell';
  return name.note ?? `Do not buy ${name.symbol}.`;
}

export function toControlRoom(input: ControlRoomInput): ControlRoomModel {
  const now = input.now ?? new Date();
  const nextRun = formatSydney(nextDruckRun(now));
  const paperRule = input.paperRule ?? DRUCK_PAPER_RULE;
  const about = [DRUCK_FROZEN, cashYieldSentence(), RULES_NOTE];
  const chart = comparisonOf(input.weeks, input.qqq ?? [], input.spy ?? [], input.bonds ?? [], input.benchmarkMissing ?? []);
  const attempted = input.attemptedAt ?? input.snapshot?.fetchedAt ?? null;
  const attemptedLabel = attempted && !Number.isNaN(Date.parse(attempted)) ? formatSydney(new Date(attempted)) : null;
  const baseFresh: FreshLine[] = [
    { label: 'Prices', value: dayOrMissing(input.snapshot?.signalAsOf ?? input.snapshot?.decisionDate) },
    { label: 'Australian dollar rate', value: dayOrMissing(input.snapshot?.fxDate) },
    { label: 'Liquidity score', value: dayOrMissing(input.liquidityAsOf) },
    { label: 'High-yield spread', value: dayOrMissing(input.spreadAsOf) },
    { label: 'Last run', value: runLine(input, attemptedLabel) },
  ];
  const shell = {
    nextRun,
    paperRule,
    about,
    chart,
    record: chart.points.length > 0 ? input.record ?? null : null,
    orderNote: ORDER_NOTE,
    freshness: baseFresh,
  };

  const snapshot = input.snapshot;
  const ready = input.status === 'ok' && snapshot && Array.isArray(snapshot.names) && snapshot.names.length > 0;
  if (!ready || !snapshot) {
    const fresh = freshState(input, null, now);
    return {
      ...shell,
      status: input.status === 'ok' ? 'empty' : input.status,
      banner: input.banner,
      colour: null,
      colourWord: null,
      headlineWait: true,
      invested: 0,
      investedLabel: null,
      sharesLabel: null,
      brake: null,
      skipped: null,
      checks: [],
      freshWord: fresh.word,
      freshTone: fresh.tone,
      cards: [],
      watch: [],
      cash: null,
      orders: [],
      ordersEmpty: 'No orders until a week is saved.',
      orderText: '',
    };
  }

  const pause = input.outcome === 'feed_failed';
  const positions = new Map(snapshot.positions.map((position) => [position.id, position]));
  const themeUse = new Map<string, number>();
  for (const name of snapshot.names) {
    themeUse.set(name.theme, (themeUse.get(name.theme) ?? 0) + Math.max(0, name.targetWeight));
  }
  const actionDate = snapshot.actionDate && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.actionDate)
    ? snapshot.actionDate
    : nextWeekdayAfter(snapshot.decisionDate);
  const cards: HoldingCard[] = [];
  const watch: WatchChip[] = [];
  const orders: OrderRow[] = [];

  for (const name of snapshot.names) {
    const position = positions.get(name.id);
    const isCard = name.targetWeight > 0.005 || name.heldWeight > 0.005 || name.heldAud > 1 || name.targetAud > 1
      || name.call === 'Buy' || name.call === 'Add' || name.call === 'Hold' || name.call === 'Trim' || name.call === 'Sell';
    if (!isCard) {
      watch.push({
        symbol: name.symbol,
        name: name.name,
        text: versus200(name.premium),
        below: name.premium < 0 || name.above200 === false,
      });
      continue;
    }
    const deltaAud = name.targetAud - name.heldAud;
    const heldShares = position && position.qty > 0
      ? Math.floor(position.qty + 1e-9)
      : wholeShares(name.heldAud, name.priceAud);
    let shares = 0;
    let side: 'BUY' | 'SELL' | null = null;
    if (deltaAud > 1) {
      shares = wholeShares(deltaAud, name.priceAud);
      side = 'BUY';
    } else if (deltaAud < -1) {
      const wanted = wholeShares(Math.abs(deltaAud), name.priceAud);
      shares = name.targetWeight <= 0.0005 ? heldShares : Math.min(heldShares, wanted);
      side = 'SELL';
    }
    const dollars = side === 'BUY' ? deltaAud : Math.abs(deltaAud);
    const { levels, note, marker } = buildLevels(name, position);
    const used = themeUse.get(name.theme) ?? 0;
    cards.push({
      id: name.id,
      symbol: name.symbol,
      name: name.name,
      weight: name.targetWeight,
      weightLabel: bookPercent(name.targetWeight),
      action: holdingAction(name, shares, dollars, pause),
      actionTone: pause && (name.call === 'Buy' || name.call === 'Add' || name.call === 'Sell' || name.call === 'Trim')
        ? 'wait'
        : actionTone(name.call),
      priceLabel: listingMoney(name.priceLocal, name.currency),
      versus200: versus200(name.premium),
      marker,
      levels,
      levelsNote: note,
      themeText: `${name.themeLabel} ${bookPercent(used)} of the ${bookPercent(DRUCK_THEME_MAX)} theme cap`,
      themeHot: used > DRUCK_THEME_MAX + 1e-9,
    });
    if (!pause && side && shares > 0) {
      const limit = Math.round(name.priceLocal * 100) / 100;
      orders.push({
        side,
        symbol: name.symbol,
        qty: shares,
        type: 'LMT',
        limit,
        limitLabel: listingMoney(limit, name.currency),
        currency: name.currency,
        placeBy: placeByLabel(actionDate, name.currency),
        status: 'Not sent',
        tif: 'DAY',
      });
    }
  }

  const invested = snapshot.names.reduce((sum, name) => sum + Math.max(0, name.targetWeight), 0);
  const investedAud = snapshot.names.reduce((sum, name) => sum + Math.max(0, name.targetAud), 0);
  const cashWeight = snapshot.equityAud > 0 ? snapshot.targetCashAud / snapshot.equityAud : 0;
  const fresh = freshState(input, snapshot, now);
  const colourWord = snapshot.colour === 'green' ? 'GREEN' : snapshot.colour === 'amber' ? 'AMBER' : 'RED';

  return {
    ...shell,
    status: 'ready',
    banner: pause ? input.banner : null,
    colour: snapshot.colour,
    colourWord,
    headlineWait: false,
    invested,
    investedLabel: bookPercent(invested),
    sharesLabel: `${audDollars(investedAud)} in shares`,
    brake: snapshot.brakeOn
      ? 'The book is 15% or more below its peak, so the cap stays at 25% until the read is Green again.'
      : null,
    skipped: snapshot.skippedFill
      ? `The ${plainDate(snapshot.skippedFill)} trades were not sent. The next close was missing, so they were not forced through late.`
      : null,
    checks: checksFor(snapshot),
    freshWord: fresh.word,
    freshTone: fresh.tone,
    cards,
    watch,
    cash: {
      symbol: DRUCK_CASH_SYMBOL,
      weight: cashWeight,
      weightLabel: bookPercent(cashWeight),
      amountLabel: audDollars(snapshot.targetCashAud),
      caption: snapshot.phase === 'filled' ? 'In AAA.AX' : 'Buying power after these orders',
      priceLabel: snapshot.aaaPrice ? `Last price ${listingMoney(snapshot.aaaPrice, 'AUD')}` : null,
      untilFill: snapshot.phase === 'pending' && Math.abs(snapshot.cashAud - snapshot.targetCashAud) > 1
        ? `${audDollars(snapshot.cashAud)} is in the account until the orders fill.`
        : null,
    },
    orders,
    ordersEmpty: pause
      ? 'No orders. A feed is down, so nothing is sent.'
      : 'No orders this week.',
    orderText: orders.length ? orderText(orders) : '',
  };
}
