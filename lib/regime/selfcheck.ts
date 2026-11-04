import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { list, put } from '@vercel/blob';
import type { ConsistencyReport } from './consistency';
import { openJournal, sealJournal } from './journal';

export const SELF_CHECK_PATHNAME = 'regime/selfcheck.json';

export interface SelfCheckFailure {
  id: string;
  detail: string;
}

export interface SelfCheckRecord {
  ok: boolean;
  failures: SelfCheckFailure[];
  asOf: string | null;
}

export function selfCheckFromReport(report: ConsistencyReport, asOf: string): SelfCheckRecord {
  const failures = report.rules
    .filter((rule) => !rule.pass)
    .map((rule) => ({ id: rule.id, detail: rule.detail }));
  return { ok: failures.length === 0, failures, asOf };
}

function localPath(): string {
  return path.join(tmpdir(), 'passiveblocks-regime-selfcheck.json');
}

function parseRecord(raw: string): SelfCheckRecord {
  const parsed = JSON.parse(raw) as SelfCheckRecord;
  if (!parsed || !Array.isArray(parsed.failures) || typeof parsed.ok !== 'boolean') {
    throw new Error('Self-check record is not valid');
  }
  return { ok: parsed.ok, failures: parsed.failures, asOf: parsed.asOf ?? null };
}

export async function readSelfCheck(): Promise<SelfCheckRecord | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const secret = process.env.REGIME_SESSION_SECRET;
  if (token && secret && secret.length >= 32) {
    try {
      const found = await list({ prefix: SELF_CHECK_PATHNAME, token, limit: 10 });
      const blob = found.blobs.find((item) => item.pathname === SELF_CHECK_PATHNAME);
      if (!blob) return null;
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) return null;
      return parseRecord(openJournal(await response.text(), secret));
    } catch {
      return null;
    }
  }
  try {
    return parseRecord(await readFile(localPath(), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeSelfCheck(record: SelfCheckRecord): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const secret = process.env.REGIME_SESSION_SECRET;
  const body = JSON.stringify(record);
  if (token && secret && secret.length >= 32) {
    await put(SELF_CHECK_PATHNAME, sealJournal(body, secret), {
      access: 'public',
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/plain',
    });
    return;
  }
  const target = localPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, 'utf8');
}
