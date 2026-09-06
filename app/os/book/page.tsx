import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export default function OsBookPage() {
  return (
    <OsShell
      pathname="/os/book"
      title="Paper book"
      subtitle="Target weights and paper fills. Live capital stays off until rail + ceilings exist."
    >
      <EmptyState
        title="Waiting for paper target book"
        description="Diego’s Decide output (target-book) will wire here. No mock P&L or sleeve sizes in the meantime."
        waitingOn="Diego Decide"
      />
    </OsShell>
  );
}
