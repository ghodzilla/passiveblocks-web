import type { PaperMarkPayload } from '@/lib/regime/paperLog';
import {
  bookAudValue,
  budgetMeans,
  describeFeeds,
  holdingsNow,
  knownGapLines,
  marketCall,
  paperComparabilityNote,
  performanceSinceStart,
  plainRegime,
  sydneyWhen,
  todayAction,
  trustLine,
  type FeedStatus,
} from '@/lib/regime/ownerCopy';
import type { RegimeView } from '@/lib/regime/view';

const STATUS_CLASS: Record<FeedStatus, string> = {
  fresh: 'text-[var(--status-ok)]',
  stale: 'text-[var(--status-warn)]',
  blocked: 'text-[var(--status-danger)]',
};

const STATUS_WORD: Record<FeedStatus, string> = {
  fresh: 'Fresh',
  stale: 'Stale',
  blocked: 'Blocked',
};

export function Fold({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/20">
      <summary className="cursor-pointer px-5 py-4">
        <span className="text-base font-bold tracking-tight">{title}</span>
        <span className="mt-1 block text-sm font-normal leading-relaxed text-[var(--muted)]">{lede}</span>
      </summary>
      <div className="border-t border-[var(--border)] px-5 py-5">{children}</div>
    </details>
  );
}

export function OwnerBrief({
  view,
  paperLog,
  verdict,
  fullStrategy,
  h1,
  blockReason,
}: {
  view: RegimeView;
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null };
  verdict: string | null;
  fullStrategy: string | null;
  h1: string | null;
  blockReason: string | null;
}) {
  const { snapshot, desk } = view;
  const tone = plainRegime(snapshot.regime);
  const call = marketCall({
    actionable: snapshot.actionable,
    action: snapshot.action,
    regime: snapshot.regime,
  });
  const aud = bookAudValue({
    currency: desk.paperLedger?.currency ?? null,
    equity: desk.equity,
    capital: desk.capital,
    valued: desk.paperLedger?.valued === true,
  });
  const action = todayAction({
    actionable: snapshot.actionable,
    action: snapshot.action,
    halted: desk.halted,
    lines: desk.lines,
    bookAud: aud.amount,
    pending: desk.paperLedger?.pending,
  });
  const held = holdingsNow({
    lines: desk.lines,
    exposures: desk.paperLedger?.exposures ?? null,
    heldWeights: paperLog.latest?.basis === 'held-book' ? paperLog.latest.weights : null,
    heldBasis: paperLog.latest?.basis,
    bookAud: aud.amount,
  });
  const performance = performanceSinceStart({
    capital: desk.capital,
    equity: desk.equity,
    currency: desk.paperLedger?.currency ?? null,
    valued: desk.paperLedger?.valued === true && desk.equity != null,
    realisedText: desk.realisedText,
    drawdown: desk.drawdown,
    comparable: paperComparabilityNote(paperLog) == null,
  });
  const trust = trustLine({ verdict, fullStrategy, h1 });
  const dollarMeans = aud.basis === 'value'
    ? 'Dollars use the current value of the Australian-dollar paper book.'
    : aud.basis === 'starting amount'
      ? 'Dollars use the starting amount, because the book has no current Australian-dollar value.'
      : action.means;

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/30 px-5 py-6 sm:px-7" id="today" data-owner-brief>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-soft)]">Today</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" data-regime-plain>
        {tone.title}
        <span className="ml-3 align-middle text-sm font-semibold text-[var(--muted)]" title={snapshot.regimeLabel}>
          {snapshot.regimeLabel}
        </span>
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{tone.means}</p>
      <p className="mt-5 text-lg font-semibold leading-relaxed text-white sm:text-xl" data-market-call data-today-line>
        {call}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4" data-today-action>
          <h2 className="text-sm font-bold">What to do today</h2>
          <p className="mt-2 text-base font-semibold leading-relaxed text-white">{action.headline}</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
            {action.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            What this means: {aud.basis === 'unavailable' ? action.means : `${dollarMeans} ${action.means}`}
          </p>
          {blockReason ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-white/50">Why new buys are off</summary>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{blockReason}</p>
            </details>
          ) : null}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-white/50">The original rule sentence</summary>
            <p className="mt-2 text-xs leading-relaxed text-white/60">{snapshot.message}</p>
          </details>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4" data-holdings>
          <h2 className="text-sm font-bold">What the book holds</h2>
          <p className="mt-2 text-base font-semibold leading-relaxed text-white">{held.sentence}</p>
          {held.items.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-white/85">
              {held.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">What this means: {held.means}</p>
        </article>
      </div>

      <article className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4" data-performance>
        <h2 className="text-sm font-bold">How the paper book has done since it started</h2>
        <p className="mt-2 text-base font-semibold leading-relaxed text-white">{performance.sentence}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">What this means: {performance.means}</p>
      </article>

      <p className="mt-5 text-sm leading-relaxed text-white/80" data-trust>{trust}</p>
    </section>
  );
}

export function FreshnessPanel({
  view,
  healthSources,
  paperLog,
  blockReason,
  csrf,
}: {
  view: RegimeView;
  healthSources: { id: string; label: string; observationDate: string | null; fetchedAt: string | null; error: string | null }[];
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null };
  blockReason: string | null;
  csrf: string | null;
}) {
  const names: Record<string, string> = {};
  for (const line of view.desk.lines) names[line.symbol] = line.name;
  const feeds = describeFeeds({
    rows: view.snapshot.freshness,
    sources: healthSources,
    priceGaps: view.ideas.gaps,
    names,
    pricesFetchedAt: view.ideas.pricesFetchedAt,
  });
  const paperNote = paperComparabilityNote(paperLog);
  const gaps = knownGapLines({
    snapshotGaps: view.snapshot.gaps,
    priceGaps: view.ideas.gaps,
    deskGaps: view.desk.gaps,
    paperNote,
  });
  const counts = {
    fresh: feeds.filter((feed) => feed.status === 'fresh').length,
    stale: feeds.filter((feed) => feed.status === 'stale').length,
    blocked: feeds.filter((feed) => feed.status === 'blocked').length,
  };

  return (
    <section className="mt-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/30 px-5 py-5" id="data-freshness" data-freshness>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">How fresh and accurate is this data?</h2>
        {csrf ? (
          <form method="POST" action="/api/regime/refresh">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-bold text-[var(--accent-soft)]">
              Refresh now
            </button>
          </form>
        ) : (
          <p className="text-xs text-[var(--muted)]">Refresh now needs the session secret on the server.</p>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        {counts.fresh} fresh, {counts.stale} stale, {counts.blocked} blocked.
        {' '}Fresh means the figure is new enough to use. Stale means it is too old for a new buy. Blocked means the feed did not arrive.
        Times are Sydney time. A date marked as the day a figure describes is the period the statistic covers, not the moment it was downloaded.
      </p>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {feeds.map((feed) => (
          <li key={feed.id} className="py-3" data-feed={feed.id} data-feed-status={feed.status}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white">{feed.name}</p>
              <p className={`text-xs font-bold uppercase tracking-wider ${STATUS_CLASS[feed.status]}`}>{STATUS_WORD[feed.status]}</p>
            </div>
            <p className="mt-1 text-sm text-white/80">{feed.updated}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Source: {feed.source}{feed.detail !== feed.name ? ` · ${feed.detail}` : ''}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">What this means: {feed.means}</p>
          </li>
        ))}
      </ul>
      {feeds.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No feed has been saved yet.</p>
      ) : null}
      <div className="mt-4 rounded-[var(--radius-lg)] border border-white/10 px-4 py-4">
        <h3 className="text-sm font-bold">Known gaps</h3>
        {gaps.length === 0 && !blockReason ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No gap is recorded on this saved copy.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-amber-100">
            {blockReason ? <li>{blockReason}</li> : null}
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          What this means: a gap is something the page could not load or could not compare. The words above are the saved notes, not a guess.
        </p>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Page opened {sydneyWhen(view.snapshot.generatedAt)}. The latest day used in the score is {view.snapshot.printDate ?? 'not available'}.
      </p>
    </section>
  );
}

export function limitSentence(view: RegimeView): string {
  const budget = view.snapshot.effectiveBudget;
  return [
    budgetMeans('swing', budget.volTarget, view.snapshot.budgetOverridden),
    budgetMeans('whole', budget.maxGross, view.snapshot.budgetOverridden),
    budgetMeans('outside', budget.maxNet, view.snapshot.budgetOverridden),
  ].join(' ');
}
