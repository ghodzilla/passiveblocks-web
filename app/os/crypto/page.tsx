import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';
import { formatFlowUsdMillions, formatVintage, liquidityCard } from '@/lib/os-data';
import board from '@/data/os/crypto-board.json';

export const metadata = {
  title: 'Crypto · OS',
  robots: { index: false, follow: false },
};

type Coin = {
  symbol: string;
  name: string;
  price: string;
  day: string;
  month: string;
  held: boolean;
};

type Flow = {
  bucket: string;
  print: string;
  tag: string;
  note: string;
};

function dayClass(day: string) {
  return day.startsWith('-') ? 'text-[var(--status-bad)]' : 'text-[var(--status-ok)]';
}

export default function CryptoPage() {
  const coins = board.coins as Coin[];
  const flows = board.flows as Flow[];
  const btc = liquidityCard.tradfi_to_crypto.btc;
  const eth = liquidityCard.tradfi_to_crypto.eth;
  const stables = liquidityCard.stablecoins;
  const refresh = formatVintage(liquidityCard.as_of);
  const boardVintage = formatVintage(board.as_of);
  const btcFlow = formatFlowUsdMillions(btc.farside_sum);
  const ethFlow = formatFlowUsdMillions(eth.farside_sum, eth.farside_sum_unit);

  return (
    <OsShell
      pathname="/os/crypto"
      eyebrow="Sense"
      title="Crypto"
      subtitle="9 Sep flow card first. The August coin tape is a prior snapshot. Not a live quote. Not Act."
    >
      <p className="mb-6 text-xs text-[var(--muted)]">
        Last full refresh {refresh}.{' '}
        <span className="os-stamp os-stamp--sense">Flow card · {refresh}</span>{' '}
        <span className="ml-1 os-stamp">Prior snapshot · {boardVintage}</span>
      </p>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Current flow regime
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
              {liquidityCard.tradfi_to_crypto.headline} Not a live quote. Not the August board. Do not blend the two.
            </p>
          </div>
          <span className="os-stamp os-stamp--sense">{refresh} · not a live quote</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">BTC ETFs</p>
            <p className="mt-1 font-mono text-xl font-semibold">{btcFlow}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">1–4 Sep · Farside · {btc.farside_as_of}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">ETH ETFs</p>
            <p className="mt-1 font-mono text-xl font-semibold">{ethFlow}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">1–4 Sep · Farside · {eth.farside_as_of}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">8 Sep session</p>
            <p className="mt-1 font-mono text-sm font-semibold">BTC {btc.sosovalue_display} · ETH {eth.sosovalue_display}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">SoSoValue · Farside not printed · {btc.sosovalue_as_of}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:col-span-2 lg:col-span-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Stablecoins</p>
            <p className="mt-1 text-sm font-semibold">{stables.level_required}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {stables.change_7d_required} 7d · {stables.change_1d_required} 1d · {stables.as_of} · DefiLlama
            </p>
          </article>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Full card on{' '}
          <Link href="/os/signal" className="underline-offset-2 hover:underline">
            Signal
          </Link>{' '}
          and{' '}
          <Link href="/os/liquidity" className="underline-offset-2 hover:underline">
            Liquidity
          </Link>
          .
        </p>
      </section>

      <details className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/15">
        <summary className="cursor-pointer px-4 py-3 text-sm">
          <span className="font-semibold">Prior snapshot</span>
          <span className="ml-2 text-xs text-[var(--muted)]">
            August board · BTC {coins.find((c) => c.symbol === 'BTC')?.price} · ETH {coins.find((c) => c.symbol === 'ETH')?.price}. Not the 8 Sep flow regime.
          </span>
        </summary>
        <div className="space-y-8 border-t border-[var(--border)] px-4 py-4">
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
            <p>{board.lead}</p>
            <p className="text-xs text-[var(--muted)]">
              {board.flow_window}. The later flow card is above, and on{' '}
              <Link href="/os/signal" className="underline-offset-2 hover:underline">
                Signal
              </Link>
              . Do not blend the two.
            </p>
          </div>

          <section className="rounded-[var(--radius-xl)] border border-[var(--status-ok)]/30 bg-[var(--status-ok)]/5 px-5 py-4">
            <p className="text-sm font-semibold text-foreground">
              {board.regime.label}{' '}
              <span className="font-mono text-xs text-[var(--muted)]">score {board.regime.score}</span>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              {board.regime.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Stablecoin supply
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Not on this print. The board left it blank.</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Crypto exposure on this board
              </p>
              <p className="mt-1 text-sm font-semibold">{board.exposure}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{board.exposure_note}</p>
            </div>
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Coin board
              </h2>
              <span className="os-stamp">prior · {boardVintage}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {coins.map((coin) => (
                <article
                  key={coin.symbol}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold tracking-tight">{coin.symbol}</p>
                    <p className="font-mono text-xl font-semibold">{coin.price}</p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {coin.name}
                    {coin.held ? ' · held on this board' : ''}
                  </p>
                  <p className="mt-2 font-mono text-xs">
                    <span className="text-[var(--status-ok)]">1M {coin.month}</span>
                    <span className={`ml-2 ${dayClass(coin.day)}`}>{coin.day}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Reported flows
            </h2>
            <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-sm">
                <tbody>
                  {flows.map((row) => (
                    <tr key={row.bucket} className="border-b border-[var(--border)]/70 align-top">
                      <td className="px-4 py-3 font-semibold">{row.bucket}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.print}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{row.tag}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">{board.sources}</p>
          </section>
        </div>
      </details>
    </OsShell>
  );
}
