/**
 * Which of a single-workout template's exercise slots to offer when the user
 * starts it ad-hoc.
 *
 * Stock templates are filtered through the user's equipment so they never
 * offer a movement the user can't do at their gym. A CUSTOM template is
 * different: its author picked every exercise deliberately (the single-
 * workout wizard offers the whole library, not just the default equipment
 * profile), so equipment filtering must not touch it. Filtering it silently
 * dropped exercises — a 4-exercise workout opened with 2, while the workout
 * library page still counted 4.
 */
import type { ProgramTemplate, ExerciseDefinition, TemplateExerciseSlot } from '@/types';
import { canUseExercise } from '@/lib/exercise/equipment';

export function usableTemplateSlots(
  tpl: ProgramTemplate,
  defs: Record<string, ExerciseDefinition>,
  equipmentItems: string[],
): TemplateExerciseSlot[] {
  const slots = tpl.weeks[0]?.days[0]?.exercises ?? [];
  if (tpl.isCustom) return slots;
  // Slots whose def hasn't loaded are kept (we can't judge them yet).
  return slots.filter((slot) => {
    const def = defs[slot.exerciseId];
    return def ? canUseExercise(def, equipmentItems) : true;
  });
}
