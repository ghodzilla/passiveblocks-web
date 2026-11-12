import type { PaperMarkPayload } from '@/lib/regime/paperLog';
import {
  bookAudValue,
  describeFeeds,
  distanceToBuy,
  GLOSSARY,
  holdingsNow,
  knownGapLines,
  performanceSinceStart,
  plainRegime,
  sydneyWhen,
  todayAction,
  trustLine,
  whyLine,
  type FeedStatus,
  type ReplaySummary,
} from '@/lib/regime/ownerCopy';
import { sydneyClock } from '@/lib/regime/time';
import type { RegimeView } from '@/lib/regime/view';
import { AllocationBar } from './viz/AllocationBar';
import { CapBars } from './viz/CapBar';
import { EquitySpark } from './viz/EquitySpark';
import { RegimeGauge } from './viz/RegimeGauge';
import { Chip, type ChipTone } from './ui/Chip';

const STATUS_WORD: Record<FeedStatus, string> = {
  fresh: 'Fresh',
  stale: 'Stale',
  blocked: 'Missing',
};

const PLAIN_NAME: Record<string, string> = {
  SHY: 'US 1–3 yr government bonds',
  'AAA.AX': 'Australian cash fund',
  'BILL.AX': 'Australian cash fund',
  UUP: 'US dollar fund',
  XLRE: 'US property shares',
  USMV: 'US low-volatility shares',
  XLP: 'US consumer staples',
  XLV: 'US health care',
  XLU: 'US utilities',
  GLD: 'Gold',
  'GOLD.AX': 'Gold',
  'VAF.AX': 'Australian bonds',
  IEF: 'US medium-term bonds',
  TLT: 'US long bonds',
  SPY: 'US shares',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ether',
  'SOL-USD': 'Solana',
};

export function Fold({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-10 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-5 py-2 sm:px-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-xl font-bold tracking-tight text-[var(--text-1)]">
        <span>{title}</span>
        <span aria-hidden className="text-sm text-[var(--text-3)]">▾</span>
      </summary>
      {lede ? <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--text-2)]">{lede}</p> : null}
      <div className="pb-5 pt-4">{children}</div>
    </details>
  );
}

function toneFor(verb: string, regime: string | null): ChipTone {
  if (verb === 'BUY') return 'buy';
  if (verb === 'TRIM' || verb === 'SELL') return 'sell';
  if (verb === 'PLAY SAFE') return 'off';
  if (regime === 'crisis') return 'sell';
  if (regime === 'tightening') return 'caution';
  if (regime === 'risk_on') return 'buy';
  return verb === 'HOLD' ? 'hold' : 'watch';
}

export function OwnerBrief({
  view,
  paperLog,
  verdict,
  fullStrategy,
  h1,
  blockReason = null,
  rules = null,
  spy = null,
  mix = null,
}: {
  view: RegimeView;
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null } | null;
  verdict: string | null;
  fullStrategy: string | null;
  h1: string | null;
  blockReason?: string | null;
  rules?: ReplaySummary | null;
  spy?: ReplaySummary | null;
  mix?: ReplaySummary | null;
}) {
  const { snapshot, desk } = view;
  const regime = plainRegime(snapshot.regime);
  const names = Object.fromEntries(desk.lines.map((line) => [line.symbol, PLAIN_NAME[line.symbol] ?? line.name]));
  const book = bookAudValue({
    currency: desk.paperLedger?.currency ?? null,
    equity: desk.paperLedger?.equity ?? null,
    capital: desk.capital,
    valued: desk.paperLedger?.valued === true,
  });
  const weights = paperLog?.latest?.basis === 'held-book' ? paperLog.latest.weights : null;
  const held = weights?.map((row) => ({
    symbol: row.symbol,
    name: row.symbol === 'CASH' ? 'Cash' : (names[row.symbol] ?? row.symbol),
    weight: row.weight,
    role: desk.lines.find((line) => line.symbol === row.symbol)?.role,
  }));
  const liquidity = snapshot.components.find((item) => item.id === 'liquidity')?.z ?? null;
  const action = todayAction({
    actionable: snapshot.actionable,
    action: snapshot.action,
    halted: desk.halted,
    lines: desk.lines,
    bookAud: book.amount,
    pending: desk.paperLedger?.pending,
    held,
    trades: desk.paperLedger?.sessionTrades,
    drawdown: desk.drawdown,
    composite: snapshot.composite,
    maxGross: snapshot.effectiveBudget.maxGross,
    maxNet: snapshot.effectiveBudget.maxNet,
    staleFeed: blockReason,
  });
  const heldBook = holdingsNow({
    lines: desk.lines,
    exposures: desk.paperLedger?.exposures ?? null,
    heldWeights: weights,
    heldBasis: paperLog?.latest?.basis,
    names,
    bookAud: book.amount,
  });
  const performance = performanceSinceStart({
    capital: desk.capital,
    equity: desk.paperLedger?.currency === 'AUD' ? desk.paperLedger.equity : null,
    currency: desk.paperLedger?.currency ?? null,
    valued: desk.paperLedger?.valued === true,
    realisedText: desk.realisedText,
    drawdown: desk.drawdown,
    comparable: paperLog?.latest?.basis === 'held-book',
  });
  const afterCosts = paperLog?.latest?.basis === 'held-book' && paperLog.latest.nav != null
    ? `${((paperLog.latest.nav - 1) * 100).toFixed(2)}%`
    : null;
  const trust = trustLine({ verdict, fullStrategy, h1, rules, spy, mix });
  const previous = snapshot.history.length > 1 ? snapshot.history[snapshot.history.length - 2]?.composite ?? null : null;
  const exposures = desk.paperLedger?.exposures ?? null;
  const cashLikeWeight = (weights ?? [])
    .filter((row) => row.symbol === 'SHY' || row.symbol === 'AAA.AX' || row.symbol === 'BILL.AX')
    .reduce((sum, row) => sum + row.weight, 0);
  const components = snapshot.components.map((item) => ({
    id: item.id,
    title: item.id === 'liquidity' ? 'Money in the system'
      : item.id === 'policy' ? 'Interest rates'
        : item.id === 'credit' ? 'Lender nerves'
          : item.id === 'growth' ? 'Growth'
            : item.id === 'positioning' ? 'Crowded bets'
              : 'AI spending',
    z: item.z,
    weight: item.weight,
  }));
  const tone = toneFor(action.verb, snapshot.regime);
  const moodTone: ChipTone = snapshot.regime === 'risk_on'
    ? 'buy'
    : snapshot.regime === 'crisis'
      ? 'sell'
      : snapshot.regime === 'tightening'
        ? 'caution'
        : 'watch';
  const ranked = (weights ?? []).slice().sort((a, b) => b.weight - a.weight);

  return (
    <section className="grid gap-8">
      <article
        className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] p-5 sm:p-6"
        style={{ borderLeftWidth: 4, borderLeftColor: tone === 'hold' ? 'var(--call-hold)' : tone === 'buy' ? 'var(--call-buy)' : tone === 'sell' ? 'var(--call-sell)' : 'var(--call-watch)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone={tone}>{action.verb}</Chip>
              <p className="text-2xl font-extrabold tracking-tight text-[var(--text-1)] sm:text-4xl">{action.headline}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={moodTone} title={regime.means}>
                {`${regime.title}${snapshot.weak ? ' · no clear signal' : ''}`}
              </Chip>
            </div>
          </div>
          <p className="text-xs text-[var(--text-3)]">
            Data as of {snapshot.today} · refreshed {sydneyClock(snapshot.generatedAt)}
          </p>
        </div>
        <div className="mt-5">
          <RegimeGauge composite={snapshot.composite} previous={previous} liquidity={liquidity} />
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-2)]">
          <span className="font-semibold text-[var(--text-1)]">Why. </span>
          The market score is {snapshot.composite == null ? 'unavailable' : snapshot.composite.toFixed(2)}. {regime.means} {whyLine(components)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-2)]">
          <span className="font-semibold text-[var(--text-1)]">What would change it. </span>
          {distanceToBuy({ composite: snapshot.composite, liquidity })}
        </p>
        <p className="mt-2 text-sm text-[var(--text-3)]">{action.reason}</p>
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[var(--text-2)]">How to read this page</summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {GLOSSARY.map((item) => (
              <div key={item.term}>
                <dt className="text-sm font-semibold text-[var(--text-1)]">{item.term}</dt>
                <dd className="text-sm leading-relaxed text-[var(--text-3)]">{item.means}</dd>
              </div>
            ))}
          </dl>
        </details>
      </article>

      <section>
        <h2 className="text-xl font-bold text-[var(--text-1)]">Your paper book</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-2)]">{performance.sentence}</p>
        {afterCosts ? <p className="mt-1 text-sm text-[var(--text-3)]">Share record, before trading costs: {book.amount == null ? '—' : `A$${Math.round(book.amount).toLocaleString('en-AU')}`}. Paper log, after the 0.10% cost: {afterCosts}.</p> : null}
        <p className="mt-1 text-[15px] text-[var(--text-2)]">{heldBook.sentence}</p>
        {book.amount != null ? <p className="mt-1 text-xs text-[var(--text-3)]">{action.means}</p> : null}
        <div className="mt-4">
          <EquitySpark marks={desk.paperLedger?.marks ?? []} baseline={desk.capital} />
        </div>
        {exposures ? (
          <div className="mt-5 grid gap-5">
            <CapBars
              invested={exposures.gross}
              investedCap={exposures.maxGross}
              investedUsual={snapshot.modelBudget?.maxGross ?? null}
              nonCash={exposures.net}
              nonCashCap={exposures.maxNet}
              nonCashUsual={snapshot.modelBudget?.maxNet ?? null}
            />
            <AllocationBar
              cash={exposures.cash}
              cashLike={cashLikeWeight}
              defensive={Math.max(0, exposures.defensive)}
              risk={Math.max(0, exposures.risk)}
            />
          </div>
        ) : null}
        <div className="mt-4 grid gap-2">
          {ranked.map((row) => {
            const line = desk.lines.find((item) => item.symbol === row.symbol);
            const call = row.symbol === 'CASH' ? 'Hold' : (line?.status === 'hold' ? 'Hold' : line?.status === 'confirmed' ? 'Buy' : line?.status === 'avoid' ? 'Avoid' : 'Hold');
            const callTone: ChipTone = call === 'Buy' ? 'buy' : call === 'Avoid' ? 'off' : 'hold';
            const aud = book.amount == null ? '—' : `A$${Math.round(row.weight * book.amount).toLocaleString('en-AU')}`;
            return (
              <article key={row.symbol} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
                <p className="font-semibold text-[var(--text-1)]">
                  {row.symbol === 'CASH' ? 'Cash' : (names[row.symbol] ?? row.symbol)}
                  {row.symbol !== 'CASH' ? <span className="ml-2 font-mono text-xs font-normal text-[var(--text-3)]">{row.symbol}</span> : null}
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-[var(--text-2)] sm:mt-0">{aud}</p>
                <p className="font-mono text-sm tabular-nums text-[var(--text-3)]">{(row.weight * 100).toFixed(1)}%</p>
                <div className="mt-2 sm:mt-0"><Chip tone={callTone}>{call}</Chip></div>
                {line?.verdict && row.symbol !== 'CASH' ? <p className="mt-2 text-sm text-[var(--text-3)] sm:col-span-4">{line.verdict}</p> : null}
              </article>
            );
          })}
        </div>
        <ul className="mt-3 space-y-1 text-[15px] text-[var(--text-2)]">
          {action.steps.map((step) => <li key={step}>{step}</li>)}
        </ul>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">{trust}</p>
      </section>
    </section>
  );
}

export function FreshnessPanel({
  view,
  healthSources,
  paperLog,
  blockReason,
}: {
  view: RegimeView;
  healthSources: { id: string; label: string; observationDate: string | null; fetchedAt: string | null; error: string | null; sourceName?: string | null }[];
  paperLog: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null } | null;
  blockReason?: string | null;
  csrf?: string | null;
}) {
  const names = Object.fromEntries(view.desk.lines.map((line) => [line.symbol, line.name]));
  const feeds = describeFeeds({
    rows: view.snapshot.freshness,
    sources: healthSources,
    priceGaps: view.ideas.gaps,
    names,
    pricesFetchedAt: view.ideas.pricesFetchedAt,
  });
  const counts = {
    fresh: feeds.filter((feed) => feed.status === 'fresh').length,
    stale: feeds.filter((feed) => feed.status === 'stale').length,
    blocked: feeds.filter((feed) => feed.status === 'blocked').length,
  };
  const gaps = knownGapLines({
    snapshotGaps: view.snapshot.gaps,
    priceGaps: view.ideas.gaps,
    deskGaps: view.desk.gaps,
    paperNote: paperLog?.status === 'missing_schema' ? 'The paper record is not stored yet.' : null,
  });
  const problems = feeds.filter((feed) => feed.status !== 'fresh');
  return (
    <section id="data-freshness" className="mt-10">
      <h2 className="text-xl font-bold text-[var(--text-1)]">How fresh is this data</h2>
      <p className="mt-2 text-[15px] text-[var(--text-2)]">
        {counts.stale === 0 && counts.blocked === 0
          ? `All ${feeds.length} feeds arrived (${sydneyClock(view.snapshot.generatedAt)}).`
          : `${counts.fresh} fresh, ${counts.stale} stale, ${counts.blocked} missing.`}
        {gaps.length ? ` ${gaps.length} known gap${gaps.length === 1 ? '' : 's'}.` : ''}
      </p>
      {blockReason ? <p className="mt-2 text-sm text-[var(--call-sell)]">{blockReason}</p> : null}
      {problems.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {problems.map((feed) => (
            <li key={feed.id} className="text-sm text-[var(--text-2)]">
              <span className="font-semibold">{STATUS_WORD[feed.status]}. </span>
              {feed.name} · {feed.updated}
            </li>
          ))}
        </ul>
      ) : null}
      {gaps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-base font-semibold text-[var(--text-1)]">What we can&apos;t measure yet</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-3)]">
            {gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      ) : null}
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[var(--text-2)]">Every feed</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Feed dates and status</caption>
            <thead className="text-xs text-[var(--text-3)]">
              <tr>
                <th scope="col" className="py-2 pr-3 text-left font-semibold">Series</th>
                <th scope="col" className="py-2 pr-3 text-left font-semibold">Period</th>
                <th scope="col" className="py-2 pr-3 text-left font-semibold">Status</th>
                <th scope="col" className="py-2 text-left font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {view.snapshot.freshness.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3 text-[var(--text-2)]">{row.label}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--text-3)]">{row.asOf ? sydneyWhen(row.asOf) : '—'}</td>
                  <td className="py-2 pr-3 text-xs font-semibold text-[var(--text-2)]">{!row.asOf ? 'Missing' : row.stale ? 'Stale' : 'Fresh'}</td>
                  <td className="py-2"><a href={row.href} className="text-[var(--call-hold)]">{row.source}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function limitSentence(view: RegimeView): string {
  const budget = view.snapshot.effectiveBudget;
  const usual = view.snapshot.modelBudget;
  const swingTighter = usual != null && budget.volTarget < usual.volTarget - 1e-9;
  const investedTighter = usual != null && budget.maxGross < usual.maxGross - 1e-9;
  const nonCashTighter = usual != null && budget.maxNet < usual.maxNet - 1e-9;
  const notes = [
    swingTighter ? `swing target tighter than the usual ${(usual.volTarget * 100).toFixed(0)}%` : null,
    investedTighter ? `invested cap tighter than the usual ${(usual.maxGross * 100).toFixed(0)}%` : null,
    nonCashTighter ? `non-cash cap tighter than the usual ${(usual.maxNet * 100).toFixed(0)}%` : null,
  ].filter((item): item is string => Boolean(item));
  return notes.length ? `Today: ${notes.join('; ')}.` : 'Today’s limits match the usual limits for this mood.';
}
