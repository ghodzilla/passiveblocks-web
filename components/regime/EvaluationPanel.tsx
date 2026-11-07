import type { EvaluationReport } from '@/lib/regime/evaluate';

function money(value: number): string {
  return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function EvaluationPanel({ report }: { report: EvaluationReport }) {
  const shown = report.symbols.filter((symbol) => symbol.skipped == null).slice(0, 8);
  return (
    <section className="mt-10" id="evaluation">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Research check</p>
      <h2 className="text-lg font-bold tracking-tight">What the saved prices can and cannot say</h2>
      <div className="mt-4 rounded-[var(--radius-xl)] border border-amber-300/40 bg-amber-400/10 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">Full strategy: not validated</p>
        <p className="mt-2 text-sm leading-relaxed text-white">{report.fullStrategyReason}</p>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.lookAhead}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{report.dividendNote}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        Fees are {report.fees.replaceAll('_', ' ')}. Slippage is {report.slippage.replaceAll('_', ' ')}. Cash earns {report.cashYield}. The lump-sum path puts every unit in on the first tradable session, so it is a different cash schedule from the monthly paths. {report.sampleNote} Rule {report.ruleVersion}. {report.included} symbols included, {report.skipped} skipped.
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No saved price series is long enough for this check.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Months</th>
                <th className="px-4 py-3">Lump end / drawdown</th>
                <th className="px-4 py-3">Monthly end / drawdown</th>
                <th className="px-4 py-3">Tactical end / invested</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((symbol) => {
                const lump = symbol.paths.find((path) => path.id === 'lump_sum');
                const monthly = symbol.paths.find((path) => path.id === 'monthly_invest');
                const tactical = symbol.paths.find((path) => path.id === 'tactical_price');
                return (
                  <tr key={symbol.symbol} className="border-t border-white/10">
                    <td className="px-4 py-3 font-semibold text-white">
                      {symbol.symbol}
                      <p className="text-[11px] font-normal text-[var(--muted)]">{symbol.firstDate} → {symbol.lastDate}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{symbol.months}</td>
                    <td className="px-4 py-3 font-mono text-xs">{lump ? `${money(lump.endEquity)} / ${pct(lump.maxDrawdown)}` : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{monthly ? `${money(monthly.endEquity)} / ${pct(monthly.maxDrawdown)}` : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{tactical ? `${money(tactical.endEquity)} / ${tactical.sessionsInvested} of ${tactical.sessions}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
        End values are units of cash contributed, not a forecast and not a portfolio recommendation. A higher number on this table is not a reason to change a live threshold.
      </p>
    </section>
  );
}
