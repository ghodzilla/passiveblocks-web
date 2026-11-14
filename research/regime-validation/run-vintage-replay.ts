import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WINDOWS } from '../../lib/regime/constants';
import type { PriceBook } from '../../lib/regime/prices';
import { maxDrawdown, walkAudPaper, walkNav } from '../../lib/regime/replay';
import type { PathSummary, VariantResult, VintageReplay } from '../../lib/regime/vintageReplay';
import { ALFRED_SERIES, loadAlfredSeries } from './alfredArchive';
import {
  assessDecision,
  groupSkipReasons,
  lookaheadViolations,
  sourceFromRows,
  type VintageSource,
} from './pointInTime';

const OUT = path.join(process.cwd(), 'research/regime-validation');
const PRICE_FILE = path.join(OUT, 'prices/book.json');
const ALFRED_DIR = path.join(OUT, 'alfred');

interface StoredBook {
  downloadedAt: string;
  symbols: {
    symbol: string;
    bars: { date: string; close: number; high?: number; low?: number }[];
    error: string | null;
    adjusted: boolean | null;
  }[];
}

interface VariantSpec {
  id: string;
  role: 'primary' | 'variant';
  label: string;
  creditSeries: string;
  creditWindow: number;
  /** Set only for the 252-observation research variant. Primary leaves the live window alone. */
  engineCreditWindow: { window: number; min: number } | null;
}

const VARIANTS: VariantSpec[] = [
  {
    id: 'primary_hy_756',
    role: 'primary',
    label: 'Primary: high-yield spread (BAMLH0A0HYM2), 756-observation z-score',
    creditSeries: 'BAMLH0A0HYM2',
    creditWindow: 756,
    engineCreditWindow: null,
  },
  {
    id: 'baa10y_756',
    role: 'variant',
    label: 'Variant: Baa corporate spread (BAA10Y) as a credit stand-in, 756-observation z-score',
    creditSeries: 'BAA10Y',
    creditWindow: 756,
    engineCreditWindow: null,
  },
  {
    id: 'hy_252',
    role: 'variant',
    label: 'Variant: high-yield spread (BAMLH0A0HYM2), 252-observation lookback',
    creditSeries: 'BAMLH0A0HYM2',
    creditWindow: 252,
    engineCreditWindow: { window: 252, min: 252 },
  },
  {
    id: 'baa10y_252',
    role: 'variant',
    label: 'Variant: Baa corporate spread (BAA10Y) as a credit stand-in, 252-observation lookback',
    creditSeries: 'BAA10Y',
    creditWindow: 252,
    engineCreditWindow: { window: 252, min: 252 },
  },
];

function bookFromFile(): PriceBook {
  const stored = JSON.parse(readFileSync(PRICE_FILE, 'utf8')) as StoredBook;
  return {
    fetchedAt: stored.downloadedAt,
    gaps: stored.symbols.filter((row) => row.error).map((row) => `${row.symbol}: ${row.error}`),
    series: stored.symbols.map((row) => ({
      symbol: row.symbol,
      bars: row.bars,
      asOf: row.bars.length ? row.bars[row.bars.length - 1].date : null,
      source: row.bars.length ? 'yahoo' as const : null,
      error: row.error,
      adjusted: row.adjusted,
    })),
  };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function contributeOnFirstOfMonth(dates: string[]): (date: string, index: number) => number {
  const seen = new Set<string>();
  return (date) => {
    const key = monthKey(date);
    if (seen.has(key)) return 0;
    seen.add(key);
    return date === dates[0] ? 0 : 1;
  };
}

function sliceCagr(points: { date: string; nav: number }[]): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86_400_000;
  if (!(days > 0) || !(first.nav > 0)) return null;
  return (last.nav / first.nav) ** (365.25 / days) - 1;
}

function summarise(points: { date: string; nav: number | null; gross: number; turnover: number }[]): PathSummary | null {
  const valid = points.filter((point): point is { date: string; nav: number; gross: number; turnover: number } => point.nav != null && Number.isFinite(point.nav));
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const days = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86_400_000;
  const cagr = days > 0 && first.nav > 0 ? (last.nav / first.nav) ** (365.25 / days) - 1 : null;
  const returns: number[] = [];
  const gapDays: number[] = [];
  for (let i = 1; i < valid.length; i += 1) {
    returns.push(valid[i].nav / valid[i - 1].nav - 1);
    gapDays.push((Date.parse(`${valid[i].date}T00:00:00Z`) - Date.parse(`${valid[i - 1].date}T00:00:00Z`)) / 86_400_000);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  let variance = 0;
  for (const value of returns) variance += (value - mean) ** 2;
  const sd = returns.length > 1 ? Math.sqrt(variance / (returns.length - 1)) : 0;
  const avgGap = gapDays.reduce((sum, value) => sum + value, 0) / gapDays.length;
  const periods = avgGap > 0 ? 365.25 / avgGap : 0;
  const drawdown = maxDrawdown(points.map((point) => point.nav));
  const mid = Math.floor(valid.length / 2);
  const firstHalfCagr = sliceCagr(valid.slice(0, mid));
  const secondHalfCagr = sliceCagr(valid.slice(mid));
  const firstHalfDrawdown = maxDrawdown(valid.slice(0, mid).map((point) => point.nav));
  const secondHalfDrawdown = maxDrawdown(valid.slice(mid).map((point) => point.nav));
  return {
    start: first.date,
    end: last.date,
    observations: valid.length,
    cagr,
    maxDrawdown: drawdown,
    volatility: sd > 0 && periods > 0 ? sd * Math.sqrt(periods) : null,
    sharpe: sd > 0 && periods > 0 ? (mean / sd) * Math.sqrt(periods) : null,
    turnover: valid.reduce((sum, point) => sum + point.turnover, 0),
    timeInMarket: valid.filter((point) => point.gross > 0).length / valid.length,
    unitNavEnd: last.nav,
    firstHalfCagr,
    secondHalfCagr,
    firstHalfDrawdown,
    secondHalfDrawdown,
    returnPerDrawdown: drawdown != null && drawdown > 0 && cagr != null ? cagr / drawdown : null,
  };
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'not calculated';
  return `${(value * 100).toFixed(1)}%`;
}

function num(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return 'not calculated';
  return value.toFixed(digits);
}

function ratio(summary: PathSummary | null): { full: number; firstHalf: number | null; secondHalf: number | null } | null {
  if (!summary || summary.cagr == null || summary.maxDrawdown == null || !(summary.maxDrawdown > 0)) return null;
  const half = (cagr: number | null, drawdown: number | null) => (
    cagr != null && drawdown != null && drawdown > 0 ? cagr / drawdown : null
  );
  return {
    full: summary.cagr / summary.maxDrawdown,
    firstHalf: half(summary.firstHalfCagr, summary.firstHalfDrawdown),
    secondHalf: half(summary.secondHalfCagr, summary.secondHalfDrawdown),
  };
}

function aheadOf(
  left: { full: number; firstHalf: number | null; secondHalf: number | null } | null,
  right: { full: number; firstHalf: number | null; secondHalf: number | null } | null,
): boolean {
  return left != null && right != null
    && left.full > right.full
    && left.firstHalf != null && right.firstHalf != null && left.firstHalf > right.firstHalf
    && left.secondHalf != null && right.secondHalf != null && left.secondHalf > right.secondHalf;
}

function compare(strategy: number | null, benchmark: number | null): 'lagged' | 'ahead' | 'matched' | 'unknown' {
  if (strategy == null || benchmark == null) return 'unknown';
  if (strategy < benchmark - 1e-6) return 'lagged';
  if (strategy > benchmark + 1e-6) return 'ahead';
  return 'matched';
}

function staticTarget(symbol: string, weight: number) {
  return (date: string) => ({
    date,
    weights: [{ symbol, weight }, { symbol: 'CASH', weight: 1 - weight }],
    gross: weight,
    actionable: true,
    regime: null,
    action: 'static',
    omissions: [],
    label: 'static_benchmark' as const,
  });
}

function replayableDates(book: PriceBook): string[] {
  const later = (symbol: string, date: string) => book.series.find((series) => series.symbol === symbol)?.bars.some((bar) => bar.date > date) ?? false;
  const spy = book.series.find((series) => series.symbol === 'SPY');
  const asx = book.series.filter((series) => series.symbol.endsWith('.AX'));
  return (spy?.bars ?? []).map((bar) => bar.date).filter((date) => (
    later('SPY', date)
    && later('AUDUSD=X', date)
    && later('VAS.AX', date)
    && asx.every((series) => series.bars.some((bar) => bar.date > date))
  ));
}

export function paragraph(spec: VariantSpec, result: Omit<VariantResult, 'paragraph' | 'lags' | 'ahead'> & { lags: string[]; ahead: string[] }): string {
  const creditName = spec.creditSeries === 'BAMLH0A0HYM2'
    ? 'The high-yield spread BAMLH0A0HYM2'
    : 'The Baa corporate spread BAA10Y, used here only as a stand-in for the high-yield spread';
  const role = spec.role === 'primary'
    ? `Primary rule. ${creditName}, ${spec.creditWindow}-observation z-score.`
    : `Variant, not the live rule. ${creditName}, ${spec.creditWindow}-observation z-score. The live credit window is still ${WINDOWS.credit.window} observations with a minimum of ${WINDOWS.credit.min}.`;
  const skipped = result.skippedReasons.length === 0
    ? `Skipped ${result.skipped} sessions.`
    : `Skipped ${result.skipped} sessions. ${result.skippedReasons.map((reason) => `${reason.count} sessions from ${reason.first} to ${reason.last}: ${reason.reason}`).join(' ')}`;
  if (!result.summary) {
    return `${role} Completed sessions: ${result.completed}. ${skipped} No portfolio return was calculated. The book is add-and-hold with the existing caps and a 0.10% one-way cost, in AUD.`;
  }
  const summary = result.summary;
  const spy = result.benchmarks.spy;
  const vas = result.benchmarks.vas;
  const mix = result.benchmarks.sixtyForty;
  const versus = [
    ['SPY', compare(summary.cagr, spy?.cagr ?? null)],
    ['VAS.AX', compare(summary.cagr, vas?.cagr ?? null)],
    ['the 60/40 mix', compare(summary.cagr, mix?.cagr ?? null)],
  ] as const;
  const lagSentence = versus.map(([name, side]) => {
    if (side === 'lagged') return `It lagged ${name}.`;
    if (side === 'ahead') return `It finished ahead of ${name}.`;
    if (side === 'matched') return `It matched ${name}.`;
    return `The comparison with ${name} was not calculated.`;
  }).join(' ');
  const short = result.completed < 60
    ? ` ${result.completed} sessions is a short sample. A compound annual rate over that span is not a meaningful test of the rule.`
    : '';
  const interior = result.interiorSkips > 0
    ? ` ${result.interiorSkips} sessions inside the span were skipped, so the book was not updated on those days.`
    : '';
  const windowNote = spec.engineCreditWindow
    ? ' This run asked the engine for a 252-observation credit score. Caps, stops, and the other windows were left as they are.'
    : ' On a completed day the credit score uses the last 756 observations. Shorter histories were skipped rather than scored. The live engine still starts a credit score at 252 observations, and the regime label can depend on that path. That minimum was not changed.';
  return `${role} Completed ${result.completed} sessions, from ${summary.start} to ${summary.end}. ${skipped}${interior} The capped AUD book, add-and-hold with the existing caps and a 0.10% one-way cost, compounded at ${pct(summary.cagr)} a year. Max drawdown ${pct(summary.maxDrawdown)}. Volatility ${pct(summary.volatility)}. Sharpe ${num(summary.sharpe)} with a risk-free rate of 0. Turnover ${num(summary.turnover)}. Invested on ${pct(summary.timeInMarket)} of sessions. Same deposits over the same sessions: SPY ${pct(spy?.cagr)} a year (drawdown ${pct(spy?.maxDrawdown)}), VAS.AX ${pct(vas?.cagr)} a year (drawdown ${pct(vas?.maxDrawdown)}), and 60% SPY / 40% cash ${pct(mix?.cagr)} a year (drawdown ${pct(mix?.maxDrawdown)}). ${lagSentence}${short}${windowNote}`;
}

function runVariant(
  spec: VariantSpec,
  dates: string[],
  sources: Record<string, VintageSource>,
  book: PriceBook,
): { result: VariantResult; inputsChecked: number; decisionsChecked: number; violations: ReturnType<typeof lookaheadViolations> } {
  const readyDates: string[] = [];
  const skipped: { date: string; reasons: string[] }[] = [];
  let inputsChecked = 0;
  let decisionsChecked = 0;
  const violations: ReturnType<typeof lookaheadViolations> = [];
  for (const date of dates) {
    const assessed = assessDecision(date, sources, spec);
    if (assessed.status === 'skipped' || !assessed.panel) {
      skipped.push({ date, reasons: assessed.reasons });
      continue;
    }
    const found = lookaheadViolations(assessed.used);
    if (found.length > 0 && violations.length < 5) violations.push(...found.slice(0, 5 - violations.length));
    inputsChecked += assessed.used.reduce((sum, input) => sum + input.points.length, 0);
    decisionsChecked += 1;
    readyDates.push(assessed.date);
  }
  const readySet = new Set(readyDates);
  let interiorSkips = 0;
  if (readyDates.length >= 2) {
    const first = readyDates[0];
    const last = readyDates[readyDates.length - 1];
    for (const date of dates) {
      if (date > first && date < last && !readySet.has(date)) interiorSkips += 1;
    }
  }
  const contribute = () => contributeOnFirstOfMonth(readyDates);
  let summary: PathSummary | null = null;
  let benchmarks: VariantResult['benchmarks'] = { spy: null, vas: null, sixtyForty: null, spyBuyAndHold: null };
  let notActionable = 0;
  let regimes: Record<string, number> = {};
  let missingFills = 0;
  if (readyDates.length > 0) {
    const started = Date.now();
    const production = walkAudPaper({
      dates: readyDates,
      book,
      mode: 'production',
      policy: 'binding',
      panel: (date) => {
        const again = assessDecision(date, sources, spec);
        if (!again.panel) throw new Error(`Missing panel for ${date}`);
        return again.panel;
      },
      contribute: contribute(),
      creditWindow: spec.engineCreditWindow ?? undefined,
      oneWayBps: 10,
    });
    console.log(spec.id, 'walk', Date.now() - started, 'ms', 'days', readyDates.length, 'missing', production.missing.length);
    missingFills = production.missing.length;
    notActionable = production.days.filter((day) => !day.actionable).length;
    regimes = production.days.reduce<Record<string, number>>((counts, day) => {
      const key = day.regime ?? 'none';
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    const spy = walkNav({ dates: readyDates, book, contribute: contribute(), oneWayBps: 10, target: staticTarget('SPY', 1) });
    const vas = walkNav({ dates: readyDates, book, contribute: contribute(), oneWayBps: 10, target: staticTarget('VAS.AX', 1) });
    const mix = walkNav({
      dates: readyDates,
      book,
      contribute: contribute(),
      oneWayBps: 10,
      target: (date) => ({
        date,
        weights: [{ symbol: 'SPY', weight: 0.6 }, { symbol: 'CASH', weight: 0.4 }],
        gross: 0.6,
        actionable: true,
        regime: null,
        action: 'static',
        omissions: [],
        label: 'static_benchmark',
      }),
    });
    const lump = walkNav({ dates: readyDates, book, contribute: () => 0, oneWayBps: 10, target: staticTarget('SPY', 1) });
    const blocked = production.missing.length > 0 || spy.missing.length > 0 || vas.missing.length > 0 || mix.missing.length > 0 || lump.missing.length > 0;
    if (!blocked) {
      summary = summarise(production.points);
      benchmarks = {
        spy: summarise(spy.points),
        vas: summarise(vas.points),
        sixtyForty: summarise(mix.points),
        spyBuyAndHold: summarise(lump.points),
      };
    }
  }
  const lags: string[] = [];
  const ahead: string[] = [];
  if (summary) {
    const pairs: [string, PathSummary | null][] = [['SPY', benchmarks.spy], ['VAS.AX', benchmarks.vas], ['60/40', benchmarks.sixtyForty]];
    for (const [name, bench] of pairs) {
      const side = compare(summary.cagr, bench?.cagr ?? null);
      if (side === 'lagged') lags.push(name);
      if (side === 'ahead') ahead.push(name);
    }
  }
  const skippedReasons = groupSkipReasons(skipped);
  const partial = {
    id: spec.id,
    role: spec.role,
    label: spec.label,
    creditSeries: spec.creditSeries,
    creditWindow: spec.creditWindow,
    engineCreditWindow: spec.engineCreditWindow?.window ?? WINDOWS.credit.window,
    engineCreditMin: spec.engineCreditWindow?.min ?? WINDOWS.credit.min,
    completed: readyDates.length,
    skipped: skipped.length,
    skippedReasons,
    interiorSkips,
    notActionable,
    regimes,
    missingFills,
    summary,
    benchmarks,
    lags,
    ahead,
  };
  return { result: { ...partial, paragraph: paragraph(spec, partial) }, inputsChecked, decisionsChecked, violations };
}

function passBecause(
  primary: VariantResult,
): { met: boolean; because: string } {
  const regimes = Object.keys(primary.regimes).filter((name) => name !== 'none');
  const production = ratio(primary.summary);
  const mix = ratio(primary.benchmarks.sixtyForty);
  const lump = ratio(primary.benchmarks.spyBuyAndHold);
  const met = aheadOf(production, mix) && aheadOf(production, lump) && regimes.length > 1;
  if (met) {
    return {
      met: true,
      because: `The pre-set comparison was met on this past sample: the primary path's return per unit of drawdown was ahead of buy-and-hold SPY and the 60% SPY / 40% cash mix on the full span and on each half, and the sample used more than one regime (${regimes.join(', ')}). Thresholds were not refit. This is still research on past data, not proof.`,
    };
  }
  const bits = [
    `Completed sessions: ${primary.completed}.`,
    regimes.length > 1 ? `Regimes: ${regimes.join(', ')}.` : `Regime labels other than "none": ${regimes.length === 0 ? 'none' : regimes.join(', ')}.`,
    production ? `Return per unit of drawdown ${production.full.toFixed(2)} (earlier half ${production.firstHalf == null ? 'not calculated' : production.firstHalf.toFixed(2)}, later half ${production.secondHalf == null ? 'not calculated' : production.secondHalf.toFixed(2)}).` : 'Return per unit of drawdown was not calculated.',
    mix ? `60/40 was ${mix.full.toFixed(2)}.` : '60/40 was not calculated.',
    lump ? `Buy-and-hold SPY was ${lump.full.toFixed(2)}.` : 'Buy-and-hold SPY was not calculated.',
    'The pre-set test needs the primary rule ahead of both on the full span and on each half, with more than one regime. That did not happen.',
  ];
  return { met: false, because: bits.join(' ') };
}

function main() {
  const book = bookFromFile();
  const dates = replayableDates(book);
  const sources: Record<string, VintageSource> = {};
  for (const id of ALFRED_SERIES) {
    const file = loadAlfredSeries(ALFRED_DIR, id);
    sources[id] = sourceFromRows(file.vintageDates, file.rows);
    console.log('loaded', id, 'vintages', file.vintageDates.length, 'rows', file.rows.length);
  }
  const spy = book.series.find((series) => series.symbol === 'SPY');
  const manifest = JSON.parse(readFileSync(path.join(ALFRED_DIR, 'manifest.json'), 'utf8')) as { gaps?: { summary?: string[] } };
  const variants: VariantResult[] = [];
  let inputsChecked = 0;
  let decisionsChecked = 0;
  const violations: ReturnType<typeof lookaheadViolations> = [];
  for (const spec of VARIANTS) {
    const run = runVariant(spec, dates, sources, book);
    variants.push(run.result);
    inputsChecked += run.inputsChecked;
    decisionsChecked += run.decisionsChecked;
    if (run.violations.length > 0 && violations.length < 5) violations.push(...run.violations.slice(0, 5 - violations.length));
    console.log(spec.id, 'completed', run.result.completed, 'skipped', run.result.skipped);
  }
  const lookahead = {
    passed: violations.length === 0,
    decisionsChecked,
    inputsChecked,
    violations: violations.length,
    sentence: violations.length === 0
      ? `Lookahead check passed. Every observation used on a decision date had already been published on or before the previous calendar day. ${inputsChecked.toLocaleString('en-US')} observations checked, 0 violations.`
      : `Lookahead check failed. ${violations.length} observations were used before they were published.`,
  };
  const primary = variants[0];
  const criteria = passBecause(primary);
  const rule = 'H1 in research/regime-validation/PROTOCOL.md. Higher unit-NAV return per unit of drawdown than buy-and-hold SPY and the same-contribution 60% SPY / 40% cash mix, on the full span and on each half, in a sample with more than one regime label. Thresholds were not refit. Same-deposit SPY and VAS.AX are reported beside that test. They are not a new pass rule.';
  const headline = criteria.met
    ? `The pre-set comparison was met on this past sample. ${criteria.because}`
    : `Full strategy: not validated. ${criteria.because}`;
  const report: VintageReplay = {
    ranAt: new Date().toISOString(),
    command: 'npx tsx research/regime-validation/run-vintage-replay.ts',
    fullStrategy: criteria.met ? 'criteria_met' : 'not_validated',
    headline,
    advice: 'This is research on past prices and on macro figures that had already been published. It is not proof the rule will keep working, and it is not financial advice.',
    limits: 'The share list is today\'s list. The 2021–2026 prices were already examined. CFTC positioning was left out. Caps, stops, sizing, and the live score windows were not changed. The 252-observation runs are variants: they pass a research-only credit window and do not change the live rule. Credit is never filled with another series when its own vintage is missing.',
    policy: 'book-limits-2026-11-07',
    costBps: 10,
    cashYieldBps: 0,
    currency: 'AUD',
    passCriteria: { met: criteria.met, rule, because: criteria.because },
    lookahead,
    calendar: {
      spySessions: spy?.bars.length ?? 0,
      replayableSessions: dates.length,
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
      priceFirst: spy?.bars[0]?.date ?? null,
      priceLast: spy?.bars[spy.bars.length - 1]?.date ?? null,
      note: 'Portfolio dates are SPY sessions in the saved Yahoo book that still have a later ASX bar to fill. Some ALFRED vintages start earlier than those prices. The book cannot start before the prices.',
    },
    dataGaps: manifest.gaps?.summary ?? [],
    variants,
  };
  writeFileSync(path.join(OUT, 'vintage-replay.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (!lookahead.passed) {
    console.error(JSON.stringify(violations.slice(0, 5), null, 2));
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('run-vintage-replay.ts')) main();
