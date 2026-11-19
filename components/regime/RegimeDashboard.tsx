import Image from 'next/image';
import Link from 'next/link';
import { DeskPanels } from '@/components/regime/DeskPanels';
import { EvaluationPanel } from '@/components/regime/EvaluationPanel';
import { FreshnessPanel, Fold, OwnerBrief } from '@/components/regime/OwnerBrief';
import { ValidationStudy, type ReplayView } from '@/components/regime/ValidationStudy';
import type { PaperMarkPayload } from '@/lib/regime/paperLog';
import { IdeasPanel } from '@/components/regime/IdeasPanel';
import type { EvaluationReport } from '@/lib/regime/evaluate';
import { MODEL_BUDGET, REGIME_LABEL, THRESHOLDS, type RegimeId } from '@/lib/regime/constants';
import { historyColumn, plainReading, researchPlain } from '@/lib/regime/ownerCopy';
import { componentPeriodNote, regimeWaitCopy, waitingOnRegime } from '@/lib/regime/plain';
import type { RefreshHealth } from '@/lib/regime/refreshHealth';
import type { SelfCheckRecord } from '@/lib/regime/selfcheck';
import { sydneyClock } from '@/lib/regime/time';
import { ComponentBars } from '@/components/regime/viz/ComponentBars';
import type { RegimeView } from '@/lib/regime/view';
import type { HistoryPoint } from '@/lib/regime/types';

function plainRegimeTitle(regime: RegimeId | null): string {
  if (regime === 'risk_on') return 'Supportive';
  if (regime === 'tightening') return 'Cautious';
  if (regime === 'crisis') return 'Stressed';
  if (regime === 'transitional') return 'Mixed';
  return 'unclear';
}

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
  risk_on: '#34d399',
  transitional: '#94a3b8',
  tightening: '#f59e0b',
  crisis: '#f87171',
};

function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const data = points.filter((point) => point.composite != null && point.regime);
  if (data.length < 2) {
    return <p className="text-sm text-[var(--text-3)]">Not enough history to chart yet.</p>;
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
      {[THRESHOLDS.riskOnEnter, THRESHOLDS.tightEnter, THRESHOLDS.crisisEnter].map((level) => (
        <line key={level} x1={padL} x2={width - padR} y1={y(level)} y2={y(level)} stroke="#9a9aa8" strokeDasharray="3 4" />
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
          <text x={0} y={y(level) + 4} fill="#9a9aa8" fontSize="11">
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

function clock(value: string | null): string {
  if (!value) return '—';
  return sydneyClock(value);
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
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)]">
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
              The daily check failed{selfCheck.asOf ? ` · ${sydneyClock(selfCheck.asOf)}` : ''}. Do not treat today’s sizes as settled.
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
          rules={replay?.production?.summary ?? null}
          spy={replay?.spySameContributions?.summary ?? null}
          mix={replay?.staticSixtyForty?.summary ?? null}
        />
        {failedRules.length === 0 ? (
          <p className="mt-4 text-xs text-[var(--text-3)]" data-consistency="pass">
            Self-checks ✓ {consistency.rules.length}/{consistency.rules.length}
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
        {waiting.length > 0 ? (
          <Fold title="Watch list" lede={regimeWaitCopy({ ...snapshot, liquidity: snapshot.components.find((item) => item.id === 'liquidity')?.z ?? null })}>
            <ul className="space-y-2 text-sm" id="waiting-on-regime">
              {waiting.map((line) => (
                <li key={line.symbol}>
                  <span className="font-semibold text-white">{line.name}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--text-3)]">{line.symbol}</span>
                  <span className="ml-2 text-[var(--text-3)]">{line.verdict}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-[var(--text-3)]">These pass everything except the market mood. They become buys once the mood turns Supportive.</p>
          </Fold>
        ) : null}

        <Fold title={`Why the market is ${plainRegimeTitle(snapshot.regime)}`} lede="Six pieces. A missing piece is left out, and the others share its weight. Money, interest rates and lender nerves must all be present.">
          <ComponentBars
            rows={snapshot.components.map((component) => ({
              title: component.id === 'liquidity' ? 'Money in the system'
                : component.id === 'policy' ? 'Interest rates'
                  : component.id === 'credit' ? 'Lender nerves'
                    : component.id === 'growth' ? 'Growth'
                      : component.id === 'positioning' ? 'Crowded bets'
                        : 'AI spending',
              z: component.z,
              weight: component.weight,
            }))}
          />
          <ul className="mt-4 space-y-2 text-sm text-[var(--text-2)]">
            {snapshot.components.map((component) => (
              <li key={component.id}>
                {plainReading(component.id, component.reading)}
                <details className="mt-1">
                  <summary className="min-h-11 cursor-pointer text-xs text-[var(--text-3)]">Details</summary>
                  <p className="text-xs leading-relaxed text-[var(--text-3)]">{component.reading}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-3)]">{component.detail}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-3)]">{componentPeriodNote(component.id, snapshot.freshness)}</p>
                </details>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="How the market call has changed" lede="The line is the overall score. The coloured bands show each week’s mood.">
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 p-3 sm:p-4">
            <HistoryChart points={snapshot.history.slice(-52)} />
            <ul className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-3)]">
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
                <thead className="text-xs font-semibold text-[var(--text-3)]">
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
        </Fold>

        <Fold title="Themes" lede="Three story baskets, each with a written on/off rule.">
          <DeskPanels desk={desk} part="themes" />
        </Fold>
        <Fold title="All names" lede="Every name, with the checks that passed and the ones in the way.">
          <IdeasPanel
            ideas={ideas}
            risk={desk.lines}
            auditNote={auditNote}
            held={Object.fromEntries((paperLog?.latest?.basis === 'held-book' ? paperLog.latest.weights : []).map((row) => [row.symbol, row.weight]))}
            bookAud={desk.paperLedger?.currency === 'AUD' ? desk.paperLedger.equity : null}
          />
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
          <dl className="mt-3 grid gap-2 text-sm text-[var(--text-3)] sm:grid-cols-2">
            <div><strong>Supportive</strong> starts when the score reaches +{THRESHOLDS.riskOnEnter.toFixed(2)} and money in the system is +{THRESHOLDS.riskOnLiquidityMin.toFixed(2)} or more. It switches off below +{THRESHOLDS.riskOnExit.toFixed(2)}, or if money falls below {THRESHOLDS.riskOnLiquidityExit.toFixed(2)}. It is the only mood where new shares, crypto or themes can be bought.</div>
            <div><strong>Mixed</strong> is everything between Cautious and Supportive. The rules hold and buy nothing new.</div>
            <div><strong>Cautious</strong> starts at {THRESHOLDS.tightEnter.toFixed(2)} and lasts until the score recovers past {THRESHOLDS.tightExit.toFixed(2)}. Only defensive holdings are kept.</div>
            <div><strong>Stressed</strong> starts at {THRESHOLDS.crisisEnter.toFixed(2)}, or at {THRESHOLDS.crisisCompositeConfirm.toFixed(2)} when the lender score is {THRESHOLDS.crisisCreditEnter.toFixed(1)} or worse. It ends when the score is above {THRESHOLDS.crisisExitComposite.toFixed(2)} and lenders are above {THRESHOLDS.crisisExitCredit.toFixed(1)}.</div>
            <div><strong>No clear signal</strong> ({`-${THRESHOLDS.weakAbsComposite}`} to +{THRESHOLDS.weakAbsComposite}): too close to normal, so nothing new is bought. If money, rates or lender nerves are missing, the book can be trimmed back to 20% invested.</div>
            <div>Size limits, swing / invested / non-cash. Supportive {pct(MODEL_BUDGET.risk_on.volTarget)} / {pct(MODEL_BUDGET.risk_on.maxGross)} / {pct(MODEL_BUDGET.risk_on.maxNet)}. Mixed {pct(MODEL_BUDGET.transitional.volTarget)} / {pct(MODEL_BUDGET.transitional.maxGross)} / {pct(MODEL_BUDGET.transitional.maxNet)}. Cautious {pct(MODEL_BUDGET.tightening.volTarget)} / {pct(MODEL_BUDGET.tightening.maxGross)} / {pct(MODEL_BUDGET.tightening.maxNet)}. Stressed {pct(MODEL_BUDGET.crisis.volTarget)} / {pct(MODEL_BUDGET.crisis.maxGross)} / {pct(MODEL_BUDGET.crisis.maxNet)}. The paper book never borrows, so it cannot go above 100% invested. A no-clear-signal day uses the tighter 40% / 20% cap.</div>
            <div>No fund over 20% of the book. No single company over 2%. All names in one theme together: 20% max. Names that are really the same bet share one 25% limit. If holdings start moving together, new sizes shrink, down to half.</div>
            <div>Every holding has an automatic sell price 2.5 typical daily moves below where it was bought, including cash-like funds. If a new buy hits that stop, the book loses about 0.75%. You can top up once, only after the holding has gained as much as it was risking. New buys pause if the book falls 10% from its high. A dip is a 10–20% pullback that has started to recover. It only becomes a buy in a Supportive market.</div>
            <div>Each check is graded against what prices did next. One that keeps being wrong is switched off automatically.</div>
          </dl>
        </Fold>
        <Fold title="Data and checks" lede="Feeds, the download log, and a refresh.">
          <FreshnessPanel
            view={view}
            healthSources={healthSources}
            paperLog={paperLog}
            blockReason={blockReason}
            csrf={csrf}
          />
          <RefreshHealthPanel health={health} attempt={attempt} csrf={csrf} showButton={false} />
        </Fold>
        <Fold title="Settings" lede="Starting amount, the long-term aspiration, and starting the paper book over.">
          <DeskPanels desk={desk} settingsNotice={settingsNotice} part="settings" />
        </Fold>
      </main>
    </div>
  );
}

