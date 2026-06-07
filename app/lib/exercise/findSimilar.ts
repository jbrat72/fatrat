/**
 * Find exercises similar to a target — same primary muscle, allowed by the
 * user's equipment + not in their excluded list. Pure function.
 */
import type { ExerciseDefinition } from '@/types';
import { canUseExercise } from './equipment';

export interface FindSimilarInput {
  exerciseId: string;
  library: ExerciseDefinition[];
  /** User's granular owned-equipment list (profile.equipmentItems). */
  equipmentItems: string[];
  excludedNames?: string[];
}

export function findSimilar(input: FindSimilarInput): ExerciseDefinition[] {
  const { exerciseId, library, equipmentItems, excludedNames = [] } = input;
  const original = library.find((e) => e.id === exerciseId);
  if (!original) return [];
  const excluded = new Set(excludedNames.map((s) => s.toLowerCase()));
  return library
    .filter((e) =>
      e.id !== original.id &&
      e.primaryMuscle === original.primaryMuscle &&
      canUseExercise(e, equipmentItems) &&
      !excluded.has(e.name.toLowerCase()),
    )
    // Same equipment first, then alphabetical
    .sort((a, b) => {
      const aMatch = a.equipment === original.equipment ? 0 : 1;
      const bMatch = b.equipment === original.equipment ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name);
    });
}
