/**
 * Pure helpers for single (ad-hoc) workout templates — shared by the
 * SingleWorkoutWizard, the Start Workout picker and the template detail page
 * so a saved workout materializes identically everywhere.
 */
import type {
  ExerciseDefinition, ExerciseEntry, MuscleGroup, SetEntry, TemplateExerciseSlot, WorkoutCategory,
} from '@/types';
import { defaultRestSec } from '@/lib/periodization/rest';
import { defaultRepRange, defaultTimeRange } from '@/lib/program/startingWeights';

export const UPPER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck'];
export const LOWER: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Category from the muscles a workout actually trains. */
export function inferCategory(muscles: MuscleGroup[]): WorkoutCategory {
  const ms = Array.from(new Set(muscles));
  if (ms.length === 0) return 'custom';
  const nonCore = ms.filter((m) => m !== 'core');
  if (nonCore.length === 0) return 'core';
  if (nonCore.every((m) => UPPER.includes(m))) return 'upper-body';
  if (nonCore.every((m) => LOWER.includes(m))) return 'lower-body';
  return 'full-body';
}

/** How the wizard's rep-range intent maps to a per-exercise range. */
export type RepIntent = 'strength' | 'hypertrophy' | 'endurance';
export function repRangeForIntent(intent: RepIntent, def: ExerciseDefinition | undefined): { repsLow: number; repsHigh: number } {
  const isolation = def?.patterns?.includes('isolation') && !def?.patterns?.includes('compound');
  if (intent === 'strength') return isolation ? { repsLow: 6, repsHigh: 8 } : { repsLow: 4, repsHigh: 6 };
  if (intent === 'endurance') return { repsLow: 12, repsHigh: 20 };
  return defaultRepRange(def);
}
export { defaultTimeRange };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rest a set of this exercise gets: its override, then the workout's, then
 *  the pattern-based default (compounds long, isolations short). */
export function restForSlot(slot: { restSeconds?: number }, workoutRest: number | undefined, def: ExerciseDefinition | undefined): number {
  return slot.restSeconds ?? workoutRest ?? defaultRestSec('hypertrophy', def?.patterns ?? []);
}

/** Rough session length: ~40s of work per set plus its rest; superset
 *  partners share one rest between them. Rounded to 5 minutes. */
export function estimateMinutes(
  slots: TemplateExerciseSlot[], workoutRest: number | undefined, defs: Record<string, ExerciseDefinition>,
): number {
  let sec = 0;
  for (const s of slots) {
    const rest = restForSlot(s, workoutRest, defs[s.exerciseId]);
    const shared = s.supersetGroup != null ? 0.5 : 1;
    sec += s.prescribedSets * (40 + rest * shared);
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** "Chest, Shoulders, Triceps · 18 sets · ~45 min" */
export function describeWorkout(
  slots: TemplateExerciseSlot[], workoutRest: number | undefined, defs: Record<string, ExerciseDefinition>,
): string {
  const muscles: MuscleGroup[] = [];
  for (const s of slots) { const m = defs[s.exerciseId]?.primaryMuscle ?? s.muscle; if (m && !muscles.includes(m)) muscles.push(m); }
  const sets = slots.reduce((a, s) => a + s.prescribedSets, 0);
  const parts = [muscles.map(cap).join(', ') || 'Custom', `${sets} set${sets === 1 ? '' : 's'}`, `~${estimateMinutes(slots, workoutRest, defs)} min`];
  return parts.join(' · ');
}

/**
 * Materialize template slots into session exercise entries, pre-filling each
 * set from the slot's starting weight / range low and carrying the saved set
 * structure (style, superset group, rest override). The def is authoritative
 * for metric and muscle; the slot's denormalized copies are the fallback.
 */
export function slotsToEntries(slots: TemplateExerciseSlot[], defs: Record<string, ExerciseDefinition>): ExerciseEntry[] {
  return slots.map((slot) => {
    const def = defs[slot.exerciseId];
    const muscle = def?.primaryMuscle ?? slot.muscle ?? 'core';
    const metric = def?.metric ?? 'weight-reps';
    const useReps = metric === 'weight-reps' || metric === 'reps';
    const useTime = metric === 'time' || metric === 'weight-time';
    const useWeight = metric === 'weight-reps' || metric === 'weight-time';
    const sets: SetEntry[] = Array.from({ length: slot.prescribedSets }, (_, i) => ({
      setIndex: i,
      weightKg: useWeight ? slot.startingWeightKg : undefined,
      reps: useReps ? slot.repsLow : undefined,
      timeSec: useTime ? slot.timeLow : undefined,
      completed: false,
    }));
    return {
      exerciseId: slot.exerciseId,
      name: def?.name ?? slot.name ?? slot.exerciseId,
      muscle,
      metric,
      prescribedSets: slot.prescribedSets,
      prescribedRepsLow: slot.repsLow,
      prescribedRepsHigh: slot.repsHigh,
      prescribedTimeLow: slot.timeLow,
      prescribedTimeHigh: slot.timeHigh,
      setStyle: slot.setStyle,
      supersetGroup: slot.supersetGroup,
      restSeconds: slot.restSeconds,
      sets,
    };
  });
}
