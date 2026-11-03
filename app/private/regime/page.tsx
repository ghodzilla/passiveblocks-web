import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { enforceRegimePage } from '@/lib/regime/guard';
import { getCachedRegimeSnapshot } from '@/lib/regime/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage() {
  await enforceRegimePage();
  const snapshot = await getCachedRegimeSnapshot();
  return <RegimeDashboard snapshot={snapshot} />;
}
