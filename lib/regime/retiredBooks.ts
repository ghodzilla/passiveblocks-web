import { audMoney } from './ownerCopy';
import { plainDate } from './visser';

export interface RetiredMain {
  equity: number | null;
  valued: boolean;
  asOf: string | null;
  nav: number | null;
  decisions: number;
}

export interface RetiredVisser {
  status: 'ok' | 'empty' | 'unconfigured' | 'missing_schema' | 'outage';
  decisionDate: string | null;
  equityAud: number | null;
  sleeveNav: number | null;
}

/** Last stored values for the books this page no longer trades. Nothing here deletes a row. */
export function retiredBookLines(main: RetiredMain, visser: RetiredVisser): string[] {
  const when = main.asOf ? ` on ${plainDate(main.asOf)}` : '';
  const nav = main.nav != null && main.nav > 0 ? `, ${main.nav.toFixed(3)} times where it started` : '';
  const mainLine = main.valued && main.equity != null && main.equity > 0
    ? `The regime book (aud-paper-v1) last stood at ${audMoney(main.equity)}${when}${nav}. It is off this page. The history stays in the database.`
    : `The regime book (aud-paper-v1) is off this page. ${main.decisions > 0 ? `${main.decisions} stored decisions remain.` : 'No latest value was on this read.'} The history stays in the database.`;

  let visserLine: string;
  if (visser.status === 'missing_schema' || visser.status === 'unconfigured') {
    visserLine = 'The Visser basket (visser-aud-paper-v1) is off this page. Its tables were not read. Nothing was deleted.';
  } else if (visser.status === 'outage') {
    visserLine = 'The Visser basket (visser-aud-paper-v1) is off this page. The last read failed, so no value is shown. The rows stay in the database.';
  } else if (visser.equityAud != null && visser.equityAud > 0 && visser.decisionDate) {
    const sleeve = visser.sleeveNav != null && visser.sleeveNav > 0
      ? ` Sleeve value ${visser.sleeveNav.toFixed(3)} times where that basket started.`
      : '';
    visserLine = `The Visser basket (visser-aud-paper-v1) last stood at ${audMoney(visser.equityAud)} for the week of ${plainDate(visser.decisionDate)}.${sleeve} It is off this page. The history stays in the database.`;
  } else {
    visserLine = 'The Visser basket (visser-aud-paper-v1) is off this page. No week was saved on this read. The history stays in the database.';
  }
  return [mainLine, visserLine];
}
