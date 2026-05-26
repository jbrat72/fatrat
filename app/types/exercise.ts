/**
 * Exercise library types — global + per-user custom.
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'neck';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith';

export type MovementPattern =
  | 'compound'
  | 'isolation'
  | 'push'
  | 'pull'
  | 'hinge'
  | 'squat'
  | 'carry'
  | 'lunge';

/**
 * What an exercise tracks per set.
 *   'weight-reps'  — default; weight x reps (e.g. Bench Press)
 *   'reps'         — pure bodyweight; reps only, no external weight (e.g. Push-up)
 *   'time'         — isometric hold; seconds only, no weight or reps (e.g. Plank)
 *   'weight-time'  — loaded carry / weighted hold; weight + seconds (e.g. Farmer's Carry)
 */
export type ExerciseMetric = 'weight-reps' | 'reps' | 'time' | 'weight-time';

export interface ExerciseDefinition {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: EquipmentType;
  patterns: MovementPattern[];
  /** How sets are measured. Defaults to 'weight-reps' when omitted. */
  metric?: ExerciseMetric;
  /** True = custom user-created exercise; false = global library entry. */
  isCustom?: boolean;
  ownerUserId?: string; // only set when isCustom
}

/**
 * Per-user personalization of the exercise library. Lets a user curate the
 * shared catalog without changing it for anyone else.
 */
export interface UserExercisePrefs {
  /** Exercise ids the user has starred — surfaced first everywhere. */
  favorites: string[];
  /** Exercise ids the user has hidden — dropped from lists + program building. */
  hidden: string[];
}
