import { DeskPage } from '@/components/hyperliquid/DeskPage';
import snapshot from '@/lib/hyperliquid/replaySnapshot.json';
import type { DeskSnapshot } from '@/lib/hyperliquid/types';
import { enforceRegimePage } from '@/lib/regime/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HyperliquidDeskPage() {
  await enforceRegimePage('/private/hyperliquid');
  return <DeskPage desk={snapshot as DeskSnapshot} />;
}
