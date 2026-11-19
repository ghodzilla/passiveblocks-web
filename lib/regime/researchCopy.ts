import type { EvalPath, SymbolEvaluation } from './evaluate';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ResearchVerdict {
  text: string;
  tone: 'buy' | 'watch' | 'hold' | 'off';
}

/** Ending wealth divided by cash put in. Each deposit in the check is $1. */
export function grewTo(wealth: number | null): string {
  if (wealth == null || !Number.isFinite(wealth)) return 'No ending value';
  return `$1 grew to $${wealth.toFixed(2)}`;
}

/** Peak-to-trough fall of the path's value. The stored figure is a fraction of the peak. */
export function worstFall(drawdown: number | null): string {
  if (drawdown == null || !Number.isFinite(drawdown)) return 'Worst fall not available';
  return `Worst fall ${Math.round(drawdown * 100)}%`;
}

/** Cash still uninvested at the last session, in the same dollars as the deposits. */
export function cashLeft(value: number): string {
  return `Cash left $${value.toFixed(2)}`;
}

/**
 * Trading charges summed in deposit-dollars, not a percentage.
 * The share of money put in is costs / contributed.
 */
export function costsLine(costs: number, contributed: number): string {
  const dollars = `$${costs.toFixed(2)}`;
  if (!(contributed > 0) || !Number.isFinite(costs)) return `Costs ${dollars}`;
  const share = (costs / contributed) * 100;
  const shareText = share < 0.05 ? 'under 0.1%' : `${share.toFixed(1)}%`;
  return `Costs ${dollars} (${shareText} of the money put in)`;
}

/**
 * Sessions with shares held, over sessions that have a saved price.
 * Not calendar days: a holiday with no price is not a session.
 */
export function inMarket(invested: number, sessions: number): string {
  if (!(sessions > 0)) return 'No trading days in this check';
  const pct = Math.round((invested / sessions) * 100);
  return `In the market ${pct}% of trading days (${invested.toLocaleString('en-AU')} of ${sessions.toLocaleString('en-AU')})`;
}

export function researchVerdict(monthly: number | null, tactical: number | null): ResearchVerdict {
  if (monthly == null || tactical == null || !Number.isFinite(monthly) || !Number.isFinite(tactical)) {
    return { text: 'Not enough history to compare.', tone: 'off' };
  }
  if (tactical > monthly) return { text: 'The price rule beat steady monthly investing.', tone: 'buy' };
  if (tactical < monthly) return { text: 'The price rule lagged steady monthly investing.', tone: 'watch' };
  return { text: 'The price rule matched steady monthly investing.', tone: 'hold' };
}

export function researchDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [year, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${Number(day)} ${name} ${year}`;
}

export function priceBasis(totalReturn: SymbolEvaluation['totalReturn']): string {
  if (totalReturn === 'adjusted') return 'Dividends are in the price.';
  if (totalReturn === 'price_only') return 'Dividends are not in the price.';
  return 'It is not recorded whether dividends are in the price.';
}

export function researchSpan(symbol: Pick<SymbolEvaluation, 'firstDate' | 'lastDate' | 'months' | 'totalReturn'>): string {
  const deposits = symbol.months === 1 ? '1 deposit of $1' : `${symbol.months} deposits of $1`;
  return `${researchDate(symbol.firstDate)} to ${researchDate(symbol.lastDate)} · ${deposits} · ${priceBasis(symbol.totalReturn)}`;
}

export function researchPathLines(path: Pick<EvalPath, 'id' | 'wealthPerUnitContributed' | 'maxDrawdown' | 'endCash' | 'costsPaid' | 'contributed' | 'sessionsInvested' | 'sessions'>): string[] {
  const lines = [
    grewTo(path.wealthPerUnitContributed),
    ...(path.maxDrawdown != null && Number.isFinite(path.maxDrawdown) ? [worstFall(path.maxDrawdown)] : []),
    cashLeft(path.endCash),
    costsLine(path.costsPaid, path.contributed),
  ];
  if (path.id === 'tactical_price') lines.push(inMarket(path.sessionsInvested, path.sessions));
  return lines;
}
