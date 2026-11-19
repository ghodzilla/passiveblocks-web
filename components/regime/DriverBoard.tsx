import type { DriverPath } from '@/lib/regime/pathToBuy';

function signed(value: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
}

const ARROW = { up: '↑', down: '↓', flat: '→', unknown: '·' } as const;
const ARROW_WORD = { up: 'up', down: 'down', flat: 'flat', unknown: 'no earlier print' } as const;

export function DriverBoard({
  drivers,
  readings,
}: {
  drivers: DriverPath[];
  readings: Record<string, string>;
}) {
  return (
    <ul className="grid gap-1">
      {drivers.map((driver) => {
        const push = driver.push;
        const width = push == null ? 0 : Math.min(50, (Math.abs(push) / 0.5) * 50);
        const negative = (push ?? 0) < 0;
        return (
          <li key={driver.id} className="grid grid-cols-1 items-center gap-1 border-b border-[var(--border)] px-1 py-0.5 sm:grid-cols-[minmax(0,1.4fr)_4.5rem_7.2rem_minmax(0,1fr)] sm:gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--text-1)]">
                <span className="font-semibold">{driver.title}</span>
                {readings[driver.id] ? <span className="ml-2 text-xs text-[var(--text-3)]">{readings[driver.id]}</span> : null}
              </p>
            </div>
            <p className="font-mono text-sm tabular-nums text-[var(--text-1)]" aria-label={driver.z == null ? 'No score' : `Score ${signed(driver.z)}, ${ARROW_WORD[driver.direction]}`}>
              {driver.z == null ? '—' : signed(driver.z)}
              <span className="ml-1 text-[var(--text-2)]" aria-hidden>{ARROW[driver.direction]}</span>
            </p>
            <p className="whitespace-nowrap font-mono text-sm tabular-nums text-[var(--text-2)]">
              {push == null ? 'left out' : `pushes ${signed(push)}`}
            </p>
            <svg viewBox="0 0 100 12" className="hidden w-full sm:block" aria-hidden>
              <line x1="50" x2="50" y1="0" y2="12" stroke="var(--text-3)" strokeWidth="0.6" />
              {push != null ? (
                <rect
                  x={negative ? 50 - width : 50}
                  y="2"
                  width={Math.max(width, 0.8)}
                  height="8"
                  rx="2"
                  fill={negative ? 'var(--call-sell)' : 'var(--call-buy)'}
                />
              ) : null}
            </svg>
          </li>
        );
      })}
    </ul>
  );
}
