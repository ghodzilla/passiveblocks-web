import type { PaperMarkPayload } from './paperLog';

export interface GrossSplit {
  gross: number;
  net: number;
  risk: number;
  defensive: number;
  cash: number;
  maxGross: number;
  maxNet: number;
}

export function bookExposureSentence(exposures: GrossSplit): string {
  return `Invested ${(exposures.gross * 100).toFixed(1)}% of ${(exposures.maxGross * 100).toFixed(0)}% max · Non-cash ${(exposures.net * 100).toFixed(1)}% of ${(exposures.maxNet * 100).toFixed(0)}% max · Cash ${(exposures.cash * 100).toFixed(1)}%.`;
}

export function paperLogSentence(paper: {
  status: string;
  decisions: number;
  marks: number;
  latest: PaperMarkPayload | null;
}): string {
  if (paper.status === 'ok' && (paper.decisions > 0 || paper.marks > 0)) {
    if (paper.latest && paper.latest.basis !== 'held-book') {
      const change = paper.latest.nav == null ? '' : ` Latest stored unit value ${paper.latest.nav.toFixed(4)} used that day's suggestion weights, not the shares in the book, so it is not comparable with the book.`;
      return `Paper record: ${paper.marks} stored marks from ${paper.decisions} decisions.${change} Invested in that mark ${(paper.latest.gross * 100).toFixed(1)}%. Cash ${(paper.latest.cashWeight * 100).toFixed(1)}%.`;
    }
    const after = paper.latest?.nav == null ? '' : ` Latest: ${((paper.latest.nav - 1) * 100).toFixed(2)}% after trading costs.`;
    return `Paper record: ${paper.marks} daily values.${after}`;
  }
  if (paper.status === 'ok') {
    return 'Paper log table is present. Decisions 0. Marks 0. A first mark, once written, includes entry cost only and is not a performance record.';
  }
  if (paper.status === 'missing_schema') {
    return 'The paper log is ledger code. It is not applied, and it is not a historical backtest. Database status: missing_schema.';
  }
  return `The paper log could not be read. Database status: ${paper.status}.`;
}
