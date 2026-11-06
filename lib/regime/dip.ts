import { mean } from './stats';
import type { RegimeId } from './constants';

export const DIP_LOW = 0.1;
export const DIP_HIGH = 0.2;
export const DIP_HIGH_WINDOW = 60;
export const DIP_MA = 20;
export const DIP_LABEL = 'Buy the dip — confirmed';

export interface DipResult {
  flagged: boolean;
  reason: string;
}

/**
 * Risk-On or Transitional only, theme on, 10–20% below the 60-day high,
 * and the close back above the 20-day average. Never in stress or crisis,
 * and never while the paper drawdown halt is on.
 */
export function dipSignal(input: {
  regime: RegimeId | null;
  themeOn: boolean;
  halted: boolean;
  closes: number[];
  low?: number;
  high?: number;
}): DipResult {
  const low = input.low ?? DIP_LOW;
  const high = input.high ?? DIP_HIGH;
  if (input.halted) return { flagged: false, reason: 'Drawdown halt is active. No new dip entry.' };
  if (input.regime !== 'risk_on' && input.regime !== 'transitional') {
    return { flagged: false, reason: 'Dip entries are only considered in Risk-On or Transitional regimes.' };
  }
  if (!input.themeOn) return { flagged: false, reason: 'The theme is off.' };
  if (!(low < high)) return { flagged: false, reason: 'Dip band is invalid.' };
  if (input.closes.length < DIP_HIGH_WINDOW) {
    return { flagged: false, reason: 'Fewer than 60 closes, so the dip is not measured.' };
  }
  const window = input.closes.slice(-DIP_HIGH_WINDOW);
  const last = window[window.length - 1];
  let peak = window[0];
  for (const price of window) if (price > peak) peak = price;
  if (!(last > 0) || !(peak > 0)) return { flagged: false, reason: 'Price is missing.' };
  const drawdown = 1 - last / peak;
  const ma = mean(input.closes.slice(-DIP_MA));
  const above = last > ma;
  const inBand = drawdown >= low - 1e-12 && drawdown <= high + 1e-12;
  if (inBand && above) {
    return { flagged: true, reason: `${(drawdown * 100).toFixed(1)}% below the 60-day high and back above the 20-day average.` };
  }
  if (!inBand) {
    return { flagged: false, reason: `${(drawdown * 100).toFixed(1)}% below the 60-day high, outside the ${(low * 100).toFixed(0)}–${(high * 100).toFixed(0)}% band.` };
  }
  return { flagged: false, reason: 'Inside the dip band, but the close is not back above the 20-day average.' };
}
