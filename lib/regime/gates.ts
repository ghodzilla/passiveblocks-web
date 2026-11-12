import { PRICE_STALE_DAYS, priceIsFresh, type IdeaStatus } from './ideas';
import { REVERSION_VETO, type QuantSignals } from './signals';
import { ADD_AFTER_R, DRAWDOWN_HALT, type PyramidState } from './sizing';
import { ageInDays } from './stats';
import { THRESHOLDS } from './constants';
import type { Stance } from './universe';

export type GateId = 'theme' | 'regime' | 'trend' | 'momentum' | 'stretch' | 'halt';

/** Whether a theme switch is actually on. A defensive lean can pass the gate while the theme is off. */
export type ThemeState = 'none' | 'on' | 'off-allowed' | 'off';

export interface GateCheck {
  id: GateId;
  label: string;
  pass: boolean;
  detail: string;
  themeState?: ThemeState;
}

export interface ThemeGateInput {
  id: string;
  label: string;
  on: boolean;
}

export interface OwnedDisplay {
  entry: number | null;
  stop: number | null;
  currency: 'A$' | 'US$';
}

const LABELS: Record<GateId, string> = {
  theme: 'Theme',
  regime: 'Market mood allows it?',
  trend: 'Price above its 200-day average?',
  momentum: 'Up over the past year?',
  stretch: 'No sudden spike?',
  halt: 'Loss limit clear?',
};

function gate(id: GateId, pass: boolean, detail: string, themeState?: ThemeState): GateCheck {
  return themeState ? { id, label: LABELS[id], pass, detail, themeState } : { id, label: LABELS[id], pass, detail };
}

function healthStatus(health: { id: string; status: string }[] | undefined, id: string): string {
  return health?.find((item) => item.id === id)?.status ?? 'unknown';
}

function quote(symbol: string | undefined, value: number): string {
  const prefix = symbol?.endsWith('.AX') ? 'A$' : 'US$';
  return `${prefix}${value.toFixed(2)}`;
}

function scoreText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function pctBelow(drawdown: number | null | undefined): string {
  if (drawdown == null || !Number.isFinite(drawdown)) return 'the book is not past its loss limit';
  return `book is ${(Math.max(0, drawdown) * 100).toFixed(1)}% below its high (limit ${(DRAWDOWN_HALT * 100).toFixed(0)}%)`;
}

/** Above / Below / Unknown from the same boolean the trend gate uses. */
export function trendWord(above200: boolean | null): 'Above' | 'Below' | 'Unknown' {
  if (above200 == null) return 'Unknown';
  return above200 ? 'Above' : 'Below';
}

export function ideaGates(input: {
  themes: ThemeGateInput[];
  stance: Stance | null;
  /** Used when the symbol is not in the playbook. True only in Risk-On or Transitional while the action is not standing down. */
  regimeOpen: boolean;
  role: 'tactical' | 'systematic' | 'cash';
  signals: QuantSignals;
  today: string;
  health?: { id: string; status: string }[];
  halted: boolean;
  pyramid: PyramidState;
  symbol?: string;
  composite?: number | null;
  drawdown?: number | null;
}): GateCheck[] {
  const themes = input.themes;
  let themeGate: GateCheck;
  if (themes.length === 0) {
    themeGate = gate('theme', true, 'No theme. This holding is not in AI infrastructure, crypto, or scarcity.', 'none');
  } else {
    const ons = themes.filter((theme) => theme.on).map((theme) => theme.label);
    const offs = themes.filter((theme) => !theme.on).map((theme) => theme.label);
    if (ons.length > 0) {
      const offClause = offs.length === 0
        ? ''
        : offs.length === 1
          ? `. The ${offs[0]} theme is off`
          : `. The ${offs.join(' and ')} themes are off`;
      const onClause = ons.length === 1 ? `${ons[0]} is on` : `${ons.join(' and ')} are on`;
      themeGate = gate('theme', true, `${onClause}${offClause}.`, 'on');
    } else if (input.stance === 'prefer') {
      const offClause = offs.length === 1
        ? `The ${offs[0]} theme is off.`
        : `The ${offs.join(' and ')} themes are off.`;
      themeGate = gate(
        'theme',
        true,
        `${offClause} Today’s lean still includes this group, so the theme is not a block.`,
        'off-allowed',
      );
    } else {
      const offClause = offs.length === 1
        ? `the ${offs[0]} theme is off`
        : `the ${offs.join(' and ')} themes are off`;
      themeGate = gate('theme', false, offClause, 'off');
    }
  }

  const todayScore = scoreText(input.composite);
  let regimeGate: GateCheck;
  if (input.stance == null) {
    regimeGate = gate(
      'regime',
      input.regimeOpen,
      input.regimeOpen
        ? 'The market mood is Supportive, so a new buy is allowed.'
        : `the market mood must be Supportive (score +${THRESHOLDS.riskOnEnter.toFixed(2)} or more; today ${todayScore})`,
    );
  } else if (input.stance === 'prefer') {
    regimeGate = gate('regime', true, 'Allowed today (defensive).');
  } else if (input.stance === 'avoid') {
    regimeGate = gate('regime', false, 'on a no-clear-signal day the rules don\'t buy this group');
  } else {
    regimeGate = gate('regime', false, 'Not chosen today — only defensive groups are bought on a no-clear-signal day');
  }

  const cash = input.role === 'cash';
  const fresh = priceIsFresh(input.signals.asOf, input.today);
  const trendRetired = healthStatus(input.health, 'trend') === 'retired';
  const momentumRetired = healthStatus(input.health, 'momentum') === 'retired';
  const stretchRetired = healthStatus(input.health, 'reversion') === 'retired';
  const priceBit = input.signals.lastClose != null && input.signals.ma200 != null
    ? ` (${quote(input.symbol, input.signals.lastClose)} vs ${quote(input.symbol, input.signals.ma200)})`
    : '';

  let trendGate: GateCheck;
  if (!fresh) {
    const age = input.signals.asOf ? ageInDays(input.signals.asOf, input.today) : null;
    const days = age != null && Number.isFinite(age) ? Math.max(0, Math.round(age)) : 'several';
    trendGate = gate('trend', false, `no new price for ${days} days (limit ${PRICE_STALE_DAYS})`);
  } else if (cash) trendGate = gate('trend', true, 'Cash does not need a 200-day uptrend.');
  else if (trendRetired) trendGate = gate('trend', true, 'The 200-day trend signal is retired, so it is not a gate.');
  else if (input.signals.above200 === true) trendGate = gate('trend', true, `Price is above its 200-day average${priceBit}.`);
  else if (input.signals.above200 === false) trendGate = gate('trend', false, `price is below its 200-day average${priceBit}`);
  else trendGate = gate('trend', false, 'the 200-day average is not known');

  let momentumGate: GateCheck;
  if (cash) momentumGate = gate('momentum', true, 'Cash does not need to be up over the past year.');
  else if (momentumRetired) momentumGate = gate('momentum', true, 'The past-year trend is retired, so it is not a gate.');
  else if (input.signals.momentum12_1 != null && input.signals.momentum12_1 > 0) {
    momentumGate = gate('momentum', true, `Up ${(input.signals.momentum12_1 * 100).toFixed(1)}% over the past year.`);
  } else if (input.signals.momentum12_1 == null) momentumGate = gate('momentum', false, 'the past-year trend is not known');
  else momentumGate = gate('momentum', false, 'not up over the past year');

  let stretchGate: GateCheck;
  if (cash) stretchGate = gate('stretch', true, 'Cash is not checked for a sudden spike.');
  else if (stretchRetired) stretchGate = gate('stretch', true, 'The spike check is retired, so it is not a gate.');
  else if (input.signals.reversionZ != null && input.signals.reversionZ < REVERSION_VETO) stretchGate = gate('stretch', true, 'The last 5 days are not a sudden spike.');
  else if (input.signals.reversionZ == null) stretchGate = gate('stretch', false, 'the recent spike check is not known');
  else stretchGate = gate('stretch', false, 'the last 5 days spiked (blocks a buy)');

  if (fresh && !cash && trendRetired && momentumRetired) {
    trendGate = gate('trend', false, '12–1 momentum and the 200-day trend are both retired');
    momentumGate = gate('momentum', false, '12–1 momentum and the 200-day trend are both retired');
  }

  const haltGate = !input.halted || input.pyramid !== 'new'
    ? gate('halt', true, input.halted ? 'The loss limit is on, and this is not a new entry.' : `Yes — ${pctBelow(input.drawdown)}.`)
    : gate('halt', false, 'the book is 10% or more below its high, so new buys are paused');

  return [themeGate, regimeGate, trendGate, momentumGate, stretchGate, haltGate];
}

function themeStateOf(gates: GateCheck[]): ThemeState {
  const theme = gates.find((item) => item.id === 'theme');
  if (theme?.themeState) return theme.themeState;
  if (!theme || theme.detail.startsWith('No theme')) return 'none';
  if (theme.detail.includes('not a block')) return 'off-allowed';
  return theme.pass ? 'on' : 'off';
}

export function verdictFromGates(gates: GateCheck[], stance: Stance | null): string {
  const state = themeStateOf(gates);
  const failed = gates.filter((item) => !item.pass).map((item) => item.detail.replace(/\.$/, ''));
  if (failed.length === 0) {
    if (state === 'on') {
      const theme = gates.find((item) => item.id === 'theme');
      const named = theme?.detail.match(/^(.+?) (?:is|are) on/);
      return named ? `Buy — every check passed. ${named[1]} is on.` : 'Buy — every check passed.';
    }
    return 'Buy — every check passed.';
  }
  if (stance === 'avoid') {
    return 'Avoid — on a no-clear-signal day the rules don\'t buy this group.';
  }
  const noun = failed.length === 1 ? 'thing' : 'things';
  const note = state === 'off-allowed'
    ? ' (The theme is off, but this holding is still allowed as defensive.)'
    : '';
  return `Watch — ${failed.length} ${noun} in the way: ${failed.join(' · ')}.${note}`;
}

function topUpPrice(owned: OwnedDisplay | undefined): string | null {
  if (!owned || owned.entry == null || owned.stop == null) return null;
  if (!(owned.entry > owned.stop)) return null;
  const level = owned.entry + ADD_AFTER_R * (owned.entry - owned.stop);
  return `${owned.currency}${level.toFixed(2)}`;
}

export function sizingVerdict(input: {
  gates: GateCheck[];
  stance: Stance | null;
  pyramid: PyramidState;
  weight: number;
  owned?: OwnedDisplay;
}): { status: IdeaStatus; verdict: string } {
  const failed = input.gates.some((item) => !item.pass);
  const ownedQuiet = (input.pyramid === 'hold' || input.pyramid === 'no-add-loser') && input.stance !== 'avoid';
  if (ownedQuiet && input.pyramid === 'no-add-loser' && !failed) {
    return { status: 'hold', verdict: 'Hold — you own this; it\'s at or below the buy price, so no top-up.' };
  }
  if (ownedQuiet && input.pyramid === 'hold' && !failed) {
    const level = topUpPrice(input.owned);
    return {
      status: 'hold',
      verdict: level
        ? `Hold — you own this. Top up only above ${level}.`
        : 'Hold — you own this. No top-up yet.',
    };
  }
  if (failed) {
    return {
      status: input.stance === 'avoid' ? 'avoid' : 'watch',
      verdict: verdictFromGates(input.gates, input.stance),
    };
  }
  if (!(input.weight > 0)) {
    return { status: 'watch', verdict: 'Watch — passes every check, but the book is at its limit, so there\'s no room.' };
  }
  const verdict = verdictFromGates(input.gates, input.stance);
  if (input.pyramid === 'add') return { status: 'confirmed', verdict: verdict.replace(/^Buy —/, 'Top up —') };
  return { status: 'confirmed', verdict };
}

export function checklistNote(gates: GateCheck[], verdict: string): string {
  const lines = gates
    .filter((item) => item.themeState !== 'none')
    .map((item) => `${item.pass ? '✓' : '✕'} ${item.label} — ${item.detail}`);
  return `${lines.join('\n')}\n${verdict}`;
}
