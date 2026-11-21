import type { EvaluationReport, EvalPath, SymbolEvaluation } from '@/lib/regime/evaluate';
import { researchPathLines, researchSpan, researchVerdict } from '@/lib/regime/researchCopy';
import { Chip } from '@/components/regime/ui/Chip';
import savedTiming from '@/research/regime-validation/timing-summary.json';

const APPROACHES: { id: EvalPath['id']; title: string; about: string }[] = [
  { id: 'monthly_invest', title: 'Steady monthly', about: '$1 bought every month.' },
  { id: 'tactical_price', title: 'Price rule', about: 'The same $1, bought only when the rules were on.' },
  { id: 'lump_sum', title: 'Lump sum', about: 'All the money on the first day. Not a test of the rules.' },
];

function pathOf(paths: EvalPath[], id: EvalPath['id']): EvalPath | undefined {
  return paths.find((path) => path.id === id);
}

function Approach({ path, title, about }: { path: EvalPath | undefined; title: string; about: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
      <p className="text-sm font-semibold text-[var(--text-1)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-3)]">{about}</p>
      {path ? (
        <ul className="mt-3 grid gap-1 text-sm text-[var(--text-2)]">
          {researchPathLines(path).map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-3)]">No result.</p>
      )}
    </div>
  );
}

function FundCard({ symbol }: { symbol: SymbolEvaluation }) {
  const monthly = pathOf(symbol.paths, 'monthly_invest');
  const tactical = pathOf(symbol.paths, 'tactical_price');
  const verdict = researchVerdict(monthly?.wealthPerUnitContributed ?? null, tactical?.wealthPerUnitContributed ?? null);
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-[var(--text-1)]">{symbol.symbol}</h3>
        <Chip tone={verdict.tone}>{verdict.text}</Chip>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-3)]">{researchSpan(symbol)}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {APPROACHES.map((approach) => (
          <Approach key={approach.id} path={pathOf(symbol.paths, approach.id)} title={approach.title} about={approach.about} />
        ))}
      </div>
    </article>
  );
}

export function EvaluationPanel({ report }: { report: EvaluationReport }) {
  const shown = report.symbols.filter((symbol) => symbol.skipped == null).slice(0, 8);
  const cost = report.assumptions.oneWayBps;
  const cash = report.assumptions.cashYieldBps;
  return (
    <section className="mt-2" id="evaluation">
      <h2 className="text-lg font-bold tracking-tight text-[var(--text-1)]">What the saved prices can and cannot say</h2>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">{report.fullStrategyReason}</p>

      <div className="mt-4 grid max-w-3xl gap-3 text-sm leading-relaxed text-[var(--text-2)]">
        <p>Three ways of counting the same saved prices. This is not the live paper book, and it does not change a rule.</p>
        <p><strong className="text-[var(--text-1)]">Steady monthly.</strong> $1 goes into the fund each month and is bought that day.</p>
        <p><strong className="text-[var(--text-1)]">Price rule.</strong> The same $1 on the same days, bought only when the previous session’s price rules were on. Cash waits when they are off.</p>
        <p><strong className="text-[var(--text-1)]">Lump sum.</strong> The same total goes in on the first day and stays invested. A higher result here is a different way of putting the money in, not proof the rules worked.</p>
        <p className="text-[var(--text-3)]">“$1 grew to” is the ending value divided by the dollars put in. Cash left is still uninvested at the end. Costs are trading charges in dollars. “In the market” counts trading days that have a saved price, not every calendar day.</p>
      </div>

      <form action="/private/regime" method="get" className="mt-4 grid max-w-3xl gap-3">
        <label className="text-sm text-[var(--text-2)]">
          One-way cost, in hundredths of a percent. 10 means 0.10% on each buy and each sell.
          <input
            name="costBps"
            defaultValue={String(cost)}
            inputMode="decimal"
            className="mt-1 block w-full max-w-xs rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-1)]"
          />
        </label>
        <label className="text-sm text-[var(--text-2)]">
          Interest on cash that is waiting, in hundredths of a percent a year. 0 means that cash earns nothing.
          <input
            name="cashBps"
            defaultValue={String(cash)}
            inputMode="decimal"
            className="mt-1 block w-full max-w-xs rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-1)]"
          />
        </label>
        <div>
          <button type="submit" className="rounded border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-1)]">
            Recalculate
          </button>
          <p className="mt-1 text-sm text-[var(--text-3)]">Recalculate redraws this comparison with the two numbers above. It does not change today’s call.</p>
        </div>
      </form>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--text-1)]">{savedTiming.timing.sentence}</p>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--text-3)]">That count is the saved research price book, with idle cash at {(savedTiming.cashYieldBps / 100).toFixed(2)}% a year. Tax and franking are not modelled. It does not change the live rules.</p>
      {report.timing.compared > 0 ? (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">This visit&apos;s saved prices: {report.timing.sentence}</p>
      ) : null}
      {report.unavailableReason ? (
        <p className="mt-4 text-sm text-[var(--text-3)]">{report.unavailableReason}</p>
      ) : null}
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-3)]">No saved price series is long enough for this check.</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {shown.map((symbol) => <FundCard key={symbol.symbol} symbol={symbol} />)}
        </div>
      )}

      <details className="mt-4 max-w-3xl">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-2)]">How these numbers are counted</summary>
        <div className="mt-2 grid gap-2 text-sm leading-relaxed text-[var(--text-3)]">
          <p>{report.lookAhead}</p>
          <p>{report.costNote}</p>
          <p>{report.cashNote}</p>
          <p>{report.dividendNote}</p>
          <p>{report.sampleNote}</p>
          <p>{report.returnLabel} Rule {report.ruleVersion}. {report.included} symbols included, {report.skipped} skipped.</p>
        </div>
      </details>
    </section>
  );
}
