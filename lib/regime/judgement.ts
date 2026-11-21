import { cashYieldSentence, CASH_YIELD_ANNUAL } from './cashYield';
import { accrueCash } from './evaluate';
import { sharpeRatio } from './improve';

/** Live paper has to clear this before any real money. */
export const PAPER_MONTHS = 12;
/** The longer test the book is judged on. Real money still waits on the 12-month rule. */
export const JUDGEMENT_YEARS = 5;

export const PAPER_ONLY_RULE =
  'Paper only. No real money until 12 months of this live paper record beats a 60/40 mix after costs, on a risk-adjusted basis (Sharpe).';

export const VISSER_PAPER_RULE =
  'Paper only. No real money in this sleeve until 12 months of its live record beats a 60/40 mix and beats QQQ, after costs, on a risk-adjusted basis (Sharpe).';

export const SIXTY_FORTY_MEANS =
  '60/40 here is 60% the S&P 500 and 40% cash, the mix already used on this page. Cash in that mix earns the rate below. It is not a mix of shares and bonds.';

export interface ClosePoint {
  date: string;
  close: number;
}

export interface MarkPoint {
  date: string;
  equity: number;
}

function calendarDays(left: string, right: string): number {
  const start = Date.parse(`${left}T00:00:00Z`);
  const end = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

function addMonths(iso: string, months: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function closeOnOrBefore(bars: ClosePoint[], date: string): number | null {
  let found: number | null = null;
  for (const bar of bars) {
    if (bar.date <= date && bar.close > 0) found = bar.close;
  }
  return found;
}

function pct(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function ratio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'not enough marks';
  return value.toFixed(2);
}

/**
 * Holding lines that add up to the same invested figure as the cap split.
 * A weight list that does not match that split is scaled. Cash is the cap split's cash.
 */
export function alignedHoldings(input: {
  weights: { symbol: string; weight: number }[];
  invested: number | null;
  cash: number | null;
}): { symbol: string; weight: number }[] {
  const rows = input.weights.filter((row) => row.weight > 0);
  const holdings = rows.filter((row) => row.symbol !== 'CASH');
  const holdingSum = holdings.reduce((sum, row) => sum + row.weight, 0);
  const invested = input.invested != null && input.invested >= 0 ? input.invested : holdingSum;
  const cash = input.cash != null && input.cash >= 0
    ? input.cash
    : Math.max(0, 1 - invested);
  const scale = holdingSum > 0 ? invested / holdingSum : 0;
  return [
    { symbol: 'CASH', weight: cash },
    ...holdings.map((row) => ({ symbol: row.symbol, weight: row.weight * scale })),
  ];
}

export function holdingsDisagree(input: {
  weights: { symbol: string; weight: number }[] | null;
  invested: number | null;
  cash: number | null;
}): boolean {
  if (!input.weights || input.invested == null) return false;
  const invested = input.weights.filter((row) => row.symbol !== 'CASH').reduce((sum, row) => sum + row.weight, 0);
  const cash = input.weights.find((row) => row.symbol === 'CASH')?.weight;
  const investedOff = Math.abs(invested - input.invested) > 0.005;
  const cashOff = cash != null && input.cash != null && Math.abs(cash - input.cash) > 0.005;
  return investedOff || cashOff;
}

/** Daily changes between stored marks. One step per pair of marks, including a weekend gap as one step. */
export function markReturns(marks: MarkPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < marks.length; i++) {
    const prev = marks[i - 1];
    const next = marks[i];
    if (!(prev.equity > 0) || !(next.equity > 0)) continue;
    out.push(next.equity / prev.equity - 1);
  }
  return out;
}

/**
 * 60% S&P 500 and 40% cash over the same mark dates.
 * Cash earns the configured yield across the calendar gap. A missing S&P price returns null.
 */
export function sixtyFortyReturns(marks: MarkPoint[], spy: ClosePoint[]): number[] | null {
  if (marks.length < 2 || spy.length === 0) return null;
  const out: number[] = [];
  for (let i = 1; i < marks.length; i++) {
    const prevDate = marks[i - 1].date;
    const date = marks[i].date;
    const then = closeOnOrBefore(spy, prevDate);
    const now = closeOnOrBefore(spy, date);
    if (!(then != null && then > 0) || !(now != null && now > 0)) return null;
    const days = calendarDays(prevDate, date);
    const cash = accrueCash(1, CASH_YIELD_ANNUAL, days) - 1;
    out.push(0.6 * (now / then - 1) + 0.4 * cash);
  }
  return out;
}

export interface PaperJudgement {
  rule: string;
  means: string;
  cash: string;
  progress: string;
  sharpe: string;
  benchmark: string;
  marks: string;
}

export function paperJudgement(input: {
  capital: number;
  equity: number | null;
  marks: MarkPoint[];
  paperMarks: number | null;
  paperReturn: number | null;
  spy: ClosePoint[];
  now?: string;
}): PaperJudgement {
  const marks = input.marks.filter((mark) => mark.equity > 0);
  const count = marks.length;
  const first = marks[0]?.date ?? null;
  const last = marks[marks.length - 1]?.date ?? null;
  const paperCount = input.paperMarks;
  const countNote = paperCount != null && paperCount !== count
    ? ` The after-cost log has ${paperCount} stored row${paperCount === 1 ? '' : 's'}, which is not the same count as these marks.`
    : '';
  const marksLine = count === 0
    ? 'No daily mark is stored on the share record yet.'
    : `${count} daily mark${count === 1 ? '' : 's'} on the share record${first && last ? `, ${first} to ${last}` : ''}.${countNote}`;

  let progress = 'The share record has no Australian-dollar value yet, so there is no progress to show.';
  if (input.equity != null && input.capital > 0) {
    const change = input.equity / input.capital - 1;
    const due = first ? addMonths(first, PAPER_MONTHS) : null;
    const five = first ? addMonths(first, JUDGEMENT_YEARS * 12) : null;
    const today = input.now ?? last ?? '';
    const yearReady = Boolean(due && today && today >= due);
    const fiveReady = Boolean(five && today && today >= five);
    const after = input.paperReturn == null
      ? ''
      : ` After trading costs, the paper log is ${pct(input.paperReturn)}.`;
    progress = `Up ${pct(change)} from the starting amount, on the share record.${after} ${
      yearReady
        ? 'Twelve months of marks are on the record. Real money still waits on the Sharpe test below.'
        : `Twelve months is not up yet${due ? ` (that date is ${due})` : ''}.`
    } ${fiveReady ? 'Five years of marks are on the record.' : `The five-year test is not complete${five ? ` (that date is ${five})` : ''}.`}`;
  }

  const bookSharpe = count >= 21 ? sharpeRatio(markReturns(marks)) : null;
  const mix = sixtyFortyReturns(marks, input.spy);
  const mixSharpe = mix && mix.length >= 20 ? sharpeRatio(mix) : null;
  let sharpe = 'Not enough marks for a Sharpe. That number starts after 20 changes, which is 21 daily marks.';
  if (count >= 21) {
    sharpe = `Sharpe so far ${ratio(bookSharpe)}, from the share-record marks. This is not the five-year result.`;
  }
  let benchmark = 'The 60/40 Sharpe for these same dates needs an S&P 500 price on each mark. It is not on this page yet.';
  if (mix && count >= 21) {
    const ahead = bookSharpe != null && mixSharpe != null && bookSharpe > mixSharpe;
    benchmark = `60/40 Sharpe over the same marks: ${ratio(mixSharpe)}. ${
      bookSharpe == null || mixSharpe == null
        ? 'One of the two Sharpes is missing, so this is not a pass or a fail.'
        : ahead
          ? 'The paper book is ahead of that mix on this short record. The 12-month rule still applies.'
          : 'The paper book is not ahead of that mix. Real money stays off.'
    }`;
  } else if (mix) {
    benchmark = 'S&P 500 prices cover these marks. The 60/40 Sharpe waits until there are 21 daily marks.';
  }

  return {
    rule: PAPER_ONLY_RULE,
    means: `${SIXTY_FORTY_MEANS} The five-year test is the same comparison. A calm year does not settle it.`,
    cash: cashYieldSentence(),
    progress,
    sharpe,
    benchmark,
    marks: marksLine,
  };
}
