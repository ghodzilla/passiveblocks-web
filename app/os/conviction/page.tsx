import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export default function OsConvictionPage() {
  return (
    <OsShell
      pathname="/os/conviction"
      title="Conviction ledger"
      subtitle="Scores publish here only after Vera signs. Until then this pane stays empty on purpose."
    >
      <EmptyState
        title="Waiting for Vera-signed conviction ledger"
        description="No placeholder scores. When the first ledger clears Risk, rows land here with citations back to Signal."
        waitingOn="Vera · Diego"
      />
    </OsShell>
  );
}
