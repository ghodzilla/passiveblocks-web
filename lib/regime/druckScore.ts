import { DRUCK_CASH_SYMBOL, DRUCK_SPY } from './druck.config';
import { DRUCK_CALLS, type DruckCall, type DruckDecisionCall, type DruckSnapshot } from './druck';
import { FX_SYMBOL, markInAud, type FxBar } from './fx';
import { ageDays, type CloseBar } from './visser';

/** Score a call this many weeks after the decision. */
export const SCORE_HORIZONS = [4, 12] as const;
export type ScoreHorizon = (typeof SCORE_HORIZONS)[number];

/** A bucket with fewer scored calls than this is shown, and marked too small to trust. */
export const SCORE_TRUST = 8;

/** A later close more than this many days after the due date is too far away to use. */
const LATE_CLOSE_DAYS = 10;

const EXIT_ACTIONS = new Set<DruckCall>(['Sell', 'Trim', 'Wait']);

export interface StoredCall {
  decisionDate: string;
  nameId: string;
  symbol: string;
  action: DruckCall;
  priceAud: number;
  priceLocal: number;
}

export interface StoredScore {
  decisionDate: string;
  nameId: string;
  symbol: string;
  action: DruckCall;
  horizonWeeks: ScoreHorizon;
  scoredOn: string;
  nameReturn: number;
  spyReturn: number;
  aaaReturn: number;
  excessSpy: number;
  excessAaa: number;
  hit: boolean;
}

export interface ScorecardRow {
  action: DruckCall;
  horizon: ScoreHorizon;
  count: number;
  hits: number;
  hitRate: number;
  avgExcessSpy: number;
  avgExcessAaa: number;
  trusted: boolean;
}

export interface ScorecardModel {
  title: string;
  empty: string | null;
  rows: {
    action: string;
    horizon: string;
    hitRate: string;
    extraSpy: string;
    extraAaa: string;
    caution: string | null;
  }[];
  footnote: string;
}

const FOOTNOTE = 'A Buy, Add, or Hold is a hit when the name beat SPY. A Sell, Trim, or Wait is a hit when the name lagged SPY. The extra return is that result, also measured against the AAA.AX price. AAA.AX here is the cash fund\'s price change. The 4.85% the book adds to idle cash is separate. Fewer than 8 scores in a row is too few to trust. This does not validate the book.';

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDruckCall(value: string): value is DruckCall {
  return (DRUCK_CALLS as readonly string[]).includes(value);
}

/** Calls as they stood at the decision. A filled week keeps them on decisionCalls. */
export function decisionCallsOf(snapshot: Pick<DruckSnapshot, 'phase' | 'decisionCalls' | 'names'>): DruckDecisionCall[] {
  if (snapshot.decisionCalls && snapshot.decisionCalls.length > 0) {
    return snapshot.decisionCalls.filter((call) => isDruckCall(call.action) && call.priceAud > 0 && call.priceLocal > 0);
  }
  if (snapshot.phase !== 'pending') return [];
  return snapshot.names
    .filter((name) => isDruckCall(name.call) && name.priceAud > 0 && name.priceLocal > 0)
    .map((name) => ({
      id: name.id,
      symbol: name.symbol,
      action: name.call,
      priceAud: name.priceAud,
      priceLocal: name.priceLocal,
    }));
}

/**
 * Extra return of the action.
 * Owning the name (Buy, Add, Hold) earns the name's return minus the benchmark.
 * Selling, trimming, or waiting earns the opposite: the name lagging is a gain.
 */
export function actionExcess(action: DruckCall, nameReturn: number, benchmarkReturn: number): number {
  const nameExcess = nameReturn - benchmarkReturn;
  return EXIT_ACTIONS.has(action) ? -nameExcess : nameExcess;
}

export function actionHit(action: DruckCall, nameReturn: number, spyReturn: number): boolean {
  return actionExcess(action, nameReturn, spyReturn) > 0;
}

function lastBar(bars: readonly CloseBar[], date: string): CloseBar | null {
  let found: CloseBar | null = null;
  for (const bar of bars) {
    if (bar.date <= date && bar.close > 0 && (!found || bar.date >= found.date)) found = bar;
  }
  return found;
}

function firstBar(bars: readonly CloseBar[], date: string): CloseBar | null {
  let found: CloseBar | null = null;
  for (const bar of bars) {
    if (bar.date >= date && bar.close > 0 && (!found || bar.date < found.date)) found = bar;
  }
  return found;
}

function audAt(symbol: string, bar: CloseBar, fx: readonly FxBar[]): number | null {
  const marked = markInAud({ symbol, local: bar.close, priceDate: bar.date, fxBars: fx.slice() });
  return marked ? marked.aud : null;
}

export interface ScoreBook {
  prices: Record<string, readonly CloseBar[]>;
  fx: readonly FxBar[];
}

/**
 * Score one call at one horizon, using only a close on or after the due date.
 * Returns null when that close is not known yet, or when a price is missing.
 * A missing price is not filled in.
 */
export function scoreCall(call: StoredCall, horizon: ScoreHorizon, book: ScoreBook): StoredScore | null {
  const due = addDays(call.decisionDate, horizon * 7);
  const nameBar = firstBar(book.prices[call.symbol] ?? [], due);
  const spyBar = firstBar(book.prices[DRUCK_SPY] ?? [], due);
  const aaaBar = firstBar(book.prices[DRUCK_CASH_SYMBOL] ?? [], due);
  if (!nameBar || !spyBar || !aaaBar) return null;
  if (ageDays(due, nameBar.date) > LATE_CLOSE_DAYS) return null;
  if (ageDays(due, spyBar.date) > LATE_CLOSE_DAYS) return null;
  if (ageDays(due, aaaBar.date) > LATE_CLOSE_DAYS) return null;
  const spyThen = lastBar(book.prices[DRUCK_SPY] ?? [], call.decisionDate);
  const aaaThen = lastBar(book.prices[DRUCK_CASH_SYMBOL] ?? [], call.decisionDate);
  if (!spyThen || !aaaThen) return null;
  if (ageDays(spyThen.date, call.decisionDate) > 7) return null;
  if (ageDays(aaaThen.date, call.decisionDate) > 7) return null;
  const nameLater = audAt(call.symbol, nameBar, book.fx);
  const spyNow = audAt(DRUCK_SPY, spyBar, book.fx);
  const spyWas = audAt(DRUCK_SPY, spyThen, book.fx);
  const aaaNow = audAt(DRUCK_CASH_SYMBOL, aaaBar, book.fx);
  const aaaWas = audAt(DRUCK_CASH_SYMBOL, aaaThen, book.fx);
  if (nameLater == null || spyNow == null || spyWas == null || aaaNow == null || aaaWas == null) return null;
  if (!(call.priceAud > 0) || !(spyWas > 0) || !(aaaWas > 0)) return null;
  const nameReturn = nameLater / call.priceAud - 1;
  const spyReturn = spyNow / spyWas - 1;
  const aaaReturn = aaaNow / aaaWas - 1;
  return {
    decisionDate: call.decisionDate,
    nameId: call.nameId,
    symbol: call.symbol,
    action: call.action,
    horizonWeeks: horizon,
    scoredOn: nameBar.date,
    nameReturn,
    spyReturn,
    aaaReturn,
    excessSpy: actionExcess(call.action, nameReturn, spyReturn),
    excessAaa: actionExcess(call.action, nameReturn, aaaReturn),
    hit: actionHit(call.action, nameReturn, spyReturn),
  };
}

export function scoresDue(calls: readonly StoredCall[], have: readonly StoredScore[], book: ScoreBook): StoredScore[] {
  const done = new Set(have.map((score) => `${score.decisionDate}|${score.nameId}|${score.horizonWeeks}`));
  const out: StoredScore[] = [];
  for (const call of calls) {
    for (const horizon of SCORE_HORIZONS) {
      if (done.has(`${call.decisionDate}|${call.nameId}|${horizon}`)) continue;
      const score = scoreCall(call, horizon, book);
      if (score) out.push(score);
    }
  }
  return out;
}

export function summarizeScores(calls: readonly StoredCall[], scores: readonly StoredScore[]): ScorecardRow[] {
  const rows: ScorecardRow[] = [];
  for (const action of DRUCK_CALLS) {
    for (const horizon of SCORE_HORIZONS) {
      const bucket = scores.filter((score) => score.action === action && score.horizonWeeks === horizon);
      if (bucket.length === 0) continue;
      const hits = bucket.filter((score) => score.hit).length;
      const avg = (pick: (score: StoredScore) => number) => bucket.reduce((sum, score) => sum + pick(score), 0) / bucket.length;
      rows.push({
        action,
        horizon,
        count: bucket.length,
        hits,
        hitRate: hits / bucket.length,
        avgExcessSpy: avg((score) => score.excessSpy),
        avgExcessAaa: avg((score) => score.excessAaa),
        trusted: bucket.length >= SCORE_TRUST,
      });
    }
  }
  return rows;
}

function signedPct(value: number): string {
  const pct = value * 100;
  const body = `${Math.abs(pct).toFixed(1)}%`;
  if (pct > 0.05) return `+${body}`;
  if (pct < -0.05) return `−${body}`;
  return '0.0%';
}

export function presentScorecard(input: {
  status: 'ok' | 'missing_schema' | 'unconfigured' | 'empty';
  calls: readonly StoredCall[];
  scores: readonly StoredScore[];
}): ScorecardModel {
  const title = 'How past calls did';
  if (input.status === 'unconfigured') {
    return {
      title,
      empty: 'No database is configured, so past calls are not saved.',
      rows: [],
      footnote: FOOTNOTE,
    };
  }
  if (input.status === 'missing_schema') {
    return {
      title,
      empty: 'The call history is not in the database yet. Apply db/regime/006_druck_context.sql. Nothing here is invented.',
      rows: [],
      footnote: FOOTNOTE,
    };
  }
  const rows = summarizeScores(input.calls, input.scores);
  if (rows.length === 0) {
    const saved = input.calls.length;
    const empty = saved === 0
      ? 'No call has been scored yet. Each weekly call is saved with the action and the price that day. It is scored after 4 weeks, and again after 12 weeks, against SPY and against just holding AAA.AX.'
      : `${saved} call${saved === 1 ? ' is' : 's are'} saved. None are 4 weeks old yet, so there is no hit rate.`;
    return { title, empty, rows: [], footnote: FOOTNOTE };
  }
  return {
    title,
    empty: null,
    rows: rows.map((row) => ({
      action: row.action,
      horizon: `${row.horizon} weeks`,
      hitRate: `${Math.round(row.hitRate * 100)}% of ${row.count}`,
      extraSpy: signedPct(row.avgExcessSpy),
      extraAaa: signedPct(row.avgExcessAaa),
      caution: row.trusted ? null : 'Too few to trust.',
    })),
    footnote: FOOTNOTE,
  };
}

export function bookFromPrices(prices: Record<string, readonly CloseBar[]>): ScoreBook {
  return { prices, fx: prices[FX_SYMBOL] ?? [] };
}

/** A short history for the fixture preview. Too few rows to trust, on purpose. */
export function sampleScoreHistory(): { calls: StoredCall[]; scores: StoredScore[] } {
  const calls: StoredCall[] = [
    { decisionDate: '2026-08-14', nameId: 'ntra', symbol: 'NTRA', action: 'Buy', priceAud: 300, priceLocal: 195 },
    { decisionDate: '2026-08-14', nameId: 'stx', symbol: 'STX', action: 'Wait', priceAud: 400, priceLocal: 260 },
    { decisionDate: '2026-09-18', nameId: 'amzn', symbol: 'AMZN', action: 'Hold', priceAud: 350, priceLocal: 227 },
  ];
  const scores: StoredScore[] = [
    {
      decisionDate: '2026-08-14', nameId: 'ntra', symbol: 'NTRA', action: 'Buy', horizonWeeks: 4,
      scoredOn: '2026-09-11', nameReturn: 0.08, spyReturn: 0.02, aaaReturn: 0.001,
      excessSpy: 0.06, excessAaa: 0.079, hit: true,
    },
    {
      decisionDate: '2026-08-14', nameId: 'stx', symbol: 'STX', action: 'Wait', horizonWeeks: 4,
      scoredOn: '2026-09-11', nameReturn: -0.04, spyReturn: 0.02, aaaReturn: 0.001,
      excessSpy: 0.06, excessAaa: 0.041, hit: true,
    },
    {
      decisionDate: '2026-09-18', nameId: 'amzn', symbol: 'AMZN', action: 'Hold', horizonWeeks: 4,
      scoredOn: '2026-10-16', nameReturn: -0.03, spyReturn: 0.01, aaaReturn: 0,
      excessSpy: -0.04, excessAaa: -0.03, hit: false,
    },
  ];
  return { calls, scores };
}
