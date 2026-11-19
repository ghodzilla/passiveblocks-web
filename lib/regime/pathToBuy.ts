import { THRESHOLDS, type ComponentId } from './constants';
import type { IdeaStatus } from './ideas';
import { DRAWDOWN_HALT } from './sizing';
import { REVERSION_VETO } from './signals';
import type { HistoryPoint } from './types';
import { EXPRESSIONS, expressionFor } from './universe';

/** Trailing z-scores are winsorised at ±3 in `zScoreLatest`. A solo target outside that cannot occur. */
const Z_CAP = 3;
const PUSH_TOLERANCE = 0.02;
const FLAT_CHANGE = 0.005;

export interface DriverInput {
  id: ComponentId;
  title: string;
  z: number | null;
  weight: number;
  included: boolean;
}

export interface DriverPath {
  id: ComponentId;
  title: string;
  z: number | null;
  weight: number;
  /** Signed contribution z × renormalised weight. Null when the piece is missing. */
  push: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  previous: number | null;
  change: number | null;
  role: 'drag' | 'help' | 'flat' | 'missing';
  /**
   * Where this piece's z would have to sit if it alone closed the score gap
   * and every other piece stayed put. Null when that question does not apply.
   */
  soloTarget: number | null;
  /** False when the target sits outside the ±3 cap this model records. */
  soloPossible: boolean | null;
}

export interface MarketPath {
  score: number | null;
  scoreBar: number;
  /** Positive means still short of the buy bar. Zero means the bar is met. Null means the score is missing. */
  scoreGap: number | null;
  scoreCleared: boolean;
  liquidity: number | null;
  liquidityBar: number;
  liquidityGap: number | null;
  liquidityCleared: boolean;
  drivers: DriverPath[];
  sumOfPushes: number | null;
  pushesMatchScore: boolean;
  note: string;
}

export interface CheckLevel {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  /** Honest price or level, when one can be read off the row. */
  level: string | null;
}

export type PathBucket = 'blocked-buy' | 'market' | 'ready' | 'own';

export interface PathNameInput {
  symbol: string;
  name: string;
  role: 'tactical' | 'systematic' | 'cash';
  status: IdeaStatus;
  sleeve: string;
  owned: boolean;
  weight: number;
  gates: { id: string; label: string; pass: boolean; detail: string }[];
  lastClose: number | null;
  ma200: number | null;
  momentum12_1: number | null;
  reversionZ: number | null;
  /** Gross or net cap leaves no room for a new buy of this role. */
  atCap: boolean;
  actionable: boolean;
}

export interface PathRow {
  symbol: string;
  name: string;
  sleeve: string;
  bucket: PathBucket;
  /** Lower is closer to a buy. */
  closeness: number;
  checks: CheckLevel[];
  ownFailures: number;
  sentence: string;
}

export interface NamePaths {
  blockedBuys: PathRow[];
  firstInLine: PathRow[];
  readyWhenSupportive: PathRow[];
  ownChecks: PathRow[];
}

const HISTORY_KEY: Record<ComponentId, keyof HistoryPoint> = {
  liquidity: 'liquidity',
  policy: 'policy',
  credit: 'credit',
  growth: 'growth',
  positioning: 'positioning',
  ai: 'ai',
};

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function previousPrint(history: HistoryPoint[], id: ComponentId, current: number | null): number | null {
  const key = HISTORY_KEY[id];
  const rows = history.filter((point) => finite(point[key] as number | null));
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1][key] as number;
  if (rows.length >= 2 && current != null && Math.abs(last - current) <= FLAT_CHANGE) {
    return rows[rows.length - 2][key] as number;
  }
  if (current != null && Math.abs(last - current) > FLAT_CHANGE) return last;
  if (rows.length >= 2) return rows[rows.length - 2][key] as number;
  return null;
}

export function marketPath(input: {
  composite: number | null;
  liquidity: number | null;
  components: DriverInput[];
  history: HistoryPoint[];
}): MarketPath {
  const score = finite(input.composite) ? input.composite : null;
  const liquidity = finite(input.liquidity) ? input.liquidity : null;
  const scoreGap = score == null ? null : Math.max(0, THRESHOLDS.riskOnEnter - score);
  const liquidityGap = liquidity == null ? null : Math.max(0, THRESHOLDS.riskOnLiquidityMin - liquidity);
  const scoreCleared = scoreGap === 0;
  const liquidityCleared = liquidityGap === 0;

  const drivers: DriverPath[] = input.components.map((component) => {
    const z = component.included && finite(component.z) ? component.z : null;
    const weight = finite(component.weight) ? component.weight : 0;
    const push = z == null || !(weight > 0) ? null : z * weight;
    const previous = previousPrint(input.history, component.id, z);
    const change = z == null || previous == null ? null : z - previous;
    let direction: DriverPath['direction'] = 'unknown';
    if (change != null) {
      if (change > FLAT_CHANGE) direction = 'up';
      else if (change < -FLAT_CHANGE) direction = 'down';
      else direction = 'flat';
    }
    let role: DriverPath['role'] = 'missing';
    if (push != null) {
      if (push < -FLAT_CHANGE) role = 'drag';
      else if (push > FLAT_CHANGE) role = 'help';
      else role = 'flat';
    }
    let soloTarget: number | null = null;
    let soloPossible: boolean | null = null;
    if (role === 'drag' && scoreGap != null && scoreGap > 0 && z != null && weight > 0) {
      soloTarget = z + scoreGap / weight;
      soloPossible = soloTarget <= Z_CAP && soloTarget >= -Z_CAP;
    }
    return {
      id: component.id,
      title: component.title,
      z,
      weight,
      push,
      direction,
      previous,
      change,
      role,
      soloTarget,
      soloPossible,
    };
  });

  const live = drivers.filter((driver) => driver.push != null);
  const sumOfPushes = live.length ? live.reduce((sum, driver) => sum + (driver.push as number), 0) : null;
  const capped = sumOfPushes == null ? null : Math.min(Z_CAP, Math.max(-Z_CAP, sumOfPushes));
  const pushesMatchScore = score == null || capped == null || Math.abs(capped - score) <= PUSH_TOLERANCE;

  const notes: string[] = [];
  if (score == null) notes.push('The score is missing, so the distance to +0.65 is not computed.');
  else if (scoreCleared) notes.push(`The score is already at the +${THRESHOLDS.riskOnEnter.toFixed(2)} buy bar.`);
  else notes.push(`The score is ${signed(scoreGap as number)} short of +${THRESHOLDS.riskOnEnter.toFixed(2)}.`);
  if (liquidity == null) notes.push('Money in the system is missing, so the distance to +0.10 is not computed.');
  else if (liquidityCleared) notes.push(`Money in the system is ${signed(liquidity)} and already clears +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)}.`);
  else notes.push(`Money in the system is ${signed(liquidityGap as number)} short of +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)}.`);
  if (score != null && sumOfPushes != null && !pushesMatchScore) {
    notes.push(`The pieces add to ${signed(sumOfPushes)}. The published score is ${signed(score)}. The distance uses the published score.`);
  }
  const drags = drivers.filter((driver) => driver.role === 'drag');
  if (scoreGap != null && scoreGap > 0 && drags.length === 0 && live.length > 0) {
    notes.push('No piece is pulling the score down. Closing the gap would take the pieces that are already helping to rise further. This page does not guess which one will.');
  }

  return {
    score,
    scoreBar: THRESHOLDS.riskOnEnter,
    scoreGap,
    scoreCleared,
    liquidity,
    liquidityBar: THRESHOLDS.riskOnLiquidityMin,
    liquidityGap,
    liquidityCleared,
    drivers,
    sumOfPushes,
    pushesMatchScore,
    note: notes.join(' '),
  };
}

function quote(symbol: string, value: number): string {
  const prefix = symbol.endsWith('.AX') ? 'A$' : 'US$';
  return `${prefix}${value.toFixed(2)}`;
}

function pct(value: number): string {
  return `${(Math.abs(value) * 100).toFixed(1)}%`;
}

function signedPct(value: number): string {
  const body = `${(value * 100).toFixed(1)}%`;
  return value > 0 ? `+${body}` : body;
}

export function checkLevels(input: {
  symbol: string;
  gates: PathNameInput['gates'];
  lastClose: number | null;
  ma200: number | null;
  momentum12_1: number | null;
  reversionZ: number | null;
  bookEquity: number | null;
  bookPeak: number | null;
  bookCurrency: 'AUD' | null;
}): CheckLevel[] {
  return input.gates.map((gate) => {
    let level: string | null = null;
    if (gate.id === 'trend') {
      if (finite(input.lastClose) && finite(input.ma200)) {
        if (input.lastClose > input.ma200) {
          level = `Last close ${quote(input.symbol, input.lastClose)} is above today's 200-day average of ${quote(input.symbol, input.ma200)}.`;
        } else {
          const below = input.ma200 > 0 ? (input.ma200 - input.lastClose) / input.ma200 : null;
          const gap = below == null ? '' : ` Last close ${quote(input.symbol, input.lastClose)} is ${pct(below)} below.`;
          level = `Needs a close above today's 200-day average of ${quote(input.symbol, input.ma200)}.${gap} The average moves every session, so this is today's gap.`;
        }
      } else if (!gate.pass) {
        level = 'The 200-day average is not on this row, so no price target is shown.';
      }
    } else if (gate.id === 'momentum') {
      const reading = finite(input.momentum12_1)
        ? `Past year ${signedPct(input.momentum12_1)}. `
        : '';
      level = `${reading}Today's price does not move this check. It uses the price a month ago versus a year ago, so no price target is shown.`;
    } else if (gate.id === 'stretch') {
      if (!gate.pass) {
        const reading = finite(input.reversionZ) ? `The last 5 days score ${signed(input.reversionZ, 1)} (a buy needs below +${REVERSION_VETO.toFixed(1)}). ` : '';
        level = `${reading}The price that would clear the spike is not stored on this page.`;
      } else {
        level = 'The last 5 days are not a spike.';
      }
    } else if (gate.id === 'theme') {
      level = gate.pass ? null : 'No price turns a theme on. It follows a written on/off rule.';
    } else if (gate.id === 'regime') {
      level = gate.pass
        ? null
        : `Not a price. The market score needs +${THRESHOLDS.riskOnEnter.toFixed(2)} and money in the system needs +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)}.`;
    } else if (gate.id === 'halt') {
      if (!gate.pass && finite(input.bookPeak) && input.bookCurrency === 'AUD') {
        const resume = input.bookPeak * (1 - DRAWDOWN_HALT);
        level = `New buys resume once the book is back above A$${Math.round(resume).toLocaleString('en-AU')} (10% below the high of A$${Math.round(input.bookPeak).toLocaleString('en-AU')}).`;
      } else if (!gate.pass) {
        level = 'The book is past its loss limit. The level that clears it is not stored on this page.';
      } else {
        level = null;
      }
    }
    return { id: gate.id, label: gate.label, pass: gate.pass, detail: gate.detail, level };
  });
}

const SLEEVE_ORDER = EXPRESSIONS.flatMap((expression) => expression.symbols);

function sleeveRank(symbol: string): number {
  const index = SLEEVE_ORDER.indexOf(symbol);
  return index === -1 ? 1000 : index;
}

function ownGates(gates: PathNameInput['gates']) {
  return gates.filter((gate) => gate.id !== 'regime');
}

/** Higher means further from a buy. Unknown gaps count as further than a measured one. */
export function ownGapScore(input: Pick<PathNameInput, 'gates' | 'lastClose' | 'ma200' | 'momentum12_1' | 'reversionZ'>): number {
  let score = 0;
  for (const gate of ownGates(input.gates)) {
    if (gate.pass) continue;
    if (gate.id === 'trend') {
      if (finite(input.lastClose) && finite(input.ma200) && input.ma200 > 0 && input.lastClose < input.ma200) {
        score += (input.ma200 - input.lastClose) / input.ma200;
      } else score += 1.5;
    } else if (gate.id === 'momentum') {
      if (finite(input.momentum12_1) && input.momentum12_1 <= 0) score += Math.min(1, -input.momentum12_1);
      else score += 1.5;
    } else if (gate.id === 'stretch') {
      if (finite(input.reversionZ) && input.reversionZ >= REVERSION_VETO) {
        score += Math.min(1, (input.reversionZ - REVERSION_VETO) / REVERSION_VETO);
      } else score += 1.5;
    } else score += 1;
  }
  return score;
}

function bucketOf(name: PathNameInput): PathBucket | null {
  if (name.role === 'cash') return null;
  const regime = name.gates.find((gate) => gate.id === 'regime');
  const ownFailed = ownGates(name.gates).filter((gate) => !gate.pass);
  const allPass = name.gates.length > 0 && name.gates.every((gate) => gate.pass);
  const checklistBuy = name.status === 'confirmed';
  const noRoom = name.atCap || !(name.weight > 0);
  if (checklistBuy && (!name.actionable || noRoom)) return 'blocked-buy';
  if (allPass && noRoom && !name.owned) return 'blocked-buy';
  if (name.owned && name.status !== 'confirmed') return null;
  if (name.status === 'hold') return null;
  if (name.status === 'confirmed') return null;
  if (ownFailed.length === 0 && regime && !regime.pass && name.status !== 'avoid') return 'market';
  const opens = expressionFor(name.symbol)?.stance.risk_on === 'prefer';
  if (ownFailed.length === 0 && name.status === 'avoid' && opens) return 'ready';
  return 'own';
}

function rowSentence(name: PathNameInput, bucket: PathBucket, ownFailures: number): string {
  if (bucket === 'blocked-buy') {
    return name.status === 'confirmed'
      ? 'The checklist says buy, but this is not a buy today.'
      : 'Every check passed, but there is no room in the book.';
  }
  if (bucket === 'market') {
    return 'Own checks pass. The market gate is the only thing in the way. First in line once the mood is Supportive.';
  }
  if (bucket === 'ready') {
    return `${name.sleeve} is not bought in today's mood. Its own checks pass, so it would be a buy once the score reaches +${THRESHOLDS.riskOnEnter.toFixed(2)} and the group is allowed again.`;
  }
  const noun = ownFailures === 1 ? 'own check is' : 'own checks are';
  return `${ownFailures} ${noun} in the way${name.status === 'avoid' ? ', and this group is not bought in today\'s mood' : ''}.`;
}

export function classifyNames(input: {
  names: PathNameInput[];
  bookEquity: number | null;
  bookPeak: number | null;
  bookCurrency: 'AUD' | null;
}): NamePaths {
  const rows: PathRow[] = [];
  for (const name of input.names) {
    const bucket = bucketOf(name);
    if (!bucket) continue;
    const ownFailures = ownGates(name.gates).filter((gate) => !gate.pass).length;
    const gap = ownGapScore(name);
    const closeness = bucket === 'blocked-buy' ? -1 : bucket === 'market' ? gap : bucket === 'ready' ? 10 + gap : 20 + ownFailures * 10 + gap;
    rows.push({
      symbol: name.symbol,
      name: name.name,
      sleeve: name.sleeve,
      bucket,
      closeness,
      ownFailures,
      checks: checkLevels({ ...name, bookEquity: input.bookEquity, bookPeak: input.bookPeak, bookCurrency: input.bookCurrency }),
      sentence: rowSentence(name, bucket, ownFailures),
    });
  }
  const byClose = (a: PathRow, b: PathRow) => a.closeness - b.closeness || sleeveRank(a.symbol) - sleeveRank(b.symbol) || a.symbol.localeCompare(b.symbol);
  const take = (bucket: PathBucket) => rows.filter((row) => row.bucket === bucket).sort(byClose);
  return {
    blockedBuys: take('blocked-buy'),
    firstInLine: take('market'),
    readyWhenSupportive: take('ready'),
    ownChecks: take('own'),
  };
}
