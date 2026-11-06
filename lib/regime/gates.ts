import { priceIsFresh, type IdeaStatus } from './ideas';
import { REVERSION_VETO, type QuantSignals } from './signals';
import type { PyramidState } from './sizing';
import type { Stance } from './universe';

export type GateId = 'theme' | 'regime' | 'trend' | 'momentum' | 'stretch' | 'halt';

export interface GateCheck {
  id: GateId;
  label: string;
  pass: boolean;
  detail: string;
}

export interface ThemeGateInput {
  id: string;
  label: string;
  on: boolean;
}

const LABELS: Record<GateId, string> = {
  theme: 'Theme on?',
  regime: 'Regime allows?',
  trend: 'Above 200d?',
  momentum: '12–1 momentum positive?',
  stretch: 'Not stretched?',
  halt: 'Drawdown halt?',
};

function gate(id: GateId, pass: boolean, detail: string): GateCheck {
  return { id, label: LABELS[id], pass, detail };
}

function healthStatus(health: { id: string; status: string }[] | undefined, id: string): string {
  return health?.find((item) => item.id === id)?.status ?? 'unknown';
}

function themeClause(gates: GateCheck[]): string {
  const theme = gates.find((item) => item.id === 'theme');
  if (!theme) return 'theme on';
  if (theme.detail.startsWith('No theme')) return 'no theme basket';
  return theme.pass ? 'theme on' : 'theme off';
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
}): GateCheck[] {
  const themes = input.themes;
  let themeGate: GateCheck;
  if (themes.length === 0) {
    themeGate = gate('theme', true, 'No theme. This holding is not in AI infrastructure, crypto, or scarcity.');
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
      themeGate = gate('theme', true, `${onClause}${offClause}.`);
    } else if (input.stance === 'prefer') {
      const offClause = offs.length === 1
        ? `The ${offs[0]} theme is off.`
        : `The ${offs.join(' and ')} themes are off.`;
      themeGate = gate('theme', true, `${offClause} Today’s lean still includes this group, so the theme is not a block.`);
    } else {
      const offClause = offs.length === 1
        ? `the ${offs[0]} theme is off.`
        : `the ${offs.join(' and ')} themes are off.`;
      themeGate = gate('theme', false, offClause);
    }
  }

  let regimeGate: GateCheck;
  if (input.stance == null) {
    regimeGate = gate(
      'regime',
      input.regimeOpen,
      input.regimeOpen
        ? 'The market score allows a new buy.'
        : 'the market score does not allow a new buy yet',
    );
  } else if (input.stance === 'prefer') {
    regimeGate = gate('regime', true, 'Today’s lean includes this group.');
  } else if (input.stance === 'avoid') {
    regimeGate = gate('regime', false, 'today’s lean is to avoid this group');
  } else {
    regimeGate = gate('regime', false, 'today’s lean is neither for nor against this group');
  }

  const cash = input.role === 'cash';
  const fresh = priceIsFresh(input.signals.asOf, input.today);
  const trendRetired = healthStatus(input.health, 'trend') === 'retired';
  const momentumRetired = healthStatus(input.health, 'momentum') === 'retired';
  const stretchRetired = healthStatus(input.health, 'reversion') === 'retired';

  let trendGate: GateCheck;
  if (!fresh) trendGate = gate('trend', false, 'the last price is stale');
  else if (cash) trendGate = gate('trend', true, 'Cash does not need a 200-day uptrend.');
  else if (trendRetired) trendGate = gate('trend', true, 'The 200-day trend signal is retired, so it is not a gate.');
  else if (input.signals.above200 === true) trendGate = gate('trend', true, 'Price is above its 200-day average.');
  else if (input.signals.above200 === false) trendGate = gate('trend', false, 'price is below its 200-day average');
  else trendGate = gate('trend', false, 'the 200-day average is not known');

  let momentumGate: GateCheck;
  if (cash) momentumGate = gate('momentum', true, 'Cash does not need positive 12–1 momentum.');
  else if (momentumRetired) momentumGate = gate('momentum', true, '12–1 momentum is retired, so it is not a gate.');
  else if (input.signals.momentum12_1 != null && input.signals.momentum12_1 > 0) momentumGate = gate('momentum', true, '12–1 momentum is positive.');
  else if (input.signals.momentum12_1 == null) momentumGate = gate('momentum', false, '12–1 momentum is not known');
  else momentumGate = gate('momentum', false, '12–1 momentum is not positive');

  let stretchGate: GateCheck;
  if (cash) stretchGate = gate('stretch', true, 'Cash is not checked for a stretched 5-session return.');
  else if (stretchRetired) stretchGate = gate('stretch', true, 'The stretch signal is retired, so it is not a gate.');
  else if (input.signals.reversionZ != null && input.signals.reversionZ < REVERSION_VETO) stretchGate = gate('stretch', true, 'The 5-session return is not stretched.');
  else if (input.signals.reversionZ == null) stretchGate = gate('stretch', false, 'the 5-session stretch is not known');
  else stretchGate = gate('stretch', false, 'the 5-session return is stretched');

  if (fresh && !cash && trendRetired && momentumRetired) {
    trendGate = gate('trend', false, '12–1 momentum and the 200-day trend are both retired');
    momentumGate = gate('momentum', false, '12–1 momentum and the 200-day trend are both retired');
  }

  const haltGate = !input.halted || input.pyramid !== 'new'
    ? gate('halt', true, input.halted ? 'The halt is on, and this is not a new entry.' : 'The drawdown halt is off.')
    : gate('halt', false, 'the paper drawdown halt is on');

  return [themeGate, regimeGate, trendGate, momentumGate, stretchGate, haltGate];
}

export function verdictFromGates(gates: GateCheck[], stance: Stance | null): string {
  const failed = gates.find((item) => !item.pass);
  const clause = themeClause(gates);
  if (!failed) {
    return clause === 'no theme basket'
      ? 'Confirmed. No theme basket, and every gate passed.'
      : 'Confirmed. Theme on, and every other gate passed.';
  }
  if (stance === 'avoid') {
    if (failed.id === 'theme') return `Avoid. ${failed.detail}`;
    return `Avoid. ${clause}, but ${failed.detail}`;
  }
  if (failed.id === 'theme') return `Watching: ${failed.detail}`;
  return `Watching: ${clause}, but ${failed.detail}`;
}

export function sizingVerdict(input: {
  gates: GateCheck[];
  stance: Stance | null;
  pyramid: PyramidState;
  weight: number;
}): { status: IdeaStatus; verdict: string } {
  const failed = input.gates.some((item) => !item.pass);
  if (failed) {
    return {
      status: input.stance === 'avoid' ? 'avoid' : 'watch',
      verdict: verdictFromGates(input.gates, input.stance),
    };
  }
  const clause = themeClause(input.gates);
  if (input.pyramid === 'no-add-loser') {
    return { status: 'watch', verdict: `Watching: ${clause}, but the open paper position is at or below its entry` };
  }
  if (input.pyramid === 'hold') {
    return { status: 'watch', verdict: `Watching: ${clause}, but the position is not yet ahead by the original risk on the trade` };
  }
  if (!(input.weight > 0)) {
    return { status: 'watch', verdict: `Watching: ${clause}, but the budget or a cap leaves the size at zero` };
  }
  return { status: 'confirmed', verdict: verdictFromGates(input.gates, input.stance) };
}

export function checklistNote(gates: GateCheck[], verdict: string): string {
  const lines = gates.map((item) => `${item.label} ${item.pass ? 'pass' : 'fail'} — ${item.detail}`);
  return `${lines.join('\n')}\n${verdict}`;
}
