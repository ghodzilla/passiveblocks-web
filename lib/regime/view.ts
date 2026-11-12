import { auditRegime, type ConsistencyReport } from './consistency';
import type { Desk } from './desk';
import { invalidationText, type IdeasReport } from './ideas';
import type { RegimeSnapshot } from './types';

export interface RegimeView {
  snapshot: RegimeSnapshot;
  ideas: IdeasReport;
  desk: Desk;
  consistency: ConsistencyReport;
}

/**
 * One object for the page. Idea tags, sizes, overlap, and the theme gates
 * are copied from the desk that just computed them, then the audit reads
 * that same object.
 */
export function publishRegime(input: { snapshot: RegimeSnapshot; ideas: IdeasReport; desk: Desk }): RegimeView {
  const bySymbol = new Map(input.desk.lines.map((line) => [line.symbol, line]));
  const ideas: IdeasReport = {
    ...input.ideas,
    overlap: input.desk.overlap,
    rows: input.ideas.rows.map((row) => {
      const line = bySymbol.get(row.symbol);
      if (!line) return row;
      return {
        ...row,
        status: line.status,
        maxWeight: line.weight,
        invalidation: invalidationText({
          status: line.status,
          role: row.role,
          ma200: row.signals.ma200,
          regimeLabel: input.snapshot.regimeLabel,
          standDown: input.ideas.defensiveOnly,
        }),
      };
    }),
  };
  const view = { snapshot: input.snapshot, ideas, desk: input.desk };
  return { ...view, consistency: auditRegime(view) };
}
