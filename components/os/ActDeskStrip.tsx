import { EmptyState } from '@/components/os/EmptyState';
import { WeightBar } from '@/components/os/WeightBar';
import {
  convictionShow,
  formatAsOf,
  formatPct,
  formatThemeLabel,
  hasLiveActBookSign,
  hasPaperActBook,
  liveActBriefRef,
  paperPortfolio,
  targetBook,
} from '@/lib/os-data';

/**
 * Scarce Act desk — funding cue for real size.
 * Show ≠ Act. Paper book rows never appear here as live-eligible.
 * Hard empty until Vera live book-sign (+ brief_ref when rows render).
 */
export function ActDeskStrip() {
  const live = hasLiveActBookSign(targetBook, paperPortfolio);
  const paperHold = hasPaperActBook(targetBook, convictionShow);
  const briefRef = liveActBriefRef();
  const asOf = targetBook.as_of || convictionShow.as_of;
  const ceilings = targetBook.risk_ceilings_ref;

  if (!live) {
    const title = paperHold ? 'Live Act empty' : 'Waiting on Vera book-sign';
    const description = paperHold
      ? 'Paper HOLD — live Act empty until Vera book-sign + brief_ref. The paper book on /os/book is not live-eligible funding.'
      : 'No live Vera book-sign or live ceilings yet. This strip stays empty until a signed live book exists — Show rows never size the book.';

    return (
      <section className="mb-8" aria-label="Act desk">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--act">Act · live</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Act desk
            </h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Show ≠ Act · funding cue
          </span>
        </div>
        <EmptyState
          title={title}
          description={description}
          waitingOn="Vera book-sign + brief_ref"
        />
      </section>
    );
  }

  // Live path only — existing feed weights, never invented.
  const rows = (
    convictionShow.book_rows.length > 0
      ? [...convictionShow.book_rows]
      : targetBook.positions.map((p) => ({
          symbol: p.symbol,
          weight_pct: p.weight_pct,
          instrument: p.instrument,
          venue: p.venue,
          sleeve: p.sleeve,
          theme_bucket: p.theme_bucket,
          score: p.score,
          tier: p.tier,
          vera_line_sign: null as string | null,
          vera_book_signed: true,
          note: '',
          book_eligible: true,
        }))
  ).sort((a, b) => b.weight_pct - a.weight_pct);

  return (
    <section
      className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5"
      aria-label="Act desk"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="os-stamp os-stamp--act">Act · live</span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Act desk
          </h2>
        </div>
        <div className="text-right font-mono text-[11px] text-[var(--muted)]">
          <p>as of {formatAsOf(asOf)}</p>
          <p className="mt-0.5">
            brief_ref · {briefRef ?? '—'}
          </p>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-[var(--muted)]">
        Vera-signed live book · {rows.length} lines · invested {formatPct(targetBook.invested_pct)} ·
        cash {formatPct(targetBook.cash_pct)}. Name cap {ceilings.max_single_name_pct}%. Show ≠ Act.
      </p>
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <li key={row.symbol} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="font-semibold tracking-tight">{row.symbol}</p>
              <p className="text-xs text-[var(--muted)]">
                {formatThemeLabel(row.theme_bucket)} · {row.instrument}
                {briefRef ? ` · ${briefRef}` : ''}
              </p>
            </div>
            <WeightBar pct={row.weight_pct} max={ceilings.max_single_name_pct} />
          </li>
        ))}
      </ul>
    </section>
  );
}
