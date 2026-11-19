import { THRESHOLDS } from '@/lib/regime/constants';
import type { MarketPath, NamePaths, PathRow } from '@/lib/regime/pathToBuy';
import { presentGateDetail, scrubFalseTheme, type PresentCall } from '@/lib/regime/presentCall';
import { CheckChip, Chip } from './ui/Chip';

function signed(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (Math.abs(value) < 0.005) return '0.00';
  return `${value > 0 ? '+' : '−'}${abs}`;
}

function Track({
  label,
  value,
  bar,
  gap,
  cleared,
  missing,
}: {
  label: string;
  value: number | null;
  bar: number;
  gap: number | null;
  cleared: boolean;
  missing: string;
}) {
  const x = (score: number) => 12 + ((Math.max(-3, Math.min(3, score)) + 3) / 6) * 296;
  const status = value == null
    ? missing
    : cleared
      ? `${signed(value)} · clears ${signed(bar)}`
      : `${signed(gap ?? 0)} short of ${signed(bar)}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-1)]">{label}</p>
        <p className="font-mono text-sm tabular-nums text-[var(--text-1)]">{status}</p>
      </div>
      {value == null ? (
        <p className="mt-2 text-sm text-[var(--text-3)]">{missing}</p>
      ) : (
        <svg viewBox="0 0 320 28" className="mt-2 w-full" role="img" aria-label={`${label} ${status}`}>
          <rect x="12" y="10" width="296" height="8" rx="4" fill="#2a2c38" />
          <line x1={x(bar)} x2={x(bar)} y1="4" y2="24" stroke="var(--call-buy)" strokeWidth="2" />
          <circle cx={x(value)} cy="14" r="6" fill={cleared ? 'var(--call-buy)' : 'var(--text-1)'} />
        </svg>
      )}
    </div>
  );
}

function Row({
  row,
  call,
}: {
  row: PathRow;
  call: PresentCall | undefined;
}) {
  const failing = row.checks.filter((check) => !check.pass && check.level);
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-1)]">
            {row.name}
            <span className="ml-2 font-mono text-xs font-normal text-[var(--text-3)]">{row.symbol}</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{call?.sentence ?? row.sentence}</p>
        </div>
        {call ? <Chip tone={call.tone}>{call.label}</Chip> : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {row.checks.map((check) => (
          <li key={check.id}>
            <CheckChip pass={check.pass} title={call ? (check.level ? scrubFalseTheme(check.level, null, call.offLabels) : presentGateDetail(check, call.themeOn, call.offLabels)) : (check.level ?? check.detail)}>{check.label}</CheckChip>
          </li>
        ))}
      </ul>
      {failing.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {failing.map((check) => (
            <li key={`${row.symbol}-${check.id}`} className="text-xs leading-relaxed text-[var(--text-3)]">{check.level}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function Group({
  title,
  lede,
  rows,
  calls,
}: {
  title: string;
  lede: string;
  rows: PathRow[];
  calls: Map<string, PresentCall>;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-base font-bold text-[var(--text-1)]">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{lede}</p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => <Row key={row.symbol} row={row} call={calls.get(row.symbol)} />)}
      </div>
    </div>
  );
}

export function PathToBuyPanel({
  market,
  names,
  calls,
  capKnown,
}: {
  market: MarketPath;
  names: NamePaths;
  calls: Map<string, PresentCall>;
  capKnown: boolean;
}) {
  const drags = market.drivers.filter((driver) => driver.role === 'drag');
  const helps = market.drivers.filter((driver) => driver.role === 'help');
  return (
    <section id="path-to-buy" className="grid gap-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-1)]">Path to a buy</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--text-2)]">{market.note}</p>
        {!capKnown ? <p className="mt-2 text-sm text-[var(--text-3)]">The book’s room under the cap is not on this page, so “at cap” is not claimed from a guess.</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Track
          label="Market score"
          value={market.score}
          bar={market.scoreBar}
          gap={market.scoreGap}
          cleared={market.scoreCleared}
          missing="The score is missing, so this distance is not shown."
        />
        <Track
          label="Money in the system"
          value={market.liquidity}
          bar={market.liquidityBar}
          gap={market.liquidityGap}
          cleared={market.liquidityCleared}
          missing="Money in the system is missing, so this distance is not shown."
        />
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20 px-4 py-4">
        <h3 className="text-sm font-bold text-[var(--text-1)]">What would have to move</h3>
        {drags.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">No piece is pulling the score down.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
            {drags.map((driver) => (
              <li key={driver.id}>
                <span className="font-semibold text-[var(--text-1)]">{driver.title}</span>
                {driver.push != null ? ` is pulling the score down by ${Math.abs(driver.push).toFixed(2)}` : ''}.
                {driver.soloTarget == null ? '' : driver.soloPossible
                  ? ` If this piece did all the lifting and nothing else changed, it would need to reach ${signed(driver.soloTarget)} from ${driver.z == null ? '—' : signed(driver.z)}.`
                  : ` Even at the +3 cap this model records, this piece cannot close the gap on its own.`}
              </li>
            ))}
          </ul>
        )}
        {helps.length > 0 ? (
          <p className="mt-3 text-sm text-[var(--text-2)]">
            Already helping: {helps.map((driver) => `${driver.title} ${driver.push == null ? '' : signed(driver.push)}`).join(', ')}.
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-[var(--text-3)]">
          Any mix of the pieces can close a gap. This is not a forecast of which one will move. A name still has to pass its own checks.
        </p>
      </div>
      <Group
        title="Not a buy today"
        lede="The checklist says buy, or every check passed, but a failed feed or a full book stops it. The hero and these rows use the same call."
        rows={names.blockedBuys}
        calls={calls}
      />
      <Group
        title="First in line"
        lede="Closest. Their own checks pass. The only thing in the way is the market gate."
        rows={names.firstInLine}
        calls={calls}
      />
      <Group
        title={`Buys if the score reaches +${THRESHOLDS.riskOnEnter.toFixed(2)}`}
        lede="Avoid today because this group is not played in the current mood. Their own checks already pass, so they turn into buys when the score crosses the bar and the group is allowed again."
        rows={names.readyWhenSupportive}
        calls={calls}
      />
      <Group
        title="Own checks still in the way"
        lede="These need a price or a theme to change, not just a higher market score. Closest to a buy are listed first."
        rows={names.ownChecks}
        calls={calls}
      />
    </section>
  );
}
