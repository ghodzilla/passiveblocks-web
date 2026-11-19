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
    <section role="status" className="rounded-[var(--radius-xl)] border border-rose-300/50 bg-rose-500/15 px-5 py-4" id="feed-banner">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-100">New buys are paused</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-[var(--text-1)] sm:text-2xl">
        The latest refresh did not land. Nothing new is bought until a refresh succeeds.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{blockReason}</p>
      <p className="mt-3 text-sm text-[var(--text-1)]">
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
