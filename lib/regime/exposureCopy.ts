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
  return `Held gross ${(exposures.gross * 100).toFixed(1)}% of the ${(exposures.maxGross * 100).toFixed(0)}% cap. This gross is every holding except the AUD cash balance, so cash-like AAA.AX, BILL.AX, and SHY count in it. Held net ${(exposures.net * 100).toFixed(1)}% of the ${(exposures.maxNet * 100).toFixed(0)}% cap. Net leaves those cash-like names out. Risk ${(exposures.risk * 100).toFixed(1)}%. Defensive ${(exposures.defensive * 100).toFixed(1)}%. AUD cash balance ${(exposures.cash * 100).toFixed(1)}%.`;
}

export function paperLogSentence(paper: {
  status: string;
  decisions: number;
  marks: number;
  latest: PaperMarkPayload | null;
}): string {
  if (paper.status === 'ok' && (paper.decisions > 0 || paper.marks > 0)) {
    const nav = !paper.latest
      ? ''
      : paper.latest.nav == null
        ? ` Latest mark: ${paper.latest.navStatus}${paper.latest.reason ? `. ${paper.latest.reason}` : ''}`
        : ` Latest AUD unit NAV ${paper.latest.nav.toFixed(4)}.`;
    if (paper.latest && paper.latest.basis !== 'held-book') {
      return `Paper log active: ${paper.decisions} decisions, ${paper.marks} marks. The latest stored mark used that day's suggestion weights, not the shares in the AUD book. A suggestion of 0% was stored as a sale. The row is kept and is not comparable with the book. Stored mark gross ${(paper.latest.gross * 100).toFixed(1)}%. Stored cash weight ${(paper.latest.cashWeight * 100).toFixed(1)}%.${nav} The first stored mark includes entry cost only and is not a performance record.`;
    }
    const latest = paper.latest
      ? ` Held-book gross ${(paper.latest.gross * 100).toFixed(1)}% counts every holding except the AUD cash balance, including AAA.AX, BILL.AX, and SHY. Cash weight ${(paper.latest.cashWeight * 100).toFixed(1)}% is the AUD cash balance.`
      : '';
    return `Paper log active: ${paper.decisions} decisions, ${paper.marks} marks; first mark includes entry cost only, not a performance record.${latest}${nav}`;
  }
  if (paper.status === 'ok') {
    return 'Paper log table is present. Decisions 0. Marks 0. A first mark, once written, includes entry cost only and is not a performance record.';
  }
  if (paper.status === 'missing_schema') {
    return 'The paper log is ledger code. It is not applied, and it is not a historical backtest. Database status: missing_schema.';
  }
  return `The paper log could not be read. Database status: ${paper.status}.`;
}
