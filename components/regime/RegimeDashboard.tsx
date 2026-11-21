import Image from 'next/image';
import Link from 'next/link';
import { FeedBanner } from '@/components/regime/FeedBanner';
import { FreshnessPanel, Fold } from '@/components/regime/OwnerBrief';
import { DruckPanel } from '@/components/regime/DruckPanel';
import type { PaperMarkPayload } from '@/lib/regime/paperLog';
import type { RefreshHealth } from '@/lib/regime/refreshHealth';
import type { SelfCheckRecord } from '@/lib/regime/selfcheck';
import { sydneyClock } from '@/lib/regime/time';
import type { DruckPanelModel } from '@/lib/regime/druckPresent';
import { retiredBookLines, type RetiredVisser } from '@/lib/regime/retiredBooks';
import type { RegimeView } from '@/lib/regime/view';

function formatZ(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return 'missing';
  if (Math.abs(z) < 0.005) return '0.00';
  const sign = z > 0 ? '+' : '−';
  return `${sign}${Math.abs(z).toFixed(2)}`;
}

function clock(value: string | null): string {
  if (!value) return '—';
  return sydneyClock(value);
}

function RefreshHealthPanel({
  health,
  attempt,
  csrf,
}: {
  health: RefreshHealth | null;
  attempt: RefreshHealth | null;
  csrf: string | null;
}) {
  const shown = health ?? attempt;
  const browserOnly = Boolean(attempt && (!health || Date.parse(attempt.attemptedAt) > Date.parse(health.attemptedAt)));
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/30 px-5 py-4" id="refresh-health" data-refresh-outcome={shown?.outcome ?? 'none'} data-refresh-durable={shown?.durable ? 'yes' : 'no'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Last attempt to download the data</h2>
        {csrf ? (
          <form method="POST" action="/api/regime/refresh">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-bold text-[var(--accent-soft)]">
              Refresh inputs
            </button>
          </form>
        ) : (
          <p className="text-xs text-[var(--muted)]">Refresh inputs needs the session secret on the server.</p>
        )}
      </div>
      <p className="mt-2 text-sm text-white/80">{shown?.note ?? 'No refresh has been recorded.'}</p>
      {browserOnly ? (
        <p className="mt-2 text-sm text-amber-100">This attempt is in this browser only. It was not written to durable storage. The book keeps its last week. Any scores below are the last saved snapshot.</p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-3)] sm:grid-cols-2">
        <div>Last try: {clock(shown?.attemptedAt ?? null)}</div>
        <div>Last time every required feed arrived: {clock(shown?.lastFullySuccessfulFetchAt ?? null)}</div>
        <div>Last saved copy: {clock(shown?.lastPersistedAt ?? null)}</div>
        <div>Where it is saved: {shown?.storage === 'neon' ? 'the database' : 'nowhere yet'}</div>
        <div>This try: {shown ? `${shown.outcome} (feeds ${shown.fetchOutcome})` : '—'}</div>
        <div>Saved copy: {shown?.snapshotSaved ? 'the market snapshot was stored' : 'the market snapshot was not stored'}</div>
      </dl>
      {shown && shown.sources.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs font-semibold text-[var(--text-3)]">
              <tr>
                <th className="py-2 pr-3 font-bold">Feed</th>
                <th className="py-2 pr-3 font-bold">Day it describes</th>
                <th className="py-2 pr-3 font-bold">Downloaded</th>
                <th className="py-2 font-bold">Problem</th>
              </tr>
            </thead>
            <tbody>
              {shown.sources.map((source) => (
                <tr key={source.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{source.label}{source.mandatory ? ' · required' : ''}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{source.observationDate ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs">{clock(source.fetchedAt)}</td>
                  <td className="py-2 text-xs text-[var(--status-warn)]">{source.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function RegimeDashboard({
  view,
  selfCheck,
  health,
  attempt,
  blockReason,
  csrf,
  paperLog,
  druck,
  visserRetired,
}: {
  view: RegimeView;
  selfCheck: SelfCheckRecord | null;
  health: RefreshHealth | null;
  attempt: RefreshHealth | null;
  blockReason: string | null;
  csrf: string | null;
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null };
  druck: DruckPanelModel;
  visserRetired: RetiredVisser;
}) {
  const { snapshot, consistency } = view;
  const failedRules = consistency.rules.filter((rule) => !rule.pass);
  const healthSources = (health ?? attempt)?.sources ?? [];
  const liquidity = snapshot.components.find((component) => component.id === 'liquidity') ?? null;
  const marks = view.desk.paperLedger?.marks ?? [];
  const lastMark = marks.length > 0 ? marks[marks.length - 1] : null;
  const retired = retiredBookLines({
    equity: view.desk.paperLedger?.equity ?? view.desk.equity ?? null,
    valued: view.desk.paperLedger?.valued === true && (view.desk.paperLedger.equity ?? 0) > 0,
    asOf: lastMark?.date ?? snapshot.today ?? null,
    nav: paperLog.latest?.nav ?? null,
    decisions: paperLog.decisions,
  }, visserRetired);
  const liquidityAsOf = liquidity?.asOf ?? snapshot.today;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 12% -10%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(248,113,113,0.08), transparent 50%)',
        }}
      />
      <header className="relative border-b border-[var(--border)]/80 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Image
                src="/passiveblocks_logo_cropped.png"
                alt="PassiveBlocks"
                width={148}
                height={34}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)]">
              Owner only
            </span>
          </div>
          <div className="flex items-center gap-4">
            <form method="POST" action="/api/regime/logout">
              <button type="submit" className="text-xs text-[var(--text-3)] transition-colors hover:text-foreground">
                Log out
              </button>
            </form>
            <Link href="/" className="text-xs text-[var(--text-3)] transition-colors hover:text-foreground">
              Public site
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6" data-regime={snapshot.regime ?? 'unavailable'} data-strategy="druck">
        {selfCheck && !selfCheck.ok ? (
          <div className="mb-6 rounded-[var(--radius-xl)] border border-rose-400/50 bg-rose-500/15 px-5 py-4" data-selfcheck="fail">
            <p className="text-sm font-semibold text-rose-50">
              The daily check failed{selfCheck.asOf ? ` · ${sydneyClock(selfCheck.asOf)}` : ''}. Do not treat today’s sizes as settled.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-rose-50">
              {selfCheck.failures.map((failure) => (
                <li key={failure.id}>{failure.detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-3">
          <FeedBanner blockReason={blockReason} health={health ?? attempt} />
          <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4 sm:px-5" id="market-inputs" data-liquidity={liquidity?.z ?? 'missing'}>
            <h2 className="text-sm font-bold text-[var(--text-1)]">Market inputs</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-1)]">
              Liquidity score {formatZ(liquidity?.z ?? null)}{liquidityAsOf ? ` as of ${liquidityAsOf}` : ''}. The book uses this score, US high-yield credit spreads, and whether the S&amp;P 500 is above its 200-day average. A missing feed keeps the last week.
            </p>
          </section>
          <DruckPanel model={druck} csrf={csrf} />
        </div>
        {failedRules.length > 0 ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-rose-400/40 bg-rose-500/10 px-4 py-3" data-consistency="fail">
            <p className="text-sm font-semibold text-rose-100">
              The internal checks disagree: {failedRules.length} of {consistency.rules.length} failed. Read those before acting.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-rose-50">
              {failedRules.map((rule) => (
                <li key={rule.id}>{rule.detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Fold title="Retired books" lede="These are no longer the strategy on this page. Their rows stay in the database.">
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]" id="retired-books">
            {retired.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Fold>
        <Fold title="Data and checks" lede="The liquidity score comes from these feeds. A failed feed does not replace the last saved week.">
          <FreshnessPanel
            view={view}
            healthSources={healthSources}
            paperLog={paperLog}
            blockReason={blockReason}
            csrf={csrf}
          />
          <RefreshHealthPanel health={health} attempt={attempt} csrf={csrf} />
        </Fold>
      </main>
    </div>
  );
}
