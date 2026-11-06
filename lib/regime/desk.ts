import type { RegimeId } from './constants';
import { pairTable } from './correlation';
import { dipSignal } from './dip';
import { dipDisplay } from './plain';
import { checklistNote, ideaGates, sizingVerdict, type GateCheck } from './gates';
import type { IdeaStatus, IdeasReport } from './ideas';
import { defensiveOnly, printStance, scaleWeights, volTargetWeight } from './ideas';
import type { Journal, PaperPosition } from './journal';
import { applyOverlapCaps, OVERLAP_GROUP_CAP, type OverlapGroup } from './overlap';
import type { PriceBook } from './prices';
import type { SeriesPoint } from './series';
import type { QuantSignals } from './signals';
import { expressionFor, type Stance } from './universe';
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
import { evaluateThemes, priorPrint, seriesDirection, themesForSymbol, type ThemeVerdict } from './themes';
import { THEME_CHANGELOG, THEME_CONFIG_VERSION, THEMES } from './themes.config';
import type { RegimeSnapshot } from './types';
import { cagrFromCurve } from './improve';
import type { WeekChange } from './improve';

export interface RiskLine {
  symbol: string;
  name: string;
  role: 'tactical' | 'systematic' | 'cash';
  defensive: boolean;
  status: IdeaStatus;
  stop: number | null;
  qty: number | null;
  weight: number;
  note: string;
  verdict: string;
  gates: GateCheck[];
  dip: string | null;
  theme: string | null;
  above200: boolean | null;
  momentum12_1: number | null;
  reversionZ: number | null;
  pyramid: 'new' | 'add' | 'hold' | 'no-add-loser';
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
  overlap: { groups: OverlapGroup[]; gap: string | null; cap: number };
  crowdingScale: number;
  realisedText: string;
  backtestedText: string;
  gapText: string;
  maxDrawdownText: string;
}

function latestComponent(snapshot: RegimeSnapshot, id: 'ai' | 'liquidity'): { value: number | null; date: string | null } {
  const component = snapshot.components.find((item) => item.id === id);
  return { value: component?.z ?? null, date: component?.asOf ?? null };
}

function barsOf(book: PriceBook, symbol: string): Bar[] {
  return book.series.find((series) => series.symbol === symbol)?.bars ?? [];
}

function themeIdsFor(symbol: string): string[] {
  return themesForSymbol(symbol).map((theme) => theme.id);
}

function measured(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return 'Not enough history yet';
  return `${(value * 100).toFixed(digits)}%`;
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

  const positions = new Map(input.journal.paper.positions.map((position) => [position.symbol, position]));
  const standDown = defensiveOnly(input.snapshot.action);
  const regimeOpen = !standDown && (input.snapshot.regime === 'risk_on' || input.snapshot.regime === 'transitional');
  const drafted: {
    symbol: string;
    name: string;
    kind: 'etf' | 'stock' | 'crypto';
    role: 'tactical' | 'systematic' | 'cash';
    defensive: boolean;
    signals: QuantSignals;
    entry: number | null;
    atr: number | null;
    volWeight: number;
    theme: string | null;
    dipFact: string | null;
    gates: GateCheck[];
    stance: Stance | null;
    eligible: boolean;
    atrGap: boolean;
    pyramid: ReturnType<typeof pyramidState>;
  }[] = [];

  const pushDraft = (row: {
    symbol: string;
    name: string;
    kind: 'etf' | 'stock' | 'crypto';
    role: 'tactical' | 'systematic' | 'cash';
    defensive: boolean;
    signals: QuantSignals;
    bars: ReturnType<typeof barsOf>;
    volWeight: number;
  }) => {
    const position = positions.get(row.symbol);
    const pyramid = pyramidState({
      hasPosition: Boolean(position),
      entry: position?.entry ?? null,
      riskPerShare: position?.riskPerShare ?? null,
      last: row.signals.lastClose,
    });
    const mapped = themesForSymbol(row.symbol).map((config) => {
      const live = themes.find((theme) => theme.id === config.id);
      return { id: config.id, label: live?.label ?? config.label, on: live?.on === true };
    });
    const expression = expressionFor(row.symbol);
    const stance = expression ? printStance(expression, input.snapshot.regime, standDown) : null;
    const gates = ideaGates({
      themes: mapped,
      stance,
      regimeOpen,
      role: row.role,
      signals: row.signals,
      today: input.snapshot.today,
      health: input.ideas.signalHealth,
      halted,
      pyramid,
    });
    const dip = mapped.length
      ? dipSignal({
        regime: input.snapshot.regime,
        themeOn: mapped.some((theme) => theme.on),
        halted,
        closes: row.bars.map((bar) => bar.close),
        low: params.dipLow,
        high: params.dipHigh,
      })
      : null;
    const eligible = gates.every((item) => item.pass) && (pyramid === 'new' || pyramid === 'add');
    drafted.push({
      symbol: row.symbol,
      name: row.name,
      kind: row.kind,
      role: row.role,
      defensive: row.defensive,
      signals: row.signals,
      entry: row.signals.lastClose,
      atr: averageTrueRange(row.bars),
      volWeight: row.volWeight,
      theme: mapped[0]?.id ?? null,
      dipFact: dip?.flagged ? dip.reason : null,
      gates,
      stance,
      eligible,
      atrGap: false,
      pyramid,
    });
  };

  const seen = new Set<string>();
  for (const row of input.ideas.rows) {
    seen.add(row.symbol);
    pushDraft({
      symbol: row.symbol,
      name: row.name,
      kind: row.kind,
      role: row.role,
      defensive: row.defensive,
      signals: row.signals,
      bars: barsOf(input.book, row.symbol),
      volWeight: volTargetWeight(input.snapshot.effectiveBudget.volTarget, row.signals.annVol20, row.role),
    });
  }

  for (const theme of themes) {
    for (const symbol of theme.symbols) {
      if (seen.has(symbol.symbol)) continue;
      seen.add(symbol.symbol);
      const bars = barsOf(input.book, symbol.symbol);
      const signals = computeSignals(bars);
      const expression = expressionFor(symbol.symbol);
      pushDraft({
        symbol: symbol.symbol,
        name: symbol.name,
        kind: symbol.kind,
        role: symbol.kind === 'stock' ? 'systematic' : 'tactical',
        defensive: expression?.defensive ?? false,
        signals,
        bars,
        volWeight: volTargetWeight(
          input.snapshot.effectiveBudget.volTarget,
          signals.annVol20,
          symbol.kind === 'stock' ? 'systematic' : 'tactical',
        ),
      });
    }
  }

  const raw = drafted.map((row) => {
    if (!row.eligible) return { role: row.role, raw: 0, qty: null as number | null, stop: null as number | null };
    const sized = riskSize({
      capital,
      riskPct: params.riskPct,
      entry: row.entry,
      atr: row.atr,
      k: params.atrK,
      cap: roleCap(row.kind),
    });
    if (sized.weight == null) {
      if (row.atr == null && row.volWeight > 0) {
        row.atrGap = true;
        return { role: row.role, raw: row.volWeight, qty: null, stop: null };
      }
      return { role: row.role, raw: 0, qty: null, stop: null };
    }
    return { role: row.role, raw: sized.weight, qty: sized.qty, stop: sized.stop };
  });

  const budgeted = scaleWeights(raw, input.snapshot.effectiveBudget.maxGross, input.snapshot.effectiveBudget.maxNet);
  const crowded = budgeted.map((weight, index) => (
    drafted[index].role === 'cash' ? weight : Math.round(weight * input.ideas.crowding.scale * 1e6) / 1e6
  ));
  const eligibleSymbols = drafted.filter((row) => row.eligible).map((row) => row.symbol);
  const pairResult = pairTable(input.book.series, eligibleSymbols);
  const overlap = applyOverlapCaps(
    drafted.map((row, index) => ({
      symbol: row.symbol,
      status: row.eligible ? 'confirmed' as const : 'watch' as const,
      weight: crowded[index],
    })),
    pairResult.unavailable ? null : pairResult.pairs,
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
    const sized = sizingVerdict({ gates: row.gates, stance: row.stance, pyramid: row.pyramid, weight });
    const failedGate = row.gates.find((gate) => !gate.pass);
    const dip = row.dipFact
      ? dipDisplay({
        fact: row.dipFact,
        sized: sized.status === 'confirmed' && weight > 0,
        failure: failedGate ? failedGate.detail : null,
      })
      : null;
    let note = checklistNote(row.gates, sized.verdict);
    if (row.atrGap && weight > 0) {
      note += '\nATR(20) is unavailable, so the weight uses the volatility target. No stop was invented.';
    } else if (raw[index].stop != null && weight > 0) {
      note += `\nStop ${raw[index].stop?.toFixed(2)}. Risk ${(params.riskPct * 100).toFixed(2)}% of capital.`;
    }
    return {
      symbol: row.symbol,
      name: row.name,
      role: row.role,
      defensive: row.defensive,
      status: sized.status,
      stop: sized.status === 'confirmed' ? raw[index].stop : null,
      qty: sized.status === 'confirmed' ? qty : null,
      weight: sized.status === 'confirmed' ? weight : 0,
      note,
      verdict: sized.verdict,
      gates: row.gates,
      dip,
      theme: row.theme,
      above200: row.signals.above200,
      momentum12_1: row.signals.momentum12_1,
      reversionZ: row.signals.reversionZ,
      pyramid: row.pyramid,
    };
  });

  const displayed = applyOverlapCaps(
    lines.map((line) => ({ symbol: line.symbol, status: line.status, weight: line.weight })),
    pairResult.unavailable ? null : pairResult.pairs,
  );
  const overlapView = {
    groups: displayed.groups.map((group) => {
      let shown = 0;
      for (const symbol of group.symbols) {
        const line = lines.find((item) => item.symbol === symbol);
        shown += line?.weight ?? 0;
      }
      return { ...group, combinedAfter: Math.round(shown * 1e6) / 1e6 };
    }),
    gap: displayed.gap,
    cap: OVERLAP_GROUP_CAP,
  };

  const byTheme = themes.map((theme) => ({
    ...theme,
    lines: lines.filter((line) => themeIdsFor(line.symbol).includes(theme.id)),
  }));

  const curve = input.journal.paper.marks.map((mark) => mark.equity);
  const realised = cagrFromCurve(curve.length ? [capital, ...curve] : []);
  const lastWeek = input.journal.weeks.length ? input.journal.weeks[input.journal.weeks.length - 1] : null;
  const backtested = lastWeek ? lastWeek.portfolio.cagr : null;
  const maxDrawdown = lastWeek
    ? lastWeek.portfolio.maxDrawdown
    : (input.journal.paper.marks.length ? drawdown.drawdown : null);
  const gaps = [...input.ideas.gaps];
  if (input.journal.gap) gaps.push(input.journal.gap);
  if (overlapView.gap) gaps.push(overlapView.gap);
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
    overlap: overlapView,
    crowdingScale: input.ideas.crowding.scale,
    realisedText: measured(realised),
    backtestedText: measured(backtested),
    gapText: measured(realised == null ? null : targetCagr - realised),
    maxDrawdownText: measured(maxDrawdown),
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
