function sydneyZone(date: Date): 'AEDT' | 'AEST' | null {
  const offset = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  if (offset.includes('AEST') || /\+10(?!\d)/.test(offset)) return 'AEST';
  if (offset.includes('AEDT') || /\+11(?!\d)/.test(offset)) return 'AEDT';
  return null;
}

function sydneyParts(date: Date): { zone: 'AEDT' | 'AEST' | null; label: string } {
  const label = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
  return { zone: sydneyZone(date), label };
}

/** Display clock. The engine's "today" stays on the Melbourne calendar, which shares this offset. */
export function sydneyClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = sydneyParts(date);
  return parts.zone ? `${parts.label} ${parts.zone}` : parts.label;
}

/** One clock for every timestamp on the regime page. */
export function melbourneClock(iso: string | null | undefined): string {
  return sydneyClock(iso);
}

/** Calendar date in Australia/Melbourne, used as the engine's "today". */
export function melbourneDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Exchange or FRED session date. These are already calendar dates, not instants. */
export function sessionDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}
