import type { RuleCard } from '@/lib/regime/presentCall';

export function RuleCards({ cards }: { cards: RuleCard[] }) {
  return (
    <section id="rules-today">
      <h2 className="text-xl font-bold text-[var(--text-1)]">If this, then that</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">The rule that applies today is marked. The others are the rest of the map.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.id}
            className="rounded-[var(--radius-lg)] border px-4 py-3"
            style={{
              borderColor: card.active ? 'var(--call-hold)' : 'var(--border)',
              background: card.active ? 'color-mix(in srgb, var(--call-hold) 12%, transparent)' : 'var(--surface-1)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">{card.active ? 'Today' : 'Rule'}</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-1)]">If {card.when}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">then {card.then}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
