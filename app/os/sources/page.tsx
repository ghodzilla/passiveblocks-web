import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export const metadata = {
  title: 'Sources · OS',
  robots: { index: false, follow: false },
};

export default function OsSourcesPage() {
  return (
    <OsShell
      pathname="/os/sources"
      eyebrow="Truth"
      title="Sources"
      subtitle="Citation drawer for every investable claim. Sense ≠ Decide — unsigned or insufficient evidence never becomes a live score."
    >
      <EmptyState
        title="Citation drawer standing by"
        description="Rows will list transcript packs, theme notes, and monitor hits behind each Vera-signed line — or flag INSUFFICIENT_EVIDENCE. Nothing to cite until Signal packs and ledger links arrive."
        waitingOn="Sense corpus"
        skeleton="sources"
      />
    </OsShell>
  );
}
