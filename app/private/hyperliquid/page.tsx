import { DeskPage } from '@/components/hyperliquid/DeskPage';
import { loadLiveDesk } from '@/lib/hyperliquid/liveDesk';
import snapshot from '@/lib/hyperliquid/replaySnapshot.json';
import type { DeskSnapshot } from '@/lib/hyperliquid/types';
import { enforceRegimePage } from '@/lib/regime/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HyperliquidDeskPage() {
  await enforceRegimePage('/private/hyperliquid');
  const live = await loadLiveDesk();
  if (live) return <DeskPage desk={live} />;
  const recorded = snapshot as DeskSnapshot;
  return (
    <DeskPage
      desk={{
        ...recorded,
        banner: 'no live data yet',
        feed: 'replay',
      }}
    />
  );
}
