import { readFileSync } from 'node:fs';
import { cookies } from 'next/headers';
import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { enforceRegimePage } from '@/lib/regime/guard';
import { parseResearchAssumptions } from '@/lib/regime/evaluate';
import { getRegimeDesk } from '@/lib/regime/load';
import { readPaperLog } from '@/lib/regime/paperLog';
import { ATTEMPT_COOKIE, openAttemptCookie, signRefreshCsrf } from '@/lib/regime/refreshHealth';
import { REGIME_COOKIE } from '@/lib/regime/session';
import { readSelfCheck } from '@/lib/regime/state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage({
  searchParams,
}: {
  searchParams?: { settings?: string | string[]; costBps?: string | string[]; cashBps?: string | string[] };
}) {
  await enforceRegimePage();
  const secret = process.env.REGIME_SESSION_SECRET;
  const sessionToken = cookies().get(REGIME_COOKIE)?.value ?? 'ip';
  const csrf = secret && secret.length >= 32 ? signRefreshCsrf(secret, sessionToken) : null;
  const attempt = secret ? openAttemptCookie(secret, cookies().get(ATTEMPT_COOKIE)?.value) : null;
  const assumptions = parseResearchAssumptions(searchParams);
  const [{ snapshot, ideas, desk, consistency, health, blockReason, auditNote, evaluation }, selfCheck, paperLog] = await Promise.all([
    getRegimeDesk(new Date(), attempt, undefined, assumptions),
    readSelfCheck(),
    readPaperLog(),
  ]);
  let validation = null;
  try {
    validation = JSON.parse(readFileSync('research/regime-validation/results.json', 'utf8'));
  } catch {
    validation = null;
  }
  const settingsFlag = Array.isArray(searchParams?.settings) ? searchParams?.settings[0] : searchParams?.settings;
  const settingsNotice = settingsFlag === 'store'
    ? 'Capital and the aspiration were not saved. Neon did not keep the write, and this server did not keep a local copy.'
    : null;
  return (
    <RegimeDashboard
      view={{ snapshot, ideas, desk, consistency }}
      selfCheck={selfCheck.status === 'ok' ? selfCheck.value : null}
      settingsNotice={settingsNotice}
      health={health}
      attempt={attempt}
      blockReason={blockReason}
      csrf={csrf}
      auditNote={auditNote}
      evaluation={evaluation}
      validation={validation}
      paperLog={paperLog}
    />
  );
}
