import { audMoney } from './ownerCopy';
import {
  VISSER_BACKTEST,
  VISSER_CAVEAT,
  VISSER_SLEEVES,
  plainDate,
  sampleStep,
  sleeveCall,
  type VisserCall,
  type VisserOutcome,
  type VisserSnapshot,
  type VisserSleeveState,
} from './visser';

export interface VisserCard {
  id: string;
  label: string;
  buy: string;
  buyName: string;
  signal: string;
  signalName: string;
  call: VisserCall;
  sentence: string;
  weight: string;
  target: string;
  held: string | null;
  bookShare: string;
  checks: { label: string; pass: boolean; detail: string }[];
  distance: string;
  detail: string;
}

export interface VisserPanelModel {
  status: 'ready' | 'empty' | 'unconfigured' | 'missing_schema' | 'outage';
  outcome: VisserOutcome | 'none';
  banner: string | null;
  lede: string;
  caveat: string;
  summary: string | null;
  cash: string | null;
  timing: string | null;
  trades: string | null;
  skipped: string | null;
  shareNote: string | null;
  cards: VisserCard[];
  stats: { label: string; value: string }[];
  audHistory: string;
  mapping: { label: string; weight: string; buy: string; signal: string; why: string }[];
  rules: string[];
}

export interface VisserViewInput {
  status: 'ok' | 'unconfigured' | 'missing_schema' | 'outage' | 'empty';
  snapshot: VisserSnapshot | null;
  banner: string | null;
  outcome: VisserOutcome | null;
  shareNote: string | null;
}

function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function pct1(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function distanceSentence(sleeve: VisserSleeveState): string {
  if (sleeve.price == null || sleeve.ma200 == null || !(sleeve.price > 0) || !(sleeve.ma200 > 0)) {
    return 'The 200-day average is not ready, so there is no distance to show.';
  }
  const toAverage = sleeve.ma200 / sleeve.price - 1;
  const toExtension = (sleeve.ma200 * 1.6) / sleeve.price - 1;
  let toGain: number | null = null;
  if (sleeve.roc50 != null && sleeve.roc50 > -0.999) {
    const past = sleeve.price / (1 + sleeve.roc50);
    toGain = (past * 1.5) / sleeve.price - 1;
  }
  const rises: { move: number; text: string }[] = [];
  const falls: { move: number; text: string }[] = [];
  if (toAverage > 0.0005) rises.push({ move: toAverage, text: `a rise of ${pct1(toAverage)} takes it up through the 200-day average` });
  else if (toAverage < -0.0005) falls.push({ move: -toAverage, text: `a fall of ${pct1(-toAverage)} takes it under the 200-day average` });
  if (toExtension > 0.0005) rises.push({ move: toExtension, text: `a rise of ${pct1(toExtension)} hits the line 60% above the 200-day average` });
  else if (toExtension < -0.0005) falls.push({ move: -toExtension, text: `a fall of ${pct1(-toExtension)} drops it back under the line 60% above the 200-day average` });
  if (toGain != null && toGain > 0.0005) rises.push({ move: toGain, text: `a rise of ${pct1(toGain)} pushes the 50-day gain through 50%` });
  else if (toGain != null && toGain < -0.0005) falls.push({ move: -toGain, text: `a fall of ${pct1(-toGain)} brings the 50-day gain back under 50%` });
  const rising = sleeve.ma20Ago != null && sleeve.ma20Ago > 0
    ? (sleeve.rising
      ? `The 200-day average is ${pct1(sleeve.ma200 / sleeve.ma20Ago - 1)} higher than 20 sessions ago.`
      : `The 200-day average is ${pct1(sleeve.ma20Ago / sleeve.ma200 - 1)} lower than 20 sessions ago, so it has to turn up before a buy.`)
    : '';
  let next = '';
  if (sleeve.above200 === false) {
    next = `It needs a rise of ${pct1(Math.max(0, toAverage))} to clear the 200-day average.`;
  } else if (sleeve.above200 && sleeve.rising === false) {
    next = 'Price is already above the 200-day average. No buy until that average turns up.';
  } else if (sleeve.hot) {
    const closest = falls.sort((a, b) => a.move - b.move)[0];
    next = closest ? `Next change: ${closest.text}.` : 'It is overheated.';
  } else {
    const closest = [...falls, ...rises].sort((a, b) => a.move - b.move)[0];
    next = closest ? `Next change: ${closest.text}.` : 'No nearby line.';
  }
  return [next, rising].filter(Boolean).join(' ');
}

function overheatDetail(sleeve: VisserSleeveState): string {
  const gain = sleeve.roc50 == null
    ? '50-day gain is not ready'
    : `50-day gain is ${pct1(sleeve.roc50)}. Half size starts above 50%`;
  const extension = sleeve.premium == null
    ? 'the gap over the 200-day average is not ready'
    : `the price is ${pct1(sleeve.premium)} above the 200-day average. Half size starts above 60%`;
  return `${gain}. ${extension}.`;
}

function weightLabel(weight: number): string {
  const pctValue = weight * 100;
  const digits = Math.abs(pctValue - Math.round(pctValue)) < 0.05 ? 0 : 1;
  return `${pctValue.toFixed(digits)}%`;
}

function sentence(sleeve: VisserSleeveState, phase: VisserSnapshot['phase'], pause: boolean): { call: VisserCall; sentence: string } {
  const name = `${sleeve.buyName} (${sleeve.buy})`;
  const target = audMoney(sleeve.targetAud);
  const held = audMoney(sleeve.heldAud);
  const weight = weightLabel(sleeve.targetWeight);
  if (pause && sleeve.call === 'Buy') {
    return { call: 'Wait', sentence: `Would buy ${target} of ${name}. The feed is down, so this buy is not sent.` };
  }
  if (pause && sleeve.call === 'Sell') {
    return { call: 'Hold', sentence: `Last call was to sell ${name} (${held}). That sell is not being forced while a feed is down.` };
  }
  if (pause && sleeve.call === 'Trim') {
    return { call: 'Hold', sentence: `Last call was to trim ${name} from ${held} to ${target}. That trim is not being forced while a feed is down.` };
  }
  if (phase === 'pending') {
    if (sleeve.call === 'Buy' && sleeve.heldAud <= 1) return { call: 'Buy', sentence: `Buy ${target} of ${name} at the next close. ${weight} of the sleeve.` };
    if (sleeve.call === 'Buy') return { call: 'Buy', sentence: `Buy more ${name} at the next close, from ${held} to ${target}. ${weight} of the sleeve.` };
    if (sleeve.call === 'Trim') {
      return {
        call: 'Trim',
        sentence: sleeve.hot
          ? `Trim ${name} at the next close, from ${held} to ${target}. It is overheated, so the rule holds half.`
          : `Trim ${name} at the next close, from ${held} to ${target}. ${weight} of the sleeve.`,
      };
    }
    if (sleeve.call === 'Sell') return { call: 'Sell', sentence: `Sell ${name} at the next close. ${held} goes back to cash.` };
    if (sleeve.call === 'Hold') return { call: 'Hold', sentence: `Hold ${held} of ${name}. Already at ${weight} of the sleeve.` };
    return { call: 'Wait', sentence: `Wait. Leave the ${sleeve.label} slice in cash.` };
  }
  if (sleeve.call === 'Hold') return { call: 'Hold', sentence: `Hold ${held} of ${name}. ${weight} of the sleeve.` };
  if (sleeve.call === 'Wait') return { call: 'Wait', sentence: `Wait. The ${sleeve.label} slice is in cash.` };
  if (sleeve.call === 'Buy') return { call: 'Buy', sentence: `Buy ${target} of ${name}. ${weight} of the sleeve.` };
  if (sleeve.call === 'Trim') return { call: 'Trim', sentence: `Trim ${name} from ${held} to ${target}.` };
  return { call: 'Sell', sentence: `Sell ${name}. ${held} is still held.` };
}

function summaryOf(cards: VisserCard[], snapshot: VisserSnapshot): string {
  return cards.map((card) => {
    const sleeve = snapshot.sleeves.find((item) => item.id === card.id);
    const target = sleeve ? audMoney(sleeve.targetAud) : '';
    const held = sleeve ? audMoney(sleeve.heldAud) : '';
    if (card.call === 'Buy') return `Buy ${card.label} ${target}`;
    if (card.call === 'Trim') return `Trim ${card.label} to ${target}`;
    if (card.call === 'Hold') return `Hold ${card.label} ${held}`;
    if (card.call === 'Sell') return `Sell ${card.label} ${held}`;
    return `Wait on ${card.label}`;
  }).join('. ') + '.';
}

function cardsFor(snapshot: VisserSnapshot, pause: boolean): VisserCard[] {
  return snapshot.sleeves.map((sleeve) => {
    const shown = sentence(sleeve, snapshot.phase, pause);
    const weightDigits = Math.abs(sleeve.targetWeight * 100 - Math.round(sleeve.targetWeight * 100)) < 0.05 ? 0 : 1;
    return {
      id: sleeve.id,
      label: sleeve.label,
      buy: sleeve.buy,
      buyName: sleeve.buyName,
      signal: sleeve.signal,
      signalName: sleeve.signalName,
      call: shown.call,
      sentence: shown.sentence,
      weight: `${pct(sleeve.targetWeight, weightDigits)} of the sleeve`,
      target: audMoney(sleeve.targetAud),
      held: Math.abs(sleeve.heldAud - sleeve.targetAud) > 1 ? audMoney(sleeve.heldAud) : null,
      bookShare: `${pct(sleeve.targetWeight * snapshot.share, 1)} of the whole book`,
      checks: [
        {
          label: 'Above 200-day',
          pass: sleeve.above200 === true,
          detail: sleeve.price != null && sleeve.ma200 != null
            ? `Price ${sleeve.price.toFixed(2)} against a 200-day average of ${sleeve.ma200.toFixed(2)}.`
            : 'The 200-day average is not ready.',
        },
        {
          label: '200-day rising',
          pass: sleeve.rising === true,
          detail: sleeve.ma200 != null && sleeve.ma20Ago != null
            ? `The 200-day average is ${sleeve.ma200.toFixed(2)}, against ${sleeve.ma20Ago.toFixed(2)} twenty sessions ago.`
            : 'The twenty-session change in the average is not ready.',
        },
        {
          label: sleeve.hot ? 'Overheated' : 'Not overheated',
          pass: sleeve.hot === false,
          detail: overheatDetail(sleeve),
        },
      ],
      distance: distanceSentence(sleeve),
      detail: `${sleeve.signalName} (${sleeve.signal}) sets the call. The order is ${sleeve.buyName} (${sleeve.buy}).`,
    };
  });
}

const RULES = [
  'Once a week, after the Friday close in the US. If Friday is a holiday, the last US session of that week. The order is for the next close.',
  'A slice is held only when the price is above its 200-day average and that average is higher than it was 20 sessions ago. Otherwise that slice stays in cash.',
  'Half the slice when the 50-day gain is over 50%, or the price is more than 60% above the 200-day average.',
  'Target weights: chips 35%, Nasdaq 15%, bitcoin 20%, gold 20%, silver 10%. Bitcoin never goes above 20%. The weights never add up to more than the sleeve, and the sleeve never borrows.',
  'The sleeve is 15% of the main paper book unless VISSER_SATELLITE_SHARE sets another size from 10% to 20%. It is tracked on its own and does not buy or sell the main book.',
  'A missing price keeps the last saved week. No new buy, and nothing is sold just because a feed is down. The rule does not use FRED.',
];

const STATS = [
  { label: '2005–2026', value: '14.1% a year, worst fall −23% (US dollars)' },
  { label: 'Since 2015', value: '22.3% a year in US dollars, 24.5% a year in Australian dollars' },
  { label: 'Without bitcoin, since 2015', value: '12.9% a year (US dollars)' },
  { label: '2005–2014 only', value: '5.1% a year (US dollars)' },
];

function historyLine(): string {
  return `Same rule in Australian dollars, 2005–2026: ${(VISSER_BACKTEST.audCagr2005 * 100).toFixed(1)}% a year, worst fall ${Math.round(VISSER_BACKTEST.audWorstFall * 100)}%.`;
}

export function toVisserPanel(input: VisserViewInput): VisserPanelModel {
  const mapping = VISSER_SLEEVES.map((sleeve) => ({
    label: sleeve.label,
    weight: pct(sleeve.base),
    buy: `${sleeve.buyName} (${sleeve.buy})`,
    signal: `${sleeve.signalName} (${sleeve.signal})`,
    why: sleeve.why,
  }));
  const base = {
    caveat: VISSER_CAVEAT,
    shareNote: input.shareNote,
    stats: STATS,
    audHistory: historyLine(),
    mapping,
    rules: RULES,
  };
  if (input.status === 'unconfigured') {
    return {
      ...base,
      status: 'unconfigured',
      outcome: 'none',
      banner: 'No database is configured for this page. Nothing is bought.',
      lede: 'The Visser basket is a side sleeve. It waits here until a week can be saved.',
      summary: null,
      cash: null,
      timing: null,
      trades: null,
      skipped: null,
      cards: [],
    };
  }
  if (input.status === 'missing_schema') {
    return {
      ...base,
      status: 'missing_schema',
      outcome: 'none',
      banner: 'The Visser tables are not in the database yet. Apply db/regime/003_visser_snapshots.sql. Nothing is bought before that.',
      lede: 'The Visser basket is a side sleeve. The rules are ready. The save is not.',
      summary: null,
      cash: null,
      timing: null,
      trades: null,
      skipped: null,
      cards: [],
    };
  }
  if (input.status === 'outage') {
    return {
      ...base,
      status: 'outage',
      outcome: 'none',
      banner: 'The saved Visser week could not be read. Nothing new is bought.',
      lede: 'The Visser basket is a side sleeve.',
      summary: null,
      cash: null,
      timing: null,
      trades: null,
      skipped: null,
      cards: [],
    };
  }
  const snapshot = input.snapshot;
  if (!snapshot || !Array.isArray(snapshot.sleeves) || snapshot.sleeves.length === 0) {
    return {
      ...base,
      status: 'empty',
      outcome: input.outcome ?? 'none',
      banner: input.banner ?? 'No week is saved yet. The Friday job writes one after the US close, once every price has arrived. Nothing is bought before that.',
      lede: 'A side sleeve of the main paper book. Checked after the Friday close in the US, and acted at the next close. Long only, no borrowing. The main book is left as it is.',
      summary: null,
      cash: null,
      timing: null,
      trades: null,
      skipped: null,
      cards: [],
    };
  }
  const pause = input.outcome === 'feed_failed';
  const cards = cardsFor(snapshot, pause);
  const shareDigits = Math.abs(snapshot.share * 100 - Math.round(snapshot.share * 100)) < 0.05 ? 0 : 1;
  const basis = snapshot.portfolioBasis === 'paper value'
    ? `${pct(snapshot.share, shareDigits)} of the main paper book (${audMoney(snapshot.budgetAud)} of ${audMoney(snapshot.portfolioAud)})`
    : `${pct(snapshot.share, shareDigits)} of the starting amount (${audMoney(snapshot.budgetAud)} of ${audMoney(snapshot.portfolioAud)}), because the main paper book has no value stored yet`;
  const nextFriday = snapshot.decisionDate
    ? (() => {
      const [year, month, day] = snapshot.decisionDate.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() !== 5) return null;
      date.setUTCDate(date.getUTCDate() + 7);
      return date.toISOString().slice(0, 10);
    })()
    : null;
  const timing = snapshot.phase === 'filled' && snapshot.filledOn
    ? `Set at the US close on ${plainDate(snapshot.decisionDate)}. Acted at the close on ${plainDate(snapshot.filledOn)}.${nextFriday ? ` Next check after the US close on ${plainDate(nextFriday)}.` : ''}`
    : `Set at the US close on ${plainDate(snapshot.decisionDate)}. Act at the next close.${nextFriday ? ` Next check after the US close on ${plainDate(nextFriday)}.` : ' Next check after the next Friday close in the US.'}`;
  const cash = pause
    ? `Cash stays at ${audMoney(snapshot.cashAud)}. The feed is down, so the sleeve is not rebalanced.`
    : `Cash in the sleeve after this call: ${audMoney(snapshot.targetCashAud)}.${Math.abs(snapshot.cashAud - snapshot.targetCashAud) > 1 ? ` Cash now: ${audMoney(snapshot.cashAud)}.` : ''}${snapshot.costAud >= 0.5 ? ` Trading cost ${audMoney(snapshot.costAud)}.` : ''}`;
  const trades = snapshot.trades.length > 0
    ? `Done: ${snapshot.trades.map((trade) => `${trade.side === 'buy' ? 'bought' : 'sold'} ${audMoney(trade.notionalAud)} of ${trade.symbol}`).join(', ')}.`
    : null;
  return {
    ...base,
    status: 'ready',
    outcome: input.outcome ?? 'saved',
    banner: pause ? input.banner : null,
    lede: `A side sleeve, ${basis}. Checked after the Friday close in the US, and acted at the next close. Long only, no borrowing. The main book is left as it is.`,
    summary: summaryOf(cards, snapshot),
    cash,
    timing,
    trades,
    skipped: snapshot.skippedFill
      ? `The ${plainDate(snapshot.skippedFill)} trades were not sent. The next close was missing, so they were not forced through late.`
      : null,
    cards,
  };
}

export function sampleVisserPanel(): VisserPanelModel {
  const step = sampleStep();
  return toVisserPanel({
    status: 'ok',
    snapshot: step.snapshot,
    banner: step.banner,
    outcome: step.outcome,
    shareNote: null,
  });
}

export function visserCallsMatchBook(snapshot: VisserSnapshot): boolean {
  return snapshot.sleeves.every((sleeve) => sleeve.call === sleeveCall(sleeve.heldAud, sleeve.targetAud, snapshot.budgetAud));
}
