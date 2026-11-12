import type { Desk } from '@/lib/regime/desk';
import { bookExposureSentence } from '@/lib/regime/exposureCopy';
import { checklistLines } from '@/lib/regime/plain';
import { ASPIRATION_LABEL } from '@/lib/regime/sizing';
import { themesForSymbol } from '@/lib/regime/themes';
import { sydneyClock } from '@/lib/regime/time';

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
  if (desk.paperLedger?.currency === 'AUD') return `Worth ${audMoney(desk.equity)}`;
  return `Worth ${money(desk.equity)}`;
}

function alsoListed(symbol: string, themeId: string, defensive: boolean): string | null {
  const others = themesForSymbol(symbol).filter((theme) => theme.id !== themeId).map((theme) => theme.label);
  const bits = [
    defensive ? 'also defensive' : null,
    ...others.map((label) => `also in ${label}`),
  ].filter((item): item is string => Boolean(item));
  return bits.length ? bits.join(' · ') : null;
}

export function DeskPanels({
  desk,
  settingsNotice = null,
  part = 'all',
}: {
  desk: Desk;
  settingsNotice?: string | null;
  part?: 'all' | 'themes' | 'settings';
}) {
  const names = desk.themes.reduce((sum, theme) => sum + theme.lines.length, 0);
  const bought = desk.themes.reduce((sum, theme) => sum + theme.lines.filter((line) => line.weight > 0).length, 0);
  return (
    <>
      {part === 'settings' ? null : (
      <section id="themes">
        <h2 className="text-lg font-bold tracking-tight">Themes, on or off</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">
          Each group is on or off from a written rule. A person reviews the list once a quarter. {names} names; {bought} bought today.
        </p>
        <div className="mt-4 grid gap-3">
          {desk.themes.map((theme) => (
            <article key={theme.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold">{theme.label}</h3>
                <p className="text-xs font-semibold text-[var(--text-2)]">
                  {theme.enabled ? (theme.on ? '● On' : '○ Off') : 'Switch off'}
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{theme.objective}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{theme.reason}</p>
              <ul className="mt-3 space-y-2">
                {theme.lines.map((line) => (
                  <li key={`${theme.id}-${line.symbol}`} className="text-sm">
                    <span className="font-mono text-xs">{line.symbol}</span>
                    <span className="ml-2 text-[var(--text-2)]">{line.name}</span>
                    {alsoListed(line.symbol, theme.id, line.defensive) ? (
                      <span className="ml-2 text-xs text-[var(--text-3)]">{alsoListed(line.symbol, theme.id, line.defensive)}</span>
                    ) : null}
                    <span className="ml-2 font-mono text-xs text-[var(--text-3)]" title="Share of the paper book.">{pct(line.weight)} of the book</span>
                    {line.dip ? <span className={`ml-2 text-xs font-semibold ${line.dip.startsWith('Dip buy') ? 'text-[var(--call-buy)]' : 'text-[var(--call-watch)]'}`}>{line.dip}</span> : null}
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
        <p className="mt-4 text-xs text-[var(--text-3)]">List version {desk.configVersion}.</p>
      </section>
      )}

      {part === 'themes' ? null : (
      <section className="mt-10" id="paper-book">
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">
          A pretend A$100,000 account that follows the rules exactly. It never borrows and only sells on a stop, a limit trim or a missing price. Trades cost 0.10% each.
        </p>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer text-sm text-[var(--text-2)]">How this record is marked</summary>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            The historical test charges 0.10% each way (10 basis points) and fills the next session. This book is a share record in Australian dollars with no broker fee, marked at the latest downloaded close.
          </p>
        </details>
        {desk.paperLedger ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
            <p>{desk.paperLedger.note}</p>
            <p className="mt-2">
                Limits applied {desk.paperLedger.status === 'enforced' ? '✓' : desk.paperLedger.status}. {desk.paperLedger.valued ? `AUD value ${audMoney(desk.paperLedger.equity)}.` : 'No AUD net value is shown.'}
              {desk.paperLedger.exposures
                ? ` ${bookExposureSentence(desk.paperLedger.exposures)}`
                : ' Held exposure is not compared with the caps until the book has an AUD value.'}
            </p>
            {desk.paperLedger.fx ? (
              <p className="mt-2">
                A$1 = US${desk.paperLedger.fx.rate == null ? 'missing' : desk.paperLedger.fx.rate.toFixed(4)} (rate for {desk.paperLedger.fx.observationDate ?? 'missing'}; downloaded {sydneyClock(desk.paperLedger.fx.fetchedAt)}). {desk.paperLedger.fx.fresh ? 'The rate is fresh enough to use.' : 'The rate is missing or stale, so new US-dollar buys stay off.'}
                {desk.paperLedger.fx.error ? ` ${desk.paperLedger.fx.error}` : ''}
              </p>
            ) : (
              <p className="mt-2">No Australian-dollar exchange rate is stored on this book yet. US and crypto names stay without an Australian-dollar value until a refresh stores one.</p>
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
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--text-2)]">Start over (keeps the old record)</summary>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-3)]">This keeps the current book and the earlier record. It opens a new book at the saved starting amount.</p>
          <form method="POST" action="/api/regime/settings" className="mt-3">
            <input type="hidden" name="intent" value="rebaseline" />
            <input type="hidden" name="capital" value={desk.capital} />
            <input type="hidden" name="targetCagr" value={Math.round(desk.targetCagr * 100)} />
            <button type="submit" className="rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-2)]">
              Start a new Australian-dollar paper book
            </button>
          </form>
        </details>
      </section>
      )}

      {part === 'themes' ? null : (
      <section className="mt-10" id="improvement">
        <h2 className="text-lg font-bold tracking-tight">The record, then the settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">
          Long-term aspiration: 66% a year (a famous fund&apos;s best record). Display only; it never changes a limit. {ASPIRATION_LABEL}.
        </p>
        {desk.halted ? (
          <div className="mt-4 rounded-[var(--radius-xl)] border border-[color:var(--call-sell)]/40 bg-[var(--surface-1)] px-5 py-4">
            <p className="text-xs font-semibold text-[var(--call-sell)]">New buys are paused</p>
            <p className="mt-2 text-base font-semibold leading-relaxed text-[var(--text-1)]">
              The paper book is {pct(desk.drawdown, 1)} below its highest value. No new buys until it recovers. The {pct(desk.targetCagr, 0)} a year aspiration does not override this.
            </p>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4">
            <p className="text-xs font-semibold text-[var(--text-3)]">Paper result so far</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[var(--text-1)]">{desk.realisedText}</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{equityLine(desk)}</p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4">
            <p className="text-xs font-semibold text-[var(--text-3)]" title="The last weekly review, compared with the US share market and a mix of 60% shares and 40% cash.">Last replay</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[var(--text-1)]">{desk.backtestedText}</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">Worst fall from a high was {desk.maxDrawdownText}.</p>
          </article>
        </div>
        <p className="mt-3 text-sm text-[var(--text-2)]">
          Starting amount {desk.paperLedger?.currency === 'AUD' ? audMoney(desk.capital) : money(desk.capital)}. Amount risked per idea {(desk.params.riskPct * 100).toFixed(2)}% of that. The stop uses {desk.params.atrK} times the average daily range. A dip is {(desk.params.dipLow * 100).toFixed(0)}–{(desk.params.dipHigh * 100).toFixed(0)}% below the 60-day high.
        </p>
        {settingsNotice ? <p className="mt-3 text-sm text-[var(--call-watch)]">{settingsNotice}</p> : null}
        <form method="POST" action="/api/regime/settings" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--text-2)]">
            Capital
            <input name="capital" type="number" min="1" step="1" defaultValue={desk.capital} className="mt-1 block w-40 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-mono text-sm text-[var(--text-1)]" />
          </label>
          <label className="text-sm text-[var(--text-2)]">
            Long-term aspiration, % a year
            <input name="targetCagr" type="number" min="0" max="200" step="1" defaultValue={Math.round(desk.targetCagr * 100)} className="mt-1 block w-32 rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-mono text-sm text-[var(--text-1)]" />
          </label>
          <button type="submit" className="rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-1)]">
            Save
          </button>
        </form>
        <h3 className="mt-6 text-sm font-bold">This week</h3>
        {desk.changes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-2)]">No automatic rule changes this week.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {desk.changes.map((change) => (
              <li key={`${change.at}-${change.ruleId}-${change.action}`}>
                <span className="font-mono text-xs text-[var(--text-3)]">{sydneyClock(change.at)}</span>
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
      )}
    </>
  );
}
