import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export default function OsSignalPage() {
  return (
    <OsShell
      pathname="/os/signal"
      title="Signal digest"
      subtitle="Weekly Sense packs. Themes and monitors feed Decide — they never size the book themselves."
    >
      <EmptyState
        title="Waiting for Signal digest"
        description="Sam’s weekly packs will surface here with links into Sources. Empty until the first pack lands."
        waitingOn="Sam Signal"
      />
    </OsShell>
  );
}
