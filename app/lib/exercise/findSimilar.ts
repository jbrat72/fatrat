/**
 * Find exercises similar to a target — same primary muscle, allowed by the
 * user's equipment + not in their excluded list. Pure function.
 */
import type { ExerciseDefinition, EquipmentAccess, EquipmentType } from '@/types';

function allowedEquipment(access: EquipmentAccess[]): Set<EquipmentType> {
  const set = new Set<EquipmentType>();
  for (const a of access) {
    switch (a) {
      case 'commercial-gym': ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','smith'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'home-gym':       ['barbell','dumbbell','bodyweight'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'dumbbells-only': ['dumbbell','bodyweight'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'bodyweight':     set.add('bodyweight'); break;
      case 'bodyweight-bands':       ['bodyweight','band'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'bodyweight-kettlebells': ['bodyweight','kettlebell'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'bodyweight-dumbbells':   ['bodyweight','dumbbell'].forEach((e) => set.add(e as EquipmentType)); break;
      case 'bands':          set.add('band'); break;
      case 'limited-hotel':  ['dumbbell','bodyweight','band'].forEach((e) => set.add(e as EquipmentType)); break;
    }
  }
  if (set.size === 0) ['barbell','dumbbell','machine','cable','bodyweight'].forEach((e) => set.add(e as EquipmentType));
  return set;
}

export interface FindSimilarInput {
  exerciseId: string;
  library: ExerciseDefinition[];
  userEquipment: EquipmentAccess[];
  excludedNames?: string[];
}

export function findSimilar(input: FindSimilarInput): ExerciseDefinition[] {
  const { exerciseId, library, userEquipment, excludedNames = [] } = input;
  const original = library.find((e) => e.id === exerciseId);
  if (!original) return [];
  const allowed = allowedEquipment(userEquipment);
  const excluded = new Set(excludedNames.map((s) => s.toLowerCase()));
  return library
    .filter((e) =>
      e.id !== original.id &&
      e.primaryMuscle === original.primaryMuscle &&
      allowed.has(e.equipment) &&
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
