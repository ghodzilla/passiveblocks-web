import type { DruckSnapshot } from './druck';
import type { ShadowRead } from './druckShadowStore';
import type { ShadowReport, ShadowStatRow } from './druckShadow';

export interface ShadowCallLine {
  symbol: string;
  text: string;
}

export interface ShadowTableRow {
  period: string;
  book: string;
  cagr: string;
  worst: string;
  sharpe: string;
  turnover: string;
}

export interface ShadowCardModel {
  title: string;
  headline: string;
  lines: ShadowCallLine[];
  checks: string[];
  tableTitle: string;
  rows: ShadowTableRow[];
  note: string;
  caveats: string[];
}

const CAVEATS = [
  'NOT VALIDATED. Paper only, for 12 months. Long only, no leverage and no shorts. The live book still uses the current three checks.',
  'This test uses today\'s candidate list the whole way back. A name is left off until it has a 200-day average. That is not the list Duquesne held in those years.',
  'Prices are Yahoo adjusted closes, which are revised for splits. Yields and high-yield spreads are the market prints on the day. Fed liquidity waits for publication (balance sheet 7 days, Treasury cash 3 days, reverse repo 1 day) on the latest vintage, not a full ALFRED history.',
  'The dollar check uses the ICE dollar index. Cash earns 4.85% in every year of the test. The Reserve Bank rate was not 4.85% for most of 2013 to 2026. Costs are 0.10% of the amount traded.',
  'Sharpe is weekly, above that 4.85% cash rate. Turnover adds buys and sells together. The worst fall is inside that window. v2 does not change the live book.',
];

function signedPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${(Math.abs(value) * 100).toFixed(1)}%`;
}

function signedNum(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

function weightText(snapshot: DruckSnapshot, id: string): string {
  const name = snapshot.names.find((row) => row.id === id);
  if (!name) return 'n/a';
  return `${Math.round(name.targetWeight * 100)}%`;
}

export function presentShadow(input: {
  read: ShadowRead;
  report: ShadowReport;
  example?: boolean;
}): ShadowCardModel {
  const snapshot = input.read.snapshot;
  const lines: ShadowCallLine[] = snapshot
    ? snapshot.names
      .filter((name) => name.targetWeight > 0.0005 || name.heldAud > 1)
      .map((name) => ({
        symbol: name.symbol,
        text: `${name.symbol} · ${name.call} · ${weightText(snapshot, name.id)}`,
      }))
    : [];
  const colour = snapshot ? snapshot.colour.toUpperCase() : null;
  const cap = snapshot ? `${Math.round(snapshot.cap * 100)}%` : null;
  let headline: string;
  if (input.read.status === 'missing_schema') {
    headline = 'The shadow week is not in the database yet. Apply db/regime/007_druck_shadow.sql. The live book is unchanged.';
  } else if (input.read.status === 'unconfigured') {
    headline = 'No database is configured, so the shadow week is not saved. The live book is unchanged.';
  } else if (!snapshot) {
    headline = 'v2 has not saved a week yet. The live book is unchanged.';
  } else if (input.example) {
    headline = `Example week ${snapshot.decisionDate}: ${colour}, up to ${cap} invested. Fixture data. The live book is unchanged.`;
  } else {
    headline = `Shadow week ${snapshot.decisionDate}: ${colour}, up to ${cap} invested. The live book is unchanged.`;
  }
  const reportNote = input.report.ok
    ? input.report.note
    : input.report.note || 'The backtest has not been saved yet.';
  return {
    title: 'What v2 rules would do',
    headline,
    lines,
    checks: snapshot?.read.checks.map((check) => `${check.pass ? 'Pass' : 'Fail'} · ${check.detail}`) ?? [],
    tableTitle: 'Point-in-time test',
    rows: input.report.rows.map(formatRow),
    note: reportNote,
    caveats: CAVEATS,
  };
}

function formatRow(row: ShadowStatRow): ShadowTableRow {
  return {
    period: row.period,
    book: row.book,
    cagr: signedPct(row.cagr),
    worst: signedPct(row.worst),
    sharpe: signedNum(row.sharpe),
    turnover: signedPct(row.turnover),
  };
}

export function emptyShadowReport(): ShadowReport {
  return {
    ok: false,
    computedAt: '',
    firstDate: null,
    lastDate: null,
    skippedWeeks: 0,
    note: 'The backtest has not been saved yet.',
    rows: [],
  };
}
