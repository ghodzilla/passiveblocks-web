/** Shape of research/regime-validation/vintage-replay.json. Research display only. */

export interface PathSummary {
  start: string;
  end: string;
  observations: number;
  cagr: number | null;
  maxDrawdown: number | null;
  volatility: number | null;
  sharpe: number | null;
  turnover: number;
  timeInMarket: number;
  unitNavEnd: number | null;
  firstHalfCagr: number | null;
  secondHalfCagr: number | null;
  firstHalfDrawdown: number | null;
  secondHalfDrawdown: number | null;
  returnPerDrawdown: number | null;
}

export interface SkipReason {
  reason: string;
  count: number;
  first: string;
  last: string;
  examples: string[];
}

export interface VariantResult {
  id: string;
  role: 'primary' | 'variant';
  label: string;
  creditSeries: string;
  creditWindow: number;
  engineCreditWindow: number;
  engineCreditMin: number;
  completed: number;
  skipped: number;
  skippedReasons: SkipReason[];
  interiorSkips: number;
  notActionable: number;
  regimes: Record<string, number>;
  missingFills: number;
  summary: PathSummary | null;
  benchmarks: {
    spy: PathSummary | null;
    vas: PathSummary | null;
    sixtyForty: PathSummary | null;
    spyBuyAndHold: PathSummary | null;
  };
  lags: string[];
  ahead: string[];
  paragraph: string;
}

export interface VintageReplay {
  ranAt: string;
  command: string;
  fullStrategy: 'not_validated' | 'criteria_met';
  headline: string;
  advice: string;
  limits: string;
  policy: string;
  costBps: number;
  cashYieldBps: number;
  currency: string;
  passCriteria: { met: boolean; rule: string; because: string };
  lookahead: { passed: boolean; decisionsChecked: number; inputsChecked: number; violations: number; sentence: string };
  calendar: { spySessions: number; replayableSessions: number; first: string | null; last: string | null; priceFirst: string | null; priceLast: string | null; note: string };
  dataGaps: string[];
  variants: VariantResult[];
}
