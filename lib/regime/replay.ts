import { snapshotFromBundle, type DataBundle } from './assemble';
import { budgetsFor } from './classify';
import { FRED_SERIES, REGIME_LABEL, RULES_VERSION } from './constants';
import { buildDesk } from './desk';
import { buildIdeas, SINGLE_POSITION_CAP, SYSTEMATIC_CAP } from './ideas';
import { emptyJournal, type Journal, type PaperPosition } from './journal';
import type { PriceBook, PriceSeries } from './prices';
import type { SeriesPoint } from './series';
import type { Bar } from './signals';
import { themesForSymbol } from './themes';
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
  if (symbol.endsWith('.AX') || symbol === 'CASH') return { aud: bar.close, fxDate: null };
  if (!fx) return null;
  let rate: number | null = null;
  let fxDate: string | null = null;
  for (const point of fx.bars) {
    if (point.date <= bar.date && point.close > 0) {
      rate = point.close;
      fxDate = point.date;
    }
  }
  if (!(rate != null) || !(rate > 0)) return null;
  return { aud: bar.close / rate, fxDate };
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

export interface BookLedger {
  model: 'paper_ledger_add_and_hold';
  capsApplyTo: 'each_day_recommended_weights_only';
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

/**
 * Conditional book. It follows applyPaperDay: a confirmed line adds a tranche,
 * and a hold stays until the stop. The day's recommended weights are a separate
 * object. Those weights are what the gross, net, name, and theme caps constrain.
 * This function does not rescale the held book to that recommendation.
 */
export function walkAudPaper(input: {
  dates: string[];
  book: PriceBook;
  mode: 'production' | 'price_only';
  panel?: (date: string) => VintagePanel;
  oneWayBps?: number;
  contribute: (date: string, index: number) => number;
}): { points: NavPoint[]; missing: string[]; days: AudDay[]; heldSymbols: string[]; ledger: BookLedger } {
  const fx = input.book.series.find((series) => series.symbol === 'AUDUSD=X');
  const oneWay = (input.oneWayBps ?? REPLAY_ONE_WAY_BPS) / 10_000;
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
  const ledger: BookLedger = {
    model: 'paper_ledger_add_and_hold',
    capsApplyTo: 'each_day_recommended_weights_only',
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
      points.push({ date, nav: null, wealth: null, units, gross: 0, turnover: 0, contribution: input.contribute(date, index) });
      days.push({ date, actionable: snapshot.actionable, regime: snapshot.regime, action: snapshot.action, omissions, gross: 0, halted: desk.halted });
      continue;
    }
    const heldBefore = new Set(journal.paper.positions.map((position) => position.symbol));
    const before = journal.paper.cash ?? 1;
    let wealthBefore = before;
    for (const position of journal.paper.positions) wealthBefore += position.qty * (fills.aud[position.symbol] ?? 0);
    const settled = settleAudDay({
      cash: before,
      positions: journal.paper.positions,
      local: fills.local,
      aud: fills.aud,
      openedOn: date,
      buys: desk.lines.map((line) => ({ symbol: line.symbol, weight: line.weight, stop: line.stop })),
      oneWay,
    });
    if (settled.unfilled.length) missing.push(...settled.unfilled.map((symbol) => `${date} ${symbol} unfilled`));
    let wealth = settled.cash;
    for (const position of settled.positions) wealth += position.qty * fills.aud[position.symbol];
    const invested = wealth - settled.cash;
    const nav = wealth / units;
    const contribution = input.contribute(date, index);
    const funded = applyContribution(nav, units, contribution);
    if (contribution > 0) settled.cash += contribution;
    units = funded.units;
    if (nav > peak) peak = nav;
    journal.paper.cash = settled.cash;
    journal.paper.positions = settled.positions;
    for (const position of settled.positions) heldSymbols.add(position.symbol);
    journal.paper.peakEquity = peak;
    journal.paper.marks = journal.paper.marks.concat([{ date, equity: nav }]);
    const gross = wealth > 0 ? invested / wealth : 0;
    recordLedger(ledger, {
      lines: desk.lines,
      maxGross: snapshot.effectiveBudget.maxGross,
      maxNet: snapshot.effectiveBudget.maxNet,
      positions: settled.positions,
      heldBefore,
      aud: fills.aud,
      cash: settled.cash,
      wealth,
      previousNew,
    });
    previousNew = new Set(desk.lines.filter((line) => line.weight > 0).map((line) => line.symbol));
    ledgerDays += 1;
    const turnover = wealthBefore > 0 ? (settled.buyNotional + settled.sellNotional) / 2 / wealthBefore : 0;
    points.push({ date, nav, wealth: funded.wealth, units, gross, turnover, contribution });
    days.push({ date, actionable: snapshot.actionable, regime: snapshot.regime, action: snapshot.action, omissions, gross, halted: desk.halted });
  }
  if (ledgerDays > 0) {
    ledger.averageRiskGross /= ledgerDays;
    ledger.averageDefensiveGross /= ledgerDays;
    ledger.averageCash /= ledgerDays;
  }
  return { points, missing, days, heldSymbols: Array.from(heldSymbols).sort(), ledger };
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
