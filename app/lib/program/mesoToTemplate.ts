/**
 * Convert an active Mesocycle (plus its first-week sessions) into a
 * ProgramTemplate-shaped object suitable for re-opening the Template Wizard.
 *
 * Used by the "Edit this plan" action on the Change Plan sheet — the wizard
 * already knows how to pre-populate from a ProgramTemplate via the
 * `initialTemplate` prop, so we synthesize one from the live plan.
 *
 * The Template Wizard reads `weeks[0]` for the exercise/day layout and
 * `weeks.length` for the week count. We emit an array of length `meso.weeks`
 * so the wizard opens at the correct duration; only week 0 carries
 * populated days. Per-exercise `startingWeightKg` is sourced from the first
 * logged/prescribed set in the first week so the wizard can pre-fill the
 * starting-weights step with what the user already has.
 *
 * Saving via the wizard's "Make it active" path archives the current plan
 * and generates a fresh program — same flow as Cancel + start a new plan.
 *
 * Pure function. No Firestore, no React.
 */
import type {
  Mesocycle, Microcycle, WorkoutSession,
  ProgramTemplate, TemplateDay, TemplateExerciseSlot, TemplateWeek,
  SplitType,
} from '@/types';

/**
 * Build a multi-week ProgramTemplate snapshot from a Mesocycle + its
 * Microcycles + the WorkoutSessions belonging to those Microcycles. The
 * structural source is week 1 (the lowest weekNumber).
 *
 * `meso.weeks` empty placeholder weeks follow week 0 so the wizard's week
 * count clamps correctly to the original plan length.
 */
export function mesocycleToTemplate(
  meso: Mesocycle,
  micros: Microcycle[],
  sessions: WorkoutSession[],
): ProgramTemplate {
  const sortedMicros = [...micros].sort((a, b) => a.weekNumber - b.weekNumber);
  const firstMicro = sortedMicros[0];
  const firstWeekSessions = firstMicro
    ? sessions
        .filter((s) => s.microcycleId === firstMicro.id)
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    : [];

  const days: TemplateDay[] = firstWeekSessions.map((s, i) => ({
    dayLabel: s.name ?? `Day ${i + 1}`,
    exercises: s.exercises.map((ex): TemplateExerciseSlot => ({
      exerciseId: ex.exerciseId,
      prescribedSets: ex.prescribedSets ?? ex.sets.length,
      repsLow: ex.prescribedRepsLow,
      repsHigh: ex.prescribedRepsHigh,
      timeLow: ex.prescribedTimeLow,
      timeHigh: ex.prescribedTimeHigh,
      startingRIR: ex.prescribedRIR,
      // The first set's weight is what the user prescribed/logged for this
      // exercise — surface it so the wizard's starting-weights step opens
      // pre-filled. (Stored in kg; the wizard converts to display units.)
      startingWeightKg: ex.sets[0]?.weightKg,
    })),
  }));

  // Emit one entry per week so the wizard's `clamp(t.weeks.length, 3, 8)`
  // lands on the original meso length. Only week 0 carries content — the
  // wizard never reads weeks[1..] for layout, only the count.
  const totalWeeks = Math.max(1, meso.weeks);
  const weeks: TemplateWeek[] = Array.from({ length: totalWeeks }, (_, i) =>
    i === 0
      ? { weekIndex: 0, days }
      : { weekIndex: i, days: [] },
  );

  const daysPerWeek = Math.max(2, days.length || 3);
  const split: SplitType = firstMicro?.splitType ?? 'custom';

  return {
    // Stable per-meso id keeps the wizard's seed effect from re-firing.
    id: `meso-edit-${meso.id}`,
    name: meso.name,
    description: meso.goal ?? 'Editing your current plan',
    kind: 'program',
    daysPerWeek,
    split,
    defaultPhase: meso.phaseType,
    progressionScheme: meso.progressionScheme,
    programStyle: meso.programStyle,
    minMode: 'BASIC',
    isCustom: true,
    createdBy: undefined,
    muscleTiers: meso.muscleTiers,
    restSeconds: meso.restSeconds,
    weeks,
  };
}
