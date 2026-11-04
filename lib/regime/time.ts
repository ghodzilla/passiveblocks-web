/** One clock for every timestamp on the regime page. */
export function melbourneClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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
