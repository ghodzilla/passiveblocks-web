import type { RegimeId } from './constants';
import { dipSignal } from './dip';
import type { IdeasReport } from './ideas';
import { scaleWeights } from './ideas';
import type { Journal, PaperPosition } from './journal';
import { applyOverlapCaps } from './overlap';
import type { PriceBook } from './prices';
import type { SeriesPoint } from './series';
import {
  averageTrueRange,
  capGroup,
  drawdownState,
  pyramidState,
  resolveCapital,
  resolveTargetCagr,
  riskSize,
  roleCap,
  THEME_WEIGHT_CAP,
} from './sizing';
import { computeSignals, type Bar } from './signals';
import { evaluateThemes, priorPrint, seriesDirection, type ThemeVerdict } from './themes';
import { THEME_CHANGELOG, THEME_CONFIG_VERSION, THEMES } from './themes.config';
import type { RegimeSnapshot } from './types';
import { cagrFromCurve } from './improve';
import type { WeekChange } from './improve';

export interface RiskLine {
  symbol: string;
  name: string;
  stop: number | null;
  qty: number | null;
  weight: number;
  note: string;
  dip: string | null;
  theme: string | null;
}

export interface Desk {
  themes: (ThemeVerdict & { lines: RiskLine[] })[];
  lines: RiskLine[];
  capital: number;
  targetCagr: number;
  drawdown: number | null;
  halted: boolean;
  equity: number | null;
  peakEquity: number | null;
  realisedCagr: number | null;
  backtestedCagr: number | null;
  maxDrawdown: number | null;
  gapToTarget: number | null;
  changes: WeekChange[];
  configVersion: string;
  changelog: typeof THEME_CHANGELOG;
  gaps: string[];
  params: Journal['params'];
}

function latestComponent(snapshot: RegimeSnapshot, id: 'ai' | 'liquidity'): { value: number | null; date: string | null } {
  const component = snapshot.components.find((item) => item.id === id);
  return { value: component?.z ?? null, date: component?.asOf ?? null };
}

function barsOf(book: PriceBook, symbol: string): Bar[] {
  return book.series.find((series) => series.symbol === symbol)?.bars ?? [];
}

function themeIdsFor(symbol: string): string[] {
  return THEMES.filter((theme) => theme.symbols.some((item) => item.symbol === symbol)).map((theme) => theme.id);
}

export function buildDesk(input: {
  snapshot: RegimeSnapshot;
  ideas: IdeasReport;
  book: PriceBook;
  realYield: SeriesPoint[];
  dollar: SeriesPoint[];
  journal: Journal;
  envCapital?: string;
  envTarget?: string;
}): Desk {
  const capital = resolveCapital(input.envCapital, input.journal.settings.capital);
  const targetCagr = resolveTargetCagr(input.envTarget, input.journal.settings.targetCagr);
  const params = input.journal.params;
  const marks = input.journal.paper.marks;
  const equity = marks.length ? marks[marks.length - 1].equity : (input.journal.paper.cash ?? capital);
  const peak = input.journal.paper.peakEquity ?? equity;
  const drawdown = drawdownState(equity, peak);
  const halted = input.journal.paper.marks.length > 0 && drawdown.halted;

  const ai = latestComponent(input.snapshot, 'ai');
  const liquidity = latestComponent(input.snapshot, 'liquidity');
  const btc = computeSignals(barsOf(input.book, 'BTC-USD'));
  const themes = evaluateThemes({
    aiLatest: ai.value,
    aiPrior: priorPrint(input.snapshot.history.map((point) => ({ date: point.date, value: point.ai })), ai.date),
    liquidityLatest: liquidity.value,
    liquidityPrior: priorPrint(input.snapshot.history.map((point) => ({ date: point.date, value: point.liquidity })), liquidity.date),
    btcAbove200: btc.above200,
    realYield: seriesDirection(input.realYield, input.snapshot.today),
    dollar: seriesDirection(input.dollar, input.snapshot.today),
  });
  const themeOn = new Map(themes.map((theme) => [theme.id, theme.on]));

  const positions = new Map(input.journal.paper.positions.map((position) => [position.symbol, position]));
  const drafted: {
    symbol: string;
    name: string;
    kind: 'etf' | 'stock' | 'crypto';
    role: 'tactical' | 'systematic' | 'cash';
    status: 'confirmed' | 'watch' | 'avoid';
    entry: number | null;
    atr: number | null;
    volWeight: number;
    theme: string | null;
    dip: string | null;
    note: string;
    pyramid: ReturnType<typeof pyramidState>;
  }[] = [];

  const seen = new Set<string>();
  for (const row of input.ideas.rows) {
    seen.add(row.symbol);
    const kind = row.kind;
    const bars = barsOf(input.book, row.symbol);
    const atr = averageTrueRange(bars);
    const position = positions.get(row.symbol);
    const pyramid = pyramidState({
      hasPosition: Boolean(position),
      entry: position?.entry ?? null,
      riskPerShare: position?.riskPerShare ?? null,
      last: row.signals.lastClose,
    });
    const themesForSymbol = themeIdsFor(row.symbol);
    const on = themesForSymbol.some((id) => themeOn.get(id));
    const dip = themesForSymbol.length
      ? dipSignal({
        regime: input.snapshot.regime,
        themeOn: on,
        halted,
        closes: bars.map((bar) => bar.close),
        low: params.dipLow,
        high: params.dipHigh,
      })
      : null;
    drafted.push({
      symbol: row.symbol,
      name: row.name,
      kind,
      role: row.role,
      status: row.status,
      entry: row.signals.lastClose,
      atr,
      volWeight: row.maxWeight,
      theme: themesForSymbol[0] ?? null,
      dip: dip?.flagged ? dip.reason : null,
      note: '',
      pyramid,
    });
  }

  for (const theme of themes) {
    for (const symbol of theme.symbols) {
      if (seen.has(symbol.symbol)) continue;
      seen.add(symbol.symbol);
      const bars = barsOf(input.book, symbol.symbol);
      const last = bars.length ? bars[bars.length - 1].close : null;
      const position = positions.get(symbol.symbol);
      const dip = dipSignal({
        regime: input.snapshot.regime,
        themeOn: theme.on,
        halted,
        closes: bars.map((bar) => bar.close),
        low: params.dipLow,
        high: params.dipHigh,
      });
      drafted.push({
        symbol: symbol.symbol,
        name: symbol.name,
        kind: symbol.kind,
        role: symbol.kind === 'stock' ? 'systematic' : 'tactical',
        status: theme.on ? 'confirmed' : 'watch',
        entry: last,
        atr: averageTrueRange(bars),
        volWeight: 0,
        theme: theme.id,
        dip: dip.flagged ? dip.reason : null,
        note: '',
        pyramid: pyramidState({
          hasPosition: Boolean(position),
          entry: position?.entry ?? null,
          riskPerShare: position?.riskPerShare ?? null,
          last,
        }),
      });
    }
  }

  const raw = drafted.map((row) => {
    if (row.status !== 'confirmed') {
      row.note = 'Not sized. The playbook or the theme switch is not on.';
      return { role: row.role, raw: 0, qty: null as number | null, stop: null as number | null };
    }
    if (halted && row.pyramid === 'new') {
      row.note = 'No new entry. The paper portfolio is 10% or more below its peak. The drawdown halt wins over the return target.';
      return { role: row.role, raw: 0, qty: null, stop: null };
    }
    if (row.pyramid === 'no-add-loser') {
      row.note = 'Do not add. The open paper position is at or below its entry.';
      return { role: row.role, raw: 0, qty: null, stop: null };
    }
    if (row.pyramid === 'hold') {
      row.note = 'No add until the position is up at least 1R from its original entry.';
      return { role: row.role, raw: 0, qty: null, stop: null };
    }
    const sized = riskSize({
      capital,
      riskPct: params.riskPct,
      entry: row.entry,
      atr: row.atr,
      k: params.atrK,
      cap: roleCap(row.kind),
    });
    if (sized.weight == null) {
      row.note = row.atr == null
        ? 'ATR(20) is unavailable because high or low is missing. The weight falls back to the volatility target. No stop was invented.'
        : 'Risk size is unavailable, so no new quantity is proposed.';
      return { role: row.role, raw: row.volWeight, qty: null, stop: null };
    }
    row.note = row.pyramid === 'add'
      ? `Add allowed after +1R. Stop ${sized.stop?.toFixed(2)}. Risk ${(params.riskPct * 100).toFixed(2)}% of capital.`
      : `New risk unit. Stop ${sized.stop?.toFixed(2)}. Risk ${(params.riskPct * 100).toFixed(2)}% of capital.`;
    return { role: row.role, raw: sized.weight, qty: sized.qty, stop: sized.stop };
  });

  const budgeted = scaleWeights(raw, input.snapshot.effectiveBudget.maxGross, input.snapshot.effectiveBudget.maxNet);
  const crowded = budgeted.map((weight, index) => (
    drafted[index].role === 'cash' ? weight : Math.round(weight * input.ideas.crowding.scale * 1e6) / 1e6
  ));
  const overlap = applyOverlapCaps(
    drafted.map((row, index) => ({ symbol: row.symbol, status: row.status, weight: crowded[index] })),
    [],
  );
  let weights = overlap.weights;
  for (const theme of THEMES) {
    weights = capGroup(
      drafted.map((row, index) => ({ symbol: row.symbol, weight: weights[index] })),
      theme.symbols.map((symbol) => symbol.symbol),
      THEME_WEIGHT_CAP,
    );
  }

  const lines: RiskLine[] = drafted.map((row, index) => {
    const weight = weights[index] ?? 0;
    const qty = raw[index].qty != null && raw[index].raw > 0
      ? Math.round((raw[index].qty as number) * (weight / raw[index].raw) * 1e6) / 1e6
      : null;
    return {
      symbol: row.symbol,
      name: row.name,
      stop: raw[index].stop,
      qty,
      weight,
      note: row.note,
      dip: row.dip,
      theme: row.theme,
    };
  });

  const byTheme = themes.map((theme) => ({
    ...theme,
    lines: lines.filter((line) => themeIdsFor(line.symbol).includes(theme.id)),
  }));

  const curve = input.journal.paper.marks.map((mark) => mark.equity);
  const realised = cagrFromCurve(curve.length ? [capital, ...curve] : []);
  const backtested = input.journal.weeks.length ? input.journal.weeks[input.journal.weeks.length - 1].portfolio.cagr : null;
  const maxDrawdown = input.journal.weeks.length
    ? input.journal.weeks[input.journal.weeks.length - 1].portfolio.maxDrawdown
    : (input.journal.paper.marks.length ? drawdown.drawdown : null);
  const gaps = [...input.ideas.gaps];
  if (input.journal.gap) gaps.push(input.journal.gap);
  if (overlap.gap) gaps.push(overlap.gap);
  const weekStart = input.snapshot.today;
  const changes = input.journal.changes.filter((change) => change.at.slice(0, 10) >= shiftDays(weekStart, -7));

  return {
    themes: byTheme,
    lines,
    capital,
    targetCagr,
    drawdown: input.journal.paper.marks.length ? drawdown.drawdown : null,
    halted,
    equity: input.journal.paper.marks.length ? equity : null,
    peakEquity: input.journal.paper.marks.length ? peak : null,
    realisedCagr: realised,
    backtestedCagr: backtested,
    maxDrawdown,
    gapToTarget: realised == null ? null : targetCagr - realised,
    changes,
    configVersion: THEME_CONFIG_VERSION,
    changelog: THEME_CHANGELOG,
    gaps,
    params,
  };
}

function shiftDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

export function callsFromDesk(desk: Desk, regime: RegimeId | null, date: string): Journal['calls'] {
  const calls: Journal['calls'] = [];
  for (const theme of desk.themes) {
    calls.push({
      date,
      ruleId: `theme:${theme.id}`,
      symbol: theme.id,
      call: theme.on ? 'on' : 'off',
      entry: null,
    });
  }
  for (const line of desk.lines) {
    if (line.dip) {
      calls.push({ date, ruleId: 'dip', symbol: line.symbol, call: 'buy-the-dip', entry: null });
    }
    if (line.qty != null && line.qty > 0) {
      calls.push({ date, ruleId: 'risk-entry', symbol: line.symbol, call: line.note, entry: null });
    }
  }
  if (regime) {
    calls.push({ date, ruleId: 'regime', symbol: 'book', call: regime, entry: null });
  }
  return calls;
}

export function settleForward(calls: Journal['calls'], barsBySymbol: Record<string, Bar[]>): Journal['outcomes'] {
  const horizons = [5, 20, 60] as const;
  const outcomes: Journal['outcomes'] = [];
  for (const call of calls) {
    const bars = barsBySymbol[call.symbol];
    if (!bars) continue;
    const index = bars.findIndex((bar) => bar.date >= call.date);
    if (index < 0 || !(bars[index].close > 0)) continue;
    for (const horizon of horizons) {
      const future = bars[index + horizon];
      if (!future || !(future.close > 0)) continue;
      outcomes.push({
        date: call.date,
        ruleId: call.ruleId,
        symbol: call.symbol,
        horizon,
        forwardReturn: future.close / bars[index].close - 1,
      });
    }
  }
  return outcomes;
}

export function applyPaperDay(input: {
  journal: Journal;
  desk: Desk;
  prices: Record<string, number>;
  date: string;
  capital: number;
}): Journal {
  if (input.journal.paper.marks.some((mark) => mark.date === input.date)) return input.journal;
  const next: Journal = JSON.parse(JSON.stringify(input.journal)) as Journal;
  let cash = next.paper.cash ?? input.capital;
  const positions: PaperPosition[] = next.paper.positions.map((position) => ({ ...position }));
  const stopped = new Set<string>();
  const kept: PaperPosition[] = [];
  for (const position of positions) {
    const price = input.prices[position.symbol];
    if (price == null || !(price > 0)) {
      kept.push(position);
      continue;
    }
    if (price <= position.stop) {
      cash += position.qty * price;
      stopped.add(position.symbol);
      continue;
    }
    kept.push(position);
  }
  const open = new Map(kept.map((position) => [position.symbol, position]));
  for (const line of input.desk.lines) {
    if (stopped.has(line.symbol)) continue;
    if (line.qty == null || !(line.qty > 0) || line.stop == null) continue;
    const price = input.prices[line.symbol];
    if (price == null || !(price > 0)) continue;
    const existing = open.get(line.symbol);
    const cost = line.qty * price;
    if (!(cash >= cost)) continue;
    if (!existing) {
      cash -= cost;
      open.set(line.symbol, {
        symbol: line.symbol,
        qty: line.qty,
        entry: price,
        stop: line.stop,
        riskPerShare: price - line.stop,
        openedOn: input.date,
      });
    } else if (price >= existing.entry + existing.riskPerShare) {
      cash -= cost;
      existing.qty += line.qty;
    }
  }
  const held: PaperPosition[] = [];
  open.forEach((position) => held.push(position));
  let equity = cash;
  for (const position of held) {
    const price = input.prices[position.symbol];
    if (price == null || !(price > 0)) return input.journal;
    equity += position.qty * price;
  }
  const peak = Math.max(next.paper.peakEquity ?? input.capital, equity);
  next.paper.cash = cash;
  next.paper.peakEquity = peak;
  next.paper.positions = held;
  next.paper.marks = next.paper.marks.concat([{ date: input.date, equity }]);
  const calls = callsFromDesk(input.desk, null, input.date);
  next.calls = next.calls.filter((call) => call.date !== input.date).concat(calls);
  return next;
}
