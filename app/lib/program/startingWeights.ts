/**
 * Starting-weight + rep-range suggestions for a new training block.
 *
 * Two paths:
 *   1. History — if the user has completed sets of this exact exercise, the
 *      suggested weight is their heaviest recent completed working set.
 *   2. Estimate — for an exercise the user has never logged (or a brand-new
 *      user), estimate a working-set weight from bodyweight, sex, experience
 *      tier, the trained muscle, and the equipment.
 *
 * Pure — no React, no Firestore. Suggestions are a starting point; the user
 * confirms or adjusts them in the Template Wizard.
 */
import type {
  ExerciseDefinition,
  UserProfile,
  WorkoutSession,
  ExperienceTier,
  Sex,
  MuscleGroup,
  EquipmentType,
} from '@/types';

export type SuggestionBasis = 'history' | 'estimate';

export interface WeightSuggestion {
  /** Suggested working weight in kg. 0 for bodyweight-only movements. */
  weightKg: number;
  repsLow: number;
  repsHigh: number;
  basis: SuggestionBasis;
}

/**
 * Default rep range for an exercise, inferred from its movement patterns:
 * compound / squat / hinge movements get a lower range, isolation gets a
 * higher one, everything else a moderate 8-12.
 */
export function defaultRepRange(
  ex: ExerciseDefinition | undefined,
): { repsLow: number; repsHigh: number } {
  const patterns = ex?.patterns ?? [];
  if (patterns.includes('isolation')) return { repsLow: 10, repsHigh: 15 };
  if (
    patterns.includes('compound') ||
    patterns.includes('squat') ||
    patterns.includes('hinge')
  ) {
    return { repsLow: 6, repsHigh: 10 };
  }
  return { repsLow: 8, repsHigh: 12 };
}

/** Default hold/carry duration window for a time-based exercise (seconds). */
export function defaultTimeRange(
  ex: ExerciseDefinition | undefined,
): { timeLow: number; timeHigh: number } {
  if (ex?.patterns?.includes('carry')) return { timeLow: 30, timeHigh: 60 };
  // Isometric holds — start short, work up.
  return { timeLow: 30, timeHigh: 60 };
}

/** Convenience: what an exercise tracks per set. */
export function exerciseMetric(ex: ExerciseDefinition | undefined) {
  return ex?.metric ?? 'weight-reps';
}

/** Fallback bodyweight when the profile has none, in kg. */
const DEFAULT_BODYWEIGHT_KG = 75;

/**
 * Fraction of bodyweight a roughly-10-rep working set might use, calibrated
 * for an intermediate male training the muscle with a barbell. Equipment,
 * experience, and sex multipliers scale it from there.
 */
const MUSCLE_BW_FRACTION: Record<MuscleGroup, number> = {
  chest: 0.55,
  back: 0.55,
  shoulders: 0.34,
  biceps: 0.18,
  triceps: 0.2,
  forearms: 0.14,
  quads: 0.85,
  hamstrings: 0.5,
  glutes: 0.7,
  calves: 0.6,
  core: 0.12,
  neck: 0.08,
};

/** How the number a user enters relates to a barbell's absolute load. */
const EQUIPMENT_FACTOR: Record<EquipmentType, number> = {
  barbell: 1,
  smith: 0.92,
  machine: 0.78,
  cable: 0.5,
  dumbbell: 0.42, // per-hand
  kettlebell: 0.38,
  band: 0.12,
  bodyweight: 0,
};

const EXPERIENCE_MULT: Record<ExperienceTier, number> = {
  'lt6mo': 0.62,
  '6mo-2yr': 1,
  '2yr-plus': 1.4,
};

function sexMultiplier(sex: Sex | undefined): number {
  if (sex === 'female') return 0.62;
  if (sex === 'male') return 1;
  return 0.82; // other / prefer-not-to-say — a middle estimate
}

/** Round to the nearest 2.5 kg, never below zero. */
function roundKg(kg: number): number {
  return Math.max(0, Math.round(kg / 2.5) * 2.5);
}

/**
 * The heaviest completed working-set weight for an exercise across the user's
 * logged history, most recent session first. Returns null if never logged.
 */
function weightFromHistory(
  exerciseId: string,
  history: WorkoutSession[],
): number | null {
  const sessions = [...history]
    .filter((s) => s.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sessions) {
    const entry = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const weights = entry.sets
      .filter((s) => s.completed && s.weightKg != null && s.reps != null)
      .map((s) => s.weightKg as number);
    if (weights.length > 0) return Math.max(...weights);
  }
  return null;
}

/** Estimate a working-set weight from the user's profile, in kg. */
function weightFromEstimate(ex: ExerciseDefinition, user: UserProfile): number {
  if (ex.equipment === 'bodyweight') return 0;
  const bodyweight =
    user.weightKg && user.weightKg > 0 ? user.weightKg : DEFAULT_BODYWEIGHT_KG;
  const muscleFrac = MUSCLE_BW_FRACTION[ex.primaryMuscle] ?? 0.3;
  const equipmentFactor = EQUIPMENT_FACTOR[ex.equipment] ?? 0.6;
  const experience = EXPERIENCE_MULT[user.experience] ?? 1;
  const sex = sexMultiplier(user.sex);
  const isolation = (ex.patterns ?? []).includes('isolation') ? 0.72 : 1;
  return roundKg(
    bodyweight * muscleFrac * equipmentFactor * experience * sex * isolation,
  );
}

/**
 * Suggest a starting weight + rep range for an exercise. Prefers the user's
 * own logged history of the lift; otherwise estimates from their profile.
 */
export function suggestStartingWeight(
  ex: ExerciseDefinition,
  user: UserProfile,
  history: WorkoutSession[] = [],
): WeightSuggestion {
  const range = defaultRepRange(ex);
  const historical = weightFromHistory(ex.id, history);
  if (historical != null) {
    return {
      weightKg: roundKg(historical),
      repsLow: range.repsLow,
      repsHigh: range.repsHigh,
      basis: 'history',
    };
  }
  return {
    weightKg: weightFromEstimate(ex, user),
    repsLow: range.repsLow,
    repsHigh: range.repsHigh,
    basis: 'estimate',
  };
}
