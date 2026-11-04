import type { Bar } from './signals';

export const ATR_WINDOW = 20;
export const DEFAULT_ATR_K = 2.5;
export const DEFAULT_RISK_PCT = 0.0075;
export const MIN_RISK_PCT = 0.005;
export const MAX_RISK_PCT = 0.01;
export const THEME_WEIGHT_CAP = 0.2;
export const DRAWDOWN_HALT = 0.1;
export const DEFAULT_CAPITAL = 100_000;
export const ADD_AFTER_R = 1;
/** Display only. The weekly job does not read this, and it does not widen risk bounds. */
export const DEFAULT_TARGET_CAGR = 0.66;
export const ASPIRATION_LABEL = 'Aspiration (Medallion gross ceiling 1988-2018) — not a forecast';

/** Simple average of the last 20 true ranges. Null when high or low is missing. Nothing is approximated from the close. */
export function averageTrueRange(bars: Bar[], window = ATR_WINDOW): number | null {
  if (bars.length < window + 1) return null;
  const ranges: number[] = [];
  for (let i = bars.length - window; i < bars.length; i++) {
    const bar = bars[i];
    const prev = bars[i - 1];
    if (bar.high == null || bar.low == null || !(bar.high > 0) || !(bar.low > 0) || !(prev.close > 0)) return null;
    const tr = Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close));
    if (!Number.isFinite(tr) || tr < 0) return null;
    ranges.push(tr);
  }
  let sum = 0;
  for (const range of ranges) sum += range;
  return sum / ranges.length;
}

export interface RiskSize {
  stop: number | null;
  qty: number | null;
  weight: number | null;
  riskPerShare: number | null;
}

/**
 * stop = entry − k × ATR(20).
 * qty = (capital × risk%) / (entry − stop).
 * Weight is notional / capital, then the single-name cap.
 * risk% outside 0.5–1% returns an empty size rather than a silent clamp.
 */
export function riskSize(input: {
  capital: number;
  riskPct: number;
  entry: number | null;
  atr: number | null;
  k: number;
  cap: number;
}): RiskSize {
  const empty: RiskSize = { stop: null, qty: null, weight: null, riskPerShare: null };
  if (!(input.capital > 0) || !(input.entry != null && input.entry > 0)) return empty;
  if (!(input.atr != null && input.atr > 0) || !(input.k > 0)) return empty;
  if (!(input.riskPct >= MIN_RISK_PCT && input.riskPct <= MAX_RISK_PCT)) return empty;
  const riskPerShare = input.k * input.atr;
  const stop = input.entry - riskPerShare;
  if (!(stop > 0) || !(riskPerShare > 0)) return empty;
  const qty = (input.capital * input.riskPct) / riskPerShare;
  if (!Number.isFinite(qty) || qty <= 0) return empty;
  const rawWeight = (qty * input.entry) / input.capital;
  const cap = input.cap > 0 ? input.cap : 0;
  const weight = Math.min(rawWeight, cap);
  const cappedQty = weight < rawWeight && input.entry > 0 ? (weight * input.capital) / input.entry : qty;
  return {
    stop,
    qty: Math.round(cappedQty * 1e6) / 1e6,
    weight: Math.round(weight * 1e6) / 1e6,
    riskPerShare,
  };
}

export type PyramidState = 'new' | 'add' | 'hold' | 'no-add-loser';

/** Add only after the open risk (1R) is earned. A price at or below the original entry is a loser: do not add. */
export function pyramidState(input: {
  hasPosition: boolean;
  entry: number | null;
  riskPerShare: number | null;
  last: number | null;
}): PyramidState {
  if (!input.hasPosition) return 'new';
  if (input.entry == null || input.last == null || input.riskPerShare == null || !(input.riskPerShare > 0)) return 'hold';
  if (input.last <= input.entry) return 'no-add-loser';
  if (input.last >= input.entry + ADD_AFTER_R * input.riskPerShare) return 'add';
  return 'hold';
}

export function drawdownState(equity: number, peak: number, limit = DRAWDOWN_HALT): { drawdown: number | null; halted: boolean } {
  if (!(peak > 0) || !Number.isFinite(equity) || !Number.isFinite(peak)) return { drawdown: null, halted: false };
  const drawdown = (peak - equity) / peak;
  return { drawdown, halted: drawdown >= limit - 1e-12 };
}

export function resolveCapital(envValue: string | undefined, saved: number | null): number {
  if (saved != null && Number.isFinite(saved) && saved > 0) return saved;
  if (envValue != null && envValue.trim() !== '') {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_CAPITAL;
}

export function resolveTargetCagr(envValue: string | undefined, saved: number | null): number {
  if (saved != null && Number.isFinite(saved) && saved >= 0 && saved <= 2) return saved;
  if (envValue != null && envValue.trim() !== '') {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 2) return parsed;
  }
  return DEFAULT_TARGET_CAGR;
}

export function roleCap(kind: 'etf' | 'stock' | 'crypto'): number {
  return kind === 'stock' ? 0.02 : 0.2;
}

/** Scale a named group down to a cap. Members keep their proportions. */
export function capGroup(weights: { symbol: string; weight: number }[], members: string[], cap: number): number[] {
  const set = new Set(members);
  const out = weights.map((row) => (row.weight > 0 ? row.weight : 0));
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    if (set.has(weights[i].symbol)) sum += out[i];
  }
  if (sum > cap && sum > 0 && cap >= 0) {
    const factor = cap / sum;
    for (let i = 0; i < weights.length; i++) {
      if (set.has(weights[i].symbol)) out[i] = Math.round(out[i] * factor * 1e6) / 1e6;
    }
  }
  return out;
}
