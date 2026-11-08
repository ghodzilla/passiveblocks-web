import { priceIsFresh } from './ideas';

/** Yahoo symbol. The close is USD per 1 AUD. An AUD price of a USD asset is close / rate. */
export const FX_SYMBOL = 'AUDUSD=X';
export const FX_CONVENTION = 'USD per 1 AUD';

const USD_CRYPTO = ['BTC-USD', 'ETH-USD', 'SOL-USD'] as const;

export interface FxBar {
  date: string;
  close: number;
}

export interface StoredFx {
  symbol: typeof FX_SYMBOL;
  convention: typeof FX_CONVENTION;
  fetchedAt: string;
  observationDate: string | null;
  rate: number | null;
  adjusted: boolean | null;
  error: string | null;
  bars: FxBar[];
}

export interface FxStamp {
  symbol: typeof FX_SYMBOL;
  convention: typeof FX_CONVENTION;
  fetchedAt: string | null;
  observationDate: string | null;
  rate: number | null;
  fresh: boolean;
  error: string | null;
}

/**
 * ASX names and the cash sleeve are AUD. US listings and the crypto pairs are USD.
 * AUDUSD=X is the rate, not a holding.
 */
export function instrumentCurrency(symbol: string): 'AUD' | 'USD' {
  if (symbol === 'CASH' || symbol.endsWith('.AX')) return 'AUD';
  return 'USD';
}

export function instrumentCurrencyNote(symbol: string): string {
  if ((USD_CRYPTO as readonly string[]).includes(symbol)) {
    return `${symbol} is quoted in USD.`;
  }
  if (instrumentCurrency(symbol) === 'AUD') return `${symbol} is quoted in AUD.`;
  return `${symbol} is quoted in USD.`;
}

/** Last positive rate on or before `priceDate`. A later bar is not used. */
export function fxForPrice(bars: FxBar[] | null | undefined, priceDate: string): { rate: number; fxDate: string } | null {
  if (!bars) return null;
  let rate: number | null = null;
  let fxDate: string | null = null;
  for (const bar of bars) {
    if (bar.date <= priceDate && bar.close > 0) {
      rate = bar.close;
      fxDate = bar.date;
    }
  }
  if (rate == null || fxDate == null) return null;
  return { rate, fxDate };
}

export function fxIsFresh(fxDate: string | null, today: string): boolean {
  return priceIsFresh(fxDate, today);
}

/**
 * AUD value of one local price. USD assets divide by the AUDUSD rate (USD per 1 AUD).
 * Returns null when a USD asset has no rate on or before the price date.
 * Freshness is the caller's decision: the replay accepts a rate that was old on a later calendar day.
 */
export function markInAud(input: {
  symbol: string;
  local: number;
  priceDate: string;
  fxBars: FxBar[] | null | undefined;
}): { aud: number; currency: 'AUD' | 'USD'; fxDate: string | null; rate: number | null } | null {
  if (!(input.local > 0)) return null;
  const currency = instrumentCurrency(input.symbol);
  if (currency === 'AUD') return { aud: input.local, currency, fxDate: null, rate: null };
  const quote = fxForPrice(input.fxBars, input.priceDate);
  if (!quote) return null;
  return { aud: input.local / quote.rate, currency, fxDate: quote.fxDate, rate: quote.rate };
}

export function fxStamp(bars: FxBar[] | null | undefined, today: string, fetchedAt: string | null, error: string | null): FxStamp {
  const quote = fxForPrice(bars, today);
  return {
    symbol: FX_SYMBOL,
    convention: FX_CONVENTION,
    fetchedAt,
    observationDate: quote?.fxDate ?? null,
    rate: quote?.rate ?? null,
    fresh: quote ? fxIsFresh(quote.fxDate, today) : false,
    error,
  };
}
