/**
 * Personal bests — best logged weight per exercise across all sessions.
 * Also produces a "PR sets" set (sessionId+exerciseId+setIndex) for flame icons.
 */
import type { WorkoutSession, EffortRPE } from '@/types';

export interface PersonalBest {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  rpe?: EffortRPE;
  date: string;
  sessionId: string;
}

/**
 * For each exercise the user has performed, return the best top set (max weight
 * × max reps tiebreaker). Sessions must be in any order — we don't depend on it.
 */
export function personalBests(sessions: WorkoutSession[]): PersonalBest[] {
  const byExercise = new Map<string, PersonalBest>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.completed || set.weightKg == null || set.reps == null) continue;
        const existing = byExercise.get(ex.exerciseId);
        if (
          !existing ||
          set.weightKg > existing.weightKg ||
          (set.weightKg === existing.weightKg && set.reps > existing.reps)
        ) {
          byExercise.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.name,
            weightKg: set.weightKg,
            reps: set.reps,
            rpe: set.rpe,
            date: s.date,
            sessionId: s.id,
          });
        }
      }
    }
  }
  return [...byExercise.values()].sort((a, b) => b.weightKg - a.weightKg);
}

/**
 * The Big Four lifts, in canonical order — used for BASIC mode's PR card.
 * If the user hasn't logged one, it's omitted.
 */
export function bigFourPRs(sessions: WorkoutSession[]): PersonalBest[] {
  const order = [
    'squat-back-barbell',
    'bench-press-barbell',
    'deadlift',
    'ohp-barbell',
  ];
  const all = personalBests(sessions);
  const byId = new Map(all.map((p) => [p.exerciseId, p]));
  return order
    .map((id) => byId.get(id))
    .filter((p): p is PersonalBest => !!p);
}
