import {
  MODEL_BUDGET,
  PRESERVATION_BUDGET,
  REGIME_LABEL,
  THRESHOLDS,
  type RegimeId,
  type RiskBudget,
} from './constants';

export type ActionId = 'risk_budget_open' | 'do_nothing' | 'reduce_risk';

/**
 * Classify one print.
 * Crisis outranks everything and can interrupt any state.
 * Leaving crisis while the composite is still at or below the tightening exit
 * lands in Tightening/Stress rather than jumping to Transitional.
 * Risk-On Liquidity Expansion requires a positive liquidity z on entry,
 * and loses the label if liquidity z falls through the exit.
 * Null composite means there is nothing to classify.
 */
export function classifyRegime(input: {
  composite: number | null;
  liquidityZ: number | null;
  creditZ: number | null;
  previous: RegimeId | null;
}): RegimeId | null {
  const { composite: c, liquidityZ: liq, creditZ: credit, previous: prev } = input;
  if (c == null || !Number.isFinite(c)) return null;

  const crisisEnter =
    c <= THRESHOLDS.crisisEnter ||
    (credit != null && credit <= THRESHOLDS.crisisCreditEnter && c <= THRESHOLDS.crisisCompositeConfirm);
  const crisisHold =
    prev === 'crisis' &&
    !(c > THRESHOLDS.crisisExitComposite && (credit == null || credit > THRESHOLDS.crisisExitCredit));
  if (crisisEnter || crisisHold) return 'crisis';

  const riskOnEnter =
    c >= THRESHOLDS.riskOnEnter && liq != null && liq >= THRESHOLDS.riskOnLiquidityMin;
  const riskOnHold =
    prev === 'risk_on' &&
    c >= THRESHOLDS.riskOnExit &&
    liq != null &&
    liq >= THRESHOLDS.riskOnLiquidityExit;

  const tightEnter = c <= THRESHOLDS.tightEnter;
  const tightHold = prev === 'tightening' && c <= THRESHOLDS.tightExit;
  const tightAfterCrisis = prev === 'crisis' && c <= THRESHOLDS.tightExit;

  if (tightEnter || tightAfterCrisis || (tightHold && !riskOnEnter)) return 'tightening';
  if (riskOnEnter || riskOnHold) return 'risk_on';
  return 'transitional';
}

export function actionFor(input: {
  actionable: boolean;
  weak: boolean;
  regime: RegimeId | null;
}): { action: ActionId; message: string } {
  if (!input.actionable) {
    return {
      action: 'reduce_risk',
      message:
        'Do nothing / reduce risk. A core series is missing or stale, so this print is not actionable. Do not add risk.',
    };
  }
  if (input.regime === 'crisis') {
    return {
      action: 'reduce_risk',
      message: 'Reduce risk. Crisis regime. Preservation budget only. Cash is preferred to activity.',
    };
  }
  if (input.regime === 'tightening') {
    return {
      action: 'reduce_risk',
      message:
        'Reduce risk. Tightening/Stress regime. Cut gross and net toward the stress budget. Do not add concentration.',
    };
  }
  if (input.weak || input.regime !== 'risk_on') {
    const quiet = input.weak
      ? `Do nothing. The composite is inside the no-edge band (|composite| < ${THRESHOLDS.weakAbsComposite}). No new risk.`
      : 'Do nothing new. Transitional regime. Keep exposure inside the mid budget and do not concentrate.';
    return { action: 'do_nothing', message: quiet };
  }
  return {
    action: 'risk_budget_open',
    message:
      'Risk-On Liquidity Expansion is confirmed by the composite and the liquidity leg. The risk budget is open up to the caps below. This is not a trade ticket.',
  };
}

export function budgetsFor(regime: RegimeId | null, action: ActionId): {
  modelBudget: RiskBudget | null;
  effectiveBudget: RiskBudget;
  budgetOverridden: boolean;
} {
  const modelBudget = regime ? MODEL_BUDGET[regime] : null;
  if (action === 'reduce_risk' && regime !== 'tightening' && regime !== 'crisis') {
    return { modelBudget, effectiveBudget: PRESERVATION_BUDGET, budgetOverridden: true };
  }
  if (action === 'reduce_risk' && regime === 'crisis') {
    return { modelBudget, effectiveBudget: MODEL_BUDGET.crisis, budgetOverridden: false };
  }
  if (action === 'reduce_risk' && regime === 'tightening') {
    return { modelBudget, effectiveBudget: MODEL_BUDGET.tightening, budgetOverridden: false };
  }
  if (action === 'do_nothing') {
    const base = modelBudget ?? MODEL_BUDGET.transitional;
    return {
      modelBudget,
      effectiveBudget: {
        volTarget: Math.min(base.volTarget, 0.06),
        maxGross: Math.min(base.maxGross, 0.4),
        maxNet: Math.min(base.maxNet, 0.2),
      },
      budgetOverridden: true,
    };
  }
  return {
    modelBudget,
    effectiveBudget: modelBudget ?? PRESERVATION_BUDGET,
    budgetOverridden: modelBudget == null,
  };
}

export function regimeLabel(regime: RegimeId | null): string {
  return regime ? REGIME_LABEL[regime] : 'Unavailable';
}
