/**
 * Resolve a logged exercise to its live library definition, tolerating id drift:
 * exact id → the id it was swapped from → a normalized-name match. Used so a
 * stale denormalized `metric` on an old session/program entry doesn't hide the
 * weight field when the same exercise now lives under a different id.
 */
import type { ExerciseDefinition } from '@/types';

export function resolveExerciseDef(
  defsById: Record<string, ExerciseDefinition>,
  ex: { exerciseId: string; name: string; swappedFromExerciseId?: string },
): ExerciseDefinition | undefined {
  if (defsById[ex.exerciseId]) return defsById[ex.exerciseId];
  if (ex.swappedFromExerciseId && defsById[ex.swappedFromExerciseId]) return defsById[ex.swappedFromExerciseId];
  const n = ex.name.trim().toLowerCase();
  return Object.values(defsById).find((d) => d.name.trim().toLowerCase() === n);
}
