import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export default function OsSourcesPage() {
  return (
    <OsShell
      pathname="/os/sources"
      title="Sources"
      subtitle="Citation drawer. Sense ≠ Decide — every investable claim must point back to corpus or flag insufficient evidence."
    >
      <EmptyState
        title="Citation drawer coming"
        description="When conviction and Signal packs arrive, this pane will list source links and INSUFFICIENT_EVIDENCE flags. Nothing to cite yet."
        waitingOn="Sense corpus"
      />
    </OsShell>
  );
}
