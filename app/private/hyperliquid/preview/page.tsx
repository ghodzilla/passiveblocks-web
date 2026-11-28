import { DeskPage } from '@/components/hyperliquid/DeskPage';
import { deskFromParts } from '@/lib/hyperliquid/liveDesk';
import snapshot from '@/lib/hyperliquid/replaySnapshot.json';
import type { DeskSnapshot } from '@/lib/hyperliquid/types';
import { enforceRegimePage } from '@/lib/regime/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HyperliquidMapperPreview() {
  await enforceRegimePage('/private/hyperliquid/preview');
  const recorded = snapshot as DeskSnapshot;
  const heartbeat = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const mapped = deskFromParts({
    equityCount: recorded.equity_curve.length,
    latestEquity: recorded.pnl.shadow_equity_usdc,
    latestEquityAt: recorded.as_of,
    heartbeatAt: heartbeat,
    bookAge: 1,
    equityCurve: recorded.equity_curve,
    strategies: recorded.strategies,
    signals: recorded.signals,
    positions: recorded.positions,
    plans: recorded.plans,
    events: recorded.events,
    gatedMean: recorded.pnl.gated_mean_r,
    ungatedMean: recorded.pnl.ungated_mean_r,
    grossLeverage: recorded.health.open_risk.gross_leverage,
    totalRisk: recorded.health.open_risk.total_risk,
    clusterRisk: recorded.health.open_risk.cluster_risk,
    staleBlocks: recorded.health.stale_blocks,
    signalEscapes: recorded.health.signal_escapes,
    falseCloses: recorded.health.false_closes,
    routing: recorded.health.routing_accuracy,
    gateMix: recorded.health.gate_mix,
    closeMix: recorded.health.close_mix,
    drawdown: recorded.health.drawdown,
    dailyPnl: recorded.health.open_risk.daily_pnl_pct,
  });
  if (!mapped) {
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
  return (
    <DeskPage
      desk={{
        ...mapped,
        banner: 'Mapper preview from recorded rows. Not a live book.',
        source: 'Mapper preview. These rows are the recorded replay, passed through the same reader that reads schema hl.',
      }}
    />
  );
}
