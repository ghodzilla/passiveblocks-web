/**
 * Druckenmiller paper book, quarterly list.
 * Edit the candidates in this file after each Duquesne 13F (mid-February, May, August, November).
 * When the list changes, change DRUCK_LIST only. Leave DRUCK_RULE as it is.
 * DRUCK_RULE is the strategy identity stored on the book. Changing it makes the saved book
 * look like an outage and hides the week history.
 * Weights are fractions of the whole book. A new position cannot start above 10%.
 * Set `active` to false to sell a name at the next week's close.
 * Set `openWeight` to 0 to keep a name on the list without buying it.
 * The hard caps (25% a name, 40% a theme, the weekly invested cap) still apply.
 */

/** Strategy identity. Do not change this when the candidate list is edited. */
export const DRUCK_RULE = 'DRUCK-2026-11-21';
/**
 * Quarterly candidate list. Change this when the names or opening sizes are edited.
 * It is written onto new weeks and is not used to accept or reject saved history.
 */
export const DRUCK_LIST = '2026-11';
export const DRUCK_BOOK_ID = 'druck-aud-paper-v1';
export const DRUCK_START_AUD = 100_000;
export const DRUCK_COST = 0.001;
export const DRUCK_CASH_SYMBOL = 'AAA.AX';
export const DRUCK_SPY = 'SPY';

export const DRUCK_CAPS = { green: 1, amber: 0.5, red: 0.25 } as const;
export const DRUCK_LIQUIDITY_MIN = 0.1;
export const DRUCK_STARTER_MAX = 0.1;
export const DRUCK_NAME_MAX = 0.25;
export const DRUCK_THEME_MAX = 0.4;
export const DRUCK_ADD_GAIN = 0.15;
export const DRUCK_STOP_COST = 0.2;
export const DRUCK_STOP_MA = 0.1;
export const DRUCK_TRIM_MA = 0.6;
export const DRUCK_BOOK_BRAKE = 0.15;
export const DRUCK_MAX_POSITIONS = 6;
export const DRUCK_MIN_POSITIONS = 3;
export const DRUCK_ADD_RUNGS = [0.1, 0.2, 0.25] as const;

export const DRUCK_BACKTEST = {
  top10Cagr: 0.204,
  top10Worst: -0.36,
  top10EarlyCagr: 0.126,
  top5Cagr: 0.213,
  top5Worst: -0.43,
  top5EarlyCagr: 0.122,
  top10ExNatera: 0.188,
  top10WindowsAt30: 0.02,
  expectedLow: 0.1,
  expectedHigh: 0.16,
  oddsOf30: '3–5%',
  qqqCagr: 0.18,
  spyCagr: 0.132,
} as const;

export const DRUCK_CAVEAT =
  'NOT VALIDATED — copying the top 10 holdings from each Duquesne 13F, 2013–2026, made 20.4% a year with a −36% worst fall, but only 12.6% a year from 2013 to 2022. This book is long only, with no leverage and no shorts. Expect about 10–16% a year. The chance of 30% a year for 10 years is about 3–5%.';

export type DruckRole = 'core' | 'watch';

export interface DruckCandidate {
  id: string;
  symbol: string;
  name: string;
  theme: string;
  themeLabel: string;
  role: DruckRole;
  /** Opening size of a new position. 0 keeps the name on the list without a buy. At most 10%. */
  openWeight: number;
  /** Size to build toward after a 15% gain from cost, still at most 25%. */
  addWeight: number;
  active: boolean;
  thesis: string;
  sellIf: string;
  /** Alternate ticker, so a quarterly edit can see it without hunting. */
  also: string | null;
}

export const DRUCK_CANDIDATES: readonly DruckCandidate[] = [
  {
    id: 'ntra',
    symbol: 'NTRA',
    name: 'Natera',
    theme: 'healthcare',
    themeLabel: 'Healthcare',
    role: 'core',
    openWeight: 0.07,
    addWeight: 0.2,
    active: true,
    thesis: 'Blood tests that spot cancer coming back. His biggest bet, and it fits the view that cancer becomes a managed disease.',
    sellIf: 'Sell if it falls 20% from our cost, or when the next 13F shows Duquesne under 15% in this name.',
    also: null,
  },
  {
    id: 'hack',
    symbol: 'HACK.AX',
    name: 'Cybersecurity',
    theme: 'cyber',
    themeLabel: 'Cybersecurity',
    role: 'core',
    openWeight: 0.08,
    addWeight: 0.15,
    active: true,
    thesis: 'AI agents both attack and defend networks. This is the cybersecurity use case, bought on the ASX.',
    sellIf: 'Sell if it closes a week more than 10% under its 200-day average.',
    also: 'CIBR is the US fund.',
  },
  {
    id: 'amzn',
    symbol: 'AMZN',
    name: 'Amazon',
    theme: 'use',
    themeLabel: 'AI use cases',
    role: 'core',
    openWeight: 0.05,
    addWeight: 0.1,
    active: true,
    thesis: 'Cloud and AI tools in shops and ads. A use case, not a chip maker. He added to it last quarter.',
    sellIf: 'Sell if it falls 20% from our cost.',
    also: null,
  },
  {
    id: 'insm',
    symbol: 'INSM',
    name: 'Insmed',
    theme: 'healthcare',
    themeLabel: 'Healthcare',
    role: 'core',
    openWeight: 0.05,
    addWeight: 0.08,
    active: true,
    thesis: 'A lung-disease drug that is selling more. He trimmed it, so the size stays small.',
    sellIf: 'Sell if it falls 20% from our cost.',
    also: null,
  },
  {
    id: 'stx',
    symbol: 'STX',
    name: 'Seagate',
    theme: 'storage',
    themeLabel: 'Storage',
    role: 'watch',
    openWeight: 0.1,
    addWeight: 0.1,
    active: true,
    thesis: 'AI data needs more hard drives. His second-largest holding. Do not buy it under the 200-day average.',
    sellIf: 'Do not buy until it closes above its 200-day average.',
    also: 'Western Digital (WDC) is the same storage idea and is listed at 0% so the theme is not doubled.',
  },
  {
    id: 'wdc',
    symbol: 'WDC',
    name: 'Western Digital',
    theme: 'storage',
    themeLabel: 'Storage',
    role: 'watch',
    openWeight: 0,
    addWeight: 0.1,
    active: true,
    thesis: 'The other hard-drive maker. It stays at 0% this quarter so storage is not counted twice.',
    sellIf: 'Do not buy until it closes above its 200-day average and the list gives it a size.',
    also: 'Seagate (STX) is the storage line with a size this quarter.',
  },
  {
    id: 'gdx',
    symbol: 'GDX.AX',
    name: 'Gold miners',
    theme: 'gold',
    themeLabel: 'Gold miners',
    role: 'watch',
    openWeight: 0.08,
    addWeight: 0.08,
    active: true,
    thesis: 'Gold miners, a hedge if government debt and the dollar get worse.',
    sellIf: 'Do not buy until it closes above its 200-day average.',
    also: 'NEM or AEM are the single-name miners.',
  },
  {
    id: 'semi',
    symbol: 'SEMI.AX',
    name: 'Semiconductors',
    theme: 'chips',
    themeLabel: 'Chips',
    role: 'watch',
    openWeight: 0.1,
    addWeight: 0.1,
    active: true,
    thesis: 'Chip makers. He now prefers the uses of AI over the machines that build it, so this is optional and small.',
    sellIf: 'Do not buy until it closes above its 200-day average.',
    also: 'TSM is the single-name chip line.',
  },
  {
    id: 'se',
    symbol: 'SE',
    name: 'Sea',
    theme: 'em',
    themeLabel: 'Emerging markets',
    role: 'watch',
    openWeight: 0,
    addWeight: 0.05,
    active: true,
    thesis: 'A higher-risk bet on growth in Southeast Asia. No size this quarter.',
    sellIf: 'Do not buy until it closes above its 200-day average and the list gives it a size.',
    also: null,
  },
  {
    id: 'ypf',
    symbol: 'YPF',
    name: 'YPF',
    theme: 'em',
    themeLabel: 'Emerging markets',
    role: 'watch',
    openWeight: 0,
    addWeight: 0.05,
    active: true,
    thesis: 'A higher-risk bet on Argentina. No size this quarter.',
    sellIf: 'Do not buy until it closes above its 200-day average and the list gives it a size.',
    also: null,
  },
  {
    id: 'ewz',
    symbol: 'EWZ',
    name: 'Brazil',
    theme: 'em',
    themeLabel: 'Emerging markets',
    role: 'watch',
    openWeight: 0.05,
    addWeight: 0.05,
    active: true,
    thesis: 'Brazil, through the EWZ fund. Higher risk. Up to 5% only once it is back above the 200-day average.',
    sellIf: 'Do not buy until it closes above its 200-day average.',
    also: 'Sea (SE) and YPF are the other emerging names, at 0% this quarter.',
  },
];
