import type { EvaluationReport, EvalPath } from '@/lib/regime/evaluate';

function money(value: number): string {
  return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function multiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

function pathOf(paths: EvalPath[], id: EvalPath['id']): EvalPath | undefined {
  return paths.find((path) => path.id === id);
}

export function EvaluationPanel({ report }: { report: EvaluationReport }) {
  const shown = report.symbols.filter((symbol) => symbol.skipped == null).slice(0, 8);
  const cost = report.assumptions.oneWayBps;
  const cash = report.assumptions.cashYieldBps;
  return (
    <section className="mt-2" id="evaluation">
      <h2 className="text-lg font-bold tracking-tight">What the saved prices can and cannot say</h2>
      <div className="mt-4 rounded-[var(--radius-xl)] border border-amber-300/40 bg-amber-400/10 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">The full rule set has not been proven on history</p>
        <p className="mt-2 text-sm leading-relaxed text-white">{report.fullStrategyReason}</p>
        <p className="mt-2 text-sm text-white/70">What this means: this block does not show that the rules make money. It only says what the saved prices are allowed to be used for.</p>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.lookAhead}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.costNote}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.cashNote}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.dividendNote}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.sampleNote}</p>
      <form action="/private/regime" method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--muted)]">
          Trading cost each way, in hundredths of a percent
          <input
            name="costBps"
            defaultValue={String(cost)}
            inputMode="decimal"
            className="mt-1 block w-28 rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Interest on cash, in hundredths of a percent a year
          <input
            name="cashBps"
            defaultValue={String(cash)}
            inputMode="decimal"
            className="mt-1 block w-28 rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white"
          />
        </label>
        <button type="submit" className="rounded border border-white/20 px-3 py-1 text-sm text-white">
          Recalculate
        </button>
      </form>
      {report.unavailableReason ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{report.unavailableReason}</p>
      ) : null}
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No saved price series is long enough for this check.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Monthly investing: end value per dollar in / cash left / costs</th>
                <th className="px-4 py-3">Following the price rule: end value per dollar in / cash left / costs</th>
                <th className="px-4 py-3">One lump sum, a different way of putting money in</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((symbol) => {
                const lump = pathOf(symbol.paths, 'lump_sum');
                const monthly = pathOf(symbol.paths, 'monthly_invest');
                const tactical = pathOf(symbol.paths, 'tactical_price');
                const priceLabel = symbol.totalReturn === 'adjusted' ? 'adjusted close' : symbol.totalReturn === 'price_only' ? 'price only' : 'adjustment unknown';
                return (
                  <tr key={symbol.symbol} className="border-t border-white/10">
                    <td className="px-4 py-3 font-semibold text-white">
                      {symbol.symbol}
                      <p className="text-[11px] font-normal text-[var(--muted)]">{symbol.firstDate} → {symbol.lastDate}</p>
                      <p className="text-[11px] font-normal text-[var(--muted)]">{symbol.months} contributions · {priceLabel}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {monthly ? `${multiple(monthly.wealthPerUnitContributed)} · cash ${money(monthly.endCash)} · cost ${money(monthly.costsPaid)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {tactical ? `${multiple(tactical.wealthPerUnitContributed)} · cash ${money(tactical.endCash)} · cost ${money(tactical.costsPaid)} · invested ${tactical.sessionsInvested}/${tactical.sessions}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {lump ? `${multiple(lump.wealthPerUnitContributed)} · worst fall ${pct(lump.maxDrawdown)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
        {report.returnLabel} The monthly and tactical columns share contribution dates. The lump-sum column does not, so a higher lump-sum number is not evidence of skill. A higher tactical number is not a reason to change a live threshold. Rule {report.ruleVersion}. {report.included} symbols included, {report.skipped} skipped.
      </p>
    </section>
  );
}
