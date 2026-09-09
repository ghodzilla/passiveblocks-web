import { OsShell } from '@/components/os/OsShell';
import { ScoreBar } from '@/components/os/ScoreBar';
import { StatStrip } from '@/components/os/StatStrip';
import { WeightBar } from '@/components/os/WeightBar';
import {
  convictionShow,
  formatAsOf,
  formatPct,
  formatScore,
  formatThemeLabel,
} from '@/lib/os-data';

export const metadata = {
  title: 'Conviction · OS',
  robots: { index: false, follow: false },
};

const TIER_PILL: Record<string, string> = {
  core: 'os-pill--core',
  growth: 'os-pill--growth',
  satellite: 'os-pill--satellite',
  moonshot: 'os-pill--moonshot',
  watch: 'os-pill--watch',
  veto: 'os-pill--veto',
};

const DECISION_PILL: Record<string, string> = {
  SIGN_CORE: 'os-pill--core',
  SIGN_GROWTH: 'os-pill--growth',
  SIGN_MOONSHOT: 'os-pill--moonshot',
  SIGN_WATCH: 'os-pill--watch',
  INSUFFICIENT: 'os-pill--insufficient',
};

function tierPill(tier: string) {
  return TIER_PILL[tier.toLowerCase()] ?? 'os-pill--watch';
}

function decisionPill(decision: string) {
  return DECISION_PILL[decision] ?? 'os-pill--insufficient';
}

function decisionLabel(decision: string) {
  return decision.replace(/^SIGN_/, '').replace(/_/g, ' ');
}

/** When Vera decision is INSUFFICIENT, do not show the dry-ledger tier (e.g. Growth) as investable. */
function showTierLabel(tier: string, decision: string) {
  if (decision === 'INSUFFICIENT') return '—';
  return tier;
}

function showTierPill(tier: string, decision: string) {
  if (decision === 'INSUFFICIENT') return 'os-pill--insufficient';
  return tierPill(tier);
}

const RETRACTION_FLAG_RE = /retract|cite_false_positive/i;

function hasRetractionSignal(flags: string[], veraNote: string) {
  if (flags.some((f) => RETRACTION_FLAG_RE.test(f))) return true;
  return /retract/i.test(veraNote);
}

/** Prefer vera_note in Why when retracted / cite false-positive; else writeup. */
function whyLine(row: { writeup: string; vera_note: string; flags: string[] }) {
  if (hasRetractionSignal(row.flags, row.vera_note) && row.vera_note) {
    return row.vera_note;
  }
  return row.writeup;
}

export default function ConvictionPage() {
  const showRows = [...convictionShow.show_rows].sort((a, b) => b.score - a.score);
  const bookRows = [...convictionShow.book_rows].sort((a, b) => b.weight_pct - a.weight_pct);
  const showCount = convictionShow.counts?.rows ?? showRows.length;
  const bookCount = bookRows.length;

  return (
    <OsShell
      pathname="/os/conviction"
      eyebrow="Decide"
      title="Conviction Show"
      subtitle={convictionShow.note}
    >
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--status-warn)]/30 bg-[var(--status-warn)]/5 px-4 py-3 text-sm text-[var(--status-warn)]">
        <span className="font-bold">Show · Vera line-signed TOP100 — NOT Act.</span>{' '}
        Act/Book uses Vera-signed <span className="font-mono">book_rows</span> only (
        {bookCount} weights). <span className="font-mono">show_rows</span> carry{' '}
        <span className="font-mono">vera_decision</span>; they never size the book.
      </div>

      <StatStrip
        stats={[
          {
            label: 'Show',
            value: String(showCount),
            hint: 'Vera line-signed',
          },
          {
            label: 'Book',
            value: String(bookCount),
            hint: 'Vera Act weights',
          },
          {
            label: 'As of',
            value: formatAsOf(convictionShow.as_of),
            hint: 'Melbourne',
          },
          {
            label: 'Mode',
            value: convictionShow.mode.replace(/_/g, ' '),
            hint: convictionShow.label,
          },
        ]}
      />

      {convictionShow.revision_note ? (
        <p className="mb-4 text-xs text-[var(--muted)]">
          Revised {formatAsOf(convictionShow.revised_at ?? convictionShow.as_of)} ·{' '}
          {convictionShow.revision_note}
        </p>
      ) : null}

      {/* Sticky scarce Act summary — keeps 8 Vera weights scannable above Show TOP100 */}
      <div className="sticky top-0 z-20 mb-8 -mx-1 border-b border-[var(--os-act-border)] bg-background/90 px-1 py-3 backdrop-blur-md">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--act">Act</span>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Act book · {bookCount} Vera-signed weights
            </p>
          </div>
          <a
            href="#act-book"
            className="text-[11px] font-medium text-[var(--os-act-fg)] underline-offset-2 hover:underline"
          >
            Jump to Act detail ↓
          </a>
        </div>
        <ul className="flex flex-wrap gap-2">
          {bookRows.map((row) => (
            <li
              key={row.symbol}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--os-act-border)] bg-[var(--os-act-bg)] px-2.5 py-1.5"
            >
              <span className="text-xs font-semibold tracking-tight text-foreground">
                {row.symbol}
              </span>
              <span className="os-tabular font-mono text-[11px] font-bold text-[var(--os-act-fg)]">
                {formatPct(row.weight_pct)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Scarce Act only — not Show density. Paper HOLD · Show ledger below never sizes the book.
        </p>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--show">Show · not Act</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Show ledger · TOP100
            </h2>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted)]">
            {showCount} rows · book_eligible {convictionShow.counts.book_eligible}
          </span>
        </div>

        <div className="mb-5 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            Desk recommendation from the transcripts, not a quote list. Hold the metal already in
            the book. Do not add more gold to force a return. Hold bitcoin. It is not the same trade
            as gold until the liquidity clock is settled. Do not add Solana, Caterpillar, Tesla, or
            a second operator ticket beside Tesla. No path to 40% is in this file. Paper stays hold.
          </p>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Symbol</th>
                  <th className="px-4 py-3 font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">Tier</th>
                  <th className="px-4 py-3 font-bold">Decision</th>
                  <th className="px-4 py-3 font-bold">Theme / layer</th>
                  <th className="px-4 py-3 font-bold">Evidence</th>
                  <th className="px-4 py-3 font-bold">Why</th>
                  <th className="px-4 py-3 font-bold">Citations</th>
                  <th className="px-4 py-3 font-bold">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {showRows.map((row) => (
                  <tr key={row.symbol} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold tracking-tight">{row.symbol}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {row.book_eligible ? 'book-eligible' : 'Show only'} · not Act
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <ScoreBar score={row.score} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`os-pill ${showTierPill(row.tier, row.vera_decision)}`}>
                        {showTierLabel(row.tier, row.vera_decision)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`os-pill ${decisionPill(row.vera_decision)}`}
                        title={row.vera_note}
                      >
                        {decisionLabel(row.vera_decision)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      <p>{formatThemeLabel(row.primary_theme)}</p>
                      <p className="text-[11px]">{formatThemeLabel(row.jordi_layer)}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-foreground">
                      {row.evidence_grade}
                    </td>
                    <td className="max-w-sm px-4 py-3.5 text-xs leading-relaxed text-[var(--muted)]">
                      {whyLine(row)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--muted)]">
                      {row.n_calls}c / {row.n_voices}v
                    </td>
                    <td className="px-4 py-3.5">
                      {row.flags.length === 0 ? (
                        <span className="text-[11px] text-[var(--muted)]">—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {row.flags.map((f) => (
                            <li
                              key={f}
                              className="inline-flex w-fit rounded border border-[var(--status-warn)]/25 bg-[var(--status-warn)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-warn)]"
                            >
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="act-book" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="os-stamp os-stamp--act">Act</span>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Act book · Vera-signed weights
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Only these {bookCount} <span className="font-mono">book_rows</span> are Vera Act
              weights (paper HOLD). Show rows above never become Act without a separate book-sign.
            </p>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted)]">{bookCount} lines</span>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--os-act-border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--os-act-bg)] text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Symbol</th>
                  <th className="px-4 py-3 font-bold">Weight</th>
                  <th className="px-4 py-3 font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">Tier</th>
                  <th className="px-4 py-3 font-bold">Sleeve / theme</th>
                  <th className="px-4 py-3 font-bold">Vera book</th>
                  <th className="px-4 py-3 font-bold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {bookRows.map((row) => (
                  <tr key={row.symbol} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold tracking-tight">{row.symbol}</p>
                      <p className="font-mono text-[11px] text-[var(--muted)]">{row.instrument}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <WeightBar pct={row.weight_pct} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ScoreBar score={row.score} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`os-pill ${tierPill(row.tier)}`}>{row.tier}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      <p>{formatThemeLabel(row.sleeve)}</p>
                      <p className="text-[11px]">{formatThemeLabel(row.theme_bucket)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`os-pill ${
                          row.vera_book_signed ? 'os-pill--core' : 'os-pill--veto'
                        }`}
                      >
                        {row.vera_book_signed ? 'Signed' : 'Unsigned'}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3.5 text-xs leading-relaxed text-[var(--muted)]">
                      {row.note}
                      <span className="mt-1 block font-mono text-[10px] text-[var(--muted-foreground)]">
                        {formatPct(row.weight_pct)} · {formatScore(row.score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </OsShell>
  );
}
