/**
 * Idle-cash yield for benchmarks and comparisons.
 * The Reserve Bank of Australia cash rate target is 4.85% a year from
 * 4 November 2026 (https://www.rba.gov.au/statistics/cash-rate/).
 * That is the policy rate, not a bank-deposit quote. It is a constant so a
 * failed FRED key cannot blank the comparison. Change the constant when the
 * target changes. Tax and franking credits are not in any of these numbers.
 */
export const CASH_YIELD_BPS = 485;
export const CASH_YIELD_ANNUAL = CASH_YIELD_BPS / 10_000;
export const CASH_YIELD_SOURCE = 'RBA cash rate target, 4.85% a year, effective 4 November 2026';
export const TAX_FRANKING_NOTE = 'Tax and franking are not modelled.';

export function cashYieldSentence(): string {
  return `Idle cash in a benchmark or a comparison earns 4.85% a year (${CASH_YIELD_SOURCE}). ${TAX_FRANKING_NOTE}`;
}
