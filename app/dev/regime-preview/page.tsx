import { notFound } from 'next/navigation';
import { RegimeDashboard } from '@/components/regime/RegimeDashboard';
import { buyProps, quietProps } from '@/lib/regime/previewFixture';

export const dynamic = 'force-dynamic';

export default function RegimePreviewPage({
  searchParams,
}: {
  searchParams?: { day?: string };
}) {
  if (process.env.NODE_ENV === 'production' || process.env.REGIME_FIXTURE_PREVIEW !== '1') notFound();
  const buys = searchParams?.day === 'buys';
  return (
    <>
      <p className="border-b border-amber-300/40 bg-amber-400/10 px-5 py-2 text-center text-sm text-[var(--text-1)]">
        Fixture, not the live book. {buys ? 'A day the rules allow buys.' : 'A day nothing new is allowed.'}
      </p>
      <RegimeDashboard {...(buys ? buyProps() : quietProps())} />
    </>
  );
}
