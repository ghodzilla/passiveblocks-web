import { snapshotFromBundle, type DataBundle } from './assemble';
import { markInAud } from './fx';
import { BOOK_LIMIT_TOLERANCE, BOOK_LIMITS_VERSION, clampBuysToCash, planBookLimits, type LimitSpec } from './bookLimits';
import { budgetsFor } from './classify';
import { FRED_SERIES, REGIME_LABEL, RULES_VERSION } from './constants';
import { buildDesk } from './desk';
import { buildIdeas, priceIsFresh, SINGLE_POSITION_CAP, SYSTEMATIC_CAP } from './ideas';
import { emptyJournal, type Journal, type PaperPosition } from './journal';
import { AI_MEGACAP_CLUSTER, OVERLAP_GROUP_CAP } from './overlap';
import type { PriceBook, PriceSeries } from './prices';
import type { SeriesPoint } from './series';
import type { Bar } from './signals';
import { themesForSymbol } from './themes';
import { THEMES } from './themes.config';
import { THEME_WEIGHT_CAP } from './sizing';
import type { RegimeSnapshot } from './types';
import { DEFAULT_ONE_WAY_BPS } from './evaluate';

export const REPLAY_ONE_WAY_BPS = DEFAULT_ONE_WAY_BPS;
export const REPLAY_CASH_YIELD_BPS = 0;
export const CREDIT_WINDOW = 756;
export const CREDIT_MIN_OBS = 252;

const MANDATORY = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'DGS2', 'BAMLH0A0HYM2'] as const;
const OPTIONAL = ['T10Y2Y', 'USALOLITOAASTSAM', 'AUSLOLITOAASTSAM', 'IPG3344S', 'DFII10', 'DTWEXBGS'] as const;

export interface PositioningRelease {
  id: string;
  label: string;
  /** Calendar date the report was published. The Tuesday as-of date is not accepted here. */
  published: string;
  netOi: SeriesPoint[];
}

export interface VintagePanel {
  decisionDate: string;
  vintageDate: string;
  series: Record<string, SeriesPoint[]>;
  positioning?: PositioningRelease[] | null;
}

export interface TargetBook {
  date: string;
  weights: { symbol: string; weight: number }[];
  gross: number;
  actionable: boolean;
  regime: string | null;
  action: string;
  omissions: string[];
  label: 'production_rules' | 'price_only_diagnostic' | 'static_benchmark';
}

export function previousCalendarDay(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) - 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function onOrBefore<T extends { date: string }>(rows: T[], date: string): T[] {
  return rows.filter((row) => row.date <= date);
}

export function panelOmissions(panel: VintagePanel): string[] {
  const notes: string[] = [];
  if (panel.vintageDate > previousCalendarDay(panel.decisionDate)) {
    notes.push(`Vintage ${panel.vintageDate} is not on or before the previous calendar day of ${panel.decisionDate}.`);
  }
  for (const id of MANDATORY) {
    const rows = onOrBefore(panel.series[id] ?? [], panel.vintageDate);
    if (rows.length === 0) notes.push(`${id} has no observation on or before the vintage. The production rule fail-closes.`);
  }
  const policy = onOrBefore(panel.series.DFEDTARU ?? [], panel.vintageDate);
  const effective = onOrBefore(panel.series.DFF ?? [], panel.vintageDate);
  if (policy.length === 0 && effective.length === 0) notes.push('DFEDTARU and DFF are both missing. Policy fail-closes.');
  const hy = onOrBefore(panel.series.BAMLH0A0HYM2 ?? [], panel.vintageDate);
  if (hy.length > 0 && hy.length < CREDIT_MIN_OBS) {
    notes.push(`Credit has ${hy.length} observations. The z-score stays empty until ${CREDIT_MIN_OBS}. The window is ${CREDIT_WINDOW}, not 156 weeks.`);
  }
  for (const id of OPTIONAL) {
    if ((panel.series[id] ?? []).length === 0) notes.push(`${id} is absent. The live rule leaves this optional leg out.`);
  }
  if (!panel.positioning || panel.positioning.length === 0) {
    notes.push('CFTC positioning is omitted. Today’s positioning is not copied into this date.');
  } else {
    for (const contract of panel.positioning) {
      if (contract.published > panel.vintageDate) notes.push(`${contract.id} was published ${contract.published}, after vintage ${panel.vintageDate}. It is not used.`);
    }
  }
  return notes;
}

function points(panel: VintagePanel, id: string): SeriesPoint[] {
  return onOrBefore(panel.series[id] ?? [], panel.vintageDate);
}

function infoThrough(symbol: string, decisionDate: string): string {
  return symbol.endsWith('.AX') ? decisionDate : previousCalendarDay(decisionDate);
}

function pricePoints(book: PriceBook, symbol: string, decisionDate: string): SeriesPoint[] {
  const series = book.series.find((item) => item.symbol === symbol);
  if (!series) return [];
  const last = infoThrough(symbol, decisionDate);
  return series.bars.filter((bar) => bar.date <= last).map((bar) => ({ date: bar.date, value: bar.close }));
}

export function bundleFromPanel(panel: VintagePanel, book: PriceBook): DataBundle {
  const policyUpper = points(panel, FRED_SERIES.policyUpper);
  const policyEffective = points(panel, FRED_SERIES.policyEffective);
  const useUpper = policyUpper.length > 0;
  const positioning = (panel.positioning ?? []).filter((contract) => contract.published <= panel.vintageDate).map((contract) => ({
    id: contract.id,
    label: contract.label,
    netOi: onOrBefore(contract.netOi, panel.vintageDate),
  }));
  return {
    today: panel.decisionDate,
    generatedAt: `${panel.decisionDate}T13:15:00.000Z`,
    walcl: points(panel, FRED_SERIES.walcl),
    tga: points(panel, FRED_SERIES.tga),
    rrp: points(panel, FRED_SERIES.rrp),
    dgs2: points(panel, FRED_SERIES.dgs2),
    policyRate: useUpper ? policyUpper : policyEffective,
    policyRateSeriesId: useUpper ? FRED_SERIES.policyUpper : FRED_SERIES.policyEffective,
    hy: points(panel, FRED_SERIES.hy),
    curve: points(panel, FRED_SERIES.curve),
    usCli: points(panel, FRED_SERIES.usCli),
    auCli: points(panel, FRED_SERIES.auCli),
    positioning,
    spy: pricePoints(book, 'SPY', panel.decisionDate),
    rsp: pricePoints(book, 'RSP', panel.decisionDate),
    smh: pricePoints(book, 'SMH', panel.decisionDate),
    capex: points(panel, FRED_SERIES.capex),
    gaps: panelOmissions(panel),
    reports: [],
  };
}

export function priceOnlySnapshot(today: string): RegimeSnapshot {
  const budget = budgetsFor('risk_on', 'risk_budget_open');
  return {
    rulesVersion: RULES_VERSION,
    generatedAt: `${today}T13:15:00.000Z`,
    today,
    printDate: today,
    regime: 'risk_on',
    regimeLabel: REGIME_LABEL.risk_on,
    composite: null,
    actionable: true,
    weak: false,
    action: 'risk_budget_open',
    message: 'Diagnostic. The macro gate is forced open so the price checks can be seen on their own. This is not a production print.',
    modelBudget: budget.modelBudget,
    effectiveBudget: budget.effectiveBudget,
    budgetOverridden: false,
    components: [],
    history: [],
    freshness: [],
    gaps: ['Price-only diagnostic. No macro vintage enters this snapshot.'],
  };
}

function clippedBook(book: PriceBook, decisionDate: string): PriceBook {
  return {
    fetchedAt: `${decisionDate}T13:15:00.000Z`,
    gaps: book.gaps,
    series: book.series.map((series) => {
      const last = infoThrough(series.symbol, decisionDate);
      const bars = series.bars.filter((bar) => bar.date <= last);
      return { ...series, bars, asOf: bars.length ? bars[bars.length - 1].date : null };
    }),
  };
}

function targetsOf(lines: { symbol: string; weight: number }[]): { symbol: string; weight: number }[] {
  const invested = lines.filter((line) => line.weight > 0);
  const gross = invested.reduce((sum, line) => sum + line.weight, 0);
  return [...invested, { symbol: 'CASH', weight: Math.max(0, 1 - gross) }];
}

function journalFor(nav: number, peak: number, held: { symbol: string; weight: number }[], book: PriceBook, date: string): Journal {
  const journal = emptyJournal();
  const positions: PaperPosition[] = [];
  for (const row of held) {
    if (row.symbol === 'CASH' || !(row.weight > 0)) continue;
    const series = book.series.find((item) => item.symbol === row.symbol);
    const bar = series ? [...series.bars].reverse().find((item) => item.date < date) : undefined;
    if (!bar) continue;
    positions.push({
      symbol: row.symbol,
      qty: row.weight,
      entry: bar.close,
      stop: bar.close,
      riskPerShare: bar.close * 0.02,
      openedOn: bar.date,
    });
  }
  journal.paper = {
    cash: null,
    peakEquity: peak,
    positions,
    marks: nav === 1 && held.every((row) => row.symbol === 'CASH') ? [] : [{ date, equity: nav }],
  };
  return journal;
}

/** Suggested desk weights for one date. The scored portfolio is walkAudPaper, which keeps holds. */
export function decideProduction(panel: VintagePanel, book: PriceBook, held: { symbol: string; weight: number }[], nav: number, peak: number): TargetBook {
  const clipped = clippedBook(book, panel.decisionDate);
  const snapshot = snapshotFromBundle(bundleFromPanel(panel, book));
  const ideas = buildIdeas({ snapshot, book: clipped });
  const desk = buildDesk({
    snapshot,
    ideas,
    book: clipped,
    realYield: points(panel, 'DFII10'),
    dollar: points(panel, 'DTWEXBGS'),
    journal: journalFor(nav, peak, held, clipped, panel.decisionDate),
  });
  const weights = targetsOf(desk.lines.map((line) => ({ symbol: line.symbol, weight: line.weight })));
  return {
    date: panel.decisionDate,
    weights,
    gross: weights.filter((row) => row.symbol !== 'CASH').reduce((sum, row) => sum + row.weight, 0),
    actionable: snapshot.actionable,
    regime: snapshot.regime,
    action: snapshot.action,
    omissions: panelOmissions(panel),
    label: 'production_rules',
  };
}

export function decidePriceOnly(date: string, book: PriceBook, held: { symbol: string; weight: number }[], nav: number, peak: number): TargetBook {
  const clipped = clippedBook(book, date);
  const snapshot = priceOnlySnapshot(date);
  const ideas = buildIdeas({ snapshot, book: clipped });
  const desk = buildDesk({
    snapshot,
    ideas,
    book: clipped,
    realYield: [],
    dollar: [],
    journal: journalFor(nav, peak, held, clipped, date),
  });
  const weights = targetsOf(desk.lines.map((line) => ({ symbol: line.symbol, weight: line.weight })));
  return {
    date,
    weights,
    gross: weights.filter((row) => row.symbol !== 'CASH').reduce((sum, row) => sum + row.weight, 0),
    actionable: true,
    regime: 'risk_on',
    action: 'risk_budget_open',
    omissions: ['Macro gate forced open. Theme switches that need a macro print stay off. Survivor universe, pre-exposed.'],
    label: 'price_only_diagnostic',
  };
}

/**
 * Fill is the first session after the decision date for every market.
 * 13:15 UTC is before the US close, so that close is hidden from the signal and is not the fill.
 * The ASX close on the decision date can be in the signal, and it is not a fill either.
 */
export function executionBar(series: PriceSeries | undefined, decisionDate: string): Bar | null {
  if (!series) return null;
  for (const bar of series.bars) {
    if (bar.date > decisionDate) return bar;
  }
  return null;
}

export function audFill(symbol: string, bar: Bar, fx: PriceSeries | undefined): { aud: number; fxDate: string | null } | null {
  const marked = markInAud({ symbol, local: bar.close, priceDate: bar.date, fxBars: fx?.bars });
  if (!marked) return null;
  return { aud: marked.aud, fxDate: marked.fxDate };
}

export function tradedFraction(next: { symbol: string; weight: number }[], prev: { symbol: string; weight: number }[]): number {
  const names = Array.from(new Set([...next.map((row) => row.symbol), ...prev.map((row) => row.symbol)]));
  let moved = 0;
  for (const symbol of names) {
    const left = next.find((row) => row.symbol === symbol)?.weight ?? 0;
    const right = prev.find((row) => row.symbol === symbol)?.weight ?? 0;
    moved += Math.abs(left - right);
  }
  return moved / 2;
}

export interface NavPoint {
  date: string;
  nav: number | null;
  wealth: number | null;
  units: number;
  gross: number;
  turnover: number;
  contribution: number;
}

/**
 * Time-weighted NAV. A contribution adds units at the current NAV and does not
 * change NAV. Drawdown belongs on `nav`, never on `wealth`.
 */
export function applyContribution(nav: number, units: number, contribution: number): { nav: number; units: number; wealth: number } {
  if (!(nav > 0) || !(contribution > 0)) return { nav, units, wealth: nav * units };
  return { nav, units: units + contribution / nav, wealth: nav * (units + contribution / nav) };
}

export function maxDrawdown(navs: (number | null)[]): number | null {
  let peak = 0;
  let worst: number | null = null;
  for (const nav of navs) {
    if (!(nav != null) || !(nav > 0)) continue;
    if (nav > peak) peak = nav;
    if (!(peak > 0)) continue;
    const dd = (peak - nav) / peak;
    if (worst == null || dd > worst) worst = dd;
  }
  return worst;
}

export function settleAudDay(input: {
  cash: number;
  positions: PaperPosition[];
  local: Record<string, number>;
  aud: Record<string, number>;
  openedOn: string;
  buys: { symbol: string; weight: number; stop: number | null }[];
  oneWay: number;
}): { cash: number; positions: PaperPosition[]; buyNotional: number; sellNotional: number; unfilled: string[] } {
  let cash = input.cash;
  const kept: PaperPosition[] = [];
  const stopped = new Set<string>();
  let sellNotional = 0;
  for (const position of input.positions) {
    const local = input.local[position.symbol];
    const aud = input.aud[position.symbol];
    if (local <= position.stop) {
      cash += position.qty * aud * (1 - input.oneWay);
      sellNotional += position.qty * aud;
      stopped.add(position.symbol);
    } else {
      kept.push(position);
    }
  }
  let equity = cash;
  for (const position of kept) equity += position.qty * input.aud[position.symbol];
  const open = new Map(kept.map((position) => [position.symbol, position]));
  let buyNotional = 0;
  const unfilled: string[] = [];
  for (const line of input.buys) {
    if (stopped.has(line.symbol) || !(line.weight > 0) || line.stop == null) continue;
    const local = input.local[line.symbol];
    const aud = input.aud[line.symbol];
    if (!(local > 0) || !(aud > 0)) {
      unfilled.push(line.symbol);
      continue;
    }
    if (!(local > line.stop)) continue;
    const spend = line.weight * equity;
    const debit = spend * (1 + input.oneWay);
    if (!(cash >= debit)) continue;
    const existing = open.get(line.symbol);
    if (!existing) {
      cash -= debit;
      buyNotional += spend;
      open.set(line.symbol, {
        symbol: line.symbol,
        qty: spend / aud,
        entry: local,
        stop: line.stop,
        riskPerShare: local - line.stop,
        openedOn: input.openedOn,
      });
    } else if (local >= existing.entry + existing.riskPerShare) {
      cash -= debit;
      buyNotional += spend;
      existing.qty += spend / aud;
    }
  }
  const positions: PaperPosition[] = [];
  open.forEach((position) => positions.push(position));
  return { cash, positions, buyNotional, sellNotional, unfilled };
}

function fillsFor(book: PriceBook, symbols: string[], date: string, fx: PriceSeries | undefined): { local: Record<string, number>; aud: Record<string, number>; missing: string[] } {
  const local: Record<string, number> = {};
  const aud: Record<string, number> = {};
  const missing: string[] = [];
  for (const symbol of symbols) {
    const series = book.series.find((item) => item.symbol === symbol);
    const bar = executionBar(series, date);
    const converted = bar ? audFill(symbol, bar, fx) : null;
    if (!bar || !converted) {
      missing.push(symbol);
      continue;
    }
    local[symbol] = bar.close;
    aud[symbol] = converted.aud;
  }
  return { local, aud, missing };
}

export interface AudDay {
  date: string;
  actionable: boolean;
  regime: string | null;
  action: string;
  omissions: string[];
  gross: number;
  halted: boolean;
}

export interface BreachCounts {
  gross: number;
  net: number;
  name: number;
  theme: number;
  overlap: number;
}

export interface BindingAudit {
  version: typeof BOOK_LIMITS_VERSION;
  tolerance: number;
  /** Planned weights, after trims and adds, measured at the decision. A count here is a new-order violation. */
  decisionBreachDays: BreachCounts;
  /** Fill prices before today's orders. This is market drift since the decision mark. */
  preTradeDriftDays: BreachCounts;
  /** Fill prices after the planned shares traded. Drift and rounding live here, not in the decision count. */
  postFillDriftDays: BreachCounts;
  unresolvedDates: string[];
  pendingCount: number;
  pendingSample: { date: string; symbol: string; reason: string }[];
  pyramidTranches: number;
  trims: number;
  cashShortfalls: number;
  feesPaid: number;
}

export interface BookLedger {
  model: 'paper_ledger_add_and_hold' | 'whole_book_limits';
  capsApplyTo: 'each_day_recommended_weights_only' | 'carried_book_and_new_tranches';
  recommendedMaxGross: number;
  recommendedMaxNet: number;
  recommendedDaysOverGross: number;
  recommendedDaysOverNet: number;
  heldMaxGross: number;
  heldMaxNet: number;
  heldMaxSingle: number;
  heldMaxSingleSymbol: string | null;
  daysHeldGrossOverBudget: number;
  daysHeldNetOverBudget: number;
  daysHeldSingleOverCap: number;
  daysHeldThemeOverCap: number;
  averageRiskGross: number;
  averageDefensiveGross: number;
  averageCash: number;
  maxRiskGross: number;
  maxDefensiveGross: number;
  consecutiveDaysWithTheSameNewWeight: number;
  pyramidAdds: number;
}

function decisionQuote(book: PriceBook, symbol: string, decisionDate: string, fx: PriceSeries | undefined): { local: number; aud: number; barDate: string } | null {
  const series = book.series.find((item) => item.symbol === symbol);
  if (!series) return null;
  const last = infoThrough(symbol, decisionDate);
  let bar: Bar | null = null;
  for (const item of series.bars) {
    if (item.date <= last) bar = item;
  }
  if (!bar) return null;
  const converted = audFill(symbol, bar, fx);
  if (!converted) return null;
  return { local: bar.close, aud: converted.aud, barDate: bar.date };
}

function limitSpecFor(desk: ReturnType<typeof buildDesk>, maxGross: number, maxNet: number): LimitSpec {
  return {
    maxGross,
    maxNet,
    haltNewEntries: desk.halted,
    overlapGroups: [Array.from(AI_MEGACAP_CLUSTER), ...desk.overlap.groups.map((group) => group.symbols)],
    themeGroups: THEMES.map((theme) => ({ id: theme.id, symbols: theme.symbols.map((item) => item.symbol) })),
  };
}

function breachOf(
  rows: { symbol: string; weight: number; role: 'tactical' | 'systematic' | 'cash'; defensive: boolean }[],
  spec: LimitSpec,
): BreachCounts {
  let gross = 0;
  let net = 0;
  let name = 0;
  for (const row of rows) {
    gross += row.weight;
    if (row.role !== 'cash') net += row.weight;
    const cap = row.role === 'systematic' ? SYSTEMATIC_CAP : SINGLE_POSITION_CAP;
    if (row.weight > cap + BOOK_LIMIT_TOLERANCE) name += 1;
  }
  const themes = new Map<string, number>();
  for (const row of rows) {
    for (const theme of themesForSymbol(row.symbol)) themes.set(theme.id, (themes.get(theme.id) ?? 0) + row.weight);
  }
  let theme = 0;
  themes.forEach((sum) => {
    if (sum > THEME_WEIGHT_CAP + BOOK_LIMIT_TOLERANCE) theme += 1;
  });
  let overlap = 0;
  for (const group of spec.overlapGroups) {
    let sum = 0;
    for (const symbol of group) sum += rows.find((row) => row.symbol === symbol)?.weight ?? 0;
    if (sum > OVERLAP_GROUP_CAP + BOOK_LIMIT_TOLERANCE) overlap += 1;
  }
  return {
    gross: gross > spec.maxGross + BOOK_LIMIT_TOLERANCE ? 1 : 0,
    net: net > spec.maxNet + BOOK_LIMIT_TOLERANCE ? 1 : 0,
    name: name > 0 ? 1 : 0,
    theme: theme > 0 ? 1 : 0,
    overlap: overlap > 0 ? 1 : 0,
  };
}

function emptyBreaches(): BreachCounts {
  return { gross: 0, net: 0, name: 0, theme: 0, overlap: 0 };
}

function addBreaches(total: BreachCounts, day: BreachCounts): void {
  total.gross += day.gross;
  total.net += day.net;
  total.name += day.name;
  total.theme += day.theme;
  total.overlap += day.overlap;
}

/**
 * Whole-book limits. Holds are kept. Caps and the stale-price guard can sell.
 * Share counts are fixed from the decision mark and filled on the next session.
 */
function executeBinding(input: {
  cash: number;
  positions: PaperPosition[];
  date: string;
  book: PriceBook;
  fx: PriceSeries | undefined;
  lines: ReturnType<typeof buildDesk>['lines'];
  spec: LimitSpec;
  local: Record<string, number>;
  aud: Record<string, number>;
  oneWay: number;
}): {
  cash: number;
  positions: PaperPosition[];
  buyNotional: number;
  sellNotional: number;
  pending: { symbol: string; reason: string }[];
  decisionBreach: BreachCounts;
  preTradeDrift: BreachCounts;
  postFillDrift: BreachCounts;
  unresolved: boolean;
  pyramidTranches: number;
  trims: number;
  cashShortfalls: number;
  fees: number;
} {
  let cash = input.cash;
  const kept: PaperPosition[] = [];
  const stopped = new Set<string>();
  let sellNotional = 0;
  let fees = 0;
  for (const position of input.positions) {
    const local = input.local[position.symbol];
    const aud = input.aud[position.symbol];
    if (local <= position.stop) {
      const notional = position.qty * aud;
      cash += notional * (1 - input.oneWay);
      fees += notional * input.oneWay;
      sellNotional += notional;
      stopped.add(position.symbol);
    } else kept.push({ ...position });
  }
  const quotes = new Map<string, { local: number; aud: number; barDate: string }>();
  for (const position of kept) {
    const quote = decisionQuote(input.book, position.symbol, input.date, input.fx);
    if (quote) quotes.set(position.symbol, quote);
  }
  const priced: PaperPosition[] = [];
  const pending: { symbol: string; reason: string }[] = [];
  for (const position of kept) {
    if (quotes.has(position.symbol)) priced.push(position);
    else pending.push({ symbol: position.symbol, reason: 'No decision mark. The name is not trimmed and the cap is not guaranteed.' });
  }
  let decisionEquity = cash;
  for (const position of priced) decisionEquity += position.qty * (quotes.get(position.symbol)?.aud ?? 0);
  const lineFor = (symbol: string) => input.lines.find((line) => line.symbol === symbol);
  const plan = planBookLimits(
    priced.map((position) => {
      const line = lineFor(position.symbol);
      const quote = quotes.get(position.symbol);
      return {
        symbol: position.symbol,
        weight: decisionEquity > 0 && quote ? position.qty * quote.aud / decisionEquity : 0,
        role: line?.role ?? 'tactical',
        defensive: line?.defensive ?? false,
        themes: themesForSymbol(position.symbol).map((theme) => theme.id),
        unpriced: false,
        forceExit: quote ? !priceIsFresh(quote.barDate, input.date) : false,
        tranches: position.tranches ?? 1,
      };
    }),
    input.lines.filter((line) => line.weight > 0 && line.stop != null && !stopped.has(line.symbol)).map((line) => ({
      symbol: line.symbol,
      weight: line.weight,
      role: line.role,
      defensive: line.defensive,
      themes: themesForSymbol(line.symbol).map((theme) => theme.id),
      kind: priced.some((position) => position.symbol === line.symbol) || kept.some((position) => position.symbol === line.symbol) ? 'pyramid' as const : 'new' as const,
    })),
    input.spec,
  );
  for (const item of plan.pending) pending.push(item);
  const rowsFor = (positions: PaperPosition[], priceOf: (symbol: string) => number | null, cashNow: number) => {
    let equity = cashNow;
    for (const position of positions) {
      const price = priceOf(position.symbol);
      if (price != null) equity += position.qty * price;
    }
    return positions.map((position) => {
      const line = lineFor(position.symbol);
      const price = priceOf(position.symbol) ?? 0;
      return {
        symbol: position.symbol,
        weight: equity > 0 ? position.qty * price / equity : 0,
        role: line?.role ?? 'tactical' as const,
        defensive: line?.defensive ?? false,
      };
    });
  };
  const preTradeDrift = breachOf(rowsFor(kept, (symbol) => input.aud[symbol] ?? null, cash), input.spec);
  const open = new Map(priced.map((position) => [position.symbol, position]));
  for (const position of kept) {
    if (!quotes.has(position.symbol)) open.set(position.symbol, position);
  }
  for (const sale of plan.sells) {
    const position = open.get(sale.symbol);
    const quote = quotes.get(sale.symbol);
    const fill = input.aud[sale.symbol];
    if (!position || !quote || !(fill > 0) || !(decisionEquity > 0)) {
      pending.push({ symbol: sale.symbol, reason: 'Planned reduction has no fill. The shares stay.' });
      continue;
    }
    const currentWeight = position.qty * quote.aud / decisionEquity;
    if (!(currentWeight > 0)) continue;
    const sold = position.qty * Math.min(1, sale.weight / currentWeight);
    const notional = sold * fill;
    cash += notional * (1 - input.oneWay);
    fees += notional * input.oneWay;
    sellNotional += notional;
    position.qty -= sold;
    if (!(position.qty > 1e-10)) open.delete(sale.symbol);
  }
  const fillable = plan.buys.filter((buy) => (input.aud[buy.symbol] ?? 0) > 0 && (input.local[buy.symbol] ?? 0) > 0);
  for (const buy of plan.buys) {
    if (!fillable.includes(buy)) pending.push({ symbol: buy.symbol, reason: 'Planned buy has no fill or no FX. It is not marked as bought.' });
  }
  const clamped = clampBuysToCash(
    fillable.map((buy) => ({ symbol: buy.symbol, notional: buy.weight * decisionEquity })),
    cash,
    input.oneWay,
  );
  cash = clamped.cashLeft;
  fees += clamped.fees;
  let buyNotional = 0;
  let pyramidTranches = 0;
  for (const buy of clamped.filled) {
    const planned = fillable.find((item) => item.symbol === buy.symbol);
    const line = lineFor(buy.symbol);
    const local = input.local[buy.symbol];
    const aud = input.aud[buy.symbol];
    if (!planned || !line || line.stop == null || !(local > line.stop) || !(aud > 0)) {
      cash += buy.notional * (1 + input.oneWay);
      fees -= buy.notional * input.oneWay;
      pending.push({ symbol: buy.symbol, reason: 'Fill is through the stop. The buy is not taken.' });
      continue;
    }
    const existing = open.get(buy.symbol);
    if (planned.kind === 'pyramid' && existing && (existing.tranches ?? 1) < 2) {
      existing.qty += buy.notional / aud;
      existing.tranches = 2;
      pyramidTranches += 1;
      buyNotional += buy.notional;
    } else if (planned.kind === 'new' && !existing) {
      open.set(buy.symbol, {
        symbol: buy.symbol,
        qty: buy.notional / aud,
        entry: local,
        stop: line.stop,
        riskPerShare: local - line.stop,
        openedOn: input.date,
        tranches: 1,
      });
      buyNotional += buy.notional;
    } else {
      cash += buy.notional * (1 + input.oneWay);
      fees -= buy.notional * input.oneWay;
      pending.push({ symbol: buy.symbol, reason: 'The planned buy no longer matches a held tranche. Cash is returned.' });
    }
  }
  for (const short of clamped.shortfall) pending.push({ symbol: short.symbol, reason: 'Cash cannot fund the planned buy. No borrowing.' });
  const positions: PaperPosition[] = [];
  open.forEach((position) => {
    if (position.qty > 1e-10) positions.push(position);
  });
  const decisionRows = plan.keptWeight.map((row) => {
    const line = lineFor(row.symbol);
    return { symbol: row.symbol, weight: row.weight, role: line?.role ?? 'tactical' as const, defensive: line?.defensive ?? false };
  });
  const postRows = rowsFor(positions, (symbol) => input.aud[symbol] ?? null, cash);
  return {
    cash,
    positions,
    buyNotional,
    sellNotional,
    pending,
    decisionBreach: breachOf(decisionRows, input.spec),
    preTradeDrift: preTradeDrift,
    postFillDrift: breachOf(postRows, input.spec),
    unresolved: pending.some((item) => item.reason.startsWith('No decision mark') || item.reason.startsWith('Planned reduction')),
    pyramidTranches,
    trims: plan.sells.length,
    cashShortfalls: clamped.shortfall.length,
    fees,
  };
}

/**
 * `add_hold` repeats the historical journal: a confirmed line adds a tranche and
 * a hold stays until the stop. `binding` applies book-limits-2026-11-07 to the
 * carried book and to new tranches. Holds are not sold because their suggestion is 0.
 */
export function walkAudPaper(input: {
  dates: string[];
  book: PriceBook;
  mode: 'production' | 'price_only';
  policy?: 'add_hold' | 'binding';
  panel?: (date: string) => VintagePanel;
  oneWayBps?: number;
  contribute: (date: string, index: number) => number;
}): { points: NavPoint[]; missing: string[]; days: AudDay[]; heldSymbols: string[]; ledger: BookLedger; binding: BindingAudit | null } {
  const fx = input.book.series.find((series) => series.symbol === 'AUDUSD=X');
  const oneWay = (input.oneWayBps ?? REPLAY_ONE_WAY_BPS) / 10_000;
  const policy = input.policy ?? 'add_hold';
  const journal = emptyJournal();
  journal.settings.capital = 1;
  journal.paper.cash = 1;
  journal.paper.peakEquity = 1;
  let units = 1;
  let peak = 1;
  const points: NavPoint[] = [];
  const days: AudDay[] = [];
  const missing: string[] = [];
  const heldSymbols = new Set<string>();
  const binding: BindingAudit = {
    version: BOOK_LIMITS_VERSION,
    tolerance: BOOK_LIMIT_TOLERANCE,
    decisionBreachDays: emptyBreaches(),
    preTradeDriftDays: emptyBreaches(),
    postFillDriftDays: emptyBreaches(),
    unresolvedDates: [],
    pendingCount: 0,
    pendingSample: [],
    pyramidTranches: 0,
    trims: 0,
    cashShortfalls: 0,
    feesPaid: 0,
  };
  const ledger: BookLedger = {
    model: policy === 'binding' ? 'whole_book_limits' : 'paper_ledger_add_and_hold',
    capsApplyTo: policy === 'binding' ? 'carried_book_and_new_tranches' : 'each_day_recommended_weights_only',
    recommendedMaxGross: 0,
    recommendedMaxNet: 0,
    recommendedDaysOverGross: 0,
    recommendedDaysOverNet: 0,
    heldMaxGross: 0,
    heldMaxNet: 0,
    heldMaxSingle: 0,
    heldMaxSingleSymbol: null,
    daysHeldGrossOverBudget: 0,
    daysHeldNetOverBudget: 0,
    daysHeldSingleOverCap: 0,
    daysHeldThemeOverCap: 0,
    averageRiskGross: 0,
    averageDefensiveGross: 0,
    averageCash: 0,
    maxRiskGross: 0,
    maxDefensiveGross: 0,
    consecutiveDaysWithTheSameNewWeight: 0,
    pyramidAdds: 0,
  };
  let ledgerDays = 0;
  let previousNew = new Set<string>();
  for (let index = 0; index < input.dates.length; index++) {
    const date = input.dates[index];
    const panel = input.panel?.(date);
    const produced = panel ? snapshotFromBundle(bundleFromPanel(panel, input.book)) : priceOnlySnapshot(date);
    const snapshot = input.mode === 'price_only'
      ? {
        ...produced,
        action: 'risk_budget_open' as const,
        actionable: true,
        message: 'Ablation. Stand-down removed. Regime, budget, and component scores stay on the production print.',
      }
      : produced;
    const clipped = clippedBook(input.book, date);
    const ideas = buildIdeas({ snapshot, book: clipped });
    const desk = buildDesk({
      snapshot,
      ideas,
      book: clipped,
      realYield: panel ? pointsOf(panel, 'DFII10') : [],
      dollar: panel ? pointsOf(panel, 'DTWEXBGS') : [],
      journal,
    });
    const wanted = desk.lines.filter((line) => line.weight > 0).map((line) => line.symbol);
    const held = journal.paper.positions.map((position) => position.symbol);
    const symbols = Array.from(new Set([...held, ...wanted]));
    const fills = fillsFor(input.book, symbols, date, fx);
    const heldMissing = fills.missing.filter((symbol) => held.includes(symbol));
    const omissions = input.mode === 'price_only'
      ? ['Ablation: the stand-down is off, so a non-defensive name can pass the regime gate. The production budget and regime stay. This is not the risk-on 150% gross budget.']
      : panel ? panelOmissions(panel) : [];
    if (heldMissing.length) {
      missing.push(...heldMissing.map((symbol) => `${date} ${symbol}`));
      if (policy === 'binding') binding.unresolvedDates.push(date);
      points.push({ date, nav: null, wealth: null, units, gross: 0, turnover: 0, contribution: input.contribute(date, index) });
      days.push({ date, actionable: snapshot.actionable, regime: snapshot.regime, action: snapshot.action, omissions, gross: 0, halted: desk.halted });
      continue;
    }
    const heldBefore = new Set(journal.paper.positions.map((position) => position.symbol));
    const before: number = journal.paper.cash ?? 1;
    let wealthBefore = before;
    for (const position of journal.paper.positions) wealthBefore += position.qty * (fills.aud[position.symbol] ?? 0);
    let cashAfter: number = before;
    let positionsAfter: PaperPosition[] = journal.paper.positions;
    let buyNotional = 0;
    let sellNotional = 0;
    if (policy === 'binding') {
      const settled = executeBinding({
        cash: before,
        positions: journal.paper.positions,
        date,
        book: input.book,
        fx,
        lines: desk.lines,
        spec: limitSpecFor(desk, snapshot.effectiveBudget.maxGross, snapshot.effectiveBudget.maxNet),
        local: fills.local,
        aud: fills.aud,
        oneWay,
      });
      cashAfter = settled.cash;
      positionsAfter = settled.positions;
      buyNotional = settled.buyNotional;
      sellNotional = settled.sellNotional;
      addBreaches(binding.decisionBreachDays, settled.decisionBreach);
      addBreaches(binding.preTradeDriftDays, settled.preTradeDrift);
      addBreaches(binding.postFillDriftDays, settled.postFillDrift);
      binding.pyramidTranches += settled.pyramidTranches;
      binding.trims += settled.trims;
      binding.cashShortfalls += settled.cashShortfalls;
      binding.feesPaid += settled.fees;
      binding.pendingCount += settled.pending.length;
      for (const item of settled.pending) {
        if (binding.pendingSample.length < 40) binding.pendingSample.push({ date, symbol: item.symbol, reason: item.reason });
      }
      if (settled.unresolved) binding.unresolvedDates.push(date);
    } else {
      const settled = settleAudDay({
        cash: before,
        positions: journal.paper.positions,
        local: fills.local,
        aud: fills.aud,
        openedOn: date,
        buys: desk.lines.map((line) => ({ symbol: line.symbol, weight: line.weight, stop: line.stop })),
        oneWay,
      });
      cashAfter = settled.cash;
      positionsAfter = settled.positions;
      buyNotional = settled.buyNotional;
      sellNotional = settled.sellNotional;
      if (settled.unfilled.length) missing.push(...settled.unfilled.map((symbol) => `${date} ${symbol} unfilled`));
    }
    const markedCash = cashAfter;
    let wealth = markedCash;
    for (const position of positionsAfter) wealth += position.qty * fills.aud[position.symbol];
    const invested = wealth - markedCash;
    const nav = wealth / units;
    const contribution = input.contribute(date, index);
    const funded = applyContribution(nav, units, contribution);
    if (contribution > 0) cashAfter += contribution;
    units = funded.units;
    if (nav > peak) peak = nav;
    journal.paper.cash = cashAfter;
    journal.paper.positions = positionsAfter;
    for (const position of positionsAfter) heldSymbols.add(position.symbol);
    journal.paper.peakEquity = peak;
    journal.paper.marks = journal.paper.marks.concat([{ date, equity: nav }]);
    const gross = wealth > 0 ? invested / wealth : 0;
    recordLedger(ledger, {
      lines: desk.lines,
      maxGross: snapshot.effectiveBudget.maxGross,
      maxNet: snapshot.effectiveBudget.maxNet,
      positions: positionsAfter,
      heldBefore,
      aud: fills.aud,
      cash: markedCash,
      wealth,
      previousNew,
    });
    previousNew = new Set(desk.lines.filter((line) => line.weight > 0).map((line) => line.symbol));
    ledgerDays += 1;
    const turnover = wealthBefore > 0 ? (buyNotional + sellNotional) / 2 / wealthBefore : 0;
    points.push({ date, nav, wealth: funded.wealth, units, gross, turnover, contribution });
    days.push({ date, actionable: snapshot.actionable, regime: snapshot.regime, action: snapshot.action, omissions, gross, halted: desk.halted });
  }
  if (ledgerDays > 0) {
    ledger.averageRiskGross /= ledgerDays;
    ledger.averageDefensiveGross /= ledgerDays;
    ledger.averageCash /= ledgerDays;
  }
  return { points, missing, days, heldSymbols: Array.from(heldSymbols).sort(), ledger, binding: policy === 'binding' ? binding : null };
}

function recordLedger(ledger: BookLedger, input: {
  lines: ReturnType<typeof buildDesk>['lines'];
  maxGross: number;
  maxNet: number;
  positions: PaperPosition[];
  heldBefore: Set<string>;
  aud: Record<string, number>;
  cash: number;
  wealth: number;
  previousNew: Set<string>;
}): void {
  let recommendedGross = 0;
  let recommendedNet = 0;
  for (const line of input.lines) {
    recommendedGross += line.weight;
    if (line.role !== 'cash') recommendedNet += line.weight;
    if (line.weight > 0 && input.previousNew.has(line.symbol)) ledger.consecutiveDaysWithTheSameNewWeight += 1;
    if (line.weight > 0 && input.heldBefore.has(line.symbol)) ledger.pyramidAdds += 1;
  }
  ledger.recommendedMaxGross = Math.max(ledger.recommendedMaxGross, recommendedGross);
  ledger.recommendedMaxNet = Math.max(ledger.recommendedMaxNet, recommendedNet);
  if (recommendedGross > input.maxGross + 1e-3) ledger.recommendedDaysOverGross += 1;
  if (recommendedNet > input.maxNet + 1e-3) ledger.recommendedDaysOverNet += 1;
  const wealth = input.wealth;
  let heldNet = 0;
  let risk = 0;
  let defensive = 0;
  let cashSleeve = 0;
  let singleBreach = false;
  const themes = new Map<string, number>();
  for (const position of input.positions) {
    const price = input.aud[position.symbol];
    const weight = wealth > 0 ? position.qty * price / wealth : 0;
    const line = input.lines.find((item) => item.symbol === position.symbol);
    const cap = line?.role === 'systematic' ? SYSTEMATIC_CAP : SINGLE_POSITION_CAP;
    if (line?.role === 'cash') cashSleeve += weight;
    else {
      heldNet += weight;
      if (line?.defensive) defensive += weight;
      else risk += weight;
    }
    if (weight > cap + 1e-3) singleBreach = true;
    if (weight > ledger.heldMaxSingle) {
      ledger.heldMaxSingle = weight;
      ledger.heldMaxSingleSymbol = position.symbol;
    }
    for (const theme of themesForSymbol(position.symbol)) {
      themes.set(theme.id, (themes.get(theme.id) ?? 0) + weight);
    }
  }
  const cashWeight = wealth > 0 ? input.cash / wealth : 0;
  ledger.heldMaxGross = Math.max(ledger.heldMaxGross, wealth > 0 ? (wealth - input.cash) / wealth : 0);
  ledger.heldMaxNet = Math.max(ledger.heldMaxNet, heldNet);
  ledger.maxRiskGross = Math.max(ledger.maxRiskGross, risk);
  ledger.maxDefensiveGross = Math.max(ledger.maxDefensiveGross, defensive);
  ledger.averageRiskGross += risk;
  ledger.averageDefensiveGross += defensive;
  ledger.averageCash += cashWeight + cashSleeve;
  const heldGross = wealth > 0 ? (wealth - input.cash) / wealth : 0;
  if (heldGross > input.maxGross + 1e-3) ledger.daysHeldGrossOverBudget += 1;
  if (heldNet > input.maxNet + 1e-3) ledger.daysHeldNetOverBudget += 1;
  if (singleBreach) ledger.daysHeldSingleOverCap += 1;
  let themeBreach = false;
  themes.forEach((sum) => {
    if (sum > THEME_WEIGHT_CAP + 1e-3) themeBreach = true;
  });
  if (themeBreach) ledger.daysHeldThemeOverCap += 1;
}

function pointsOf(panel: VintagePanel, id: string): SeriesPoint[] {
  return points(panel, id);
}

export function walkNav(input: {
  dates: string[];
  book: PriceBook;
  fxSymbol?: string;
  oneWayBps?: number;
  contribute: (date: string, index: number) => number;
  target: (date: string, held: { symbol: string; weight: number }[], nav: number, peak: number) => TargetBook;
}): { points: NavPoint[]; missing: string[]; targets: TargetBook[] } {
  const fx = input.book.series.find((series) => series.symbol === (input.fxSymbol ?? 'AUDUSD=X'));
  const oneWay = (input.oneWayBps ?? REPLAY_ONE_WAY_BPS) / 10_000;
  let held = [{ symbol: 'CASH', weight: 1 }];
  let entry: Record<string, number> | null = null;
  let nav = 1;
  let units = 1;
  let peak = 1;
  const points: NavPoint[] = [];
  const targets: TargetBook[] = [];
  const missing: string[] = [];
  for (let index = 0; index < input.dates.length; index++) {
    const date = input.dates[index];
    const decision = input.target(date, held, nav, peak);
    targets.push(decision);
    const needed = Array.from(new Set([...held, ...decision.weights].map((row) => row.symbol).filter((symbol) => symbol !== 'CASH')));
    const fills: Record<string, number> = {};
    let blocked = false;
    for (const symbol of needed) {
      const series = input.book.series.find((item) => item.symbol === symbol);
      const bar = executionBar(series, date);
      const aud = bar ? audFill(symbol, bar, fx) : null;
      if (!aud) {
        missing.push(`${date} ${symbol}`);
        blocked = true;
        break;
      }
      fills[symbol] = aud.aud;
    }
    const contribution = input.contribute(date, index);
    if (blocked) {
      points.push({ date, nav: null, wealth: null, units, gross: decision.gross, turnover: 0, contribution });
      continue;
    }
    let turnover = tradedFraction(decision.weights, held);
    if (entry) {
      let invested = 0;
      let cashWeight = 0;
      const drifted: { symbol: string; weight: number }[] = [];
      for (const row of held) {
        if (row.symbol === 'CASH' || !(row.weight > 0)) {
          cashWeight += row.weight;
          continue;
        }
        const now = fills[row.symbol];
        const then = entry[row.symbol];
        if (!(now > 0) || !(then > 0)) {
          missing.push(`${date} ${row.symbol} mark`);
          blocked = true;
          break;
        }
        const value = row.weight * (now / then);
        invested += value;
        drifted.push({ symbol: row.symbol, weight: value });
      }
      if (blocked) {
        points.push({ date, nav: null, wealth: null, units, gross: decision.gross, turnover: 0, contribution });
        continue;
      }
      const total = invested + cashWeight;
      if (!(total > 0)) {
        missing.push(`${date} value`);
        points.push({ date, nav: null, wealth: null, units, gross: decision.gross, turnover: 0, contribution });
        continue;
      }
      drifted.push({ symbol: 'CASH', weight: cashWeight / total });
      for (const row of drifted) if (row.symbol !== 'CASH') row.weight /= total;
      turnover = tradedFraction(decision.weights, drifted);
      nav *= total * (1 - turnover * oneWay);
    } else {
      nav = 1 - turnover * oneWay;
    }
    if (nav > peak) peak = nav;
    const funded = applyContribution(nav, units, contribution);
    units = funded.units;
    held = decision.weights;
    entry = fills;
    points.push({ date, nav, wealth: funded.wealth, units, gross: decision.gross, turnover, contribution });
  }
  return { points, missing, targets };
}
