/**
 * Macro regime rules, version regime-v1.
 * Positive composite = easier liquidity / risk-on. Negative = stress.
 * Weights are the base weights. Missing components are renormalised.
 */

export const RULES_VERSION = 'regime-v1';

export const COMPONENT_IDS = ['liquidity', 'policy', 'credit', 'growth', 'positioning'] as const;
export type ComponentId = (typeof COMPONENT_IDS)[number];

export const BASE_WEIGHTS: Record<ComponentId, number> = {
  liquidity: 0.3,
  policy: 0.2,
  credit: 0.25,
  growth: 0.15,
  positioning: 0.1,
};

export const WINDOWS = {
  liquidity: { window: 156, min: 52 },
  policy: { window: 756, min: 252 },
  credit: { window: 756, min: 252 },
  curve: { window: 756, min: 252 },
  growthDiff: { window: 60, min: 24 },
  positioning: { window: 156, min: 52 },
} as const;

/** Entry bands are stricter than exit bands so the label does not flap. */
export const THRESHOLDS = {
  crisisEnter: -1.75,
  crisisCreditEnter: -2,
  crisisCompositeConfirm: -1.25,
  crisisExitComposite: -1.25,
  crisisExitCredit: -1.5,
  tightEnter: -0.75,
  tightExit: -0.35,
  riskOnEnter: 0.65,
  riskOnLiquidityMin: 0.1,
  riskOnExit: 0.25,
  riskOnLiquidityExit: -0.25,
  weakAbsComposite: 0.35,
} as const;

export const STALE_AFTER_DAYS = {
  weekly: 21,
  daily: 10,
  monthly: 75,
} as const;

export type RegimeId = 'risk_on' | 'transitional' | 'tightening' | 'crisis';

export const REGIME_LABEL: Record<RegimeId, string> = {
  risk_on: 'Risk-On Liquidity Expansion',
  transitional: 'Transitional',
  tightening: 'Tightening/Stress',
  crisis: 'Crisis',
};

/** Annual vol target and exposure caps. Fractions, not percents. */
export interface RiskBudget {
  volTarget: number;
  maxGross: number;
  maxNet: number;
}

export const MODEL_BUDGET: Record<RegimeId, RiskBudget> = {
  risk_on: { volTarget: 0.12, maxGross: 1.5, maxNet: 1 },
  transitional: { volTarget: 0.06, maxGross: 0.8, maxNet: 0.5 },
  tightening: { volTarget: 0.04, maxGross: 0.4, maxNet: 0.25 },
  crisis: { volTarget: 0.03, maxGross: 0.2, maxNet: 0.1 },
};

/** Used when the print is missing or stale. Net new risk is zero. */
export const PRESERVATION_BUDGET: RiskBudget = {
  volTarget: 0.03,
  maxGross: 0.2,
  maxNet: 0,
};

export const HISTORY_WEEKS = 260;
export const LIQUIDITY_CHANGE_WEEKS = 13;
export const CLI_MOMENTUM_MONTHS = 6;

export const FRED_SERIES = {
  walcl: 'WALCL',
  tga: 'WTREGEN',
  rrp: 'RRPONTSYD',
  dgs2: 'DGS2',
  policyUpper: 'DFEDTARU',
  policyEffective: 'DFF',
  hy: 'BAMLH0A0HYM2',
  curve: 'T10Y2Y',
  usCli: 'USALOLITOAASTSAM',
  auCli: 'AUSLOLITOAASTSAM',
} as const;

export const FRED_OBSERVATION_START = '2012-01-01';
