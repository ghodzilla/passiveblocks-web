import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';
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

  return (
    <OsShell
      pathname="/os/crypto"
      eyebrow="Sense"
      title="Crypto"
      subtitle="Coin tape and reported flows from the August research board. Not a live quote. Not Act."
    >
      <div className="mb-8 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
        <p>{board.lead}</p>
        <p className="text-xs text-[var(--muted)]">
          {board.flow_window}. The later flow card is on{' '}
          <Link href="/os/signal" className="underline-offset-2 hover:underline">
            Signal
          </Link>
          . Do not blend the two.
        </p>
      </div>

      <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--status-ok)]/30 bg-[var(--status-ok)]/5 px-5 py-4">
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

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
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

      <section className="mb-12">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          Coin board
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {coins.map((coin) => (
            <article
              key={coin.symbol}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold tracking-tight">{coin.symbol}</p>
                <p className="font-mono text-sm">{coin.price}</p>
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
    </OsShell>
  );
}
