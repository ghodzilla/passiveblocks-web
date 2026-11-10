import Image from 'next/image';
import Link from 'next/link';
import { DeskPanels } from '@/components/regime/DeskPanels';
import { EvaluationPanel } from '@/components/regime/EvaluationPanel';
import { FreshnessPanel, Fold, limitSentence, OwnerBrief } from '@/components/regime/OwnerBrief';
import { ValidationStudy, type ReplayView } from '@/components/regime/ValidationStudy';
import type { PaperMarkPayload } from '@/lib/regime/paperLog';
import { IdeasPanel } from '@/components/regime/IdeasPanel';
import type { EvaluationReport } from '@/lib/regime/evaluate';
import { MODEL_BUDGET, REGIME_LABEL, THRESHOLDS, type RegimeId } from '@/lib/regime/constants';
import { budgetMeans, componentPlain, historyColumn, researchPlain } from '@/lib/regime/ownerCopy';
import { componentPeriodNote, plainZ, regimeWaitCopy, seriesCadence, waitingOnRegime } from '@/lib/regime/plain';
import type { RefreshHealth } from '@/lib/regime/refreshHealth';
import type { SelfCheckRecord } from '@/lib/regime/selfcheck';
import { melbourneClock } from '@/lib/regime/time';
import type { RegimeView } from '@/lib/regime/view';
import type { HistoryPoint } from '@/lib/regime/types';

function formatZ(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return '—';
  if (Math.abs(z) < 0.005) return '0.00';
  const sign = z > 0 ? '+' : '−';
  return `${sign}${Math.abs(z).toFixed(2)}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const BAND: Record<RegimeId, string> = {
  risk_on: '#4ade80',
  transitional: '#94a3b8',
  tightening: '#fbbf24',
  crisis: '#f87171',
};

function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const data = points.filter((point) => point.composite != null && point.regime);
  if (data.length < 2) {
    return <p className="text-sm text-[var(--muted)]">Not enough history to chart yet.</p>;
  }
  const width = 800;
  const height = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const y = (value: number) => padT + ((3 - value) / 6) * innerH;
  const slot = innerW / data.length;
  const line = data
    .map((point, index) => {
      const x = padL + slot * index + slot / 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y(point.composite ?? 0).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overall score and market-call history" className="h-auto w-full">
      {data.map((point, index) => (
        <rect
          key={point.date}
          x={padL + slot * index}
          y={padT}
          width={slot + 0.4}
          height={innerH}
          fill={BAND[point.regime ?? 'transitional']}
          opacity={0.16}
        />
      ))}
      {[3, 0, -3].map((level) => (
        <g key={level}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y(level)}
            y2={y(level)}
            stroke={level === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}
          />
          <text x={0} y={y(level) + 4} fill="rgba(255,255,255,0.45)" fontSize="11">
            {level > 0 ? `+${level}` : `${level}`}
          </text>
        </g>
      ))}
      <path d={line} fill="none" stroke="#f4f4f5" strokeWidth="1.7" />
      <text x={padL} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="11">{data[0].date}</text>
      <text x={width - padR} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="end">
        {data[data.length - 1].date}
      </text>
    </svg>
  );
}

function ZBar({ z }: { z: number | null }) {
  const left = z == null ? 50 : ((Math.max(-3, Math.min(3, z)) + 3) / 6) * 100;
  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-white/10" aria-hidden>
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
      {z != null ? (
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${left}% - 5px)` }}
        />
      ) : null}
    </div>
  );
}

function clock(value: string | null): string {
  if (!value) return '—';
  return `${melbourneClock(value)} Australia/Melbourne`;
}

function RefreshHealthPanel({
  health,
  attempt,
  csrf,
  showButton = true,
}: {
  health: RefreshHealth | null;
  attempt: RefreshHealth | null;
  csrf: string | null;
  showButton?: boolean;
}) {
  const shown = health ?? attempt;
  const browserOnly = Boolean(attempt && (!health || Date.parse(attempt.attemptedAt) > Date.parse(health.attemptedAt)));
  return (
    <section className="mb-6 rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/30 px-5 py-4" id="refresh-health" data-refresh-outcome={shown?.outcome ?? 'none'} data-refresh-durable={shown?.durable ? 'yes' : 'no'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Last attempt to download the data</h2>
        {showButton && csrf ? (
          <form method="POST" action="/api/regime/refresh">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-bold text-[var(--accent-soft)]">
              Refresh now
            </button>
          </form>
        ) : (
          showButton ? <p className="text-xs text-[var(--muted)]">Refresh now needs the session secret on the server.</p> : null
        )}
      </div>
      <p className="mt-2 text-sm text-white/80">{shown?.note ?? 'No refresh has been recorded.'}</p>
      {browserOnly ? (
        <p className="mt-2 text-sm text-amber-100">This attempt is in this browser only. It was not written to durable storage. New buys stay off. Any scores below are the last saved snapshot.</p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
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
            <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
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
  settingsNotice = null,
  auditNote,
  evaluation,
  validation,
  replay,
  paperLog,
}: {
  view: RegimeView;
  selfCheck: SelfCheckRecord | null;
  health: RefreshHealth | null;
  attempt: RefreshHealth | null;
  blockReason: string | null;
  csrf: string | null;
  settingsNotice?: string | null;
  auditNote: string;
  evaluation: EvaluationReport;
  validation: {
    ranAt: string;
    command: string;
    fullStrategy: string;
    verdict: string;
    reason: string;
    hypotheses: { id: string; status: string; because: string }[];
    preExposure: string;
    metrics: null;
    omitted: string[];
    blocking?: string;
    survivorship?: string;
    credit?: {
      observationCount: number;
      firstObservation: string | null;
      lastObservation: string | null;
      firstCreditZObservation: string | null;
      firstFullWindowObservation: string | null;
      creditZObservationCount: number;
      fullWindowObservationCount: number;
      earliestDecisionDate: string | null;
      latestDecisionDate: string | null;
      completedReplayDates: number;
      rule: string;
      constraint: string;
      failClosed: string;
    };
    cftc?: { publication: string };
    paperLog?: { state: string; activated: boolean; operationalPaperNav: boolean; captures: string; limits: string; activation: string };
    rows: {
      id: string;
      role: string;
      url: string;
      availability: string;
      httpStatus: number | null;
      bytes: number;
      sha256: string | null;
      note: string;
    }[];
  } | null;
  replay: ReplayView | null;
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null };
}) {
  const { snapshot, ideas, desk, consistency } = view;
  const failedRules = consistency.rules.filter((rule) => !rule.pass);
  const waiting = waitingOnRegime(desk.lines);
  const recent = snapshot.history.slice(-8).reverse();
  const healthSources = (health ?? attempt)?.sources ?? [];

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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
            <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
              Owner only
            </span>
          </div>
          <div className="flex items-center gap-4">
            <form method="POST" action="/api/regime/logout">
              <button type="submit" className="text-xs text-[var(--muted)] transition-colors hover:text-foreground">
                Log out
              </button>
            </form>
            <Link href="/" className="text-xs text-[var(--muted)] transition-colors hover:text-foreground">
              Public site
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" data-regime={snapshot.regime ?? 'unavailable'} data-action={snapshot.action}>
        {selfCheck && !selfCheck.ok ? (
          <div className="mb-6 rounded-[var(--radius-xl)] border border-rose-400/50 bg-rose-500/15 px-5 py-4" data-selfcheck="fail">
            <p className="text-sm font-semibold text-rose-50">
              The daily check failed{selfCheck.asOf ? ` · ${melbourneClock(selfCheck.asOf)} Australia/Melbourne` : ''}. Do not treat today’s sizes as settled.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-rose-50">
              {selfCheck.failures.map((failure) => (
                <li key={failure.id}>{failure.detail}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <OwnerBrief
          view={view}
          paperLog={paperLog}
          verdict={validation?.verdict ?? null}
          fullStrategy={validation?.fullStrategy ?? null}
          h1={replay?.hypotheses?.h1 ?? null}
          blockReason={blockReason}
        />
        {failedRules.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--status-ok)]" data-consistency="pass">
            The internal checks agree ({consistency.rules.length} of {consistency.rules.length}).
          </p>
        ) : (
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
        )}
        <FreshnessPanel
          view={view}
          healthSources={healthSources}
          paperLog={paperLog}
          blockReason={blockReason}
          csrf={csrf}
        />

        <Fold title="Size limits behind today’s numbers" lede={limitSentence(view)}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Overall score" tip="The blended market score. Above zero means easier than usual. Within 0.35 of zero is the quiet band, where new buys stay off." value={formatZ(snapshot.composite)} meta={snapshot.weak ? 'In the quiet band, within 0.35 of zero. What this means: sit tight.' : 'What this means: clearly easier or tighter than usual.'} />
            <Tile label="How much the book may swing" tip="The yearly up-and-down the rules try to stay inside. This is a risk limit, not a return." value={pct(snapshot.effectiveBudget.volTarget)} meta={budgetMeans('swing', snapshot.effectiveBudget.volTarget, snapshot.budgetOverridden)} />
            <Tile label="Biggest size of the whole book" tip="The cap on every holding except the cash sitting in the account." value={pct(snapshot.effectiveBudget.maxGross)} meta={budgetMeans('whole', snapshot.effectiveBudget.maxGross, snapshot.budgetOverridden)} />
            <Tile label="Biggest size outside cash" tip="The cap on holdings that are not cash or short-term government bonds." value={pct(snapshot.effectiveBudget.maxNet)} meta={budgetMeans('outside', snapshot.effectiveBudget.maxNet, snapshot.budgetOverridden)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            Rule set {snapshot.rulesVersion}.
            {snapshot.modelBudget ? ` Usual limits for this market call: swing ${pct(snapshot.modelBudget.volTarget)}, whole book ${pct(snapshot.modelBudget.maxGross)}, outside cash ${pct(snapshot.modelBudget.maxNet)}.` : ''}
            {' '}What this means: these are ceilings. They are not the return to expect.
          </p>
        </Fold>

        {waiting.length > 0 ? (
          <Fold title="Names waiting for an easier market" lede={regimeWaitCopy(snapshot)}>
            <ul className="space-y-2 text-sm" id="waiting-on-regime">
              {waiting.map((line) => (
                <li key={line.symbol}>
                  <span className="font-semibold text-white">{line.name}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--muted)]">{line.symbol}</span>
                  <span className="ml-2 text-white/55">{line.verdict}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-[var(--muted)]">What this means: the story for these names is on, and the market call is the only thing in the way. They are not buys today.</p>
          </Fold>
        ) : null}

        <Fold title="What went into the market call" lede="Six pieces. A missing piece is left out, and the others share its weight.">
          <div className="grid gap-3">
            {snapshot.components.map((component) => {
              const plain = componentPlain(component.id, component.z);
              return (
              <article key={component.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {plain.title}
                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">{component.label}</span>
                  </h3>
                  <p className="text-sm text-foreground" title="A negative reading is tighter than usual. A positive reading is easier. The number in brackets is the score.">
                    {plainZ(plain.title, component.z)}
                    <span className="ml-3 text-xs text-[var(--muted)]">{Math.round(component.weight * 100)}% of the call</span>
                  </p>
                </div>
                <ZBar z={component.z} />
                <p className="mt-3 text-sm leading-relaxed text-white/80">What this means: {plain.means}</p>
                <p className="mt-2 text-sm text-[var(--muted)]" title="The raw series behind the score.">{component.reading}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-white/50">Details</summary>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{component.detail}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-white/35">
                    {component.included ? 'Included in the overall score' : 'Left out of the overall score'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{componentPeriodNote(component.id, snapshot.freshness)}</p>
                </details>
                {component.gap ? (
                  <p className="mt-2 text-sm text-[var(--status-warn)]">{component.included ? 'Note: ' : 'Gap: '}{component.gap}</p>
                ) : null}
              </article>
              );
            })}
          </div>
        </Fold>

        <Fold title="How the market call has changed" lede="Each week’s call, in order. The label changes slowly so it does not flip every week. A price older than 10 days is dropped from the live card.">
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 p-3 sm:p-4">
            <HistoryChart points={snapshot.history} />
            <ul className="mt-3 flex flex-wrap gap-3 text-[11px] uppercase tracking-wider text-[var(--muted)]">
              {(Object.keys(REGIME_LABEL) as RegimeId[]).map((id) => (
                <li key={id} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: BAND[id] }} />
                  {REGIME_LABEL[id]}
                </li>
              ))}
            </ul>
          </div>
          {recent.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Recent market calls</caption>
                <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  <tr>
                    {(['date', 'regime', 'composite', 'liquidity', 'policy', 'credit', 'growth', 'positioning', 'ai'] as const).map((id) => (
                      <th key={id} className="py-2 pr-3 font-bold" title={historyColumn(id).technical}>{historyColumn(id).label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-xs os-tabular">
                  {recent.map((point) => (
                    <tr key={point.date} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-3">{point.date}</td>
                      <td className="py-2 pr-3">{point.regime ? REGIME_LABEL[point.regime] : '—'}</td>
                      <td className="py-2 pr-3">{formatZ(point.composite)}</td>
                      <td className="py-2 pr-3">{formatZ(point.liquidity)}</td>
                      <td className="py-2 pr-3">{formatZ(point.policy)}</td>
                      <td className="py-2 pr-3">{formatZ(point.credit)}</td>
                      <td className="py-2 pr-3">{formatZ(point.growth)}</td>
                      <td className="py-2 pr-3">{formatZ(point.positioning)}</td>
                      <td className="py-2">{formatZ(point.ai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-[var(--muted)]">What this means: the line is the overall score. The coloured bands are the market call for that week. A positive score is easier than usual.</p>
        </Fold>

        <Fold title="Feed table" lede="The same feeds as the list above, in a table. Current means fresh. The date is the day the figure describes, not the download.">
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-bold">Series</th>
                  <th className="py-2 pr-3 font-bold" title="The day or month the statistic describes. Not the download time.">Period covered</th>
                  <th className="py-2 pr-3 font-bold">Age</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.freshness.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="py-2.5 pr-3">{row.label}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {row.asOf ?? '—'}
                      <span className="mt-0.5 block font-sans text-[10px] uppercase tracking-wider text-[var(--muted)]">{seriesCadence(row.staleAfterDays)}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.ageDays == null ? '—' : `${row.ageDays}d`}</td>
                    <td
                      className={`py-2.5 pr-3 text-xs font-bold uppercase tracking-wider ${!row.asOf ? 'text-[var(--status-danger)]' : row.stale ? 'text-[var(--status-warn)]' : 'text-[var(--status-ok)]'}`}
                      title={row.stale
                        ? `Older than the ${row.staleAfterDays}-day window for this series.`
                        : `Inside the ${row.staleAfterDays}-day window. The date is the period covered, not the download time.`}
                    >
                      {!row.asOf ? 'Blocked' : row.stale ? 'Stale' : 'Fresh'}
                    </td>
                    <td className="py-2.5">
                      <a href={row.href} className="text-[var(--accent-soft)] underline-offset-2 hover:underline" rel="noreferrer">
                        {row.source}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Period covered is the day or month the number describes. The download time is the snapshot clock above. A monthly series shows an older month when that month is the newest release. A row marked Stale is outside the window this model allows. Stale liquidity, the policy rate, the 2-year yield, or the high-yield spread blocks new risk. Share-price dates stay on the exchange session. Melbourne time is used for the snapshot clock.
          </p>
          {snapshot.gaps.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-[var(--status-warn)]">
              {snapshot.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : null}
        </Fold>

        <Fold title="Each investment" lede="What to hold, name by name. Confirmed means every check passed. Watch means something is in the way. Avoid means today’s lean is away from that group.">
          <IdeasPanel ideas={ideas} risk={desk.lines} auditNote={auditNote} />
        </Fold>
        <Fold title="The paper book and the settings" lede="What the Australian-dollar paper book is worth, the aim written on the settings, and the buttons that change them. The aim is not the return to expect.">
          <DeskPanels desk={desk} settingsNotice={settingsNotice} />
        </Fold>
        <Fold
          title="Has this beaten a simple index fund?"
          lede={researchPlain({ h1: replay?.hypotheses?.h1 ?? null, h2: replay?.hypotheses?.h2 ?? null })}
        >
          <EvaluationPanel report={evaluation} />
          <ValidationStudy study={validation} replay={replay} paper={paperLog} />
        </Fold>

        <Fold title="The rules, written out" lede="The thresholds and the size limits. The small labels are the technical names.">
          <h2 className="text-lg font-bold tracking-tight">The rules, in everyday words</h2>
          <dl className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
            <div title="Supportive starts when the overall score clears the enter band and money in the system is still easy.">Supportive starts when the overall score is at least {THRESHOLDS.riskOnEnter} and money in the system is still easy (at least {THRESHOLDS.riskOnLiquidityMin}). It ends if the score falls below {THRESHOLDS.riskOnExit} or money in the system turns tight. Technical name: Risk-On.</div>
            <div>Cautious starts at a score of {THRESHOLDS.tightEnter} or lower, and holds until the score is back above {THRESHOLDS.tightExit}. Technical name: Tightening.</div>
            <div>Stressed starts at {THRESHOLDS.crisisEnter} or lower, or when lenders are very nervous and the score is also weak. Technical name: Crisis.</div>
            <div>Quiet band: a score within {THRESHOLDS.weakAbsComposite} of zero means sit tight. No new share, crypto, or theme buys.</div>
            <div title="Swing, whole book, and outside cash.">Size limits when supportive: swing {pct(MODEL_BUDGET.risk_on.volTarget)}, whole book {pct(MODEL_BUDGET.risk_on.maxGross)}, outside cash {pct(MODEL_BUDGET.risk_on.maxNet)}. Mixed: swing {pct(MODEL_BUDGET.transitional.volTarget)}. Cautious: swing {pct(MODEL_BUDGET.tightening.volTarget)}. Stressed: swing {pct(MODEL_BUDGET.crisis.volTarget)}.</div>
            <div>A missing piece is left out and the others share its weight. Missing money-in-the-system, interest rates, or lender nerves blocks new buys.</div>
            <div>AI spending is 8% of the score. The page still works without it.</div>
            <div>A name is given a size only when it is confirmed, and never more than 20% of the book. One stock is capped at 2%.</div>
            <div title="How much the holdings move together.">When holdings move together (average likeness above 0.55), sizes outside cash shrink, down to half at 0.70. Related AI and crypto names share a 25% cap.</div>
            <div>A check that has been wrong on both its score and its hit rate is turned off. If both the past-year move and the long-term trend are turned off, nothing new is confirmed.</div>
            <div>AI infrastructure, crypto, and gold switch on from written rules. A person reviews that list each quarter. The weekly job does not edit it.</div>
            <div title="The stop uses the average daily range. The original cash at risk is the amount that would be lost if the stop is hit.">The stop sits 2.5 average daily ranges below the price. The size risks 0.75% of capital to that stop. Add only after the trade is ahead by that original risk. A 10% paper loss from the peak blocks new buys.</div>
            <div>A dip is called confirmed only when the name would actually be sized. Otherwise it says “Dip spotted — blocked” and names the first thing in the way. The price pattern is 10–20% under the 60-day high and back above the 20-day average, with the theme on, and never when the market is cautious, stressed, or the loss halt is on.</div>
          </dl>
        </Fold>
        <Fold title="Download log" lede="When the data was last fetched, whether it was saved, and any error on each feed.">
          <RefreshHealthPanel health={health} attempt={attempt} csrf={csrf} showButton={false} />
        </Fold>
      </main>
    </div>
  );
}

function Tile({ label, value, meta, tip }: { label: string; value: string; meta: string; tip: string }) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4" title={tip}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight os-tabular">{value}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{meta}</p>
    </article>
  );
}
