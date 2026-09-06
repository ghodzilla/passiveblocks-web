import { OsShell } from '@/components/os/OsShell';
import { EmptyState } from '@/components/os/EmptyState';

export const metadata = {
  title: 'Signal · OS',
  robots: { index: false, follow: false },
};

export default function OsSignalPage() {
  return (
    <OsShell
      pathname="/os/signal"
      eyebrow="Sense"
      title="Signal inbox"
      subtitle="Weekly packs from Sam land here — themes, monitors, and regime notes that feed Decide. Sense never sizes the book."
    >
      <EmptyState
        title="No Signal packs yet"
        description="When the first weekly digest ships, you’ll see pack cards with focus themes, monitor hits, and deep links into Sources. Structure is ready; inbox is empty on purpose."
        waitingOn="Sam Signal"
        skeleton="signal"
      />
    </OsShell>
  );
}
