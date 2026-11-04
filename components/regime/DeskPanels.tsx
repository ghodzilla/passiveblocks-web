import type { Desk } from '@/lib/regime/desk';
import { ASPIRATION_LABEL } from '@/lib/regime/sizing';
import { melbourneClock } from '@/lib/regime/time';

function pct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function DeskPanels({ desk }: { desk: Desk }) {
  return (
    <>
      <section className="mt-10" id="themes">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Themes</p>
        <h2 className="text-lg font-bold tracking-tight">Objective switches, version {desk.configVersion}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Each basket is on or off from a written rule. The list is reviewed by a person once a quarter. The weekly improvement job does not rewrite these switches.
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
                    <span className="ml-2 font-mono text-xs">{pct(line.weight)}</span>
                    {line.dip ? <span className="ml-2 text-xs font-semibold text-emerald-200">{line.dip}</span> : null}
                    <p className="text-xs text-[var(--muted)]">{line.verdict}</p>
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

      <section className="mt-10" id="improvement">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Improvement</p>
        <h2 className="text-lg font-bold tracking-tight">Aspiration, then the record</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {ASPIRATION_LABEL}. Drawdown limits always win over chasing it. A parameter moves only when it improves out-of-sample Sharpe or Calmar on at least 2 of 3 walk-forward folds, and only once per rule per month. The gap does not loosen the drawdown halt, the 0.5–1% risk band, or the position caps.
        </p>
        {desk.halted ? (
          <div className="mt-4 rounded-[var(--radius-xl)] border border-rose-400/40 bg-rose-500/10 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Drawdown halt</p>
            <p className="mt-2 text-base font-semibold leading-relaxed text-white">
              The paper portfolio is {pct(desk.drawdown, 1)} below its peak. No new entries until it recovers. The {pct(desk.targetCagr, 0)} a year aspiration does not override this.
            </p>
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[11px] font-bold leading-snug text-[var(--muted-foreground)]">{ASPIRATION_LABEL}</p>
            <p className="mt-2 font-mono text-2xl font-bold">{pct(desk.targetCagr, 0)}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Realised CAGR</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.realisedText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">{desk.equity == null ? 'No paper marks yet' : `Equity ${money(desk.equity)}`}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Backtested CAGR</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.backtestedText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Last weekly review, vs SPY and 60/40</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Gap to target</p>
            <p className="mt-2 font-mono text-2xl font-bold">{desk.gapText}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Max drawdown {desk.maxDrawdownText}</p>
          </article>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Paper capital {money(desk.capital)}. Risk per idea {(desk.params.riskPct * 100).toFixed(2)}%. ATR multiple {desk.params.atrK}. Dip band {(desk.params.dipLow * 100).toFixed(0)}–{(desk.params.dipHigh * 100).toFixed(0)}% below the 60-day high.
        </p>
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
