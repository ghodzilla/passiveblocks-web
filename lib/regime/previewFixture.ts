import type { ComponentProps } from 'react';
import type { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { toControlRoom } from './controlRoom';
import { sampleStep } from './druck';
import { toDruckPanel } from './druckPresent';
import { retiredBookLines } from './retiredBooks';

type DashboardProps = ComponentProps<typeof RegimeDashboard>;

const NOW = new Date('2026-11-21T21:00:00.000Z');

function retired() {
  return retiredBookLines(
    { equity: 100_464, valued: true, asOf: '2026-11-19', nav: 1.0046, decisions: 40 },
    { status: 'ok', decisionDate: '2026-11-13', equityAud: 15_000, sleeveNav: 1 },
  );
}

/** Red 25% sample book: NTRA, HACK.AX, AMZN, INSM, and cash in AAA.AX. */
export function buyProps(): DashboardProps {
  const step = sampleStep();
  const weeks = step.snapshot ? [step.snapshot] : [];
  const panel = toDruckPanel({
    status: 'ok',
    snapshot: step.snapshot,
    banner: step.banner,
    outcome: step.outcome,
    weeks,
  });
  return {
    csrf: 'preview',
    retired: retired(),
    room: toControlRoom({
      status: 'ok',
      snapshot: step.snapshot,
      banner: panel.banner,
      outcome: step.outcome,
      weeks,
      now: NOW,
      liquidityAsOf: '2026-11-20',
      spreadAsOf: '2026-11-20',
      attemptedAt: step.snapshot?.fetchedAt ?? null,
      paperRule: panel.paperRule,
      record: panel.record,
    }),
  };
}

export function quietProps(): DashboardProps {
  const panel = toDruckPanel({ status: 'empty', snapshot: null, banner: null, outcome: null });
  return {
    csrf: 'preview',
    retired: retired(),
    room: toControlRoom({
      status: 'empty',
      snapshot: null,
      banner: panel.banner,
      outcome: null,
      now: NOW,
      paperRule: panel.paperRule,
    }),
  };
}
