/**
 * Visser overlay. Quarterly human review only.
 * The improvement loop is not allowed to edit this file or flip these switches.
 */
export const THEME_CONFIG_VERSION = '2026-Q4.2';

export interface ThemeChangelogEntry {
  version: string;
  date: string;
  note: string;
}

export const THEME_CHANGELOG: ThemeChangelogEntry[] = [
  {
    version: '2026-Q4.1',
    date: '2026-11-04',
    note: 'Initial three baskets: AI infrastructure, crypto, and scarcity. Switches are objective rules, reviewed by a human once a quarter. The weekly improvement job may tune ATR k, risk percent, momentum lookback, and dip thresholds inside fixed bounds. It may not rewrite this list.',
  },
  {
    version: '2026-Q4.2',
    date: '2026-11-04',
    note: 'Scarcity now includes GOLD.AX with GLD and SLV, so the ASX gold ETF reads the same live switch as the US listing. Bonds such as IEF and VAF.AX stay outside every theme. The weekly job still cannot edit this list.',
  },
];

export interface ThemeSymbol {
  symbol: string;
  name: string;
  yahoo: string;
  /** Stocks use the 2% sleeve cap. ETFs and crypto use the 20% tactical cap. */
  kind: 'etf' | 'stock' | 'crypto';
}

export interface ThemeConfig {
  id: string;
  label: string;
  /** Objective switch. Off means the basket is not a candidate, whatever the data says. */
  enabled: boolean;
  objective: string;
  symbols: ThemeSymbol[];
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'ai-infrastructure',
    label: 'AI infrastructure',
    enabled: true,
    objective: 'On when the AI capex component z-score is rising versus the prior print. Semiconductors, power, and data-centre landlords are the same buildout.',
    symbols: [
      { symbol: 'SMH', name: 'Semiconductors', yahoo: 'SMH', kind: 'etf' },
      { symbol: 'XLU', name: 'Utilities / power', yahoo: 'XLU', kind: 'etf' },
      { symbol: 'EQIX', name: 'Equinix', yahoo: 'EQIX', kind: 'stock' },
      { symbol: 'DLR', name: 'Digital Realty', yahoo: 'DLR', kind: 'stock' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    enabled: true,
    objective: 'On when Bitcoin is above its 200-day average and the liquidity component z-score is rising. Both have to be true.',
    symbols: [
      { symbol: 'BTC-USD', name: 'Bitcoin', yahoo: 'BTC-USD', kind: 'crypto' },
      { symbol: 'ETH-USD', name: 'Ether', yahoo: 'ETH-USD', kind: 'crypto' },
      { symbol: 'SOL-USD', name: 'Solana', yahoo: 'SOL-USD', kind: 'crypto' },
    ],
  },
  {
    id: 'scarcity',
    label: 'Scarcity',
    enabled: true,
    objective: 'On when the 10-year real yield (FRED DFII10) is falling, or the trade-weighted dollar (FRED DTWEXBGS) is weakening. Either one is enough.',
    symbols: [
      { symbol: 'GLD', name: 'Gold', yahoo: 'GLD', kind: 'etf' },
      { symbol: 'GOLD.AX', name: 'ASX physical gold', yahoo: 'GOLD.AX', kind: 'etf' },
      { symbol: 'SLV', name: 'Silver', yahoo: 'SLV', kind: 'etf' },
      { symbol: 'BTC-USD', name: 'Bitcoin', yahoo: 'BTC-USD', kind: 'crypto' },
    ],
  },
];
