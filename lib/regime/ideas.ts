import type { ActionId } from './classify';
import type { ComponentId, RegimeId } from './constants';
import type { QuantSignals } from './signals';
import { computeSignals, quantAgrees, signalStrength } from './signals';
import type { ComponentScore, RegimeSnapshot } from './types';
import {
  EXPRESSIONS,
  expressionFor,
  resolveUniverse,
  type AssetClass,
  type Expression,
  type Instrument,
  type InstrumentRole,
  type Stance,
} from './universe';
import type { PriceBook } from './prices';

export const SINGLE_POSITION_CAP = 0.2;
export const SYSTEMATIC_CAP = 0.02;
/** Cash vol-targeting uses this floor so a near-zero vol does not imply a huge weight. */
export const CASH_VOL_FLOOR = 0.03;
export const PRICE_STALE_DAYS = 7;

export type IdeaStatus = 'confirmed' | 'watch' | 'avoid';

export interface IdeaRow {
  symbol: string;
  name: string;
  venue: 'US' | 'ASX';
  kind: 'etf' | 'stock';
  assetClass: AssetClass;
  sleeve: string;
  role: InstrumentRole;
  defensive: boolean;
  status: IdeaStatus;
  strength: number | null;
  signals: QuantSignals;
  maxWeight: number;
  rationale: string;
  drivers: string;
  invalidation: string;
  priceStale: boolean;
  source: string | null;
}

export interface PlaybookRow {
  id: string;
  assetClass: AssetClass;
  label: string;
  symbols: string[];
  mapStance: Stance;
  printStance: Stance;
  defensive: boolean;
  rationale: string;
  drivers: string;
}

export interface IdeasReport {
  defensiveOnly: boolean;
  action: ActionId;
  regime: RegimeId | null;
  banner: string | null;
  playbook: PlaybookRow[];
  rows: IdeaRow[];
  watchlistNote: string | null;
  gaps: string[];
  pricesFetchedAt: string | null;
  singlePositionCap: number;
  systematicCap: number;
}

export function defensiveOnly(action: ActionId): boolean {
  return action === 'do_nothing' || action === 'reduce_risk';
}

export function printStance(expression: Expression, regime: RegimeId | null, standDown: boolean): Stance {
  const map = expression.stance[regime ?? 'preservation'];
  if (!standDown) return map;
  if (!expression.defensive) return 'avoid';
  if (expression.role === 'cash') return 'prefer';
  if (map === 'avoid') return 'avoid';
  return 'prefer';
}

export function priceIsFresh(asOf: string | null, today: string): boolean {
  if (!asOf) return false;
  const ageMs = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(ageMs)) return false;
  return ageMs <= PRICE_STALE_DAYS * 86_400_000;
}

export function volTargetWeight(volTarget: number, annVol: number | null, role: InstrumentRole): number {
  if (annVol == null || !Number.isFinite(annVol) || annVol < 0) return 0;
  if (!Number.isFinite(volTarget) || volTarget <= 0) return 0;
  const vol = role === 'cash' ? Math.max(annVol, CASH_VOL_FLOOR) : annVol;
  if (vol <= 0) return 0;
  const cap = role === 'systematic' ? SYSTEMATIC_CAP : SINGLE_POSITION_CAP;
  return Math.min(volTarget / vol, cap);
}

/**
 * Non-cash weights are scaled to maxNet first (zero when maxNet is 0).
 * The book is then scaled so the sum of suggested weights does not exceed maxGross.
 */
export function scaleWeights(
  rows: { role: InstrumentRole; raw: number }[],
  maxGross: number,
  maxNet: number,
): number[] {
  const gross = Number.isFinite(maxGross) && maxGross > 0 ? maxGross : 0;
  const net = Number.isFinite(maxNet) && maxNet > 0 ? maxNet : 0;
  const weights = rows.map((row) => (row.raw > 0 ? row.raw : 0));
  let riskSum = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].role !== 'cash') riskSum += weights[i];
  }
  if (riskSum > net) {
    const factor = net === 0 || riskSum === 0 ? 0 : net / riskSum;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].role !== 'cash') weights[i] *= factor;
    }
  }
  let total = 0;
  for (const weight of weights) total += weight;
  if (total > gross && total > 0) {
    const factor = gross / total;
    for (let i = 0; i < weights.length; i++) weights[i] *= factor;
  }
  return weights.map((weight) => Math.round(weight * 1e6) / 1e6);
}

export function invalidationText(input: {
  status: IdeaStatus;
  role: InstrumentRole;
  ma200: number | null;
  regimeLabel: string;
  standDown: boolean;
}): string {
  if (input.status === 'avoid') {
    return 'Not a sized idea. It is sized only if the playbook prefers it on an open budget and the quant signals agree.';
  }
  if (input.role === 'cash') {
    return input.standDown
      ? 'Invalid if the action leaves do nothing / reduce risk, or cash stops being the ballast.'
      : 'Invalid if the regime stops preferring cash. A price trend is not the invalidation.';
  }
  const trend = input.ma200 != null
    ? `close falls through the 200-day average (${input.ma200.toFixed(2)})`
    : 'the 200-day trend breaks';
  const regime = input.standDown
    ? 'the action leaves do nothing / reduce risk'
    : `the regime leaves ${input.regimeLabel}`;
  return `Invalid if ${trend}, 12–1 month momentum flips negative, or ${regime}.`;
}

function driverText(drivers: ComponentId[], components: ComponentScore[]): string {
  return drivers
    .map((id) => {
      const component = components.find((item) => item.id === id);
      const label = component?.label ?? id;
      const z = component?.z;
      if (z == null || !Number.isFinite(z)) return `${label} z —`;
      const sign = z > 0 ? '+' : '';
      return `${label} z ${sign}${z.toFixed(2)}`;
    })
    .join(', ');
}

function decideStatus(stance: Stance, agreed: boolean, fresh: boolean): IdeaStatus {
  if (stance === 'avoid') return 'avoid';
  if (stance !== 'prefer' || !agreed || !fresh) return 'watch';
  return 'confirmed';
}

export function buildIdeas(input: {
  snapshot: Pick<RegimeSnapshot, 'regime' | 'regimeLabel' | 'action' | 'message' | 'today' | 'effectiveBudget' | 'components'>;
  book: PriceBook;
  watchlist?: string;
}): IdeasReport {
  const standDown = defensiveOnly(input.snapshot.action);
  const instruments = resolveUniverse(input.watchlist);
  const bySymbol = new Map<string, PriceBook['series'][number]>();
  for (const series of input.book.series) bySymbol.set(series.symbol, series);

  const playbook: PlaybookRow[] = EXPRESSIONS.map((expression) => ({
    id: expression.id,
    assetClass: expression.assetClass,
    label: expression.label,
    symbols: expression.symbols,
    mapStance: expression.stance[input.snapshot.regime ?? 'preservation'],
    printStance: printStance(expression, input.snapshot.regime, standDown),
    defensive: expression.defensive,
    rationale: expression.rationale,
    drivers: driverText(expression.drivers, input.snapshot.components),
  }));

  const equity = EXPRESSIONS.find((expression) => expression.id === 'equity-beta') as Expression;
  const stocksLive = !standDown && printStance(equity, input.snapshot.regime, false) === 'prefer';

  const drafted: {
    instrument: Instrument;
    sleeve: string;
    signals: QuantSignals;
    status: IdeaStatus;
    strength: number | null;
    rationale: string;
    drivers: string;
    priceStale: boolean;
    source: string | null;
  }[] = [];

  for (const instrument of instruments) {
    if (instrument.kind === 'stock' && !stocksLive) continue;
    const expression = expressionFor(instrument.symbol);
    const stance: Stance = instrument.kind === 'stock'
      ? 'prefer'
      : expression
        ? printStance(expression, input.snapshot.regime, standDown)
        : 'avoid';
    const series = bySymbol.get(instrument.symbol);
    const signals = computeSignals(series?.bars ?? []);
    const fresh = priceIsFresh(signals.asOf, input.snapshot.today);
    const agreed = quantAgrees(instrument.role, signals);
    const status = decideStatus(stance, agreed, fresh);
    const drivers = expression
      ? driverText(expression.drivers, input.snapshot.components)
      : driverText(['liquidity', 'credit', 'growth'], input.snapshot.components);
    const rationale = expression
      ? expression.rationale
      : 'Watchlist stock. It is a candidate only when equity beta is preferred on an open risk budget, and only when 12–1 momentum, the 200-day trend, and the 5-session return z-score agree.';
    drafted.push({
      instrument,
      sleeve: expression?.label ?? 'Watchlist',
      signals,
      status,
      strength: signalStrength(signals),
      rationale,
      drivers,
      priceStale: signals.asOf != null && !fresh,
      source: series?.source ?? null,
    });
  }

  const raw = drafted.map((row) => ({
    role: row.instrument.role,
    raw: row.status === 'confirmed'
      ? volTargetWeight(input.snapshot.effectiveBudget.volTarget, row.signals.annVol20, row.instrument.role)
      : 0,
  }));
  const weights = scaleWeights(raw, input.snapshot.effectiveBudget.maxGross, input.snapshot.effectiveBudget.maxNet);

  const rows: IdeaRow[] = drafted.map((row, index) => ({
    symbol: row.instrument.symbol,
    name: row.instrument.name,
    venue: row.instrument.venue,
    kind: row.instrument.kind,
    assetClass: row.instrument.assetClass,
    sleeve: row.sleeve,
    role: row.instrument.role,
    defensive: row.instrument.defensive,
    status: row.status,
    strength: row.strength,
    signals: row.signals,
    maxWeight: weights[index],
    rationale: row.rationale,
    drivers: row.drivers,
    invalidation: invalidationText({
      status: row.status,
      role: row.instrument.role,
      ma200: row.signals.ma200,
      regimeLabel: input.snapshot.regimeLabel,
      standDown,
    }),
    priceStale: row.priceStale,
    source: row.source,
  }));

  rows.sort((a, b) => {
    const order = { confirmed: 0, watch: 1, avoid: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const as = a.strength == null ? -Infinity : a.strength;
    const bs = b.strength == null ? -Infinity : b.strength;
    if (as !== bs) return bs - as;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });

  return {
    defensiveOnly: standDown,
    action: input.snapshot.action,
    regime: input.snapshot.regime,
    banner: standDown ? input.snapshot.message : null,
    playbook,
    rows,
    watchlistNote: stocksLive
      ? null
      : 'The stock watchlist is stood down. Do nothing / reduce risk limits candidates to defensive and cash expressions.',
    gaps: input.book.gaps.slice(),
    pricesFetchedAt: input.book.fetchedAt,
    singlePositionCap: SINGLE_POSITION_CAP,
    systematicCap: SYSTEMATIC_CAP,
  };
}
