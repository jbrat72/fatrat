/**
 * mm:ss helpers for time-based exercises (holds, carries). Time is stored as
 * whole seconds (SetEntry.timeSec); these convert to/from a clock display and
 * support digit-by-digit entry on a numeric keypad (no ":" key needed).
 */

/** Seconds → "m:ss" (e.g. 90 → "1:30"). Empty string for null. */
export function formatSeconds(total: number | undefined): string {
  if (total == null) return '';
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a raw digit string as a clock, filling from the right so the colon
 * appears as soon as there are seconds digits: "" → "", "9" → "0:09",
 * "130" → "1:30", "1305" → "13:05". Capped at 4 digits (99:99).
 */
export function digitsToClock(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 4);
  if (d === '') return '';
  const ss = d.slice(-2);
  const mm = d.slice(0, -2);
  return `${mm === '' ? '0' : mm}:${ss.padStart(2, '0')}`;
}

/** Raw digit string → seconds (last two digits are seconds, the rest minutes). */
export function digitsToSeconds(digits: string): number | undefined {
  const d = digits.replace(/\D/g, '').slice(0, 4);
  if (d === '') return undefined;
  const ss = parseInt(d.slice(-2) || '0', 10);
  const mm = parseInt(d.slice(0, -2) || '0', 10);
  return mm * 60 + ss;
}

/** Seconds → the digit string a user would type (e.g. 90 → "130"). */
export function secondsToDigits(total: number | undefined): string {
  if (total == null) return '';
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}${String(s).padStart(2, '0')}`;
}
