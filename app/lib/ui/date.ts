/** Local-date helpers. We always store and compare ISO YYYY-MM-DD strings,
 *  but JS's `Date.toISOString()` converts to UTC — which silently rolls
 *  the date forward/back across midnight for non-UTC timezones. Use these
 *  helpers anywhere we want "today" or a same-day stamp in the user's
 *  local timezone. */

export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Human day-date from an ISO date string, parsed as LOCAL midnight.
 *   long   → "Friday, July 18"
 *   medium → "Friday, Jul 18"
 *   short  → "Fri, Jul 18"
 * One helper instead of the three near-identical toLocaleDateString wrappers
 * that had grown in today/, FinishPlanModal and StartWorkoutModal.
 */
export function formatDayDate(iso: string, style: 'long' | 'medium' | 'short' = 'long'): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions =
    style === 'long' ? { weekday: 'long', month: 'long', day: 'numeric' }
    : style === 'medium' ? { weekday: 'long', month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}
