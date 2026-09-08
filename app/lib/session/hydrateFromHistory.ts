/**
 * Backfill non-completed sets in a session with the user's most-recent prior
 * performance of the same exercise (weight + reps only).
 *
 * This function NEVER changes the set count. Volume changes driven by feedback
 * or soreness are surfaced as explicit suggestions the user accepts (see
 * SorenessCheckIn) — applying them silently here was overwriting the set count
 * the user deliberately set on the Today card every time a workout was opened.
 */
import type { WorkoutSession, SetEntry } from '@/types';
import { isPerformedSet } from './performedSets';

/** A prior set only counts as history if it was actually performed — a fully
 *  skipped session keeps its prefilled weight/reps and must not be a source.
 *  It counts as usable if it recorded ANY value: requiring BOTH weight and reps
 *  meant bodyweight lifts (reps only, no weight) and time-based holds (time
 *  only) never hydrated at all — the reps stayed at the generator's range-low. */
const usable = (s: SetEntry) =>
  isPerformedSet(s) && (s.weightKg != null || s.reps != null || s.timeSec != null);

export function hydrateFromHistory(
  session: WorkoutSession,
  priorSessions: WorkoutSession[],
): WorkoutSession {
  if (session.exercises.some((ex) => ex.sets.some((s) => s.completed))) return session;

  const sorted = [...priorSessions].sort((a, b) => b.date.localeCompare(a.date));

  // Per-exercise hydration: copy weight/reps from prior session's matching exercise.
  const exercises = session.exercises.map((ex) => {
    // Same matching order as the PREV column (workout page `priorFor`): exact
    // id, then the id this exercise was swapped from, then a normalized name.
    // Matching on id alone left PREV showing last time's numbers while the
    // inputs stayed at the generator defaults whenever the id had drifted.
    const nameKey = ex.name.trim().toLowerCase();
    const matches = (e: typeof ex) =>
      e.exerciseId === ex.exerciseId
      || (ex.swappedFromExerciseId != null && e.exerciseId === ex.swappedFromExerciseId)
      || e.name.trim().toLowerCase() === nameKey;
    let priorEx: typeof ex | undefined;
    for (const prior of sorted) {
      if (prior.id === session.id) continue;
      const candidate = prior.exercises.find((e) => e.exerciseId === ex.exerciseId && e.sets.some(usable))
        ?? prior.exercises.find((e) => matches(e) && e.sets.some(usable));
      if (candidate) {
        priorEx = candidate;
        break;
      }
    }
    if (!priorEx) return ex;

    const priorByIndex = new Map<number, SetEntry>();
    const lastCompletedPrior = [...priorEx.sets].reverse().find(usable);
    for (const s of priorEx.sets) {
      if (usable(s)) priorByIndex.set(s.setIndex, s);
    }

    const sets = ex.sets.map((s, i) => {
      if (s.completed) return s;
      const prior = priorByIndex.get(i) ?? lastCompletedPrior;
      if (!prior) return s;
      // Last time's values beat the GENERATOR's defaults, but never a manual
      // edit. The generator pre-fills reps at the range's low end (so a value
      // equal to prescribedRepsLow is treated as untouched) and leaves weight
      // empty except where deliberately seeded — a non-null weight or an
      // off-default rep count is user intent and is preserved.
      const repsUntouched = s.reps == null || s.reps === ex.prescribedRepsLow;
      const timeUntouched = s.timeSec == null || s.timeSec === ex.prescribedTimeLow;
      return {
        ...s,
        weightKg: s.weightKg == null ? prior.weightKg : s.weightKg,
        reps:     repsUntouched ? (prior.reps ?? s.reps) : s.reps,
        timeSec:  timeUntouched ? (prior.timeSec ?? s.timeSec) : s.timeSec,
      };
    });
    return { ...ex, sets };
  });

  return { ...session, exercises };
}
