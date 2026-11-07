import type { ConsistencyReport } from './consistency';

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

export function parseSelfCheckRecord(raw: string): SelfCheckRecord {
  const parsed = JSON.parse(raw) as SelfCheckRecord;
  if (!parsed || !Array.isArray(parsed.failures) || typeof parsed.ok !== 'boolean') {
    throw new Error('Self-check record is not valid');
  }
  return { ok: parsed.ok, failures: parsed.failures, asOf: parsed.asOf ?? null };
}
