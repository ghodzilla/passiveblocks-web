import Link from 'next/link';
import { liquidityCard, type LiquidityCell } from '@/lib/os-data';

function StatusPill({ status }: { status: LiquidityCell['status'] }) {
  if (status === 'INSUFFICIENT') {
    return <span className="os-pill os-pill--insufficient">INSUFFICIENT</span>;
  }
  return <span className="os-pill os-pill--core">Filled</span>;
}

function CellBlock({ cell }: { cell: LiquidityCell }) {
  return (
    <article className="border-b border-[var(--border)] px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            {cell.group}
          </p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">{cell.label}</h3>
        </div>
        <StatusPill status={cell.status} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{cell.headline}</p>
      {cell.detail ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{cell.detail}</p>
      ) : null}
      <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
        {[cell.as_of ? `as of ${cell.as_of}` : null, cell.publisher].filter(Boolean).join(' · ')}
        {cell.source_url ? (
          <>
            {cell.as_of || cell.publisher ? ' · ' : null}
            <a
              href={cell.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent-soft)] hover:underline"
            >
              {cell.source_url}
            </a>
          </>
        ) : null}
        {cell.tried ? ` · tried ${cell.tried}` : null}
      </p>
    </article>
  );
}

function NoteCopy({ text }: { text: string }) {
  const mark = 'does not ';
  const at = text.indexOf(mark);
  if (at < 0) return <>{text}</>;
  const before = text.slice(0, at + 'does '.length);
  const after = text.slice(at + mark.length);
  return (
    <>
      {before}
      <span className="font-semibold">not</span> {after}
    </>
  );
}

function withStatus(
  cell: Omit<LiquidityCell, 'status'>,
  status: LiquidityCell['status'],
): LiquidityCell {
  return { ...cell, status };
}

export function LiquidityCard({ variant = 'full' }: { variant?: 'full' | 'teaser' }) {
  const card = liquidityCard;
  const byId = new Map<string, LiquidityCell>();
  for (const cell of card.filled) byId.set(cell.id, withStatus(cell, 'FILLED'));
  for (const cell of card.insufficient) byId.set(cell.id, withStatus(cell, 'INSUFFICIENT'));
  const teaser = card.teaser_ids
    .map((id) => byId.get(id))
    .filter((cell): cell is LiquidityCell => Boolean(cell));

  if (variant === 'teaser') {
    return (
      <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Flow prints · not a thesis
            </p>
            <h2 className="mt-1 text-sm font-bold tracking-tight text-foreground">
              Liquidity card · {card.as_of}
            </h2>
          </div>
          <Link
            href="/os/signal"
            className="text-[11px] font-medium text-[var(--accent-soft)] underline-offset-2 hover:underline"
          >
            Full card on Signal →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {teaser.map((cell) => (
            <article
              key={cell.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {cell.label}
                </p>
                <StatusPill status={cell.status} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground">{cell.headline}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          Tape does not adjudicate Howell. Not a second thesis. Paper HOLD stays copy, not a fill.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Prints · not a thesis
            </p>
            <h2 className="mt-1 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Liquidity card
            </h2>
          </div>
          <span className="os-stamp os-stamp--sense">Sense · not Act</span>
        </div>
        <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
          as of {card.as_of} ({card.timezone}) · compiled {card.compiled}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{card.preamble}</p>
      </div>

      <div className="border-b border-[var(--border)] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          Tradfi→crypto
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{card.tradfi_to_crypto.headline}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          BTC Farside {card.tradfi_to_crypto.btc.farside_window}, US$m:{' '}
          {card.tradfi_to_crypto.btc.farside_sessions_usdm}. Sum {card.tradfi_to_crypto.btc.farside_sum}.{' '}
          {card.tradfi_to_crypto.btc.farside_latest_complete}. Cumulative {card.tradfi_to_crypto.btc.farside_cumulative_usdm}{' '}
          US$m. {card.tradfi_to_crypto.btc.farside_cumulative_note}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          ETH Farside {card.tradfi_to_crypto.eth.farside_window}, US$m:{' '}
          {card.tradfi_to_crypto.eth.farside_sessions_usdm}. Sum {card.tradfi_to_crypto.eth.farside_sum}{' '}
          {card.tradfi_to_crypto.eth.farside_sum_unit}. {card.tradfi_to_crypto.eth.farside_latest_complete}.
          Cumulative {card.tradfi_to_crypto.eth.farside_cumulative_usdm} US$m.{' '}
          {card.tradfi_to_crypto.eth.farside_cumulative_note} {card.tradfi_to_crypto.eth.sosovalue_mismatch_note}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          SoSoValue 8 Sep BTC {card.tradfi_to_crypto.btc.sosovalue_display} ({card.tradfi_to_crypto.btc.sosovalue_exact}
          ; cumulative {card.tradfi_to_crypto.btc.sosovalue_cumulative}; net assets{' '}
          {card.tradfi_to_crypto.btc.sosovalue_net_assets}) / ETH {card.tradfi_to_crypto.eth.sosovalue_display} (
          {card.tradfi_to_crypto.eth.sosovalue_exact}; cumulative {card.tradfi_to_crypto.eth.sosovalue_cumulative}).
        </p>
        <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
          <a
            href={card.tradfi_to_crypto.btc.farside_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-soft)] hover:underline"
          >
            {card.tradfi_to_crypto.btc.farside_publisher} BTC
          </a>
          {' · '}
          <a
            href={card.tradfi_to_crypto.eth.farside_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-soft)] hover:underline"
          >
            ETH
          </a>
          {' · '}
          <a
            href={card.tradfi_to_crypto.btc.sosovalue_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-soft)] hover:underline"
          >
            {card.tradfi_to_crypto.btc.sosovalue_publisher} BTC
          </a>
          {' · '}
          <a
            href={card.tradfi_to_crypto.eth.sosovalue_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-soft)] hover:underline"
          >
            ETH
          </a>
        </p>
      </div>

      <div className="border-b border-[var(--border)] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          Stablecoins
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{card.stablecoins.headline}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          Level {card.stablecoins.level_exact} ({card.stablecoins.level_display}) on {card.stablecoins.as_of}.
          1-day vs {card.stablecoins.change_1d_vs}: {card.stablecoins.change_1d_exact} ({card.stablecoins.change_1d_display}).
          7-day vs {card.stablecoins.change_7d_vs}: {card.stablecoins.change_7d_exact} ({card.stablecoins.change_7d_display}).
          30-day vs {card.stablecoins.change_30d_vs}: {card.stablecoins.change_30d_exact} ({card.stablecoins.change_30d_display}).
          Field <span className="font-mono">{card.stablecoins.field}</span>. {card.stablecoins.field_note}
        </p>
        <p className="mt-2 font-mono text-[11px]">
          <a
            href={card.stablecoins.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-soft)] hover:underline"
          >
            {card.stablecoins.source_url}
          </a>
          {' · '}
          {card.stablecoins.publisher}
        </p>
      </div>

      <div className="border-b border-[var(--border)] bg-[var(--status-warn)]/5 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--status-warn)]">Note</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground"><NoteCopy text={card.visible_note} /></p>
      </div>

      <div>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Filled prints
          </h3>
        </div>
        {card.filled.map((cell) => (
          <CellBlock key={cell.id} cell={{ ...cell, status: 'FILLED' }} />
        ))}
      </div>

      <div>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            INSUFFICIENT
          </h3>
        </div>
        {card.insufficient.map((cell) => (
          <CellBlock key={cell.id} cell={{ ...cell, status: 'INSUFFICIENT' }} />
        ))}
      </div>

      <div className="border-t border-[var(--border)] px-5 py-4">
        <p className="text-xs leading-relaxed text-[var(--muted)]">{card.absent}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Paper HOLD stays copy, not a new fill. This card does not rescore either side of the split.
        </p>
      </div>
    </section>
  );
}
