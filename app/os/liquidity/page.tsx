import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';
import flows from '@/data/os/liquidity-flows.json';

export const metadata = {
  title: 'Liquidity · OS',
  robots: { index: false, follow: false },
};

type Row = { bucket: string; print: string; note: string };

export default function LiquidityPage() {
  const rows = flows.rows as Row[];

  return (
    <OsShell
      pathname="/os/liquidity"
      eyebrow="Sense"
      title="Liquidity and flows"
      subtitle="Reported capital flows from the August board. Not a live tape. Not Act."
    >
      <div className="mb-8 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
        <p>{flows.lead}</p>
        <p className="text-xs text-[var(--muted)]">
          {flows.window}. The later flow card is on{' '}
          <Link href="/os/signal" className="underline-offset-2 hover:underline">
            Signal
          </Link>
          . The coin board is on{' '}
          <Link href="/os/crypto" className="underline-offset-2 hover:underline">
            Crypto
          </Link>
          .
        </p>
      </div>

      <p className="mb-8 rounded-[var(--radius-lg)] border border-[var(--status-warn)]/30 bg-[var(--status-warn)]/5 px-4 py-3 text-sm text-[var(--muted)]">
        {flows.timeline}
      </p>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          Capital flows, reported net
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.bucket} className="border-b border-[var(--border)]/70 align-top">
                  <td className="px-4 py-3 font-semibold">{row.bucket}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.print}</td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">{flows.sources}</p>
      </section>
    </OsShell>
  );
}
