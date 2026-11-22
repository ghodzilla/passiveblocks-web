import { cashYieldSentence } from './cashYield';
import {
  DRUCK_BOOK_ID,
  DRUCK_CANDIDATES,
  DRUCK_CAVEAT,
  DRUCK_COST,
  DRUCK_MAX_POSITIONS,
  DRUCK_MIN_POSITIONS,
  DRUCK_START_AUD,
} from './druck.config';
import {
  plainDate,
  sampleStep,
  type DruckCall,
  type DruckNameState,
  type DruckOutcome,
  type DruckSnapshot,
  type DruckTag,
} from './druck';
import { sharpeRatio } from './improve';
import { DRUCK_PAPER_RULE, SIXTY_FORTY_ONE_WAY, walkSixtyForty } from './judgement';
import { audMoney, bookPercent } from './ownerCopy';

export interface DruckCard {
  id: string;
  symbol: string;
  name: string;
  call: DruckCall;
  sentence: string;
  thesis: string;
  sellIf: string;
  also: string | null;
  weight: string;
  target: string;
  held: string | null;
  price: string;
  checks: { label: string; pass: boolean; detail: string }[];
}

export interface DruckPanelModel {
  status: 'ready' | 'empty' | 'unconfigured' | 'missing_schema' | 'outage';
  outcome: DruckOutcome | 'none';
  banner: string | null;
  lede: string;
  caveat: string;
  colour: string | null;
  colourId: DruckSnapshot['colour'] | null;
  summary: string | null;
  aside: string | null;
  cash: string | null;
  timing: string | null;
  brake: string | null;
  trades: string | null;
  skipped: string | null;
  cards: DruckCard[];
  checks: { label: string; pass: boolean; detail: string }[];
  stats: { label: string; value: string }[];
  mapping: { symbol: string; name: string; weight: string; thesis: string }[];
  rules: string[];
  paperRule: string;
  frozen: string;
  cashYield: string;
  record: string;
  bookId: string;
}

export interface DruckViewInput {
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage' | 'empty';
  snapshot: DruckSnapshot | null;
  banner: string | null;
  outcome: DruckOutcome | null;
  weeks?: DruckSnapshot[];
  qqq?: { date: string; close: number }[];
  spy?: { date: string; close: number }[];
  bonds?: { date: string; close: number }[];
}

export const DRUCK_FROZEN = 'The job does not retune these rules. Change a size only by editing the candidate list after a Duquesne 13F (mid-February, May, August, November).';

const RULES = [
  'Once a week, on Saturday morning in Sydney, after the Friday close in the US. If Friday is a holiday, the last US session of that week. The order is for the next close.',
  'Green means all three are true: the liquidity score on this page is at least +0.10, US high-yield spreads are not wider than three months ago, and the S&P 500 is above its 200-day average. Red means two or more fail. Anything else is Amber.',
  'Green may invest up to 100%. Amber stops at 50%. Red stops at 25%. The rest stays in cash (AAA.AX), which earns 4.85% a year in this book.',
  'If the whole book falls 15% from its peak, the cap drops to the Red level and stays there until the read is Green again.',
  'Three to six positions. A new position starts at no more than 10%. A name below its 200-day average cannot be bought.',
  'Add only after the position is up at least 15% from our cost and still above its 200-day average. The steps are 10%, then 20%, then 25%. One name stops at 25%. One theme stops at 40%. Never average down.',
  'Sell the whole position if it is 20% below our cost, or if it closes the week more than 10% below its 200-day average. If it is more than 60% above that average, sell half.',
  'Long only. No leverage, no shorts, no borrowed money. This is the only book on this page.',
  'A missing price keeps the last saved week. No new buy, and nothing is sold just because a feed is down.',
  `Each buy and each sell costs ${(DRUCK_COST * 100).toFixed(2)}%. US prices are turned into Australian dollars with the same AUDUSD rate the main book uses. You place every order yourself.`,
];

const STATS = [
  { label: 'Top 10 copied, 2013–2026', value: '20.4% a year, worst fall −36%' },
  { label: 'Same list, 2013–2022 only', value: '12.6% a year. Most of the later gain was 2023–2025.' },
  { label: 'What to expect from this book', value: 'About 10–16% a year. Falls of about 20–30% are part of that.' },
  { label: 'Chance of 30% a year for 10 years', value: 'About 3–5%. No tested window got there.' },
];

function pct1(value: number): string {
  const pct = Math.abs(value) * 100;
  const digits = Math.abs(pct - Math.round(pct)) < 0.05 ? 0 : 1;
  return `${pct.toFixed(digits)}%`;
}

function closeOn(bars: { date: string; close: number }[], date: string): number | null {
  let found: number | null = null;
  for (const bar of bars) {
    if (bar.date <= date && bar.close > 0) found = bar.close;
  }
  return found;
}

function storedMarks(weeks: DruckSnapshot[], key: 'qqq' | 'spy' | 'ief'): { date: string; close: number }[] | null {
  const series: { date: string; close: number }[] = [];
  for (const week of weeks) {
    const close = week.benchmarks?.[key];
    const date = week.benchmarks?.date;
    if (typeof close !== 'number' || !(close > 0) || !date) return null;
    series.push({ date, close });
  }
  return series;
}

function signedPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function druckRecordSentence(
  weeks: DruckSnapshot[] | undefined,
  qqq: { date: string; close: number }[] | undefined,
  spy: { date: string; close: number }[] | undefined,
  bonds: { date: string; close: number }[] | undefined,
): string {
  const saved = (weeks ?? []).filter((week) => week.decisionDate);
  if (saved.length === 0) return 'No week is saved yet. The live record starts when the first snapshot is stored.';
  const first = saved[0];
  const last = saved[saved.length - 1];
  const span = `${saved.length} week${saved.length === 1 ? '' : 's'} recorded, ${plainDate(first.decisionDate)} to ${plainDate(last.decisionDate)}.`;
  const valued = saved.filter((week) => week.phase === 'filled' && typeof week.nav === 'number' && week.nav > 0);
  if (valued.length < 2) {
    return `${span} A return against 60/40 and against QQQ needs two filled weeks that store a book value.`;
  }
  const start = valued[0];
  const end = valued[valued.length - 1];
  const book = end.nav / start.nav - 1;
  const storedQqq = storedMarks(valued, 'qqq');
  const storedSpy = storedMarks(valued, 'spy');
  const storedBonds = storedMarks(valued, 'ief');
  const marked = (week: DruckSnapshot, stored: boolean) => (stored && week.benchmarks?.date ? week.benchmarks.date : week.decisionDate);
  const qqqSeries = storedQqq ?? qqq ?? [];
  const spySeries = storedSpy ?? spy ?? [];
  const bondSeries = (storedSpy && storedBonds ? storedBonds : null) ?? bonds ?? [];
  const qqqThen = closeOn(qqqSeries, marked(start, storedQqq != null));
  const qqqNow = closeOn(qqqSeries, marked(end, storedQqq != null));
  const qqqReturn = qqqThen && qqqNow ? (1 - SIXTY_FORTY_ONE_WAY) * (qqqNow / qqqThen) - 1 : null;
  const mixPath = walkSixtyForty({
    dates: valued.map((week) => marked(week, storedSpy != null)),
    spy: spySeries,
    bonds: bondSeries,
  });
  const mix = mixPath ? mixPath.values[mixPath.values.length - 1] - 1 : null;
  const changes: number[] = [];
  for (let i = 1; i < valued.length; i++) {
    const prev = valued[i - 1].nav;
    const next = valued[i].nav;
    if (prev > 0 && next > 0) changes.push(next / prev - 1);
  }
  const sharpe = changes.length >= 8 ? sharpeRatio(changes) : null;
  const versus = [
    `Book ${signedPct(book)}`,
    mix == null ? '60/40 not priced on these dates' : `60/40 ${signedPct(mix)}`,
    qqqReturn == null ? 'QQQ not priced on these dates' : `QQQ ${signedPct(qqqReturn)}`,
  ].join('. ');
  const risk = sharpe == null
    ? 'Not enough weeks for a Sharpe (that starts after 8 weekly changes).'
    : `Book Sharpe ${sharpe.toFixed(2)}. That Sharpe treats each stored week as one step.`;
  return `${span} ${versus}. ${risk}`;
}

function priceLine(name: DruckNameState, fxRate: number | null): string {
  const local = name.currency === 'AUD' ? `A$${name.priceLocal.toFixed(2)}` : `US$${name.priceLocal.toFixed(2)}`;
  const fx = name.currency === 'USD' && fxRate
    ? ` About A$${name.priceAud.toFixed(2)} at ${fxRate.toFixed(4)} US dollars per 1 Australian dollar.`
    : '';
  const gap = name.premium >= 0
    ? `${pct1(name.premium)} above its 200-day average`
    : `${pct1(name.premium)} below its 200-day average`;
  return `${local}, ${gap}.${fx}`;
}

function sentenceFor(name: DruckNameState, phase: DruckSnapshot['phase'], pause: boolean): { call: DruckCall; sentence: string } {
  const weight = bookPercent(name.targetWeight);
  const target = audMoney(name.targetAud);
  const held = audMoney(name.heldAud);
  if (pause && (name.call === 'Buy' || name.call === 'Add')) {
    return { call: 'Wait', sentence: `Would buy ${name.symbol} ${weight} (${target}). The feed is down, so this buy is not sent.` };
  }
  if (pause && name.call === 'Sell') {
    return { call: 'Hold', sentence: `Last call was to sell ${name.symbol} (${held}). That sell is not being forced while a feed is down.` };
  }
  if (pause && name.call === 'Trim') {
    return { call: 'Hold', sentence: `Last call was to trim ${name.symbol} to ${weight}. That trim is not being forced while a feed is down.` };
  }
  if (name.note) return { call: name.call, sentence: `${name.note}` };
  if (name.call === 'Buy') {
    const when = phase === 'pending' ? ' at the next close' : '';
    return { call: 'Buy', sentence: `Buy ${name.symbol} ${weight} (${target})${when}.` };
  }
  if (name.call === 'Add') {
    const when = phase === 'pending' ? ' at the next close' : '';
    return { call: 'Add', sentence: `Add ${name.symbol} to ${weight} (${target})${when}. It is up from our cost and still above its 200-day average.` };
  }
  if (name.call === 'Trim') {
    const why = name.tag === 'trim-extension'
      ? 'It is more than 60% above its 200-day average, so the rule sells half.'
      : 'The invested cap is lower than the shares we hold.';
    return { call: 'Trim', sentence: `Trim ${name.symbol} to ${weight} (${target}). ${why}` };
  }
  if (name.call === 'Sell') {
    const why = name.tag === 'sell-cost'
      ? 'It is 20% or more below our cost.'
      : name.tag === 'sell-trend'
        ? 'It closed more than 10% below its 200-day average.'
        : 'It is off this quarter\'s list.';
    return { call: 'Sell', sentence: `Sell ${name.symbol}. ${why}` };
  }
  if (name.call === 'Hold') return { call: 'Hold', sentence: `Hold ${name.symbol} at ${bookPercent(name.heldWeight)} (${held}).` };
  return { call: 'Wait', sentence: waitSentence(name) };
}

function waitSentence(name: DruckNameState): string {
  const tag: DruckTag = name.tag;
  if (tag === 'wait-trend' || name.above200 === false) {
    const gap = name.premium < 0 ? ` It is ${pct1(name.premium)} below its 200-day average.` : ' It is not above its 200-day average.';
    return `Do not buy ${name.symbol}.${gap}`;
  }
  if (tag === 'wait-size' || !(name.openWeight > 0)) return `Do not buy ${name.symbol}. This quarter's list gives it no size.`;
  if (tag === 'wait-slots') return `Do not buy ${name.symbol}. The book already has ${DRUCK_MAX_POSITIONS} positions.`;
  if (tag === 'wait-cap') return `Do not buy ${name.symbol}. The invested cap is already full.`;
  if (tag === 'sell-cost' || tag === 'sell-trend' || tag === 'sell-list') return `Sold ${name.symbol}. The position is closed.`;
  return `Do not buy ${name.symbol}.`;
}

function cardsFor(snapshot: DruckSnapshot, pause: boolean): DruckCard[] {
  return snapshot.names.map((name) => {
    const shown = sentenceFor(name, snapshot.phase, pause);
    return {
      id: name.id,
      symbol: name.symbol,
      name: name.name,
      call: shown.call,
      sentence: shown.sentence,
      thesis: name.thesis,
      sellIf: name.sellIf,
      also: name.also,
      weight: bookPercent(name.targetWeight),
      target: audMoney(name.targetAud),
      held: name.heldAud > 1 ? audMoney(name.heldAud) : null,
      price: priceLine(name, snapshot.fxRate),
      checks: [
        {
          label: 'Above 200-day',
          pass: name.above200 === true,
          detail: `Price ${name.priceLocal.toFixed(2)} against a 200-day average of ${name.ma200.toFixed(2)}.`,
        },
        {
          label: 'Starter at most 10%',
          pass: name.heldAud > 1 || name.targetWeight <= 0.1 + 1e-9,
          detail: name.heldAud > 1
            ? 'Already held. A new buy cannot start above 10%.'
            : `Opening size ${bookPercent(name.openWeight)}. The cap for a new position is 10%.`,
        },
      ],
    };
  });
}

function summaryOf(cards: DruckCard[], snapshot: DruckSnapshot): { summary: string; aside: string | null } {
  const actions = cards.filter((card) => card.call === 'Buy' || card.call === 'Add' || card.call === 'Trim' || card.call === 'Sell');
  const actionText = actions.length
    ? actions.map((card) => {
      const name = snapshot.names.find((item) => item.id === card.id);
      const weight = name ? bookPercent(name.targetWeight) : card.weight;
      if (card.call === 'Buy') return `Buy ${card.symbol} ${weight}`;
      if (card.call === 'Add') return `Add ${card.symbol} to ${weight}`;
      if (card.call === 'Trim') return `Trim ${card.symbol} to ${weight}`;
      return `Sell ${card.symbol}`;
    }).join('. ')
    : 'No buys or sells this week';
  const cashWeight = snapshot.equityAud > 0 ? snapshot.targetCashAud / snapshot.equityAud : 0;
  const summary = `${actionText}. The other ${bookPercent(cashWeight)} stays in cash (AAA.AX).`;
  const blocked = cards.filter((card) => card.call === 'Wait').map((card) => card.symbol);
  const aside = blocked.length ? `Do not buy ${blocked.join(', ')}.` : null;
  return { summary, aside };
}

function colourLine(snapshot: DruckSnapshot): string {
  const label = snapshot.colour === 'green' ? 'Green' : snapshot.colour === 'amber' ? 'Amber' : 'Red';
  const cap = bookPercent(snapshot.cap);
  return `This week is ${label}. Invest at most ${cap}.`;
}

export function toDruckPanel(input: DruckViewInput): DruckPanelModel {
  const mapping = DRUCK_CANDIDATES.map((candidate) => ({
    symbol: candidate.symbol,
    name: candidate.name,
    weight: candidate.openWeight > 0 ? bookPercent(candidate.openWeight) : '0%',
    thesis: candidate.thesis,
  }));
  const base = {
    caveat: DRUCK_CAVEAT,
    stats: STATS,
    mapping,
    rules: RULES,
    paperRule: DRUCK_PAPER_RULE,
    frozen: DRUCK_FROZEN,
    cashYield: cashYieldSentence(),
    record: druckRecordSentence(input.weeks, input.qqq, input.spy, input.bonds),
    bookId: DRUCK_BOOK_ID,
  };
  if (input.status === 'unconfigured') {
    return {
      ...base,
      status: 'unconfigured',
      outcome: 'none',
      banner: 'No database is configured for this page. Nothing is bought.',
      lede: 'A separate paper book. It waits here until a week can be saved.',
      colour: null,
      colourId: null,
      summary: null,
      aside: null,
      cash: null,
      timing: null,
      brake: null,
      trades: null,
      skipped: null,
      cards: [],
      checks: [],
    };
  }
  if (input.status === 'missing_schema') {
    return {
      ...base,
      status: 'missing_schema',
      outcome: 'none',
      banner: 'The Druckenmiller tables are not in the database yet. Apply db/regime/004_druck_snapshots.sql. Nothing is bought before that.',
      lede: 'A separate paper book. The rules are ready. The save is not.',
      colour: null,
      colourId: null,
      summary: null,
      aside: null,
      cash: null,
      timing: null,
      brake: null,
      trades: null,
      skipped: null,
      cards: [],
      checks: [],
    };
  }
  if (input.status === 'outage') {
    return {
      ...base,
      status: 'outage',
      outcome: 'none',
      banner: 'The saved Druckenmiller week could not be read. Nothing new is bought.',
      lede: 'A separate paper book.',
      colour: null,
      colourId: null,
      summary: null,
      aside: null,
      cash: null,
      timing: null,
      brake: null,
      trades: null,
      skipped: null,
      cards: [],
      checks: [],
    };
  }
  const snapshot = input.snapshot;
  if (!snapshot || !Array.isArray(snapshot.names) || snapshot.names.length === 0) {
    return {
      ...base,
      status: 'empty',
      outcome: input.outcome ?? 'none',
      banner: input.banner ?? 'No week is saved yet. The Saturday check writes one after the US close, once every price has arrived. Nothing is bought before that.',
      lede: `The paper book on this page, starting at ${audMoney(DRUCK_START_AUD)}. Long only, no leverage, no shorts.`,
      colour: null,
      colourId: null,
      summary: null,
      aside: null,
      cash: null,
      timing: null,
      brake: null,
      trades: null,
      skipped: null,
      cards: [],
      checks: [],
    };
  }
  const pause = input.outcome === 'feed_failed';
  const cards = cardsFor(snapshot, pause);
  const { summary, aside } = summaryOf(cards, snapshot);
  const heldCount = snapshot.names.filter((name) => name.targetWeight > 0.005 || name.heldWeight > 0.005).length;
  const timing = snapshot.phase === 'filled' && snapshot.filledOn
    ? `Set after the US close on ${plainDate(snapshot.decisionDate)}. Acted at the close on ${plainDate(snapshot.filledOn)}. ${heldCount} position${heldCount === 1 ? '' : 's'} (the range is ${DRUCK_MIN_POSITIONS} to ${DRUCK_MAX_POSITIONS}).`
    : `Set after the US close on ${plainDate(snapshot.decisionDate)}. Act at the next close. ${heldCount} position${heldCount === 1 ? '' : 's'} (the range is ${DRUCK_MIN_POSITIONS} to ${DRUCK_MAX_POSITIONS}).`;
  const aaa = snapshot.aaaPrice ? ` Last price A$${snapshot.aaaPrice.toFixed(2)}.` : '';
  const cash = pause
    ? `Cash stays at ${audMoney(snapshot.cashAud)}. The feed is down, so the book is not rebalanced.`
    : `Cash (AAA.AX) after this call: ${audMoney(snapshot.targetCashAud)}.${(snapshot.cashInterestAud ?? 0) > 0.5 ? ` Idle cash earned ${audMoney(snapshot.cashInterestAud)} since the previous fill.` : ''}${snapshot.costAud >= 0.5 ? ` Trading cost ${audMoney(snapshot.costAud)}.` : ''}${aaa}`;
  const trades = snapshot.trades.length
    ? `Done: ${snapshot.trades.map((trade) => `${trade.side === 'buy' ? 'bought' : 'sold'} ${audMoney(trade.notionalAud)} of ${trade.symbol}`).join(', ')}.`
    : null;
  return {
    ...base,
    status: 'ready',
    outcome: input.outcome ?? 'saved',
    banner: pause ? input.banner : null,
    lede: `The paper book on this page (${DRUCK_BOOK_ID}), starting at ${audMoney(DRUCK_START_AUD)}. Long only, no leverage, no shorts. Checked on Saturday morning in Sydney, after the Friday close in the US.`,
    colour: colourLine(snapshot),
    colourId: snapshot.colour,
    summary,
    aside,
    cash,
    timing,
    brake: snapshot.brakeOn
      ? 'The book is 15% or more below its peak, so the cap stays at 25% until the read is Green again.'
      : null,
    trades,
    skipped: snapshot.skippedFill
      ? `The ${plainDate(snapshot.skippedFill)} trades were not sent. The next close was missing, so they were not forced through late.`
      : null,
    cards,
    checks: snapshot.read?.checks ?? [],
  };
}

export function sampleDruckPanel(): DruckPanelModel {
  const step = sampleStep();
  const snapshot = step.snapshot;
  return toDruckPanel({
    status: 'ok',
    snapshot,
    banner: step.banner,
    outcome: step.outcome,
    weeks: snapshot ? [snapshot] : [],
  });
}

export function druckCallsMatchBook(snapshot: DruckSnapshot): boolean {
  return snapshot.names.every((name) => {
    if (snapshot.phase === 'filled' && name.call === 'Hold') return true;
    if (snapshot.phase === 'filled' && name.call === 'Wait') return name.targetWeight <= 0.005;
    return true;
  });
}
