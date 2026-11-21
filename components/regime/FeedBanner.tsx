import type { RefreshHealth } from '@/lib/regime/refreshHealth';
import { sydneyClock } from '@/lib/regime/time';

export function FeedBanner({
  blockReason,
  health,
}: {
  blockReason: string | null;
  health: RefreshHealth | null;
}) {
  if (!blockReason) return null;
  const lastGood = health?.lastFullySuccessfulFetchAt ?? null;
  const attempt = health?.attemptedAt ?? null;
  const failures = (health?.sources ?? []).filter((source) => source.mandatory && source.error).slice(0, 4);
  return (
    <section role="status" className="rounded-[var(--radius-xl)] border border-rose-300/50 bg-rose-500/15 px-4 py-3" id="feed-banner">
      <p className="text-sm font-bold text-[var(--text-1)]">A required market feed failed. The book keeps its last week and does not trade off this read.</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{blockReason}</p>
      <p className="mt-1 text-sm text-[var(--text-1)]">
        Last good data: {lastGood ? sydneyClock(lastGood) : 'no successful fetch is stored'}.
        {' '}Last attempt: {attempt ? sydneyClock(attempt) : '—'}.
      </p>
      {failures.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-[var(--text-2)]">
          {failures.map((source) => (
            <li key={source.id}>{source.label}: {source.error}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
