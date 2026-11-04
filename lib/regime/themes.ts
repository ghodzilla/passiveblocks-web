import { ageInDays } from './stats';
import type { SeriesPoint } from './series';
import { THEMES, type ThemeConfig } from './themes.config';

/** Baskets that contain this symbol, in config order. Empty when the sleeve has no theme. */
export function themesForSymbol(symbol: string): ThemeConfig[] {
  return THEMES.filter((theme) => theme.symbols.some((item) => item.symbol === symbol));
}

export type SeriesDirection = 'falling' | 'rising' | 'flat' | 'unknown';

export function seriesDirection(points: SeriesPoint[], today: string, staleAfterDays = 10): SeriesDirection {
  if (points.length < 2) return 'unknown';
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!Number.isFinite(last.value) || !Number.isFinite(prev.value)) return 'unknown';
  const age = ageInDays(last.date, today);
  if (!Number.isFinite(age) || age > staleAfterDays) return 'unknown';
  if (last.value < prev.value) return 'falling';
  if (last.value > prev.value) return 'rising';
  return 'flat';
}

/** True only when both prints exist and the latest is strictly higher. */
export function componentRising(latest: number | null, prior: number | null): boolean | null {
  if (latest == null || prior == null || !Number.isFinite(latest) || !Number.isFinite(prior)) return null;
  return latest > prior;
}

export function priorPrint(values: { date: string; value: number | null }[], latestDate: string | null): number | null {
  const rows = values.filter((row) => row.value != null && Number.isFinite(row.value) && (latestDate == null || row.date < latestDate));
  const last = rows[rows.length - 1];
  return last ? last.value : null;
}

export interface ThemeVerdict {
  id: string;
  label: string;
  enabled: boolean;
  on: boolean;
  objective: string;
  reason: string;
  symbols: ThemeConfig['symbols'];
}

function formatZ(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

export function evaluateThemes(input: {
  themes?: ThemeConfig[];
  aiLatest: number | null;
  aiPrior: number | null;
  liquidityLatest: number | null;
  liquidityPrior: number | null;
  btcAbove200: boolean | null;
  realYield: SeriesDirection;
  dollar: SeriesDirection;
}): ThemeVerdict[] {
  const themes = input.themes ?? THEMES;
  return themes.map((theme) => {
    if (!theme.enabled) {
      return {
        id: theme.id,
        label: theme.label,
        enabled: false,
        on: false,
        objective: theme.objective,
        reason: 'Objective switch is off in the theme config. The basket is not a candidate.',
        symbols: theme.symbols,
      };
    }
    if (theme.id === 'ai-infrastructure') {
      const rising = componentRising(input.aiLatest, input.aiPrior);
      if (rising == null) {
        return verdict(theme, false, 'Off. The AI capex component does not have two prints, so a rise cannot be claimed.');
      }
      return verdict(
        theme,
        rising,
        rising
          ? `On. AI capex z moved from ${formatZ(input.aiPrior as number)} to ${formatZ(input.aiLatest as number)}.`
          : `Off. AI capex z is ${formatZ(input.aiLatest as number)}, not above the prior print of ${formatZ(input.aiPrior as number)}.`,
      );
    }
    if (theme.id === 'crypto') {
      const rising = componentRising(input.liquidityLatest, input.liquidityPrior);
      if (input.btcAbove200 == null || rising == null) {
        const missing = [
          input.btcAbove200 == null ? 'Bitcoin does not have a 200-day average yet' : null,
          rising == null ? 'liquidity does not have two prints' : null,
        ].filter((item): item is string => Boolean(item));
        return verdict(theme, false, `Off. ${missing.join(', and ')}. Both conditions are required.`);
      }
      const on = input.btcAbove200 && rising;
      const btc = input.btcAbove200 ? 'Bitcoin is above its 200-day average' : 'Bitcoin is not above its 200-day average';
      const liq = rising
        ? `liquidity z rose from ${formatZ(input.liquidityPrior as number)} to ${formatZ(input.liquidityLatest as number)}`
        : `liquidity z is ${formatZ(input.liquidityLatest as number)}, not above ${formatZ(input.liquidityPrior as number)}`;
      return verdict(theme, on, on ? `On. ${btc}, and ${liq}.` : `Off. ${btc}, and ${liq}.`);
    }
    if (theme.id === 'scarcity') {
      const yieldFalling = input.realYield === 'falling';
      const dollarWeak = input.dollar === 'falling';
      if (input.realYield === 'unknown' && input.dollar === 'unknown') {
        return verdict(theme, false, 'Off. Real yields (DFII10) and the dollar (DTWEXBGS) are both unavailable, so neither leg of the rule can fire.');
      }
      if (yieldFalling || dollarWeak) {
        const bits = [
          yieldFalling ? 'the 10-year real yield is falling' : null,
          dollarWeak ? 'the trade-weighted dollar is weakening' : null,
        ].filter((item): item is string => Boolean(item));
        const unknown = [
          input.realYield === 'unknown' ? 'Real yields were unavailable.' : null,
          input.dollar === 'unknown' ? 'The dollar index was unavailable.' : null,
        ].filter((item): item is string => Boolean(item));
        return verdict(theme, true, `On. ${bits.join(', and ')}. ${unknown.join(' ')}`.trim());
      }
      return verdict(
        theme,
        false,
        `Off. Real yields are ${input.realYield}, and the dollar is ${input.dollar}. The theme needs falling real yields or a weaker dollar.`,
      );
    }
    return verdict(theme, false, 'Off. This theme id has no rule.');
  });
}

function verdict(theme: ThemeConfig, on: boolean, reason: string): ThemeVerdict {
  return {
    id: theme.id,
    label: theme.label,
    enabled: theme.enabled,
    on,
    objective: theme.objective,
    reason,
    symbols: theme.symbols,
  };
}
