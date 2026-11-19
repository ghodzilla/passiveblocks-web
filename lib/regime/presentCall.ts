import { PRESERVATION_BUDGET, THRESHOLDS, type RegimeId } from './constants';
import type { IdeaStatus } from './ideas';
import { ADD_AFTER_R } from './sizing';

export type CallLabel = 'Buy' | 'Hold' | 'Watch' | 'Avoid' | 'Would buy';
export type CallTone = 'buy' | 'hold' | 'watch' | 'sell' | 'off' | 'caution';

export interface PresentInput {
  status: IdeaStatus;
  verdict: string;
  role: 'tactical' | 'systematic' | 'cash';
  pyramid: 'new' | 'add' | 'hold' | 'no-add-loser';
  weight: number;
  sleeve: string;
  gates: { id: string; pass: boolean; detail: string; themeState?: string }[];
  /** False when every theme on this name is off. Null when the name is in no theme. */
  themeOn: boolean | null;
  themeLabels: string[];
  owned: boolean;
  entry: number | null;
  stop: number | null;
  currency: 'A$' | 'US$';
  actionable: boolean;
  /** No room for a new buy of this role. */
  atCap: boolean;
}

export interface PresentCall {
  label: CallLabel;
  tone: CallTone;
  sentence: string;
  /** Reasons a checklist buy is not a buy today. */
  blockedBy: string[];
  themeOn: boolean | null;
  offLabels: string[];
}

const TONE: Record<CallLabel, CallTone> = {
  Buy: 'buy',
  Hold: 'hold',
  Watch: 'watch',
  Avoid: 'off',
  'Would buy': 'caution',
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** Top-up price from the stored entry and stop. Same sum the engine uses. Null when either price is missing. */
export function topUpLevel(input: { entry: number | null; stop: number | null; currency: 'A$' | 'US$' }): string | null {
  if (!finite(input.entry) || !finite(input.stop)) return null;
  if (!(input.entry > input.stop)) return null;
  const level = input.entry + ADD_AFTER_R * (input.entry - input.stop);
  return `${input.currency}${level.toFixed(2)}`;
}

/**
 * Drop a claim that a theme is on.
 * `labels` are the themes that are actually off. The bare phrase "theme on"
 * is removed only when no theme on this name is on.
 */
export function scrubFalseTheme(text: string, themeOn: boolean | null, labels: string[]): string {
  if (!text) return text;
  let next = themeOn === false ? text.replace(/\btheme on\b/gi, 'the theme is off') : text;
  for (const label of labels) {
    next = next.replaceAll(`${label} is on`, `${label} is off`);
    next = next.replaceAll(`${label} are on`, `${label} are off`);
  }
  return next;
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function holdSentence(input: PresentInput): string {
  const level = topUpLevel(input);
  if (input.pyramid === 'no-add-loser') {
    return level
      ? `Hold — you own this. It is at or below the buy price, so no top-up. A top-up would need ${level}.`
      : 'Hold — you own this. It is at or below the buy price, so no top-up.';
  }
  if (level) return `Hold — you own this. Top up only above ${level}.`;
  if (input.entry == null || input.stop == null) {
    return 'Hold — you own this. The top-up price is not stored on this page.';
  }
  return 'Hold — you own this. No top-up yet.';
}

function avoidSentence(input: PresentInput): string {
  const sleeve = input.sleeve || 'This group';
  const ownFailed = input.gates.filter((gate) => gate.id !== 'regime' && !gate.pass);
  if (ownFailed.length === 0) {
    return `Avoid — ${sleeve} is not bought in this market mood, even though its own checks pass. This is not a failing price. The group can be bought again when the mood is Supportive (score +0.65 or more).`;
  }
  const bits = ownFailed.map((gate) => gate.detail.replace(/\.$/, ''));
  return `Avoid — ${sleeve} is not bought in this market mood. Its own checks are also in the way: ${bits.join(' · ')}.`;
}

function watchSentence(input: PresentInput): string {
  const failed = input.gates.filter((gate) => !gate.pass).map((gate) => gate.detail.replace(/\.$/, ''));
  if (failed.length === 0) {
    return 'Watch — every check passed, but there is no room in the book.';
  }
  const noun = failed.length === 1 ? 'thing' : 'things';
  return `Watch — ${failed.length} ${noun} in the way: ${failed.join(' · ')}.`;
}

/**
 * Display label for one name. Does not change the stored status, the weight, or a gate.
 * Owned names read Hold. A checklist Buy reads "Would buy" when the feed is down or the book is full.
 * Avoid is the sleeve, not a failed price check.
 */
export function presentCall(input: PresentInput): PresentCall {
  const checklistBuy = input.status === 'confirmed';
  const noRoom = input.atCap || !(input.weight > 0);
  const blockedBy: string[] = [];
  if (checklistBuy && !input.actionable) blockedBy.push('data feed failed');
  if (checklistBuy && noRoom) blockedBy.push('at cap');

  let label: CallLabel;
  let sentence: string;
  if (input.role === 'cash') {
    label = 'Hold';
    sentence = 'Hold — cash. You keep it.';
  } else if (checklistBuy && blockedBy.length > 0) {
    label = 'Would buy';
    const held = input.owned ? ' You already hold this.' : '';
    const level = input.owned ? topUpLevel(input) : null;
    const top = level ? ` Top up only above ${level}.` : '';
    sentence = `Would buy, but blocked by: ${joinAnd(blockedBy)}.${held}${top}`;
  } else if (checklistBuy) {
    label = 'Buy';
    sentence = input.pyramid === 'add' ? 'Top up — every check passed.' : 'Buy — every check passed.';
    if (input.themeOn === false && input.themeLabels.length) {
      sentence += ` ${joinAnd(input.themeLabels)} is off. The theme is not what cleared the check.`;
    }
  } else if (input.owned) {
    label = 'Hold';
    sentence = holdSentence(input);
  } else if (input.status === 'avoid') {
    label = 'Avoid';
    sentence = avoidSentence(input);
  } else if (input.status === 'hold') {
    label = 'Hold';
    sentence = holdSentence(input);
  } else {
    label = 'Watch';
    sentence = watchSentence(input);
  }

  if (input.themeOn === false && input.themeLabels.length) {
    const note = `${joinAnd(input.themeLabels)} is off.`;
    if (!sentence.includes(note)) sentence += ` ${note}`;
  }
  sentence = scrubFalseTheme(sentence, input.themeOn, input.themeLabels);
  return {
    label,
    tone: TONE[label],
    sentence,
    blockedBy: label === 'Would buy' ? blockedBy : [],
    themeOn: input.themeOn,
    offLabels: input.themeLabels,
  };
}

export interface RuleCard {
  id: string;
  when: string;
  then: string;
  active: boolean;
}

/** Plain if/then cards. The active card follows the published mood. It does not re-score the market. */
export function marketRuleCards(input: { regime: RegimeId | null; actionable: boolean }): RuleCard[] {
  const buy = THRESHOLDS.riskOnEnter.toFixed(2);
  const money = THRESHOLDS.riskOnLiquidityMin.toFixed(2);
  const cards: RuleCard[] = [
    {
      id: 'feed',
      when: 'A mandatory feed is missing or the refresh did not save',
      then: `Play safe. No new buys until a refresh succeeds. Do not add risk. The limit while the feed is down is ${(PRESERVATION_BUDGET.maxGross * 100).toFixed(0)}% invested and ${(PRESERVATION_BUDGET.maxNet * 100).toFixed(0)}% non-cash. A failed refresh does not sell the held book.`,
      active: !input.actionable,
    },
    {
      id: 'supportive',
      when: `Score is +${buy} or higher, and money in the system is +${money} or higher`,
      then: 'Mood is Supportive. A name can be bought only if its own checks pass and there is room.',
      active: input.actionable && input.regime === 'risk_on',
    },
    {
      id: 'mixed',
      when: `Score is between ${THRESHOLDS.tightEnter.toFixed(2)} and +${buy}`,
      then: 'Mood is Mixed. Hold. Buy nothing new.',
      active: input.actionable && (input.regime === 'transitional' || input.regime == null),
    },
    {
      id: 'cautious',
      when: `Score is ${THRESHOLDS.tightEnter.toFixed(2)} or lower`,
      then: 'Mood is Cautious. Defensive holdings and cash only.',
      active: input.actionable && input.regime === 'tightening',
    },
    {
      id: 'stressed',
      when: `Score is ${THRESHOLDS.crisisEnter.toFixed(2)} or lower, or lenders are badly stressed`,
      then: 'Mood is Stressed. Mostly cash.',
      active: input.actionable && input.regime === 'crisis',
    },
  ];
  return cards;
}

export function presentGateDetail(
  gate: { id: string; detail: string },
  themeOn: boolean | null,
  labels: string[],
): string {
  if (gate.id !== 'theme') return gate.detail;
  return scrubFalseTheme(gate.detail, themeOn, labels);
}
