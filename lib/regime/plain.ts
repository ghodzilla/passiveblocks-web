import { THRESHOLDS, type ComponentId } from './constants';
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

export function plainZ(label: string, z: number | null): string {
  if (z == null || !Number.isFinite(z)) return `${label}: not available`;
  const mag = Math.abs(z);
  let phrase = 'about average';
  if (mag >= 0.15) {
    const degree = mag < 0.75 ? 'slightly ' : mag < 1.5 ? '' : 'very ';
    phrase = `${degree}${z < 0 ? 'tight' : 'supportive'}`.trim();
  }
  const num = `${z > 0 ? '+' : ''}${z.toFixed(2)}`;
  const rare = mag >= THRESHOLDS.crisisEnter * -1 ? '; rarer than 1 day in 20' : '';
  return `${label}: ${phrase} (${num}${rare})`;
}

const OWNER_DRIVER: Record<string, string> = {
  Liquidity: 'Money in the system',
  Credit: 'Lender nerves',
  'Policy path': 'Interest rates',
  'Growth differential': 'Growth',
  'Positioning extremes': 'Crowded bets',
  'AI capex': 'AI spending',
  'AI capex & concentration': 'AI spending',
};

/** Turn "Liquidity z -0.38" into a sentence an owner can read. Numbers stay. */
export function plainDrivers(text: string): string {
  return text.replace(/([A-Za-z][^,]*?) z ([+\-−]?\d+\.\d+|—)/g, (_full, label: string, raw: string) => {
    const name = OWNER_DRIVER[label.trim()] ?? label.trim();
    if (raw === '—') return `${name}: not available`;
    return plainZ(name, Number(raw.replace('−', '-')));
  });
}

export function dipDisplay(input: { fact: string; sized: boolean; failure: string | null }): string {
  if (input.sized) return `Dip buy. ${input.fact}`;
  const why = (input.failure ?? 'a check failed').replace(/\.$/, '');
  return `Dip, not a buy yet: ${why}. ${input.fact}`;
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

function signed(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function regimeWaitCopy(input: {
  action: 'risk_budget_open' | 'do_nothing' | 'reduce_risk';
  actionable: boolean;
  weak: boolean;
  regimeLabel: string;
  composite?: number | null;
  liquidity?: number | null;
}): string {
  const score = signed(input.composite);
  const liq = signed(input.liquidity);
  const enter = THRESHOLDS.riskOnEnter.toFixed(2);
  const money = THRESHOLDS.riskOnLiquidityMin.toFixed(2);
  const band = THRESHOLDS.weakAbsComposite.toFixed(2);
  return `Buying restarts when the score reaches +${enter} (today ${score}) and money in the system is +${money} or more (today ${liq}). Passing +${band} only ends the no-clear-signal zone; the market is still Mixed, and Mixed doesn't buy.`;
}

export function stanceWords(printStance: string, mapStance: string): { today: string; usual: string | null } {
  const today = printStance === 'prefer' ? 'Allowed today' : 'Not today';
  if (printStance === mapStance) return { today, usual: null };
  if (printStance === 'prefer' && mapStance === 'neutral') {
    return { today, usual: 'Normally neutral; allowed today because it is defensive.' };
  }
  const usual = mapStance === 'prefer' ? 'Usually allowed' : mapStance === 'avoid' ? 'Usually not bought' : 'Normally neutral';
  return { today, usual };
}

export function checklistLines(gates: GateCheck[]): string {
  return gates
    .filter((item) => item.themeState !== 'none')
    .map((item) => `${item.pass ? '✓' : '✕'} ${item.label} — ${item.detail}`)
    .join('\n');
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
