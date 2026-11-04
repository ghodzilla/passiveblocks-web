import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { enforceRegimePage } from '@/lib/regime/guard';
import { getRegimeDesk } from '@/lib/regime/load';
import { readSelfCheck } from '@/lib/regime/selfcheck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage() {
  await enforceRegimePage();
  const [{ snapshot, ideas, desk, consistency }, selfCheck] = await Promise.all([
    getRegimeDesk(),
    readSelfCheck(),
  ]);
  return <RegimeDashboard view={{ snapshot, ideas, desk, consistency }} selfCheck={selfCheck} />;
}
