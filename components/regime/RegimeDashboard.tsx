import Image from 'next/image';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { CopyOrders } from '@/components/regime/CopyOrders';
import type { ChartPoint, ControlRoomModel, FilingCardModel, HoldingCard, ScorecardModel } from '@/lib/regime/controlRoom';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const CARD = 'rounded-2xl border border-white/10 bg-[#10192b]/90 shadow-[0_18px_50px_rgba(0,0,0,0.28)]';

const TONE = {
  coral: 'text-[#fb7185]',
  amber: 'text-[#fbbf24]',
  emerald: 'text-[#34d399]',
  muted: 'text-[#c5d0e0]',
} as const;

const READ = {
  green: { text: 'text-[#34d399]', stroke: '#34d399' },
  amber: { text: 'text-[#fbbf24]', stroke: '#fbbf24' },
  red: { text: 'text-[#fb7185]', stroke: '#fb7185' },
} as const;

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function WeightRing({ weight, label, colour }: { weight: number; label: string; colour: string }) {
  const radius = 34;
  const circ = 2 * Math.PI * radius;
  const shown = Math.max(0, Math.min(1, weight));
  return (
    <svg viewBox="0 0 92 92" className="mx-auto h-[92px] w-[92px]" role="img" aria-label={`${label} of the book`}>
      <circle cx="46" cy="46" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx="46"
        cy="46"
        r={radius}
        fill="none"
        stroke={colour}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circ * shown} ${circ * (1 - shown)}`}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="44" textAnchor="middle" fill="#f4f7fb" fontSize="16" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
      <text x="46" y="60" textAnchor="middle" fill="#c5d0e0" fontSize="10" fontFamily="Inter, system-ui, sans-serif">
        weight
      </text>
    </svg>
  );
}

function InvestedGauge({ weight, colour, label }: { weight: number; colour: ControlRoomModel['colour']; label: string }) {
  const pct = Math.max(0, Math.min(1, weight));
  const stroke = colour ? READ[colour].stroke : '#94a3b8';
  const text = colour ? READ[colour].text : 'text-[#f4f7fb]';
  const cx = 110;
  const cy = 104;
  const radius = 84;
  const left = cx - radius;
  const right = cx + radius;
  const end = Math.PI * (1 - pct);
  const ex = cx + radius * Math.cos(end);
  const ey = cy - radius * Math.sin(end);
  const track = `M ${left} ${cy} A ${radius} ${radius} 0 0 1 ${right} ${cy}`;
  const value = pct <= 0.001 ? '' : `M ${left} ${cy} A ${radius} ${radius} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  return (
    <div className="mx-auto w-[220px] shrink-0">
      <div className="relative">
        <svg viewBox="0 0 220 124" className="w-full" role="img" aria-label={`${label} invested`}>
          <path d={track} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="16" strokeLinecap="round" />
          {value ? <path d={value} fill="none" stroke={stroke} strokeWidth="16" strokeLinecap="round" /> : null}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 top-[52px] text-center">
          <p className={`text-3xl font-semibold tabular-nums leading-none ${text}`}>{label}</p>
          <p className="mt-1 text-xs text-[#c5d0e0]">invested</p>
        </div>
      </div>
      <div className="flex justify-between px-1 text-[11px] font-medium text-[#c5d0e0]">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function PriceScale({ card }: { card: HoldingCard }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {card.levels.map((level) => (
          <div key={level.key} title={level.title}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#c5d0e0]">{level.label}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${TONE[level.tone]}`}>{level.text}</p>
            <p className="mt-0.5 min-h-[2rem] text-[11px] leading-tight text-[#c5d0e0]">{level.caption}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-3">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fbbf24] ring-2 ring-[#10192b]"
          style={{ left: `${card.marker * 100}%` }}
          title={`Now ${card.priceLabel}`}
        />
      </div>
      <p className="mt-1 text-center text-xs text-[#d5deea]">
        Now {card.priceLabel} · {card.versus200}
      </p>
      {card.levelsNote ? <p className="mt-1 text-center text-xs leading-relaxed text-[#c5d0e0]">{card.levelsNote}</p> : null}
    </div>
  );
}

function linePath(values: (number | null)[], xAt: (index: number) => number, yAt: (value: number) => number): string | null {
  let path = '';
  values.forEach((value, index) => {
    if (value == null) return;
    path += `${path ? ' L' : 'M'} ${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`;
  });
  return path || null;
}

function ComparisonChart({ chart }: { chart: ControlRoomModel['chart'] }) {
  if (chart.empty || chart.points.length < 2) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-[#d5deea]">{chart.empty ?? 'First comparison appears after the first filled week'}</p>
      </div>
    );
  }
  const width = 640;
  const height = 196;
  const pad = { l: 44, r: 12, t: 16, b: 28 };
  const series = chart.points.flatMap((point) => [point.book, point.mix, point.qqq].filter((value): value is number => value != null));
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 0.01;
  const yAt = (value: number) => pad.t + (1 - (value - min) / span) * (height - pad.t - pad.b);
  const xAt = (index: number) => pad.l + (index / (chart.points.length - 1)) * (width - pad.l - pad.r);
  const ticks = [max, (max + min) / 2, min];
  const book = linePath(chart.points.map((point) => point.book), xAt, yAt);
  const mix = linePath(chart.points.map((point) => point.mix), xAt, yAt);
  const qqq = linePath(chart.points.map((point) => point.qqq), xAt, yAt);
  const mid = Math.floor((chart.points.length - 1) / 2);
  const last = chart.points.length - 1;
  const labelIndexes = [0, mid, last].filter((index, position, all) => all.indexOf(index) === position);
  return (
    <div>
      {chart.legend ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
          <li className="text-[#34d399]">{chart.legend.book}</li>
          <li className="text-[#fbbf24]">{chart.legend.mix}</li>
          <li className="text-[#d5deea]">{chart.legend.qqq}</li>
        </ul>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Book against 60/40 and QQQ since the first filled week">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke="rgba(255,255,255,0.08)" />
            <text x={pad.l - 6} y={yAt(tick) + 3} textAnchor="end" fill="#c5d0e0" fontSize="11" fontFamily="Inter, system-ui, sans-serif">
              {(tick * 100).toFixed(Math.abs(tick) >= 0.1 ? 0 : 1)}%
            </text>
          </g>
        ))}
        {qqq ? <path d={qqq} fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {mix ? <path d={mix} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {book ? <path d={book} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {labelIndexes.map((index) => (
          <text key={chart.points[index].date} x={xAt(index)} y={height - 8} textAnchor="middle" fill="#c5d0e0" fontSize="11" fontFamily="Inter, system-ui, sans-serif">
            {chart.points[index].label}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Change since the first filled week</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Book</th>
            <th>60/40</th>
            <th>QQQ</th>
          </tr>
        </thead>
        <tbody>
          {chart.points.map((point: ChartPoint) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.book == null ? '—' : `${(point.book * 100).toFixed(2)}%`}</td>
              <td>{point.mix == null ? '—' : `${(point.mix * 100).toFixed(2)}%`}</td>
              <td>{point.qqq == null ? '—' : `${(point.qqq * 100).toFixed(2)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scorecard({ card }: { card: ScorecardModel }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`} id="druck-scorecard" data-druck-scorecard={card.empty ? 'empty' : 'ready'} aria-label={card.title}>
      <h2 className="text-sm font-semibold">{card.title}</h2>
      {card.empty ? (
        <p className="mt-2 text-sm leading-relaxed text-[#d5deea]">{card.empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {card.rows.map((row) => (
            <li key={`${row.action}-${row.horizon}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-sm font-semibold">{row.action} · {row.horizon}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#d5deea]">Hit rate {row.hitRate}. Extra vs SPY {row.extraSpy}. Vs AAA {row.extraAaa}.</p>
              {row.caution ? <p className="mt-1 text-xs text-[#fde68a]">{row.caution}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-[#c5d0e0]">{card.footnote}</p>
    </section>
  );
}

function Filings({ card }: { card: FilingCardModel }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`} id="druck-13f" data-druck-13f={card.lines.length > 0 ? 'ready' : 'empty'} aria-label={card.title}>
      <h2 className="text-sm font-semibold">{card.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#d5deea]">{card.headline}</p>
      {card.flags.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {card.flags.map((flag) => (
            <li key={flag} className="rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-2 text-sm leading-relaxed text-[#fffbeb]" data-druck-13f-flag>
              {flag}
            </li>
          ))}
        </ul>
      ) : null}
      {card.lines.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm leading-relaxed text-[#d5deea]">
          {card.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {card.suggestions.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm leading-relaxed text-[#f4f7fb]">
          {card.suggestions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-[#c5d0e0]">{card.footnote}</p>
    </section>
  );
}

function EarningsBlock({ card }: { card: HoldingCard }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-[#d5deea]" data-earnings={card.symbol}>
      {card.earnings.flag ? (
        <p className="mb-1 font-semibold text-[#fbbf24]" data-earnings-flag>{card.earnings.flag}</p>
      ) : null}
      <p>{card.earnings.next}</p>
      <p className="mt-1">{card.earnings.eps}</p>
      <p className="mt-1">{card.earnings.revenue}</p>
      <p className="mt-1">{card.earnings.revision}</p>
    </div>
  );
}

function actionClass(tone: HoldingCard['actionTone']): string {
  if (tone === 'buy') return 'text-[#34d399]';
  if (tone === 'trim') return 'text-[#fbbf24]';
  if (tone === 'sell') return 'text-[#fb7185]';
  if (tone === 'wait') return 'text-[#fbbf24]';
  return 'text-[#f4f7fb]';
}

function dotClass(tone: HoldingCard['actionTone']): string {
  if (tone === 'buy') return 'bg-[#34d399]';
  if (tone === 'sell') return 'bg-[#fb7185]';
  if (tone === 'trim' || tone === 'wait') return 'bg-[#fbbf24]';
  return 'bg-[#93c5fd]';
}

export function RegimeDashboard({
  room,
  csrf,
  retired,
}: {
  room: ControlRoomModel;
  csrf: string | null;
  retired: string[];
}) {
  const read = room.colour ? READ[room.colour] : null;
  const freshClass = room.freshTone === 'fresh'
    ? 'text-[#34d399]'
    : room.freshTone === 'down'
      ? 'text-[#fb7185]'
      : 'text-[#fbbf24]';

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
            <p className="min-w-0 text-sm leading-snug text-[#d5deea]">Druckenmiller-style paper portfolio</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0c1424] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#f4f7fb]">
              <LockIcon />
              Paper only · NOT VALIDATED
            </span>
            {csrf ? (
              <form method="POST" action="/api/regime/druck">
                <input type="hidden" name="csrf" value={csrf} />
                <button
                  type="submit"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f4f7fb] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d399]"
                >
                  Update
                </button>
              </form>
            ) : (
              <p className="text-xs text-[#c5d0e0]">Update needs the session secret on the server.</p>
            )}
            <form method="POST" action="/api/regime/logout">
              <button type="submit" className="px-2 py-1.5 text-xs text-[#c5d0e0] hover:text-[#f4f7fb]">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="druck-book" className="relative mx-auto max-w-[1440px] space-y-4 px-4 py-5 sm:px-6 sm:py-6" data-druck-colour={room.colour ?? 'none'} data-invested={room.investedLabel ?? 'none'} data-fresh={room.freshTone}>
        {room.banner ? (
          <p role="status" className="rounded-2xl border border-[#fb7185]/40 bg-[#fb7185]/15 px-4 py-3 text-sm leading-relaxed text-[#f4f7fb]">
            {room.banner}
          </p>
        ) : null}

        <section className={`${CARD} px-4 py-5 sm:px-6`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {room.headlineWait || !room.colourWord || !read ? (
                  'Market read: waiting for the first week'
                ) : (
                  <>
                    Market read: <span className={read.text}>{room.colourWord}</span>
                    {room.investedLabel ? <span> — {room.investedLabel} invested</span> : null}
                  </>
                )}
              </h1>
              {room.sharesLabel ? <p className="mt-1 text-sm text-[#d5deea]">{room.sharesLabel}</p> : null}
              {room.checks.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {room.checks.map((check) => (
                    <li key={check.id}>
                      <span
                        title={check.detail}
                        aria-label={`${check.pass ? 'Passed' : 'Failed'}: ${check.label}. ${check.detail}`}
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${check.pass ? 'border-[#34d399]/40 text-[#34d399]' : 'border-[#fb7185]/40 text-[#fb7185]'}`}
                      >
                        <span aria-hidden>{check.pass ? '✓' : '✕'}</span>
                        {check.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#d5deea]">The three checks appear when the first week is saved.</p>
              )}
              <p className="mt-3 text-sm text-[#d5deea]">
                Next run <span className="font-medium text-[#f4f7fb]">{room.nextRun}</span>
                <span className="px-1.5" aria-hidden>·</span>
                <span className={`font-semibold ${freshClass}`}>{room.freshWord}</span>
              </p>
              {room.brake ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#fde68a]">{room.brake}</p> : null}
              {room.skipped ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#fde68a]">{room.skipped}</p> : null}
            </div>
            <InvestedGauge weight={room.invested} colour={room.colour} label={room.investedLabel ?? '0%'} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Scorecard card={room.scorecard} />
          <Filings card={room.filings} />
        </div>

        {room.cards.length > 0 || room.cash ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {room.cards.map((card) => (
              <article key={card.id} className={`${CARD} flex flex-col p-4`} data-ticker={card.symbol}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold tracking-wide">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${dotClass(card.actionTone)}`} />
                    {card.symbol}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[#d5deea]">{card.weightLabel}</p>
                </div>
                <div className="mt-3">
                  <WeightRing weight={card.weight} label={card.weightLabel} colour={card.actionTone === 'sell' ? '#fb7185' : card.actionTone === 'trim' ? '#fbbf24' : '#34d399'} />
                </div>
                <p className={`mt-3 text-center text-sm font-semibold leading-snug ${actionClass(card.actionTone)}`}>{card.action}</p>
                <p className={`mt-1 text-center text-xs leading-relaxed ${card.themeHot ? 'text-[#fb7185]' : 'text-[#c5d0e0]'}`}>{card.themeText}</p>
                <div className="mt-4">
                  <PriceScale card={card} />
                </div>
                <EarningsBlock card={card} />
              </article>
            ))}
            {room.cash ? (
              <article className={`${CARD} flex flex-col p-4`} data-ticker={room.cash.symbol}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Cash</p>
                  <p className="text-xs text-[#c5d0e0]">{room.cash.symbol}</p>
                </div>
                <div className="mt-3">
                  <WeightRing weight={room.cash.weight} label={room.cash.weightLabel} colour="#34d399" />
                </div>
                <p className="mt-3 text-center text-2xl font-semibold tabular-nums text-[#f4f7fb]">{room.cash.amountLabel}</p>
                <p className="mt-1 text-center text-sm text-[#34d399]">{room.cash.caption}</p>
                {room.cash.priceLabel ? <p className="mt-2 text-center text-xs text-[#c5d0e0]">{room.cash.priceLabel}</p> : null}
                {room.cash.untilFill ? <p className="mt-2 text-center text-xs leading-relaxed text-[#d5deea]">{room.cash.untilFill}</p> : null}
              </article>
            ) : null}
          </div>
        ) : (
          <section className={`${CARD} px-4 py-8 text-center text-sm text-[#d5deea]`}>
            No holdings yet. Nothing is bought before the first saved week.
          </section>
        )}

        {room.watch.length > 0 ? (
          <section className={`${CARD} px-4 py-4 sm:px-5`} aria-label="Watching">
            <h2 className="text-sm font-semibold">Watching</h2>
            <p className="mt-1 text-sm text-[#d5deea]">These names are at 0%. A name under its 200-day average is not bought.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {room.watch.map((chip) => (
                <li key={chip.symbol}>
                  <span title={chip.name} className="inline-flex items-baseline gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm">
                    <span className="font-semibold">{chip.symbol}</span>
                    <span className={chip.below ? 'text-[#fb7185]' : 'text-[#34d399]'}>{chip.text}</span>
                    {chip.earningsFlag ? <span className="font-semibold text-[#fbbf24]" data-earnings-flag>{chip.earningsFlag}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <section className={`${CARD} p-4 sm:p-5 xl:col-span-2`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Book vs 60/40 vs QQQ</h2>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#d5deea]">Since inception</span>
            </div>
            <ComparisonChart chart={room.chart} />
            {room.chart.missing ? <p className="mt-2 text-xs leading-relaxed text-[#fde68a]">{room.chart.missing}</p> : null}
            {room.record ? <p className="mt-3 text-sm leading-relaxed text-[#d5deea]">{room.record}</p> : null}
            <p className="mt-3 text-xs leading-relaxed text-[#c5d0e0]">{room.chart.note}</p>
          </section>

          <section className={`${CARD} p-4 sm:p-5 xl:col-span-3`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">IBKR order list</h2>
              {room.orderText ? <CopyOrders text={room.orderText} /> : null}
            </div>
            {room.orders.length === 0 ? (
              <p className="text-sm text-[#d5deea]">{room.ordersEmpty}</p>
            ) : (
              <>
                <ul className="grid gap-3 xl:hidden">
                  {room.orders.map((order) => (
                    <li key={`${order.side}-${order.symbol}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                      <p className="font-semibold">
                        <span className={order.side === 'BUY' ? 'text-[#34d399]' : 'text-[#fb7185]'}>{order.side}</span>
                        {' '}{order.symbol}
                        <span className="font-medium text-[#d5deea]"> · {order.qty} shares</span>
                      </p>
                      <p className="mt-1 text-[#d5deea]">Limit {order.limitLabel} · {order.currency} · {order.type} · {order.tif}</p>
                      <p className="mt-1 text-[#d5deea]">Place by {order.placeBy}</p>
                      <p className="mt-1 font-semibold text-[#fbbf24]">{order.status}</p>
                    </li>
                  ))}
                </ul>
                <div className="hidden xl:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Orders to type into IBKR. Nothing is sent from this page.</caption>
                    <thead className="text-[11px] font-semibold uppercase tracking-wide text-[#c5d0e0]">
                      <tr>
                        <th className="pb-2 pr-3 font-semibold">Side</th>
                        <th className="pb-2 pr-3 font-semibold">Ticker</th>
                        <th className="pb-2 pr-3 font-semibold">Qty</th>
                        <th className="pb-2 pr-3 font-semibold">Type</th>
                        <th className="pb-2 pr-3 font-semibold">Limit</th>
                        <th className="pb-2 pr-3 font-semibold">Currency</th>
                        <th className="pb-2 pr-3 font-semibold">Place by</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.orders.map((order) => (
                        <tr key={`${order.side}-${order.symbol}`} className="border-t border-white/10">
                          <td className={`py-2.5 pr-3 font-semibold ${order.side === 'BUY' ? 'text-[#34d399]' : 'text-[#fb7185]'}`}>{order.side}</td>
                          <td className="py-2.5 pr-3 font-medium">{order.symbol}</td>
                          <td className="py-2.5 pr-3 tabular-nums">{order.qty}</td>
                          <td className="py-2.5 pr-3 text-[#fbbf24]">{order.type}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-[#fbbf24]">{order.limitLabel}</td>
                          <td className="py-2.5 pr-3">{order.currency}</td>
                          <td className="py-2.5 pr-3 text-[#d5deea]">{order.placeBy}</td>
                          <td className="py-2.5 font-semibold text-[#fbbf24]">{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-3 text-xs leading-relaxed text-[#c5d0e0]">{room.orderNote}</p>
          </section>
        </div>

        <section className={`${CARD} px-4 py-4 sm:px-5`} aria-label="Data freshness">
          <h2 className="text-sm font-semibold">Where the numbers come from</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {room.freshness.map((line) => {
              const tone = line.value.startsWith('failed')
                ? 'text-[#fb7185]'
                : line.value.startsWith('succeeded')
                  ? 'text-[#34d399]'
                  : 'text-[#f4f7fb]';
              return (
                <div key={line.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#c5d0e0]">{line.label}</dt>
                  <dd className={`mt-1 text-sm font-medium ${tone}`}>{line.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        <p className="rounded-2xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-3 text-sm leading-relaxed text-[#fffbeb]">
          {room.paperRule}
        </p>

        <details className={`${CARD} px-4 sm:px-5`}>
          <summary className="cursor-pointer list-none py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d399] [&::-webkit-details-marker]:hidden">
            Not validated, and how the rules work
          </summary>
          <div className="space-y-3 pb-4 text-sm leading-relaxed text-[#d5deea]">
            {room.about.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>

        <details className={`${CARD} px-4 sm:px-5`}>
          <summary className="cursor-pointer list-none py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d399] [&::-webkit-details-marker]:hidden">
            Retired books
          </summary>
          <ul className="space-y-2 pb-4 text-sm leading-relaxed text-[#d5deea]" id="retired-books">
            {retired.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </main>
    </div>
  );
}
