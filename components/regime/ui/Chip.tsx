export type ChipTone = 'buy' | 'hold' | 'watch' | 'sell' | 'off' | 'caution';

const TONE: Record<ChipTone, { icon: string; color: string }> = {
  buy: { icon: '▲', color: 'var(--call-buy)' },
  hold: { icon: '■', color: 'var(--call-hold)' },
  watch: { icon: '◆', color: 'var(--call-watch)' },
  caution: { icon: '◆', color: 'var(--call-caution)' },
  sell: { icon: '▼', color: 'var(--call-sell)' },
  off: { icon: '–', color: 'var(--call-off)' },
};

export function Chip({ tone, children, title }: { tone: ChipTone; children: string; title?: string }) {
  const toneStyle = TONE[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        color: toneStyle.color,
        borderColor: `color-mix(in srgb, ${toneStyle.color} 35%, transparent)`,
        background: `color-mix(in srgb, ${toneStyle.color} 12%, transparent)`,
      }}
    >
      <span aria-hidden>{toneStyle.icon}</span>
      {children}
    </span>
  );
}

export function CheckChip({ pass, children }: { pass: boolean; children: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
      style={{
        color: pass ? 'var(--call-buy)' : 'var(--call-sell)',
        borderColor: pass ? 'color-mix(in srgb, var(--call-buy) 35%, transparent)' : 'color-mix(in srgb, var(--call-sell) 35%, transparent)',
      }}
    >
      <span aria-hidden>{pass ? '✓' : '✕'}</span>
      {children}
    </span>
  );
}
