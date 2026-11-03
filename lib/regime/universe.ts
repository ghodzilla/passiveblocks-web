import type { ComponentId, RegimeId } from './constants';

export type AssetClass = 'equities' | 'rates' | 'fx' | 'commodities' | 'cash';
export type Stance = 'prefer' | 'avoid' | 'neutral';
export type InstrumentRole = 'tactical' | 'systematic' | 'cash';
export type RegimeKey = RegimeId | 'preservation';

export interface Instrument {
  symbol: string;
  name: string;
  venue: 'US' | 'ASX';
  kind: 'etf' | 'stock';
  role: InstrumentRole;
  defensive: boolean;
  assetClass: AssetClass;
  yahoo: string;
}

export interface Expression {
  id: string;
  assetClass: AssetClass;
  label: string;
  symbols: string[];
  defensive: boolean;
  role: 'tactical' | 'cash';
  drivers: ComponentId[];
  rationale: string;
  stance: Record<RegimeKey, Stance>;
}

const S = (risk_on: Stance, transitional: Stance, tightening: Stance, crisis: Stance, preservation: Stance) => ({
  risk_on,
  transitional,
  tightening,
  crisis,
  preservation,
});

function etf(
  symbol: string,
  name: string,
  venue: 'US' | 'ASX',
  assetClass: AssetClass,
  role: 'tactical' | 'cash',
  defensive: boolean,
): Instrument {
  return {
    symbol,
    name,
    venue,
    kind: 'etf',
    role,
    defensive,
    assetClass,
    yahoo: symbol,
  };
}

function stock(symbol: string, name: string, venue: 'US' | 'ASX'): Instrument {
  return {
    symbol,
    name,
    venue,
    kind: 'stock',
    role: 'systematic',
    defensive: false,
    assetClass: 'equities',
    yahoo: symbol,
  };
}

export const EXPRESSIONS: Expression[] = [
  {
    id: 'equity-beta',
    assetClass: 'equities',
    label: 'Equity beta',
    symbols: ['SPY', 'VAS.AX', 'VGS.AX', 'IOZ.AX'],
    defensive: false,
    role: 'tactical',
    drivers: ['liquidity', 'credit', 'growth'],
    rationale:
      'Broad equity beta is the liquid expression of easier liquidity and open credit. It is a candidate only when those legs and the composite confirm risk-on.',
    stance: S('prefer', 'neutral', 'avoid', 'avoid', 'avoid'),
  },
  {
    id: 'growth-momentum',
    assetClass: 'equities',
    label: 'Growth and momentum',
    symbols: ['QQQ', 'MTUM', 'XLK', 'XLC'],
    defensive: false,
    role: 'tactical',
    drivers: ['liquidity', 'growth'],
    rationale:
      'Growth and momentum follow the liquidity and growth-differential legs. They are the first equity sleeve to stand down when those z-scores fade.',
    stance: S('prefer', 'avoid', 'avoid', 'avoid', 'avoid'),
  },
  {
    id: 'cyclicals',
    assetClass: 'equities',
    label: 'Cyclical sectors',
    symbols: ['XLY', 'XLI', 'XLE', 'XLF', 'XLB', 'IWM'],
    defensive: false,
    role: 'tactical',
    drivers: ['liquidity', 'credit', 'growth'],
    rationale:
      'Discretionary, industrials, energy, financials, materials, and small caps need liquidity and credit together. A negative credit z is an avoid.',
    stance: S('prefer', 'avoid', 'avoid', 'avoid', 'avoid'),
  },
  {
    id: 'defensive-equity',
    assetClass: 'equities',
    label: 'Defensive equity',
    symbols: ['XLP', 'XLU', 'XLV', 'XLRE', 'USMV'],
    defensive: true,
    role: 'tactical',
    drivers: ['credit', 'liquidity'],
    rationale:
      'Staples, utilities, healthcare, real estate, and minimum volatility are the equity ballast when the composite is not a clean risk-on. They are still equities, so a crisis print prefers cash over this sleeve.',
    stance: S('neutral', 'prefer', 'prefer', 'avoid', 'avoid'),
  },
  {
    id: 'long-duration',
    assetClass: 'rates',
    label: 'Long duration',
    symbols: ['TLT'],
    defensive: false,
    role: 'tactical',
    drivers: ['policy', 'growth'],
    rationale:
      'Long Treasuries are a policy-path and stress hedge, not a risk-on expression. Positive growth z usually argues against adding duration. The sleeve is not sized while the action is do nothing or reduce risk.',
    stance: S('avoid', 'neutral', 'prefer', 'prefer', 'neutral'),
  },
  {
    id: 'intermediate-bonds',
    assetClass: 'rates',
    label: 'Intermediate bonds',
    symbols: ['IEF', 'VAF.AX'],
    defensive: true,
    role: 'tactical',
    drivers: ['policy', 'liquidity'],
    rationale:
      'Intermediate government bonds are the defensive duration sleeve, via IEF or the ASX composite bond ETF VAF. They are preferred when policy z is the support and equity beta is not.',
    stance: S('neutral', 'prefer', 'prefer', 'prefer', 'prefer'),
  },
  {
    id: 'cash',
    assetClass: 'cash',
    label: 'Cash and T-bills',
    symbols: ['SHY', 'AAA.AX', 'BILL.AX'],
    defensive: true,
    role: 'cash',
    drivers: ['liquidity', 'credit'],
    rationale:
      'T-bills and Australian cash ETFs are the ballast. A flat price is the point, so 12–1 momentum does not have to be positive for cash to be confirmed.',
    stance: S('avoid', 'prefer', 'prefer', 'prefer', 'prefer'),
  },
  {
    id: 'usd',
    assetClass: 'fx',
    label: 'US dollar',
    symbols: ['UUP'],
    defensive: true,
    role: 'tactical',
    drivers: ['liquidity', 'growth'],
    rationale:
      'UUP is the liquid USD expression. It is preferred when liquidity z is tight, and avoided when liquidity is easy.',
    stance: S('avoid', 'neutral', 'prefer', 'prefer', 'prefer'),
  },
  {
    id: 'aud',
    assetClass: 'fx',
    label: 'Australian dollar',
    symbols: ['FXA'],
    defensive: false,
    role: 'tactical',
    drivers: ['liquidity', 'growth'],
    rationale:
      'FXA is the AUD expression. It is preferred when liquidity and the US−AU growth differential are supportive, and it is not a defensive holding.',
    stance: S('prefer', 'neutral', 'avoid', 'avoid', 'avoid'),
  },
  {
    id: 'gold',
    assetClass: 'commodities',
    label: 'Gold',
    symbols: ['GLD', 'GOLD.AX'],
    defensive: true,
    role: 'tactical',
    drivers: ['liquidity', 'credit'],
    rationale:
      'Gold is the hedge when liquidity or credit z is stressed. It is not the risk-on expression. GLD is US-listed; GOLD.AX is the ASX physical gold ETF.',
    stance: S('avoid', 'neutral', 'prefer', 'prefer', 'prefer'),
  },
];

const ETF_NOTES: Record<string, string> = {
  SPY: 'SPDR S&P 500',
  'VAS.AX': 'Vanguard Australian Shares',
  'VGS.AX': 'Vanguard MSCI Intl ex-Australia',
  'IOZ.AX': 'iShares Core S&P/ASX 200',
  QQQ: 'Invesco QQQ',
  MTUM: 'iShares MSCI USA Momentum',
  XLK: 'Technology Select Sector SPDR',
  XLC: 'Communication Services SPDR',
  XLY: 'Consumer Discretionary SPDR',
  XLI: 'Industrial Select Sector SPDR',
  XLE: 'Energy Select Sector SPDR',
  XLF: 'Financial Select Sector SPDR',
  XLB: 'Materials Select Sector SPDR',
  IWM: 'iShares Russell 2000',
  XLP: 'Consumer Staples SPDR',
  XLU: 'Utilities Select Sector SPDR',
  XLV: 'Health Care Select Sector SPDR',
  XLRE: 'Real Estate Select Sector SPDR',
  USMV: 'iShares MSCI USA Min Vol',
  TLT: 'iShares 20+ Year Treasury',
  IEF: 'iShares 7–10 Year Treasury',
  'VAF.AX': 'Vanguard Australian Fixed Interest',
  SHY: 'iShares 1–3 Year Treasury',
  'AAA.AX': 'BetaShares Australian High Interest Cash',
  'BILL.AX': 'iShares Core Cash',
  UUP: 'Invesco DB US Dollar Bullish',
  FXA: 'Invesco CurrencyShares Australian Dollar',
  GLD: 'SPDR Gold Shares',
  'GOLD.AX': 'Global X Physical Gold',
};

function roleFor(symbol: string): { role: 'tactical' | 'cash'; defensive: boolean; assetClass: AssetClass } {
  for (const expression of EXPRESSIONS) {
    if (expression.symbols.includes(symbol)) {
      return { role: expression.role, defensive: expression.defensive, assetClass: expression.assetClass };
    }
  }
  return { role: 'tactical', defensive: false, assetClass: 'equities' };
}

export const PLAYBOOK_ETFS: Instrument[] = Object.keys(ETF_NOTES).map((symbol) => {
  const meta = roleFor(symbol);
  return etf(symbol, ETF_NOTES[symbol], symbol.endsWith('.AX') ? 'ASX' : 'US', meta.assetClass, meta.role, meta.defensive);
});

/** Liquid US megacaps plus a liquid slice of the ASX 20. Replace via REGIME_WATCHLIST. */
export const DEFAULT_WATCHLIST: Instrument[] = [
  stock('AAPL', 'Apple', 'US'),
  stock('MSFT', 'Microsoft', 'US'),
  stock('NVDA', 'NVIDIA', 'US'),
  stock('AMZN', 'Amazon', 'US'),
  stock('GOOGL', 'Alphabet', 'US'),
  stock('META', 'Meta', 'US'),
  stock('AVGO', 'Broadcom', 'US'),
  stock('LLY', 'Eli Lilly', 'US'),
  stock('TSLA', 'Tesla', 'US'),
  stock('BRK-B', 'Berkshire Hathaway', 'US'),
  stock('BHP.AX', 'BHP', 'ASX'),
  stock('CBA.AX', 'Commonwealth Bank', 'ASX'),
  stock('CSL.AX', 'CSL', 'ASX'),
  stock('NAB.AX', 'NAB', 'ASX'),
  stock('WBC.AX', 'Westpac', 'ASX'),
  stock('ANZ.AX', 'ANZ', 'ASX'),
  stock('WES.AX', 'Wesfarmers', 'ASX'),
  stock('MQG.AX', 'Macquarie', 'ASX'),
  stock('WOW.AX', 'Woolworths', 'ASX'),
  stock('TLS.AX', 'Telstra', 'ASX'),
];

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Undefined keeps the default list. A set value, even empty, replaces it. */
export function parseWatchlist(raw: string | undefined): string[] | null {
  if (raw == null) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const symbol = normalizeSymbol(part);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

function synthesizeStock(symbol: string): Instrument {
  const venue = symbol.endsWith('.AX') ? 'ASX' : 'US';
  return stock(symbol, symbol, venue);
}

export function resolveUniverse(watchlistRaw: string | undefined): Instrument[] {
  const custom = parseWatchlist(watchlistRaw);
  const stocks = custom == null
    ? DEFAULT_WATCHLIST
    : custom.map((symbol) => DEFAULT_WATCHLIST.find((item) => item.symbol === symbol) ?? synthesizeStock(symbol));
  return PLAYBOOK_ETFS.concat(stocks);
}

export function expressionFor(symbol: string): Expression | null {
  for (const expression of EXPRESSIONS) {
    if (expression.symbols.includes(symbol)) return expression;
  }
  return null;
}
