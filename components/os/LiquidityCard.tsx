import Link from 'next/link';
import { formatFlowUsdMillions, liquidityCard } from '@/lib/os-data';
import { MetricTile } from '@/components/os/MetricTile';

function tone(value: string): 'ok' | 'bad' | 'neutral' {
  if (value.trim().startsWith('-') || value.trim().startsWith('−')) return 'bad';
  if (value.trim().startsWith('+')) return 'ok';
  return 'neutral';
}

function sessions(raw: string) {
  return raw.split(',').map((part) => part.trim());
}

export function LiquidityCard({ variant = 'full' }: { variant?: 'full' | 'teaser' }) {
  const card = liquidityCard;
  const btc = card.tradfi_to_crypto.btc;
  const eth = card.tradfi_to_crypto.eth;
  const stables = card.stablecoins;
  const dates = ['1 Sep', '2 Sep', '3 Sep', '4 Sep'];
  const btcSessions = sessions(btc.farside_sessions_usdm);
  const ethSessions = sessions(eth.farside_sessions_usdm);

  const btcFlow = formatFlowUsdMillions(btc.farside_sum);
  const ethFlow = formatFlowUsdMillions(eth.farside_sum, eth.farside_sum_unit);

  const tiles = [
    {
      label: 'Stablecoins',
      value: stables.level_required,
      delta: `${stables.change_7d_required} 7d · ${stables.change_1d_required} 1d`,
      meta: `${stables.as_of} · DefiLlama`,
      tone: tone(stables.change_7d_required),
    },
    {
      label: 'BTC ETFs',
      value: btcFlow,
      delta: '1–4 Sep net',
      meta: `${btc.farside_as_of} · Farside`,
      tone: tone(btcFlow),
    },
    {
      label: 'ETH ETFs',
      value: ethFlow,
      delta: '1–4 Sep net',
      meta: `${eth.farside_as_of} · Farside`,
      tone: tone(ethFlow),
    },
    {
      label: 'BTC 8 Sep',
      value: btc.sosovalue_display,
      delta: 'SoSoValue · Farside not printed',
      meta: btc.sosovalue_as_of,
      tone: 'bad' as const,
    },
    {
      label: 'ETH 8 Sep',
      value: eth.sosovalue_display,
      delta: 'SoSoValue · Farside not printed',
      meta: eth.sosovalue_as_of,
      tone: 'bad' as const,
    },
    {
      label: 'ON RRP',
      value: '$0.626bn',
      delta: '−$0.049bn vs 4 Sep',
      meta: '8 Sep · FRED',
      tone: 'neutral' as const,
    },
  ];

  if (variant === 'teaser') {
    return (
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Flows
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">The tape this week</h2>
          </div>
          <Link href="/os/liquidity" className="text-xs text-[var(--accent-soft)] hover:underline">
            All prints
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.slice(0, 3).map((tile) => (
            <MetricTile key={tile.label} {...tile} />
          ))}
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">Does not pick the clock. Paper stays hold.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-foreground">Does not pick the clock. Paper stays hold.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">9 Sep pull. Not the July board.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <MetricTile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-bold">Spot ETF</th>
              {dates.map((day) => (
                <th key={day} className="px-4 py-3 font-bold">{day}</th>
              ))}
              <th className="px-4 py-3 font-bold">Sum</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--border)]">
              <td className="px-4 py-3 font-semibold">BTC</td>
              {btcSessions.map((value) => (
                <td key={value} className={`px-4 py-3 font-mono ${tone(value) === 'bad' ? 'text-[var(--status-bad)]' : 'text-[var(--status-ok)]'}`}>
                  {value}
                </td>
              ))}
              <td className="px-4 py-3 font-mono font-semibold">{btcFlow}</td>
            </tr>
            <tr className="border-t border-[var(--border)]">
              <td className="px-4 py-3 font-semibold">ETH</td>
              {ethSessions.map((value) => (
                <td key={value} className={`px-4 py-3 font-mono ${tone(value) === 'bad' ? 'text-[var(--status-bad)]' : 'text-[var(--status-ok)]'}`}>
                  {value}
                </td>
              ))}
              <td className="px-4 py-3 font-mono font-semibold">{ethFlow}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="TGA" value="$889bn" delta="−$82bn vs 28 Aug" meta="4 Sep · Treasury" />
        <MetricTile label="Reserves" value="Down" delta="−$30.4bn week" meta="Week ended 2 Sep · H.4.1" tone="bad" />
        <MetricTile label="HY spread" value="2.68%" delta="+0.08pt vs 28 Aug" meta="7 Sep · not a flow" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {['Gold flow', 'PBOC print', 'Basis', 'Farside 8 Sep'].map((label) => (
          <MetricTile key={label} label={label} value="No print" meta="Hole. Not zero." />
        ))}
      </div>
    </section>
  );
}
