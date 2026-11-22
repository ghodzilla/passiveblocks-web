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
  const empty = searchParams?.day === 'empty';
  return (
    <>
      <p className="border-b border-amber-300/40 bg-[#3b2a0a] px-4 py-2 text-center text-sm text-[#fffbeb]">
        Fixture, not the live book. {empty ? 'No week is saved yet.' : 'Red week from the sample book. The picture’s numbers are not used.'}
      </p>
      <RegimeDashboard {...(empty ? quietProps() : buyProps())} />
    </>
  );
}
