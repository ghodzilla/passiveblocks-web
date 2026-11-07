/** Credit z-score dates for BAMLH0A0HYM2 under the production window. */

export function nextCalendarDay(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function creditSpan(dates: string[], window = 756, minObs = 252) {
  const sorted = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const count = sorted.length;
  const firstCreditZObservation = count >= minObs ? sorted[minObs - 1] : null;
  const firstFullWindowObservation = count >= window ? sorted[window - 1] : null;
  const lastObservation = count > 0 ? sorted[count - 1] : null;
  return {
    observationCount: count,
    firstObservation: count > 0 ? sorted[0] : null,
    lastObservation,
    window,
    minObs,
    firstCreditZObservation,
    firstFullWindowObservation,
    creditZObservationCount: Math.max(0, count - minObs + 1),
    fullWindowObservationCount: Math.max(0, count - window + 1),
    earliestDecisionDate: firstCreditZObservation ? nextCalendarDay(firstCreditZObservation) : null,
    latestDecisionDate: lastObservation ? nextCalendarDay(lastObservation) : null,
    completedReplayDates: 0,
  };
}
