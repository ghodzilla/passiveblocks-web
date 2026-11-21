import { DRUCK_BACKTEST } from '@/lib/regime/druck.config';
import type { DruckCall } from '@/lib/regime/druck';
import type { DruckPanelModel } from '@/lib/regime/druckPresent';
import { CheckChip, Chip, type ChipTone } from './ui/Chip';

const TONE: Record<DruckCall, ChipTone> = {
  Buy: 'buy',
  Add: 'buy',
  Hold: 'hold',
  Trim: 'caution',
  Sell: 'sell',
  Wait: 'watch',
};

export function DruckPanel({
  model,
  csrf,
}: {
  model: DruckPanelModel;
  csrf: string | null;
}) {
  return (
    <section id="druck-book" className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4 sm:px-5" data-druck-status={model.status} data-druck-outcome={model.outcome} data-druck-colour={model.colourId ?? 'none'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[var(--text-1)]">Druckenmiller</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">{model.lede}</p>
        </div>
        {csrf ? (
          <form method="POST" action="/api/regime/druck">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-bold text-[var(--accent-soft)]">
              Update
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
        <p role="status" className="mt-3 rounded-[var(--radius-lg)] border border-rose-300/50 bg-rose-500/15 px-3 py-3 text-sm leading-relaxed text-[var(--text-1)]" data-druck-banner="down">
          {model.banner}
        </p>
      ) : null}
      {model.colour ? <p className="mt-4 text-base font-semibold leading-relaxed text-[var(--text-1)]" data-druck-read>{model.colour}</p> : null}
      {model.checks.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {model.checks.map((check) => (
            <li key={check.label}>
              <CheckChip pass={check.pass} title={check.detail}>{check.label}</CheckChip>
            </li>
          ))}
        </ul>
      ) : null}
      {model.brake ? <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-100">{model.brake}</p> : null}
      {model.summary ? <p className="mt-3 text-base font-semibold leading-relaxed text-[var(--text-1)]" data-druck-summary>{model.summary}</p> : null}
      {model.aside ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.aside}</p> : null}
      {model.timing ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.timing}</p> : null}
      {model.cash ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.cash}</p> : null}
      {model.trades ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.trades}</p> : null}
      {model.skipped ? <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{model.skipped}</p> : null}
      {model.cards.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {model.cards.map((card) => (
            <article key={card.id} className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-3 py-3" data-druck-name={card.symbol} data-druck-call={card.call}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-1)]">
                    {card.name}
                    <span className="ml-2 font-mono text-xs font-normal text-[var(--text-3)]">{card.symbol}</span>
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-[var(--text-1)]">{card.sentence}</p>
                </div>
                <Chip tone={TONE[card.call]}>{card.call}</Chip>
              </div>
              <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-2)]">{card.thesis}</p>
              <p className="mt-1 text-sm text-[var(--text-1)]">
                Size {card.weight}
                {card.target !== '$0' ? ` · ${card.target}` : ''}
                {card.held ? ` · held ${card.held}` : ''}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {card.checks.map((check) => (
                  <li key={check.label}>
                    <CheckChip pass={check.pass} title={check.detail}>{check.label}</CheckChip>
                  </li>
                ))}
              </ul>
              <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-2)]">{card.price}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-3)]">{card.sellIf}{card.also ? ` ${card.also}` : ''}</p>
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
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--text-1)]">The list and the rules</summary>
        <div className="grid gap-3 pb-2">
          {model.mapping.map((row) => (
            <div key={row.symbol}>
              <p className="text-sm font-semibold text-[var(--text-1)]">{row.symbol} · {row.name} · open at {row.weight}</p>
              <p className="text-sm leading-relaxed text-[var(--text-3)]">{row.thesis}</p>
            </div>
          ))}
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
            {model.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-[var(--text-3)]">
            The copied-13F test bought the day after each filing, in US dollars, at 0.10% cost. About 4% of the weight was in names that were later delisted, and those were dropped. His own record used leverage, shorts, and other markets. This book does not. Tax and franking are not modelled.
            {` Top 5 copied: ${(DRUCK_BACKTEST.top5Cagr * 100).toFixed(1)}% a year, worst fall −${Math.abs(DRUCK_BACKTEST.top5Worst * 100).toFixed(0)}%, and ${(DRUCK_BACKTEST.top5EarlyCagr * 100).toFixed(1)}% a year from 2013 to 2022. Top 10 without Natera: ${(DRUCK_BACKTEST.top10ExNatera * 100).toFixed(1)}% a year. QQQ was ${(DRUCK_BACKTEST.qqqCagr * 100).toFixed(1)}% a year over the full span. SPY was ${(DRUCK_BACKTEST.spyCagr * 100).toFixed(1)}%.`}
          </p>
        </div>
      </details>
    </section>
  );
}
