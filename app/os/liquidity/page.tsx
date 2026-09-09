import { OsShell } from '@/components/os/OsShell';
import { LiquidityCard } from '@/components/os/LiquidityCard';

export const metadata = {
  title: 'Liquidity · OS',
  robots: { index: false, follow: false },
};

export default function LiquidityPage() {
  return (
    <OsShell pathname="/os/liquidity" eyebrow="Sense" title="Liquidity" subtitle="Number first. Not a thesis.">
      <LiquidityCard />
    </OsShell>
  );
}
