import { OsShell } from '@/components/os/OsShell';
import { StatStrip } from '@/components/os/StatStrip';
import { formatAsOf, targetBook } from '@/lib/os-data';

export const metadata = {
  title: 'Risk · OS',
  robots: { index: false, follow: false },
};

export default function OsRiskPage() {
  const c = targetBook.risk_ceilings_ref;
  const rows = [
    { key: 'DD', label: 'Max drawdown', value: `${c.max_drawdown_pct}%`, tone: 'danger' as const },
    { key: 'IL', label: 'Impermanent loss budget', value: `${c.max_il_budget_pct}%`, tone: 'warn' as const },
    { key: 'Name', label: 'Single-name cap', value: `${c.max_single_name_pct}%`, tone: 'warn' as const },
    { key: 'Theme', label: 'Single-theme cap', value: `${c.max_single_theme_pct}%`, tone: 'neutral' as const },
    {
      key: 'Kill',
      label: 'Kill switch',
      value: c.kill_switch ? 'Armed (paper)' : 'Disarmed',
      tone: (c.kill_switch ? 'ok' : 'danger') as 'ok' | 'danger',
    },
  ];

  const toneClass = {
    ok: 'text-[var(--status-ok)] border-[var(--status-ok)]/30 bg-[var(--status-ok)]/10',
    warn: 'text-[var(--status-warn)] border-[var(--status-warn)]/30 bg-[var(--status-warn)]/10',
    danger: 'text-[var(--status-danger)] border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10',
    neutral: 'text-[var(--status-neutral)] border-[var(--status-neutral)]/30 bg-white/[0.03]',
  };

  return (
    <OsShell
      pathname="/os/risk"
      eyebrow="Risk"
      title="Paper ceilings"
      subtitle="Vera-signed envelope for unsupervised paper Act. Live capital ceilings stay unsigned and separate."
    >
      <StatStrip
        stats={[
          { label: 'DD', value: `${c.max_drawdown_pct}%`, hint: 'Max drawdown' },
          { label: 'IL', value: `${c.max_il_budget_pct}%`, hint: 'IL budget' },
          { label: 'Name', value: `${c.max_single_name_pct}%`, hint: 'Single name' },
          {
            label: 'Kill',
            value: c.kill_switch ? 'Armed' : 'Off',
            hint: formatAsOf(targetBook.vera_book_signed_at),
          },
        ]}
      />

      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--status-ok)]/25 bg-[var(--status-ok)]/5 px-4 py-3 text-sm text-[var(--status-ok)]">
        Paper · Vera-signed · not live capital policy · {targetBook.vera_book_signed_by}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-black/20 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <th className="px-4 py-3">Gate</th>
              <th className="px-4 py-3">Ceiling</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3.5 font-semibold tracking-tight text-foreground">{row.key}</td>
                <td className="px-4 py-3.5 text-[var(--muted)]">{row.label}</td>
                <td className="px-4 py-3.5 text-right">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${toneClass[row.tone]}`}
                  >
                    {row.value}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OsShell>
  );
}
