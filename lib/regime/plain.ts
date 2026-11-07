import { THRESHOLDS, type ComponentId } from './constants';
import { DIP_LABEL } from './dip';
import type { GateCheck } from './gates';

export interface PlainGate {
  id: string;
  pass: boolean;
  detail: string;
}

export interface PlainLine {
  symbol: string;
  name: string;
  role: 'tactical' | 'systematic' | 'cash';
  weight: number;
  verdict?: string;
  gates: PlainGate[];
}

export interface PlainTheme {
  id: string;
  label: string;
  on: boolean;
  lines: { weight: number }[];
}

const CASH = new Set(['SHY', 'AAA.AX', 'BILL.AX']);
const BONDS = new Set(['IEF', 'VAF.AX', 'TLT']);
const DOLLAR = new Set(['UUP']);
const GOLD = new Set(['GLD', 'GOLD.AX']);
const DEFENSIVE = new Set(['XLP', 'XLU', 'XLV', 'XLRE', 'USMV']);

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function plainZ(label: string, z: number | null): string {
  if (z == null || !Number.isFinite(z)) return `${label}: not available`;
  const mag = Math.abs(z);
  let phrase = 'about average';
  if (mag >= 0.15) {
    const degree = mag < 0.75 ? 'slightly ' : mag < 1.5 ? '' : 'very ';
    phrase = `${degree}${z < 0 ? 'tight' : 'supportive'}`.trim();
  }
  const num = `${z > 0 ? '+' : ''}${z.toFixed(2)}`;
  return `${label}: ${phrase} (${num})`;
}

/** Turn "Liquidity z -0.38" into a sentence an owner can read. Numbers stay. */
export function plainDrivers(text: string): string {
  return text.replace(/([A-Za-z][^,]*?) z ([+\-−]?\d+\.\d+|—)/g, (_full, label: string, raw: string) => {
    if (raw === '—') return `${label.trim()}: not available`;
    return plainZ(label.trim(), Number(raw.replace('−', '-')));
  });
}

export function dipDisplay(input: { fact: string; sized: boolean; failure: string | null }): string {
  if (input.sized) return `${DIP_LABEL}. ${input.fact}`;
  const why = (input.failure ?? 'a checklist item failed').replace(/\.$/, '');
  return `Dip spotted — blocked: ${why}. ${input.fact}`;
}

/** Theme is on, and the first thing in the way is the regime. Price and the other checks are not the blocker. */
export function waitingOnRegime(lines: PlainLine[]): PlainLine[] {
  return lines.filter((line) => {
    const theme = line.gates.find((gate) => gate.id === 'theme');
    const first = line.gates.find((gate) => !gate.pass);
    return Boolean(theme?.pass)
      && !theme?.detail.startsWith('No theme')
      && first?.id === 'regime'
      && !(line.weight > 0);
  });
}

export function regimeWaitCopy(input: {
  action: 'risk_budget_open' | 'do_nothing' | 'reduce_risk';
  actionable: boolean;
  weak: boolean;
  regimeLabel: string;
}): string {
  const band = THRESHOLDS.weakAbsComposite;
  if (!input.actionable) {
    return `A core data series is missing or stale, so nothing new is bought. The market score needs fresh data and a Risk-On reading above +${band} before these become buys.`;
  }
  if (input.action === 'reduce_risk') {
    return `The regime is ${input.regimeLabel}, so new buys are off. The market score needs to recover into Risk-On, above +${band}, before these can be sized.`;
  }
  return `The market score needs to move above +${band} into Risk-On. A Transitional label, or a score still within ${band} of zero, keeps the buy window shut. Liquidity also has to stay easy.`;
}

function themeWatchName(id: string, label: string): string {
  if (id === 'crypto') return 'crypto';
  if (id === 'scarcity') return 'gold';
  if (id === 'ai-infrastructure') return 'AI infrastructure';
  return label;
}

function holdPhrase(lines: PlainLine[]): string {
  const sized = lines.filter((line) => line.weight > 0);
  const bits: string[] = [];
  if (sized.some((line) => line.role === 'cash' || CASH.has(line.symbol))) bits.push('cash and T-bills');
  if (sized.some((line) => DOLLAR.has(line.symbol))) bits.push('the US dollar');
  if (sized.some((line) => BONDS.has(line.symbol))) bits.push('bonds');
  if (sized.some((line) => DEFENSIVE.has(line.symbol))) bits.push('defensive shares');
  if (sized.some((line) => GOLD.has(line.symbol))) bits.push('gold');
  for (const line of sized) {
    if (line.role === 'cash' || CASH.has(line.symbol) || DOLLAR.has(line.symbol) || BONDS.has(line.symbol) || DEFENSIVE.has(line.symbol) || GOLD.has(line.symbol)) continue;
    bits.push(line.name);
  }
  if (bits.length === 0) return 'stay in cash';
  return `hold ${joinAnd(bits)}`;
}

export function todayInOneLine(input: {
  action: 'risk_budget_open' | 'do_nothing' | 'reduce_risk';
  actionable: boolean;
  lines: PlainLine[];
  themes: PlainTheme[];
}): string {
  const lead = !input.actionable || input.action === 'do_nothing'
    ? 'Sit tight'
    : input.action === 'reduce_risk'
      ? 'Cut risk'
      : 'The buy window is open';
  const watching = input.themes.filter((theme) => theme.on && theme.lines.every((line) => !(line.weight > 0)));
  const names = watching.map((theme) => themeWatchName(theme.id, theme.label));
  const watch = names.length === 0
    ? ''
    : ` ${names.length === 1
      ? `${names[0].charAt(0).toUpperCase()}${names[0].slice(1)} is`
      : `${joinAnd(names).charAt(0).toUpperCase()}${joinAnd(names).slice(1)} are`} on watch — waiting for the market score to improve.`;
  return `${lead}: ${holdPhrase(input.lines)}.${watch}`;
}

export function plainBanner(input: {
  action: 'risk_budget_open' | 'do_nothing' | 'reduce_risk';
  actionable: boolean;
  weak: boolean;
  regimeLabel: string;
  blockReason?: string | null;
}): { headline: string; note: string } {
  const band = THRESHOLDS.weakAbsComposite;
  if (!input.actionable) {
    if (input.blockReason) {
      return {
        headline: 'Sit tight. This page does not have a saved, current refresh.',
        note: input.blockReason,
      };
    }
    return {
      headline: 'Sit tight. A core data series is missing or stale, so this is not a day to add risk.',
      note: 'Cash can still be held. The numbers below are the last complete print, not a buy signal.',
    };
  }
  if (input.action === 'reduce_risk') {
    return {
      headline: `Cut risk. The regime is ${input.regimeLabel}. New buys in shares, crypto, and themes are off.`,
      note: 'Cash is preferred. A small defensive holding can remain. This is not a sell ticket.',
    };
  }
  if (input.action === 'do_nothing' && input.weak) {
    return {
      headline: `Sit tight. The market score is in the quiet band (within ${band} of zero). No new share, crypto, or theme buys.`,
      note: `Cash, T-bills, and other defensive holdings can still have a small size. The score has to clear +${band} into Risk-On before those new buys open.`,
    };
  }
  if (input.action === 'do_nothing') {
    return {
      headline: `Sit tight. The regime is ${input.regimeLabel}, so new share, crypto, and theme buys stay off.`,
      note: 'Cash, T-bills, and other defensive holdings can still have a small size. A Transitional reading is not a buy window.',
    };
  }
  return {
    headline: 'The buy window is open. New buys are allowed up to the size limits below. This is not an order.',
    note: 'Each name still has to pass its own checklist. A theme being on is not by itself a buy.',
  };
}

export function stanceWords(printStance: string, mapStance: string): { today: string; usual: string | null } {
  const today = printStance === 'prefer' ? 'Today: consider' : printStance === 'avoid' ? 'Today: avoid' : 'Today: neither';
  if (printStance === mapStance) return { today, usual: null };
  const usual = mapStance === 'prefer' ? 'usual lean is for it' : mapStance === 'avoid' ? 'usual lean is against it' : 'usual lean is neither';
  return { today, usual };
}

export function checklistLines(gates: GateCheck[]): string {
  return gates.map((gate) => `${gate.label} ${gate.pass ? 'pass' : 'fail'} — ${gate.detail}`).join('\n');
}

export function seriesCadence(staleAfterDays: number): string {
  if (staleAfterDays >= 75) return 'monthly release';
  if (staleAfterDays >= 21) return 'weekly';
  return 'daily';
}

interface DatedRow {
  id: string;
  asOf: string | null;
  label?: string;
}

function covered(rows: DatedRow[], id: string): string {
  return rows.find((row) => row.id === id)?.asOf ?? 'not in this download';
}

/**
 * Names the period each leg covers. A blended card must not collapse to the
 * oldest month, or a current daily series looks like the page stopped in that month.
 */
export function componentPeriodNote(id: ComponentId, rows: DatedRow[]): string {
  if (id === 'liquidity') {
    return `Period covered: Fed assets ${covered(rows, 'WALCL')} (weekly), Treasury account ${covered(rows, 'WTREGEN')} (weekly), reverse repo ${covered(rows, 'RRPONTSYD')} (daily).`;
  }
  if (id === 'policy') {
    const policy = rows.find((row) => row.id === 'DFEDTARU' || row.id === 'DFF');
    return `Period covered: 2-year yield ${covered(rows, 'DGS2')} (daily), policy rate ${policy?.asOf ?? 'not in this download'} (daily).`;
  }
  if (id === 'credit') {
    return `Period covered: high-yield spread ${covered(rows, 'BAMLH0A0HYM2')} (daily).`;
  }
  if (id === 'growth') {
    return `Period covered: yield curve ${covered(rows, 'T10Y2Y')} (daily). US leading indicator ${covered(rows, 'USALOLITOAASTSAM')} and Australia leading indicator ${covered(rows, 'AUSLOLITOAASTSAM')} are monthly releases. That date is the month being measured. The download time is the snapshot clock at the top of the page.`;
  }
  if (id === 'ai') {
    return `Period covered: S&P 500 ${covered(rows, 'SPY')}, equal-weight ${covered(rows, 'RSP')}, semiconductors ${covered(rows, 'SMH')} (share prices). Semiconductor production ${covered(rows, 'IPG3344S')} is a monthly release. That date is the newest month published. The download time is the snapshot clock at the top of the page.`;
  }
  const reports = rows.filter((row) => row.id.startsWith('CFTC-'));
  if (reports.length === 0) return 'Period covered: no CFTC report in this download.';
  const listed = reports.map((row) => `${row.label ?? row.id} ${row.asOf ?? 'not in this download'}`).join('; ');
  return `Period covered: ${listed} (weekly reports).`;
}
