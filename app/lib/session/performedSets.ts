/**
 * Canonical "was this set actually performed?" predicate.
 *
 * The app's convention for a skipped set is `completed: true` + `setType:
 * 'skip'` (the Finish sweep and the per-set skip action both write this), and
 * skipped sets RETAIN whatever weight/reps were prefilled by hydration or the
 * generator. Any stat, PR, progression or seeding computation that filters
 * only on `completed` will therefore count lifts that never happened.
 *
 * Every domain consumer (personalBests, calibration, progression, volume,
 * mesoRecap, hydrateFromHistory, streak, series, deload) must go through
 * `isPerformedSet` instead of checking `completed` directly.
 */
import type { SetEntry } from '@/types';

/** True when the set was actually performed (logged and not a skip). */
export function isPerformedSet(s: SetEntry): boolean {
  return s.completed && s.setType !== 'skip';
}

/** True when the set was performed as working volume (not a skip or warmup). */
export function isWorkingSet(s: SetEntry): boolean {
  return isPerformedSet(s) && s.setType !== 'warmup';
}

/** Convenience filter. */
export function performedSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter(isPerformedSet);
}
