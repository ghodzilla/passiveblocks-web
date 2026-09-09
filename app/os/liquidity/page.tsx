import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';
import card from '@/data/os/liquidity-card.json';

export const metadata = {
  title: 'Liquidity · OS',
  robots: { index: false, follow: false },
};

type Cell = {
  group: string;
  label: string;
  as_of: string;
  publisher: string;
  source_url: string;
  headline: string;
  detail: string;
};

export default function LiquidityPage() {
  const cells = card.filled as Cell[];

  return (
    <OsShell
      pathname="/os/liquidity"
      eyebrow="Sense"
      title="Liquidity and flows"
      subtitle="9 Sep pull. Crypto, tradfi, tradfi into crypto. Not the July board. Not Act."
    >
      <div className="mb-8 max-w-3xl space-y-3 text-sm leading-relaxed">
        <p>{card.visible_note}</p>
        <p className="text-xs text-[var(--muted)]">{card.absent}</p>
        <p className="text-xs text-[var(--muted)]">
          Compiled {card.compiled}. The letter is on{' '}
          <Link href="/os/letter" className="underline-offset-2 hover:underline">
            Letter
          </Link>
          .
        </p>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <tbody>
            {cells.map((row) => (
              <tr key={row.label} className="border-b border-[var(--border)]/70 align-top">
                <td className="px-4 py-3 text-xs text-[var(--muted)]">{row.group}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.headline}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{row.detail}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {row.as_of} · {row.publisher}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OsShell>
  );
}
