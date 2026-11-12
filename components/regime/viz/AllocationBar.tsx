export function AllocationBar({
  cash,
  cashLike,
  defensive,
  risk,
}: {
  cash: number;
  cashLike: number;
  defensive: number;
  risk: number;
}) {
  const parts = [
    { label: 'Cash', value: cash, color: '#64748b' },
    { label: 'Cash-like funds', value: cashLike, color: '#93c5fd' },
    { label: 'Defensive', value: defensive, color: 'var(--call-hold)' },
    { label: 'Riskier', value: risk, color: 'var(--call-watch)' },
  ].filter((part) => part.value > 0.004);
  let cursor = 0;
  return (
    <div>
      <svg viewBox="0 0 320 18" className="w-full" role="img" aria-label={parts.map((part) => `${part.label} ${(part.value * 100).toFixed(1)} percent`).join(', ')}>
        <rect x="0" y="4" width="320" height="10" rx="5" fill="#2a2c38" />
        {parts.map((part) => {
          const width = part.value * 320;
          const node = <rect key={part.label} x={cursor} y="4" width={Math.max(width, 0)} height="10" fill={part.color} />;
          cursor += width;
          return node;
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-3)]">
        {parts.map((part) => (
          <li key={part.label}>
            <span aria-hidden style={{ color: part.color }}>● </span>
            {part.label} {(part.value * 100).toFixed(1)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
