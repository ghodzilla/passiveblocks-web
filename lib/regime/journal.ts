import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DEFAULT_ATR_K, DEFAULT_RISK_PCT } from './sizing';
import { DIP_HIGH, DIP_LOW } from './dip';
import { MOMENTUM_LOOKBACK } from './signals';
import type { WeekChange } from './improve';

/** Kept on the journal document so one upsert stays inside the Free plan's 1 GB. */
export const JOURNAL_MARK_LIMIT = 800;
export const JOURNAL_CALL_LIMIT = 4000;
export const JOURNAL_OUTCOME_LIMIT = 12000;
export const JOURNAL_WEEK_LIMIT = 156;
export const JOURNAL_CHANGE_LIMIT = 156;

export interface PaperPosition {
  symbol: string;
  qty: number;
  entry: number;
  stop: number;
  riskPerShare: number;
  openedOn: string;
}

export interface RuleCall {
  date: string;
  ruleId: string;
  symbol: string;
  call: string;
  entry: number | null;
}

export interface ForwardOutcome {
  date: string;
  ruleId: string;
  symbol: string;
  horizon: 5 | 20 | 60;
  forwardReturn: number;
}

export interface Journal {
  version: 1;
  settings: { capital: number | null; targetCagr: number | null };
  params: {
    atrK: number;
    riskPct: number;
    momentumLookback: number;
    dipLow: number;
    dipHigh: number;
  };
  paper: {
    cash: number | null;
    peakEquity: number | null;
    positions: PaperPosition[];
    marks: { date: string; equity: number }[];
  };
  calls: RuleCall[];
  outcomes: ForwardOutcome[];
  changes: WeekChange[];
  weeks: {
    at: string;
    portfolio: { cagr: number | null; maxDrawdown: number | null; sharpe: number | null };
    spy: { cagr: number | null; maxDrawdown: number | null; sharpe: number | null };
    sixtyForty: { cagr: number | null; maxDrawdown: number | null; sharpe: number | null };
    note: string;
  }[];
  gap: string | null;
}

export function emptyJournal(): Journal {
  return {
    version: 1,
    settings: { capital: null, targetCagr: null },
    params: {
      atrK: DEFAULT_ATR_K,
      riskPct: DEFAULT_RISK_PCT,
      momentumLookback: MOMENTUM_LOOKBACK,
      dipLow: DIP_LOW,
      dipHigh: DIP_HIGH,
    },
    paper: { cash: null, peakEquity: null, positions: [], marks: [] },
    calls: [],
    outcomes: [],
    changes: [],
    weeks: [],
    gap: null,
  };
}

export function sealJournal(json: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function openJournal(payload: string, secret: string): string {
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < 29) throw new Error('Journal payload is too short');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function parseJournal(raw: string): Journal {
  const parsed = JSON.parse(raw) as Journal;
  if (!parsed || parsed.version !== 1 || !parsed.params || !parsed.paper) throw new Error('Journal is not version 1');
  return parsed;
}

/** Drops the oldest rows. Callers save `gap` as null because a gap means the read failed. */
export function boundJournal(journal: Journal): Journal {
  return {
    ...journal,
    gap: null,
    paper: { ...journal.paper, marks: journal.paper.marks.slice(-JOURNAL_MARK_LIMIT) },
    calls: journal.calls.slice(-JOURNAL_CALL_LIMIT),
    outcomes: journal.outcomes.slice(-JOURNAL_OUTCOME_LIMIT),
    weeks: journal.weeks.slice(-JOURNAL_WEEK_LIMIT),
    changes: journal.changes.slice(-JOURNAL_CHANGE_LIMIT),
  };
}
