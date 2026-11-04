import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { enforceRegimePage } from '@/lib/regime/guard';
import { getRegimeDesk } from '@/lib/regime/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegimePage() {
  await enforceRegimePage();
  const { snapshot, ideas, desk } = await getRegimeDesk();
  return <RegimeDashboard snapshot={snapshot} ideas={ideas} desk={desk} />;
}
