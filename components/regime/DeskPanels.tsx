import type { Desk } from '@/lib/regime/desk';
import { bookExposureSentence } from '@/lib/regime/exposureCopy';
import { checklistLines } from '@/lib/regime/plain';
import { ASPIRATION_LABEL } from '@/lib/regime/sizing';
import { melbourneClock } from '@/lib/regime/time';

function pct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function audMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function equityLine(desk: Desk): string {
  if (desk.paperLedger?.status === 'legacy_only') return 'Earlier ledger retained. No AUD value.';
  if (desk.equity == null || desk.paperLedger?.valued === false) return 'No AUD paper value yet';
  if (desk.paperLedger?.currency === 'AUD') return `Equity ${audMoney(desk.equity)}`;
  return `Equity ${money(desk.equity)}`;
}

export function DeskPanels({ desk, settingsNotice = null }: { desk: Desk; settingsNotice?: string | null }) {
  return (
    <>
      <section className="mt-10" id="themes">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Themes</p>
        <h2 className="text-lg font-bold tracking-tight">Theme switches, version {desk.configVersion}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Each basket is on or off from a written rule. A person reviews the list once a quarter. The weekly job does not rewrite these switches. A theme being on is support for the story, not approval to trade. The sentence under each name is the blocker or the pass. 0% means it is not sized. Cash can pass a check that a share fails, and that is still not an order.
        </p>
        <div className="mt-4 grid gap-3">
          {desk.themes.map((theme) => (
            <article key={theme.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold">{theme.label}</h3>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.on ? 'text-emerald-200' : 'text-[var(--muted)]'}`}>
                  {theme.enabled ? (theme.on ? 'On' : 'Off') : 'Switch off'}
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{theme.objective}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{theme.reason}</p>
              <ul className="mt-3 space-y-2">
                {theme.lines.map((line) => (
                  <li key={`${theme.id}-${line.symbol}`} className="text-sm">
                    <span className="font-mono text-xs">{line.symbol}</span>
                    <span className="ml-2 text-[var(--muted)]">{line.name}</span>
                    <span className="ml-2 font-mono text-xs" title="Share of the paper book. 0% is not a buy.">{pct(line.weight)}</span>
                    {line.dip ? <span className={`ml-2 text-xs font-semibold ${line.dip.includes('blocked') ? 'text-amber-100' : 'text-emerald-200'}`}>{line.dip}</span> : null}
                    <p className="text-xs text-[var(--muted)]">{line.verdict}</p>
                    <details>
                      <summary className="cursor-pointer text-xs text-[var(--accent-soft)]">Why?</summary>
                      <p className="whitespace-pre-line text-xs text-white/70">{checklistLines(line.gates)}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-bold">Theme change log</h3>
          <ul className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            {desk.changelog.map((entry) => (
              <li key={entry.date}>
                <span className="font-mono text-xs text-white/70">{entry.date}</span> {entry.note}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10" id="paper-book">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Paper only</p>
        <h2 className="text-lg font-bold tracking-tight">AUD paper book{desk.paperLedger?.policy ? `, ${desk.paperLedger.policy}` : ''}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          This is a paper ledger, not a brokerage account and not an order. Caps bind the shares already held and any new tranche. A fresh price or a fresh FX rate is not a buy. A missing or stale AUDUSD rate blocks a new buy and leaves the book without an AUD value. 0% on a held name is not an instruction to sell it. The research replay charges 10 bps and fills the next session. This book is a share ledger in AUD with no broker fee, marked at the latest fetched close.
        </p>
        {desk.paperLedger ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
            <p>{desk.paperLedger.note}</p>
            <p className="mt-2">
              Status {desk.paperLedger.status}. {desk.paperLedger.valued ? `AUD value ${audMoney(desk.paperLedger.equity)}.` : 'No AUD net value is shown.'}
              {desk.paperLedger.exposures
                ? ` ${bookExposureSentence(desk.paperLedger.exposures)}`
                : ' Held exposure is not compared with the caps until the book has an AUD value.'}
            </p>
            {desk.paperLedger.fx ? (
              <p className="mt-2">
                AUDUSD is USD per 1 AUD. Observation {desk.paperLedger.fx.observationDate ?? 'missing'}. Fetched {desk.paperLedger.fx.fetchedAt ?? 'missing'}. Rate {desk.paperLedger.fx.rate == null ? 'missing' : desk.paperLedger.fx.rate.toFixed(4)}. {desk.paperLedger.fx.fresh ? 'The rate is inside the price window.' : 'The rate is missing or stale, so new USD buys stay off.'}
                {desk.paperLedger.fx.error ? ` ${desk.paperLedger.fx.error}` : ''}
              </p>
            ) : (
              <p className="mt-2">No AUDUSD quote is stored on this book yet. US and crypto names stay unvalued until a refresh stores one.</p>
            )}
            {desk.paperLedger.pending.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {desk.paperLedger.pending.map((item) => (
                  <li key={`${item.symbol}-${item.reason}`}>{item.symbol}: {item.reason}</li>
                ))}
              </ul>
            ) : <p className="mt-2">No pending trim or FX block on the latest mark.</p>}
            {desk.paperLedger.legacy ? (
              <p className="mt-2">The earlier ledger has {desk.paperLedger.legacyPositions} retained row{desk.paperLedger.legacyPositions === 1 ? '' : 's'}. Those cash and cost figures are not converted and are not an AUD value.</p>
            ) : null}
          </div>
        ) : null}
        <form method="POST" action="/api/regime/settings" className="mt-4">
          <input type="hidden" name="intent" value="rebaseline" />
          <input type="hidden" name="capital" value={desk.capital} />
          <input type="hidden" name="targetCagr" value={Math.round(desk.targetCagr * 100)} />
          <button type="submit" className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Start a new AUD paper book
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">That button keeps the current AUD book and the earlier ledger. It does not delete them. It opens a new book at the saved capital.</p>
      </section>

      <section className="mt-10" id="improvement">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Improvement</p>
        <h2 className="text-lg font-bold tracking-tight">The aim, then the record</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {ASPIRATION_LABEL}. A loss limit always beats chasing that aim. A setting changes only when the out-of-sample test is better on at least 2 of 3 past periods, and only once a month. The gap does not loosen the loss halt, the 0.5–1% risk per idea, or the size caps.
        </p>
        {desk.halted ? (
          <div className="mt-4 rounded-[var(--radius-xl)] border border-rose-400/40 bg-rose-500/10 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Loss halt</p>
            <p className="mt-2 text-base font-semibold leading-relaxed text-white">
              The paper portfolio is {pct(desk.drawdown, 1)} below its peak. No new buys until it recovers. The {pct(desk.targetCagr, 0)} a year aim does not override this.
            </p>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[11px] font-bold leading-snug text-[var(--muted-foreground)]">{ASPIRATION_LABEL}</p>
            <p className="mt-2 font-mono text-2xl font-bold">{pct(desk.targetCagr, 0)}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" title="Compound annual growth of the paper book.">Paper return so far</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.realisedText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">{equityLine(desk)}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" title="Compound annual growth from the last weekly test.">Tested return</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.backtestedText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Last weekly review, versus the US share market and a 60/40 mix</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" title="How far the paper return sits from the aspiration. It does not change the risk rules.">Gap to the aim</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.gapText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Worst peak-to-trough loss {desk.maxDrawdownText}</p>
          </article>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Paper capital {desk.paperLedger?.currency === 'AUD' ? audMoney(desk.capital) : money(desk.capital)}. Risk per idea {(desk.params.riskPct * 100).toFixed(2)}% of capital. The stop uses {desk.params.atrK} times the average daily range. A dip is {(desk.params.dipLow * 100).toFixed(0)}–{(desk.params.dipHigh * 100).toFixed(0)}% below the 60-day high.
        </p>
        {settingsNotice ? <p className="mt-3 text-sm text-amber-100">{settingsNotice}</p> : null}
        <form method="POST" action="/api/regime/settings" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-[var(--muted)]">
            Capital
            <input name="capital" type="number" min="1" step="1" defaultValue={desk.capital} className="mt-1 block w-40 rounded border border-[var(--border)] bg-black/40 px-2 py-1 font-mono text-sm text-foreground" />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Target % / year
            <input name="targetCagr" type="number" min="0" max="200" step="1" defaultValue={Math.round(desk.targetCagr * 100)} className="mt-1 block w-32 rounded border border-[var(--border)] bg-black/40 px-2 py-1 font-mono text-sm text-foreground" />
          </label>
          <button type="submit" className="rounded-full border border-[var(--accent)]/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-soft)]">
            Save
          </button>
        </form>
        <h3 className="mt-6 text-sm font-bold">This week</h3>
        {desk.changes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No rule was promoted, demoted, or retired in the last seven days.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {desk.changes.map((change) => (
              <li key={`${change.at}-${change.ruleId}-${change.action}`}>
                <span className="font-mono text-[11px] text-white/50">{melbourneClock(change.at)}</span>
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-white/60">{change.action}</span>
                <span className="ml-2 font-mono text-xs">{change.ruleId}</span>
                <p className="text-[var(--muted)]">{change.detail}</p>
              </li>
            ))}
          </ul>
        )}
        {desk.gaps.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-[var(--status-warn)]">
            {desk.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
