/**
 * Rep-range / hold-duration / metric helpers used when building a training
 * block from a template or the wizard.
 *
 * (The older bodyweight-based starting-weight *estimator* was removed with the
 * legacy Template Wizard — Plan Wizard v2 sources working weights from the
 * user's own baselines / calibration week instead.)
 *
 * Pure — no React, no Firestore.
 */
import type { ExerciseDefinition } from '@/types';

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
