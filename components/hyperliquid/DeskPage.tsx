import Image from 'next/image';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { Chip, CheckChip } from '@/components/regime/ui/Chip';
import type { ChipTone } from '@/components/regime/ui/Chip';
import type { DeskSnapshot } from '@/lib/hyperliquid/types';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const CARD = 'rounded-2xl border border-white/10 bg-[#10192b]/90 shadow-[0_18px_50px_rgba(0,0,0,0.28)]';

const STRATEGY: Record<string, string> = {
  tsmom_4h: 'Trend following on the 4-hour chart',
  utc_range_break: 'Break of the overnight range',
  btc_hold_1x: 'Baseline that just holds bitcoin',
  random_entry: 'Baseline that enters at random',
};

const SKIP: Record<string, string> = {
  bad_book: 'The book was too wide or too thin.',
  max_positions: 'Three positions were already open.',
  verify_expired: 'The gate asked for more proof and the window ran out.',
  baseline: 'A baseline is kept for comparison and is not taken.',
  cluster_risk: 'That cluster was already at its risk cap.',
  non_positive_edge: 'The planned edge was not positive.',
  session: 'The market was outside its trading session.',
};

const CLASS_LABEL: Record<string, string> = {
  crypto: 'Crypto',
  us_equity: 'Stocks',
  metals: 'Metals',
  energy: 'Energy',
};

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function dollars(value: number, digits = 2) {
  return `$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function share(value: number, digits = 0) {
  return `${(Math.abs(value) * 100).toFixed(digits)}%`;
}

function money(value: number, digits = 2) {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (value < 0) return `−$${abs}`;
  if (value > 0) return `+$${abs}`;
  return `$${abs}`;
}

function pct(value: number, digits = 1) {
  const shown = (value * 100).toFixed(digits);
  return value > 0 ? `+${shown}%` : `${shown}%`;
}

function px(value: number) {
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (value >= 20) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function rMultiple(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}R`;
}

function stamp(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hourCycle: 'h23',
  }).format(date) + ' UTC';
}

function toneFor(value: string | null | undefined): ChipTone {
  if (value === 'accept' || value === 'closed_as_planned' || value === 'trade') return 'buy';
  if (value === 'verify_more' || value === 'shadow') return 'watch';
  if (value === 'reject' || value === 'mismatch' || value === 'skip') return 'sell';
  if (value === 'hold') return 'hold';
  return 'off';
}

function Section({
  index,
  title,
  lede,
  children,
}: {
  index: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-[#8ea0b8]">{index}</span>
        <h2 className="text-lg font-semibold tracking-tight text-[#f4f7fb]">{title}</h2>
      </div>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#c5d0e0]">{lede}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Meter({
  label,
  used,
  cap,
  usedText,
  capText,
  help,
}: {
  label: string;
  used: number;
  cap: number;
  usedText: string;
  capText: string;
  help: string;
}) {
  const ratio = cap > 0 ? Math.max(0, used) / cap : 0;
  const width = Math.max(0, Math.min(1, ratio)) * 320;
  const fill = ratio >= 0.9 ? '#fb7185' : ratio >= 0.7 ? '#fbbf24' : '#34d399';
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1424] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-[#f4f7fb]">{label}</p>
        <p className="font-mono text-xs tabular-nums text-[#f4f7fb]">
          {usedText}
          <span className="text-[#8ea0b8]"> / {capText}</span>
        </p>
      </div>
      <svg viewBox="0 0 320 18" className="mt-2 w-full" role="img" aria-label={`${label}: ${usedText} of ${capText}`}>
        <rect x="0" y="5" width="320" height="8" rx="4" fill="#2a2c38" />
        <rect x="0" y="5" width={width} height="8" rx="4" fill={fill} />
        <line x1="320" x2="320" y1="2" y2="16" stroke="#f4f7fb" strokeWidth="1.5" />
      </svg>
      <p className="mt-2 text-xs leading-relaxed text-[#c5d0e0]">{help}</p>
    </div>
  );
}

function EquityChart({ desk }: { desk: DeskSnapshot }) {
  const series = [
    { name: 'Simulation', colour: '#60a5fa', points: desk.equity_curve },
    { name: 'Baselines', colour: '#94a3b8', points: desk.baseline_curve },
  ];
  const values = series.flatMap((item) => item.points.map((point) => point.equity));
  const low = Math.min(980, ...values);
  const high = Math.max(1010, ...values);
  const span = high - low || 1;
  const pathFor = (points: { equity: number }[]) =>
    points
      .map((point, index) => {
        const x = points.length === 1 ? 20 : 20 + (index / (points.length - 1)) * 600;
        const y = 180 - ((point.equity - low) / span) * 150;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  const baselineFlat = desk.baseline_curve.every((point) => point.equity === desk.baseline_curve[0]?.equity);
  return (
    <div>
      <svg viewBox="0 0 640 210" className="w-full" role="img" aria-label="Shadow equity against the baselines">
        <line x1="20" x2="620" y1="180" y2="180" stroke="rgba(255,255,255,0.12)" />
        <text x="20" y="198" fill="#8ea0b8" fontSize="11">
          Start {dollars(desk.pnl.start_usdc, 0)}
        </text>
        <text x="430" y="198" fill="#8ea0b8" fontSize="11">
          Now {dollars(desk.pnl.shadow_equity_usdc)}
        </text>
        {series.map((item) => (
          <path key={item.name} d={pathFor(item.points)} fill="none" stroke={item.colour} strokeWidth="2.5" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#c5d0e0]">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-[#60a5fa]" /> Simulation</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-[#94a3b8]" /> Baselines</span>
      </div>
      {baselineFlat ? (
        <p className="mt-2 text-sm text-[#c5d0e0]">
          The hold-bitcoin and random-entry baselines did not close a trade, so their line stays at the starting 1,000.
        </p>
      ) : null}
    </div>
  );
}

function League({ desk }: { desk: DeskSnapshot }) {
  const classes = ['crypto', 'us_equity', 'metals', 'energy'];
  return (
    <div className="space-y-4">
      {classes.map((asset) => {
        const rows = desk.strategies.filter((row) => row.asset_class === asset);
        return (
          <div key={asset}>
            <h3 className="text-sm font-semibold text-[#f4f7fb]">{CLASS_LABEL[asset] ?? asset}</h3>
            {rows.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-white/15 px-4 py-4 text-sm text-[#c5d0e0]">
                No {CLASS_LABEL[asset]?.toLowerCase() ?? asset} strategy is in this recording.
              </p>
            ) : (
              <>
                <div className="mt-2 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-[#8ea0b8]">
                      <tr>
                        {['Strategy', 'Status', 'Weight', 'n', 'Mean R', 'Shrunk edge', 'LCB', 'Calibration', 'Win rate', 'P&L'].map((heading) => (
                          <th key={heading} className="px-2 py-2 font-medium">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.name} className="border-t border-white/10">
                          <td className="px-2 py-3">
                            <p className="font-medium text-[#f4f7fb]">{row.name}</p>
                            <p className="text-xs text-[#c5d0e0]">{STRATEGY[row.name] ?? 'A recorded strategy.'}</p>
                          </td>
                          <td className="px-2 py-3"><Chip tone={toneFor(row.status)}>{row.status}</Chip></td>
                          <td className="px-2 py-3 font-mono tabular-nums">{row.weight.toFixed(2)}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{row.n}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{rMultiple(row.mean_r)}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{rMultiple(row.shrunk_edge)}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{rMultiple(row.lcb)}</td>
                          <td className="px-2 py-3 text-[#c5d0e0]">{row.calibration_slope == null ? 'Not enough trades' : row.calibration_slope.toFixed(2)}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{row.win_rate == null ? '—' : share(row.win_rate)}</td>
                          <td className="px-2 py-3 font-mono tabular-nums">{money(row.pnl_usdc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-2 space-y-2 md:hidden">
                  {rows.map((row) => (
                    <li key={row.name} className="rounded-xl border border-white/10 bg-[#0c1424] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-[#c5d0e0]">{STRATEGY[row.name]}</p>
                        </div>
                        <Chip tone={toneFor(row.status)}>{row.status}</Chip>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <Fact k="Closed trades" v={String(row.n)} />
                        <Fact k="Mean R" v={rMultiple(row.mean_r)} />
                        <Fact k="Shrunk edge" v={rMultiple(row.shrunk_edge)} />
                        <Fact k="LCB" v={rMultiple(row.lcb)} />
                        <Fact k="Win rate" v={row.win_rate == null ? '—' : share(row.win_rate)} />
                        <Fact k="P&L" v={money(row.pnl_usdc)} />
                      </dl>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-[#8ea0b8]">
        Shrunk edge pulls a small sample toward zero. LCB is that edge minus a cushion for noise. Under 30 closed trades, the rank stays shadow even if the lower bound is positive. P&amp;L is estimated from the recorded result and the fee.
      </p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[#8ea0b8]">{k}</dt>
      <dd className="font-mono tabular-nums text-[#f4f7fb]">{v}</dd>
    </div>
  );
}

export function DeskPage({ desk }: { desk: DeskSnapshot }) {
  const risk = desk.health.open_risk;
  const limits = desk.health.limits;
  const taken = desk.positions.filter((row) => row.counts_toward_limits);
  const research = desk.positions.filter((row) => !row.counts_toward_limits);
  const lossUsed = Math.max(0, -risk.daily_pnl_pct);
  const classes = ['crypto', 'us_equity', 'metals', 'energy'];

  return (
    <div className={`${inter.className} relative min-h-screen overflow-x-hidden bg-[#070d18] text-[#f4f7fb]`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 8% -10%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(ellipse 42% 36% at 100% 0%, rgba(251,113,133,0.10), transparent 50%)',
        }}
      />
      <header className="relative border-b border-white/10 bg-[#070d18]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <Link href="/" className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d399]">
              <Image src="/passiveblocks_logo_cropped.png" alt="PassiveBlocks" width={168} height={40} className="h-9 w-auto mix-blend-screen" priority />
            </Link>
            <p className="min-w-0 text-sm leading-snug text-[#d5deea]">Hyperliquid desk</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/private/regime" className="rounded-full border border-white/15 bg-[#0c1424] px-3 py-1.5 text-xs font-semibold text-[#f4f7fb] hover:bg-white/10">
              Regime book
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0c1424] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#f4f7fb]">
              <LockIcon />
              Simulation only · NOT VALIDATED
            </span>
            <form method="POST" action="/api/regime/logout">
              <button type="submit" className="px-2 py-1.5 text-xs text-[#c5d0e0] hover:text-[#f4f7fb]">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1440px] space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap gap-2">
            <Chip tone="watch">SIMULATION</Chip>
            <Chip tone="sell">NOT VALIDATED</Chip>
            <Chip tone="hold">Recorded replay</Chip>
          </div>
          <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            {desk.headline}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#c5d0e0]">
            {desk.source} Captured {desk.as_of_sydney ?? 'at an unknown time'}. {desk.pnl.note}
          </p>
        </div>

        <Section
          index="01"
          title="Status"
          lede="Where the recording sits. A live desk would show a heartbeat from the server. This one is the snapshot itself."
        >
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem label="Mode" value="SIMULATION" note="No order has been sent." />
            <StatusItem label="Heartbeat" value="At the capture" note="There is no live pulse to age." />
            <StatusItem
              label="Halt and drain"
              value={desk.status.halt || desk.status.drain ? 'On' : 'Off'}
              note={desk.status.pause_new_entries ? 'New entries are paused.' : 'New entries are not paused.'}
            />
            <StatusItem
              label="Data freshness"
              value={desk.status.fresh ? 'Fresh' : 'Stale'}
              note={desk.status.fresh ? 'The recorded book was inside the 5 second limit.' : 'The book was too old for a new entry.'}
            />
            <StatusItem label="Engine" value={String(desk.status.version)} note={String(desk.status.network)} />
            <StatusItem
              label="Window"
              value={`Day ${desk.status.window_day} of ${desk.status.window_days}`}
              note="A go-live call waits for the full window."
            />
          </dl>
          <ul className="mt-4 space-y-2">
            {desk.notices.map((notice) => (
              <li key={notice} className="rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-sm text-[#f4f7fb]">
                {notice}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          index="02"
          title="Risk"
          lede="These bars count the two taken shadow trades, not the research walks. A bar that fills toward the tick is getting close to a hard limit."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Meter
              label="Leverage"
              used={risk.gross_leverage}
              cap={limits.max_leverage}
              usedText={`${risk.gross_leverage.toFixed(2)}x`}
              capText={`${limits.max_leverage.toFixed(1)}x`}
              help="Gross size of the taken trades divided by paper equity. Over 2.0x is refused."
            />
            <Meter
              label="Today's P&L"
              used={lossUsed}
              cap={limits.daily_loss_stop}
              usedText={pct(risk.daily_pnl_pct)}
              capText={pct(-limits.daily_loss_stop, 0)}
              help="A loss of 2% on the day blocks new entries until the next UTC day."
            />
            <Meter
              label="Drawdown"
              used={desk.health.drawdown}
              cap={limits.drawdown_kill}
              usedText={pct(-desk.health.drawdown)}
              capText={pct(-limits.drawdown_kill, 0)}
              help="A 10% drop from the peak stays on until a person restarts it."
            />
            <Meter
              label="Positions"
              used={risk.positions}
              cap={limits.max_positions}
              usedText={String(risk.positions)}
              capText={String(limits.max_positions)}
              help="Taken trades only. A fourth is refused."
            />
            {classes.map((name) => (
              <Meter
                key={name}
                label={`${CLASS_LABEL[name]} risk`}
                used={risk.cluster_risk[name] ?? 0}
                cap={limits.cluster_risk_cap}
                usedText={share(risk.cluster_risk[name] ?? 0, 2)}
                capText={share(limits.cluster_risk_cap, 1)}
                help="Risk at the stop for this group of markets. The cap is 1.5%."
              />
            ))}
            <Meter
              label="Total risk"
              used={risk.total_risk}
              cap={limits.total_risk_cap}
              usedText={share(risk.total_risk, 2)}
              capText={share(limits.total_risk_cap, 1)}
              help="Risk at the stops across every taken trade. The cap is 2.0%."
            />
          </div>
        </Section>

        <Section
          index="03"
          title="Equity"
          lede="Paper equity, starting at 1,000 USDC. The line is rebuilt from closed research walks and ends on the recorded total."
        >
          <EquityChart desk={desk} />
        </Section>

        <Section
          index="04"
          title="Strategy league"
          lede="How each strategy looks after this short recording. Shadow means it is not proven. A positive number here is not an edge."
        >
          <League desk={desk} />
        </Section>

        <Section
          index="05"
          title="Stocks and commodities"
          lede="Which markets this recording could have traded, and why the others did not."
        >
          <p className="text-sm text-[#c5d0e0]">{desk.whitelist.stocks_and_commodities.eligible_note}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {desk.whitelist.eligible.map((market) => (
              <li key={market} className="rounded-full border border-[#34d399]/40 bg-[#34d399]/10 px-3 py-1 text-xs font-semibold text-[#34d399]">
                {market}
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[#d5deea]">
            <li className="rounded-xl bg-[#0c1424] px-3 py-2">{desk.whitelist.stocks_and_commodities.stocks}</li>
            <li className="rounded-xl bg-[#0c1424] px-3 py-2">{desk.whitelist.stocks_and_commodities.commodities}</li>
            <li className="rounded-xl bg-[#0c1424] px-3 py-2">{desk.whitelist.stocks_and_commodities.earnings}</li>
            <li className="rounded-xl bg-[#0c1424] px-3 py-2">{desk.whitelist.stocks_and_commodities.oil_roll}</li>
            <li className="rounded-xl bg-[#0c1424] px-3 py-2">{desk.whitelist.stocks_and_commodities.macro}</li>
          </ul>
        </Section>

        <Section
          index="06"
          title="Open positions"
          lede="A tick means the stop is written in the plan. It is not an order on an exchange."
        >
          {taken.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-[#c5d0e0]">No taken trade is open.</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {taken.map((row) => (
                <PositionCard key={`${row.book}-${row.market}-${row.strategy}`} row={row} />
              ))}
            </ul>
          )}
          <h3 className="mt-5 text-sm font-semibold">Research walks still open</h3>
          <p className="mt-1 text-sm text-[#c5d0e0]">These do not count toward the three-position cap. They exist so a skipped idea can be compared later.</p>
          {research.length === 0 ? (
            <p className="mt-3 text-sm text-[#c5d0e0]">None.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {research.map((row) => (
                <li key={`${row.book}-${row.market}-${row.strategy}-${row.entry}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <span className="font-medium">{row.market} {row.side}</span>
                  <span className="text-[#c5d0e0]"> · {STRATEGY[row.strategy] ?? row.strategy}</span>
                  <p className="mt-1 font-mono text-xs text-[#c5d0e0]">Entry {px(row.entry)} · stop {px(row.stop)} · funding {money(row.funding_usdc, 2)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          index="07"
          title="Signal log"
          lede="Every idea, the gate's verdict, and how sure it was. Confidence here is the gate's own number, not a promise."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#0c1424] p-3">
              <p className="text-xs uppercase tracking-wide text-[#8ea0b8]">Gated, closed</p>
              <p className="mt-1 font-mono text-xl">{rMultiple(desk.pnl.gated_mean_r)}</p>
              <p className="text-xs text-[#c5d0e0]">Mean result of taken trades that have closed. None have closed yet.</p>
            </div>
            <div className="rounded-xl bg-[#0c1424] p-3">
              <p className="text-xs uppercase tracking-wide text-[#8ea0b8]">Ungated, closed</p>
              <p className="mt-1 font-mono text-xl">{rMultiple(desk.pnl.ungated_mean_r)}</p>
              <p className="text-xs text-[#c5d0e0]">Mean result if the gate had not blocked the research walks.</p>
            </div>
          </div>
          <h3 className="mt-4 text-sm font-semibold">Skipped trades, by reason</h3>
          {desk.skip_pnl.length === 0 ? (
            <p className="mt-2 text-sm text-[#c5d0e0]">No skipped idea has a closed result yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {desk.skip_pnl.map((row) => (
                <li key={row.reason} className="rounded-xl border border-white/10 px-3 py-2">
                  <p className="text-sm font-medium">{row.reason.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-[#c5d0e0]">{SKIP[row.reason] ?? 'The engine skipped this one.'}</p>
                  <p className="mt-1 font-mono text-sm">{row.n} closed · {rMultiple(row.mean_r)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#8ea0b8]">
                <tr>
                  {['When', 'Strategy', 'Market', 'Side', 'Gate', 'Confidence', 'What happened'].map((heading) => (
                    <th key={heading} className="px-2 py-2 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {desk.signals.map((row) => (
                  <tr key={`${row.at}-${row.strategy}-${row.market}-${row.side}`} className="border-t border-white/10">
                    <td className="px-2 py-2 text-xs text-[#c5d0e0]">{stamp(row.at)}</td>
                    <td className="px-2 py-2">{row.strategy}</td>
                    <td className="px-2 py-2">{row.market}</td>
                    <td className="px-2 py-2 capitalize">{row.side}</td>
                    <td className="px-2 py-2">{row.verdict ? <Chip tone={toneFor(row.verdict)}>{row.verdict}</Chip> : '—'}</td>
                    <td className="px-2 py-2 font-mono">{row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}%`}</td>
                    <td className="px-2 py-2 text-[#c5d0e0]">{row.decision === 'trade' ? 'Taken into the shadow book' : (SKIP[row.skip_reason ?? ''] ?? row.skip_reason ?? 'Skipped')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-2 md:hidden">
            {desk.signals.map((row) => (
              <li key={`${row.at}-${row.strategy}-${row.market}-${row.side}`} className="rounded-xl border border-white/10 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{row.market} {row.side}</p>
                  {row.verdict ? <Chip tone={toneFor(row.verdict)}>{row.verdict}</Chip> : null}
                </div>
                <p className="mt-1 text-xs text-[#c5d0e0]">{stamp(row.at)} · {STRATEGY[row.strategy] ?? row.strategy}</p>
                <p className="mt-1 text-[#d5deea]">{row.decision === 'trade' ? 'Taken into the shadow book' : (SKIP[row.skip_reason ?? ''] ?? 'Skipped')}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          index="08"
          title="Plans and closes"
          lede="A taken trade is finished only when its fills line up with the entry, the stop, and the target. A gap stays open."
        >
          {desk.plans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-[#c5d0e0]">No plan was written.</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {desk.plans.map((plan) => (
                <li key={plan.id} className="rounded-xl border border-white/10 bg-[#0c1424] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{plan.market} {plan.side}</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.verdict ? <Chip tone={toneFor(plan.verdict)}>{plan.verdict}</Chip> : null}
                      {plan.outcome ? <Chip tone={toneFor(plan.outcome)}>{plan.outcome.replaceAll('_', ' ')}</Chip> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[#c5d0e0]">{STRATEGY[plan.strategy ?? ''] ?? plan.strategy}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {plan.legs.map((leg) => (
                      <li key={leg.role} className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                        <span className="capitalize">{leg.role}</span>
                        <span className="font-mono text-xs tabular-nums text-[#c5d0e0]">
                          plan {leg.plan_px == null ? '—' : px(leg.plan_px)}
                          {' · '}
                          fill {leg.fill_px == null ? 'none' : px(leg.fill_px)}
                        </span>
                        <Chip tone={leg.fill === 'present' ? 'buy' : 'watch'}>{leg.fill === 'present' ? 'filled' : 'missing'}</Chip>
                      </li>
                    ))}
                  </ul>
                  {plan.gaps.length > 0 ? (
                    <p className="mt-3 text-xs text-[#fbbf24]">Still open: {plan.gaps.join(', ').replaceAll('_', ' ')}.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          index="09"
          title="Calibration and desk health"
          lede="Calibration asks whether a predicted edge showed up. Desk health asks whether the machinery did what it claimed."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HealthStat label="Calibration slope" value="Not enough trades" note="A slope needs a week of closed results. None of these strategies have that." />
            <HealthStat label="Routing" value={share(desk.health.routing_accuracy, 1)} note="Share of ideas that received a gate verdict." />
            <HealthStat label="Signal escapes" value={String(desk.health.signal_escapes)} note="A take with no accept. The target is zero." />
            <HealthStat label="False closes" value={String(desk.health.false_closes)} note="A close marked done without the fills. The target is zero." />
            <HealthStat label="Stale-data blocks" value={String(desk.health.stale_blocks)} note="Times a stale book stopped new entries. This recording had a fresh book." />
            <HealthStat label="Interruptions" value={String(desk.health.unnecessary_interruptions)} note="Not classified yet, so this stays at zero." />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Mix title="Gate verdicts" mix={desk.health.gate_mix} hint="Accept, ask for more, or reject." />
            <Mix title="Closer outcomes" mix={desk.health.close_mix} hint="How the taken trades were judged." />
          </div>
        </Section>

        <Section
          index="10"
          title="Risk events"
          lede="What the engine wrote down. An outbox row stays on this machine until a later build is allowed to send it."
        >
          {desk.events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-[#c5d0e0]">No events in this recording.</p>
          ) : (
            <ul className="space-y-2">
              {desk.events.map((event) => (
                <li key={`${event.kind}-${event.at}-${event.text}`} className="rounded-xl border border-white/10 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={event.severity === 'WARN' || event.severity === 'CRITICAL' ? 'sell' : 'hold'}>{event.severity}</Chip>
                    <span className="text-xs text-[#8ea0b8]">{stamp(event.at)}</span>
                  </div>
                  <p className="mt-1 text-sm">{event.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          index="11"
          title="Go-live scorecard"
          lede="The checklist for offering real money after a full window. This recording has not started that window."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="sell">{desk.scorecard.verdict}</Chip>
            <p className="text-sm text-[#d5deea]">{desk.scorecard.plain}</p>
          </div>
          <ul className="mt-4 space-y-2">
            {desk.scorecard.items.map((item) => (
              <li key={item.name} className="flex flex-col gap-1 rounded-xl bg-[#0c1424] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <CheckChip pass={item.pass} title={item.detail}>{item.name}</CheckChip>
                <p className="text-sm text-[#c5d0e0]">{item.detail}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          index="12"
          title="Controls"
          lede={`The desk is at L${desk.autonomy.exercised} ${desk.autonomy.name}. The ceiling is L${desk.autonomy.cap}. A person has to confirm any promotion. It never happens by itself.`}
        >
          <p className="text-sm text-[#c5d0e0]">
            L1 can read and keep the shadow book. It cannot pause a market or send a trade. L4, which would change the leverage cap or move money, is not available from this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Pause new entries', 'Drain', 'Halt', 'Resume'].map((label) => (
              <button
                key={label}
                type="button"
                disabled
                aria-disabled="true"
                className="cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#8ea0b8] opacity-60"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-[#fbbf24]">These buttons stay off. They are enabled when the engine runs on the server.</p>
        </Section>
      </main>
    </div>
  );
}

function StatusItem({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-[#0c1424] px-3 py-3">
      <dt className="text-xs uppercase tracking-wide text-[#8ea0b8]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#f4f7fb]">{value}</dd>
      <dd className="mt-1 text-xs leading-relaxed text-[#c5d0e0]">{note}</dd>
    </div>
  );
}

function PositionCard({ row }: { row: DeskSnapshot['positions'][number] }) {
  return (
    <li className="rounded-xl border border-white/10 bg-[#0c1424] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.market} {row.side}</p>
          <p className="text-xs text-[#c5d0e0]">{STRATEGY[row.strategy] ?? row.strategy}</p>
        </div>
        {row.stop_in_plan ? <Chip tone="buy" title={row.stop_note}>Stop in the plan</Chip> : <Chip tone="sell">No stop</Chip>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Fact k="Entry" v={px(row.entry)} />
        <Fact k="Stop" v={px(row.stop)} />
        <Fact k="Target" v={px(row.target)} />
        <Fact k="Size" v={dollars(row.notional_usdc, 0)} />
        <Fact k="Funding so far" v={money(row.funding_usdc)} />
      </dl>
      <p className="mt-2 text-xs text-[#c5d0e0]">{row.stop_note}</p>
    </li>
  );
}

function HealthStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-[#0c1424] p-3">
      <p className="text-xs uppercase tracking-wide text-[#8ea0b8]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#c5d0e0]">{note}</p>
    </div>
  );
}

function Mix({ title, mix, hint }: { title: string; mix: Record<string, number>; hint: string }) {
  const entries = Object.entries(mix);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-[#c5d0e0]">{hint}</p>
      {entries.length === 0 ? <p className="mt-2 text-sm text-[#c5d0e0]">Nothing recorded.</p> : (
        <ul className="mt-3 space-y-2">
          {entries.map(([name, count]) => (
            <li key={name}>
              <div className="flex justify-between text-xs">
                <span>{name.replaceAll('_', ' ')}</span>
                <span className="font-mono">{count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[#2a2c38]">
                <div className="h-1.5 rounded-full bg-[#60a5fa]" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
