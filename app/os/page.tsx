import { OsShell } from '@/components/os/OsShell';
import { OsCard } from '@/components/os/OsCard';

export default function OsHomePage() {
  return (
    <OsShell
      pathname="/os"
      title="Operating home"
      subtitle="Sense → Decide → Show → paper Act. Cards stay empty until Sam, Diego, and Vera feed signed data — no inventable numbers."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <OsCard
          href="/os/conviction"
          label="Decide"
          title="Conviction ledger"
          description="Vera-signed scores only. Unsigned rows never appear as live claims."
          status="Empty"
        />
        <OsCard
          href="/os/book"
          label="Show · Act"
          title="Paper book"
          description="Target book and paper fills against live signals. Structure ready; book pending."
          status="Empty"
        />
        <OsCard
          href="/os/risk"
          label="Risk"
          title="Risk ceilings"
          description="Paper structure for DD, IL, name, theme, and kill switch — pending Vera schema sign-off."
          status="Structure"
        />
        <OsCard
          href="/os/signal"
          label="Sense"
          title="Signal digest"
          description="Weekly packs from Sam. Citations stay visible — Sense ≠ Decide."
          status="Empty"
        />
      </div>
    </OsShell>
  );
}
