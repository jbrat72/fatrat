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

export function hydrateFromHistory(
  session: WorkoutSession,
  priorSessions: WorkoutSession[],
): WorkoutSession {
  if (session.exercises.some((ex) => ex.sets.some((s) => s.completed))) return session;

  const sorted = [...priorSessions].sort((a, b) => b.date.localeCompare(a.date));

  // Per-exercise hydration: copy weight/reps from prior session's matching exercise.
  const exercises = session.exercises.map((ex) => {
    let priorEx: typeof ex | undefined;
    for (const prior of sorted) {
      if (prior.id === session.id) continue;
      const candidate = prior.exercises.find((e) => e.exerciseId === ex.exerciseId);
      if (candidate && candidate.sets.some((s) => s.completed && s.weightKg != null && s.reps != null)) {
        priorEx = candidate;
        break;
      }
    }
    if (!priorEx) return ex;

    const priorByIndex = new Map<number, SetEntry>();
    const lastCompletedPrior = [...priorEx.sets].reverse().find((s) => s.completed && s.weightKg != null && s.reps != null);
    for (const s of priorEx.sets) {
      if (s.completed && s.weightKg != null && s.reps != null) priorByIndex.set(s.setIndex, s);
    }

    const sets = ex.sets.map((s, i) => {
      if (s.completed) return s;
      const prior = priorByIndex.get(i) ?? lastCompletedPrior;
      if (!prior) return s;
      return {
        ...s,
        weightKg: s.weightKg ?? prior.weightKg,
        reps:     s.reps     ?? prior.reps,
      };
    });
    return { ...ex, sets };
  });

  return { ...session, exercises };
}
