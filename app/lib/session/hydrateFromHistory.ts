/**
 * Backfill non-completed sets in a session with the user's most-recent prior
 * performance of the same exercise. Also apply per-muscle adjustments derived
 * from the most recent feedback (limited to "add sets" — we don't auto-remove
 * sets to avoid losing prescribed work without consent).
 */
import type { WorkoutSession, SetEntry, MuscleGroup } from '@/types';
import type { MuscleAdjustment } from '@/lib/periodization/adjustFromFeedback';
import { adjustFromFeedback } from '@/lib/periodization/adjustFromFeedback';

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

  // Per-muscle feedback adjustment: find the most recent feedback for each muscle
  // and apply ONLY positive setsDelta (we don't auto-remove sets).
  const muscleAdjustments = new Map<MuscleGroup, MuscleAdjustment>();
  for (const prior of sorted) {
    if (!prior.feedback) continue;
    const out = adjustFromFeedback(prior.feedback);
    for (const a of out) {
      if (!muscleAdjustments.has(a.muscle)) muscleAdjustments.set(a.muscle, a);
    }
  }

  const exercisesWithAdjustments = exercises.map((ex) => {
    const a = muscleAdjustments.get(ex.muscle);
    if (!a) return ex;
    if (a.setsDelta > 0) {
      const last = ex.sets[ex.sets.length - 1];
      const newSets = [...ex.sets];
      for (let k = 0; k < a.setsDelta; k++) {
        newSets.push({
          setIndex: newSets.length,
          weightKg: last?.weightKg,
          reps: last?.reps,
          completed: false,
        });
      }
      return { ...ex, sets: newSets };
    }
    return ex;
  });

  return { ...session, exercises: exercisesWithAdjustments };
}
