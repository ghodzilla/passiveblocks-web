import { JetBrains_Mono } from 'next/font/google';
import { cockpitView } from '@/lib/hyperliquid/cockpit';
import type { DecisionIcon } from '@/lib/hyperliquid/cockpit';
import type { DeskSnapshot } from '@/lib/hyperliquid/types';

const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap' });

const CLIP = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';

export function Cockpit({ desk, now = new Date() }: { desk: DeskSnapshot; now?: Date }) {
  const view = cockpitView(desk, now);
  const pnlColor = view.pnl.up ? '#d6ff6a' : '#ff8b98';
  return (
    <section aria-label="Hyperliquid desk" className="space-y-3">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-[0.18em] text-white sm:text-3xl sm:tracking-[0.28em]">
            HYPERLIQUID DESK
          </h1>
          <p className="mt-1 text-xs tracking-wide text-[#d5e2ee]">
            SIMULATION · {view.engine.updated} · {view.engine.clock}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="cyan">PAPER</Chip>
          <Chip tone="coral">NOT VALIDATED</Chip>
          <Chip tone={view.engine.state === 'online' ? 'lime' : view.engine.state === 'stale' ? 'amber' : 'coral'}>
            {view.engine.label}
          </Chip>
        </div>
      </header>

      {desk.banner ? (
        <p className="rounded-md border border-[#ff8b98]/55 bg-[#3a1820] px-3 py-2 text-sm font-semibold text-[#ffe7c2]">
          {desk.banner}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1.25fr)_minmax(0,1fr)_minmax(240px,0.95fr)]">
        <div
          className="order-1 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          style={{ filter: `drop-shadow(0 0 16px ${view.pnl.up ? 'rgba(190,255,70,0.18)' : 'rgba(255,90,110,0.18)'})` }}
        >
          <Dial text={view.pnl.text} pct={view.pnl.pct} hint={view.pnl.hint} color={pnlColor} />
        </div>

        <div className="order-2 grid grid-cols-2 gap-3 lg:contents">
          {view.meters.map((meter, index) => (
            <article
              key={meter.key}
              title={meter.hint}
              className={`hl-panel p-3 ${index < 2 ? 'lg:col-start-1' : 'lg:col-start-3'} ${index % 2 === 0 ? 'lg:row-start-1' : 'lg:row-start-2'}`}
              style={{ clipPath: CLIP }}
            >
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#d5e2ee]">{meter.label}</p>
              <p className={`${mono.className} mt-2 text-2xl font-semibold text-white`}>
                {meter.value}
                <span className="text-sm font-medium text-[#9fb3c7]"> / {meter.cap}</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1c2836]" role="presentation">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(meter.ratio * 100)}%`,
                    background: meter.ratio > 0.8 ? '#ff8b98' : '#7ef0ff',
                  }}
                />
              </div>
            </article>
          ))}
        </div>

        <div className="order-3 lg:col-span-3 lg:col-start-1 lg:row-start-3">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-[#d5e2ee]">MARKETS IT IS WATCHING</h2>
            <span className="h-1.5 w-1.5 rounded-full bg-[#7ef0ff]" aria-hidden />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {view.markets.map((market) => (
              <article key={market.symbol} title={market.hint} className="hl-panel p-3" style={{ clipPath: CLIP }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Coin symbol={market.symbol} />
                    <div>
                      <p className="text-sm font-semibold text-white">{market.symbol}</p>
                      <p className="text-xs text-[#d5e2ee]">{market.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`${mono.className} text-lg font-semibold text-white`}>{market.price ?? '—'}</p>
                    <p className={`${mono.className} text-xs text-[#9fb3c7]`} title="A 24 hour change is not stored.">
                      {market.change ?? '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-[#9fb3c7]">No tape stored</p>
                <p className={`mt-2 text-sm font-medium ${market.status.startsWith('In trade') ? 'text-[#d6ff6a]' : market.status === 'Skipped' ? 'text-[#ffb4bc]' : 'text-[#9be7ff]'}`}>
                  {market.status}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="order-4 hl-panel p-3 lg:col-start-4 lg:row-span-3 lg:row-start-1" style={{ clipPath: CLIP }} aria-label="Latest decisions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-[0.16em] text-[#d6ff6a]">LATEST DECISIONS</h2>
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6ff6a]" aria-hidden />
          </div>
          {view.decisions.length === 0 ? (
            <p className="text-sm text-[#d5e2ee]">No decisions recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {view.decisions.map((row, index) => (
                <li key={`${row.text}-${index}`} className="flex items-start gap-2" title={row.hint}>
                  <DecisionMark icon={row.icon} />
                  <span className="text-sm leading-snug text-[#e7eef6]">{row.text}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <footer className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Desk health">
        {view.health.map((row) => (
          <div key={row.key} title={row.hint} className="hl-panel flex items-center gap-3 px-3 py-2.5" style={{ clipPath: CLIP }}>
            <HealthIcon kind={row.key} state={row.state} />
            <p className="text-xs font-semibold tracking-[0.14em] text-[#d5e2ee]">{row.label}</p>
            <p className={`ml-auto text-xs font-semibold tracking-[0.12em] ${row.state === 'HEALTHY' ? 'text-[#d6ff6a]' : row.state === 'DEGRADED' ? 'text-[#ffd089]' : 'text-[#ffb4bc]'}`}>
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${row.state === 'HEALTHY' ? 'bg-[#d6ff6a]' : row.state === 'DEGRADED' ? 'bg-[#ffd089]' : 'bg-[#ff8b98]'}`} aria-hidden />
              {row.state}
            </p>
          </div>
        ))}
      </footer>
    </section>
  );
}

function Chip({ tone, children }: { tone: 'cyan' | 'coral' | 'lime' | 'amber'; children: string }) {
  const styles = {
    cyan: 'border-[#7ef0ff]/70 text-[#bff8ff] shadow-[0_0_12px_rgba(126,240,255,0.25)]',
    coral: 'border-[#ff8b98]/80 text-[#ffd0d4] shadow-[0_0_12px_rgba(255,90,110,0.25)]',
    lime: 'border-[#d6ff6a]/70 text-[#e7ffb0] shadow-[0_0_12px_rgba(214,255,106,0.22)]',
    amber: 'border-[#ffd089]/80 text-[#ffe7c2] shadow-[0_0_12px_rgba(255,180,80,0.2)]',
  }[tone];
  const dot = { cyan: 'bg-[#7ef0ff]', coral: 'bg-[#ff8b98]', lime: 'bg-[#d6ff6a]', amber: 'bg-[#ffd089]' }[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border bg-[#0c141c]/80 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

function Dial({ text, pct, hint, color }: { text: string; pct: number; hint: string; color: string }) {
  const radius = 78;
  const circ = 2 * Math.PI * radius;
  const sweep = Math.max(0.16, Math.min(0.78, 0.16 + Math.abs(pct) / 0.04));
  return (
    <div className="hl-panel flex h-full items-center justify-center px-4 py-6" style={{ clipPath: CLIP }} title={hint}>
      <div className="relative h-56 w-56 sm:h-64 sm:w-64" role="img" aria-label={`Paper P&L ${text}. ${hint}`}>
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#1a2836" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circ * sweep} ${circ}`}
            transform="rotate(-90 100 100)"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#d5e2ee]">PAPER P&amp;L</p>
          <p className={`${mono.className} mt-1 text-4xl font-semibold`} style={{ color }}>{text}</p>
          <p className="mt-1 whitespace-nowrap text-[10px] font-semibold tracking-[0.12em] text-[#d5e2ee]">REALIZED + UNREALIZED</p>
        </div>
      </div>
    </div>
  );
}

function Coin({ symbol }: { symbol: 'BTC' | 'ETH' | 'SOL' }) {
  if (symbol === 'BTC') {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#f7931a" />
        <path d="M17.8 14.2c1.3-.4 2-1.2 1.8-2.4-.2-1.4-1.4-2-3.2-2.1V8h-1.6v1.6h-1.2V8h-1.6v1.7H10v1.6h1.1c.4 0 .6.2.6.5v8.3c0 .3-.2.5-.6.5H10V22h1.9v1.7h1.6V22h1.3v1.7h1.6V22c2.2-.2 3.6-1 3.8-2.7.2-1.4-.4-2.3-1.4-2.7.8-.4 1.3-1.1 1.2-2.4zM15 12.2h1.5c.8 0 1.3.3 1.3 1s-.5 1.1-1.4 1.1H15v-2.1zm1.8 6.2H15v-2.2h1.9c.9 0 1.5.4 1.5 1.1s-.6 1.1-1.6 1.1z" fill="#fff" />
      </svg>
    );
  }
  if (symbol === 'ETH') {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#627eea" />
        <path d="M16 6l6.2 10.1L16 13.8 9.8 16.1 16 6z" fill="#fff" fillOpacity="0.95" />
        <path d="M16 26l6.2-8.7L16 20.2l-6.2-2.9L16 26z" fill="#fff" fillOpacity="0.75" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#14f195" />
      <path d="M9 20.5c2.2-4.2 4.6-8.2 7.2-8.2 1.6 0 2.2 1.2 3.2 2.6 1 1.5 2 2.9 3.6 2.9" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 14.5c2.2-1.2 4.2-1.6 6.2-.4 1.4.8 2.2 2 3.4 2s2-.8 4.4-2.4" fill="none" stroke="#5b4dff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DecisionMark({ icon }: { icon: DecisionIcon }) {
  const color = icon === 'warn' ? '#ff8b98' : icon === 'check' || icon === 'up' ? '#d6ff6a' : '#9be7ff';
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
      {icon === 'clock' ? <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="1.4" /> : null}
      {icon === 'clock' ? <path d="M8 5v3.2L10 10" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" /> : null}
      {icon === 'up' ? <path d="M8 12V4M5 7l3-3 3 3" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {icon === 'warn' ? <path d="M8 2.8l5.2 9.2H2.8L8 2.8z" fill="none" stroke={color} strokeWidth="1.3" /> : null}
      {icon === 'warn' ? <path d="M8 6.2v2.6M8 10.4v.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" /> : null}
      {icon === 'check' ? <path d="M3.5 8.2l3 3 6-6.2" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

function HealthIcon({ kind, state }: { kind: 'feed' | 'database' | 'alerts'; state: 'HEALTHY' | 'DEGRADED' | 'DOWN' }) {
  const color = state === 'HEALTHY' ? '#d6ff6a' : state === 'DEGRADED' ? '#ffd089' : '#ffb4bc';
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" style={{ color }} aria-hidden>
      {kind === 'feed' ? <path d="M2 10h2l2-4 3 8 2-4h7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {kind === 'database' ? <><ellipse cx="10" cy="5" rx="6" ry="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M4 5v10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5" fill="none" stroke="currentColor" strokeWidth="1.3" /></> : null}
      {kind === 'alerts' ? <path d="M10 3.2a4 4 0 00-4 4v2.2L4.5 12h11L14 9.4V7.2a4 4 0 00-4-4zM8.2 14.2a1.8 1.8 0 003.6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /> : null}
    </svg>
  );
}
