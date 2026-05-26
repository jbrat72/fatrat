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
