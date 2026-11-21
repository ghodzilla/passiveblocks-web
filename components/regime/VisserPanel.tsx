import type { VisserCall } from '@/lib/regime/visser';
import type { VisserPanelModel } from '@/lib/regime/visserPresent';
import { CheckChip, Chip, type ChipTone } from './ui/Chip';

const TONE: Record<VisserCall, ChipTone> = {
  Buy: 'buy',
  Hold: 'hold',
  Trim: 'caution',
  Sell: 'sell',
  Wait: 'watch',
};

export function VisserPanel({
  model,
  csrf,
}: {
  model: VisserPanelModel;
  csrf: string | null;
}) {
  return (
    <section id="visser-basket" className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4 sm:px-5" data-visser-status={model.status} data-visser-outcome={model.outcome}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-1)]">Visser basket</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">{model.lede}</p>
        </div>
        {csrf ? (
          <form method="POST" action="/api/regime/visser">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-bold text-[var(--accent-soft)]">
              Update basket
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-amber-100">{model.paperRule}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{model.frozen}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{model.cashYield}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-1)]">{model.record}</p>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-amber-100">{model.caveat}</p>
      {model.banner ? (
        <p role="status" className="mt-3 rounded-[var(--radius-lg)] border border-rose-300/50 bg-rose-500/15 px-3 py-3 text-sm leading-relaxed text-[var(--text-1)]" data-visser-banner="down">
          {model.banner}
        </p>
      ) : null}
      {model.shareNote ? <p className="mt-3 text-sm text-[var(--text-2)]">{model.shareNote}</p> : null}
      {model.summary ? <p className="mt-4 text-base font-semibold leading-relaxed text-[var(--text-1)]">{model.summary}</p> : null}
      {model.timing ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.timing}</p> : null}
      {model.cash ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.cash}</p> : null}
      {model.trades ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.trades}</p> : null}
      {model.skipped ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.skipped}</p> : null}
      {model.cards.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {model.cards.map((card) => (
            <article key={card.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-3 py-3" data-visser-sleeve={card.id} data-visser-call={card.call}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-1)]">
                    {card.label}
                    <span className="ml-2 font-mono text-xs font-normal text-[var(--text-3)]">{card.buy}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{card.sentence}</p>
                </div>
                <Chip tone={TONE[card.call]}>{card.call}</Chip>
              </div>
              <p className="mt-2 text-sm text-[var(--text-1)]">
                Target {card.weight} · {card.target}
                {card.held ? ` · held ${card.held}` : ''}
                <span className="text-[var(--text-3)]"> · signal {card.signal} · {card.bookShare}</span>
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {card.checks.map((check) => (
                  <li key={check.label}>
                    <CheckChip pass={check.pass} title={check.detail}>{check.label}</CheckChip>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{card.distance}</p>
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer text-xs text-[var(--text-3)]">Price detail</summary>
                <p className="text-xs leading-relaxed text-[var(--text-3)]">{card.detail}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-3)]">{card.checks.map((check) => check.detail).join(' ')}</p>
              </details>
            </article>
          ))}
        </div>
      ) : null}
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {model.stats.map((stat) => (
          <div key={stat.label} className="rounded-[var(--radius-lg)] border border-[var(--border)] px-3 py-2">
            <dt className="text-xs font-semibold text-[var(--text-3)]">{stat.label}</dt>
            <dd className="text-sm leading-relaxed text-[var(--text-1)]">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-3)]">{model.audHistory}</p>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--text-1)]">What you buy, and the rule</summary>
        <div className="grid gap-3 pb-2">
          {model.mapping.map((row) => (
            <div key={row.label}>
              <p className="text-sm font-semibold text-[var(--text-1)]">{row.label} · {row.weight}</p>
              <p className="text-sm leading-relaxed text-[var(--text-2)]">Buy {row.buy}. Signal {row.signal}.</p>
              <p className="text-sm leading-relaxed text-[var(--text-3)]">{row.why}</p>
            </div>
          ))}
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
            {model.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-[var(--text-3)]">Backtest VS1, weekly, 0.10% trading cost, idle money in 3-month US T-bills, no borrowing, before tax. This sleeve leaves idle money as Australian dollar cash, credits that cash at the rate above, and charges the same 0.10% when it trades. Tax and franking are not modelled.</p>
        </div>
      </details>
    </section>
  );
}
