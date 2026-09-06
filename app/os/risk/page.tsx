import { OsShell } from '@/components/os/OsShell';

const CEILINGS = [
  { key: 'DD', label: 'Max drawdown', value: '15%', tone: 'danger' as const },
  { key: 'IL', label: 'Impermanent loss', value: '5%', tone: 'warn' as const },
  { key: 'Name', label: 'Single-name cap', value: '10%', tone: 'warn' as const },
  { key: 'Theme', label: 'Theme / sleeve cap', value: '40%', tone: 'neutral' as const },
  { key: 'Kill', label: 'Kill switch', value: 'Armed (paper)', tone: 'ok' as const },
];

const toneClass = {
  ok: 'text-[var(--status-ok)] border-[var(--status-ok)]/30',
  warn: 'text-[var(--status-warn)] border-[var(--status-warn)]/30',
  danger: 'text-[var(--status-danger)] border-[var(--status-danger)]/30',
  neutral: 'text-[var(--status-neutral)] border-[var(--status-neutral)]/30',
};

export default function OsRiskPage() {
  return (
    <OsShell
      pathname="/os/risk"
      title="Risk ceilings"
      subtitle="Vera-signed paper ceilings (2026-09-06). Live capital ceilings remain unsigned and separate."
    >
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--status-warn)]/25 bg-[var(--status-warn)]/5 px-4 py-3 text-sm text-[var(--status-warn)]">
        Paper · Vera-signed · not live capital policy
      </div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              <th className="px-4 py-3">Gate</th>
              <th className="px-4 py-3">Ceiling</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {CEILINGS.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold text-foreground">{row.key}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.label}</td>
                <td className="px-4 py-3 text-right">
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
