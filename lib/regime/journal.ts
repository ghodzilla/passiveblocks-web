import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { list, put } from '@vercel/blob';
import { DEFAULT_ATR_K, DEFAULT_RISK_PCT } from './sizing';
import { DIP_HIGH, DIP_LOW } from './dip';
import { MOMENTUM_LOOKBACK } from './signals';
import type { WeekChange } from './improve';

export const JOURNAL_PATHNAME = 'regime/journal.json';

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

function filePath(): string {
  return process.env.REGIME_JOURNAL_PATH || path.join(tmpdir(), 'passiveblocks-regime-journal.json');
}

async function readFileJournal(): Promise<Journal | null> {
  try {
    const raw = await readFile(filePath(), 'utf8');
    return parseJournal(raw);
  } catch {
    return null;
  }
}

async function writeFileJournal(journal: Journal): Promise<void> {
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(journal), 'utf8');
}

export async function readJournal(): Promise<Journal> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const secret = process.env.REGIME_SESSION_SECRET;
  if (token && secret && secret.length >= 32) {
    try {
      const found = await list({ prefix: JOURNAL_PATHNAME, token, limit: 10 });
      const blob = found.blobs.find((item) => item.pathname === JOURNAL_PATHNAME);
      if (!blob) return emptyJournal();
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Journal blob HTTP ${response.status}`);
      const text = openJournal(await response.text(), secret);
      return parseJournal(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Journal read failed';
      const journal = emptyJournal();
      journal.gap = `The paper journal could not be read (${message}). No track record was invented.`;
      return journal;
    }
  }
  const local = await readFileJournal();
  if (local) {
    local.gap = local.gap ?? 'BLOB_READ_WRITE_TOKEN is not set. This journal is stored on the local instance only.';
    return local;
  }
  const journal = emptyJournal();
  journal.gap = 'BLOB_READ_WRITE_TOKEN is not set. The paper journal is not durable on a new serverless instance. Set the token to store an encrypted journal in Vercel Blob. No Supabase table is used.';
  return journal;
}

export async function writeJournal(journal: Journal): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const secret = process.env.REGIME_SESSION_SECRET;
  const stored = { ...journal, gap: null };
  if (token && secret && secret.length >= 32) {
    const body = sealJournal(JSON.stringify(stored), secret);
    await put(JOURNAL_PATHNAME, body, {
      access: 'public',
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/plain',
    });
    return;
  }
  await writeFileJournal(stored);
}
