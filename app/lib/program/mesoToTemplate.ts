/**
 * Convert an active Mesocycle (plus its first-week sessions) into a
 * ProgramTemplate-shaped object suitable for re-opening the Template Wizard.
 *
 * Used by the "Edit this plan" action on the Change Plan sheet — the wizard
 * already knows how to pre-populate from a ProgramTemplate via the
 * `initialTemplate` prop, so we synthesize one from the live plan.
 *
 * The Template Wizard reads `weeks[0]` only when seeding state, so we emit a
 * single-week template populated from the meso's first microcycle. Saving
 * via the wizard's "Make it active" path archives the current plan and
 * generates a fresh program — same flow as Cancel + start a new plan.
 *
 * Pure function. No Firestore, no React.
 */
import type {
  Mesocycle, Microcycle, WorkoutSession,
  ProgramTemplate, TemplateDay, TemplateExerciseSlot, TemplateWeek,
  SplitType,
} from '@/types';

/**
 * Build a single-week ProgramTemplate from a Mesocycle + its Microcycles +
 * the WorkoutSessions belonging to those Microcycles. Picks week 1 (the
 * lowest weekNumber) as the structural source.
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
    })),
  }));

  const week: TemplateWeek = { weekIndex: 0, days };
  const daysPerWeek = Math.max(2, days.length || 3);
  const split: SplitType = firstMicro?.splitType ?? 'custom';

  return {
    // `id` is irrelevant — the wizard only reads it for change detection in
    // its initRef. A stable per-meso id keeps the effect from re-firing.
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
    weeks: [week],
  };
}
