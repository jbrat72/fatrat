/**
 * Given the just-logged set + prescription, decide what to preload on the
 * NEXT (still-incomplete) set in the same exercise.
 *
 * Increments are unit-aware:
 *   - Metric  (kg):      small = 2.5 kg, big = 5 kg
 *   - Imperial (lb):     small = 5 lb,   big = 10 lb (most working weights)
 *                        small = 1 lb,   big = 2 lb  (dumbbells under 20 lb)
 *
 * Rules:
 *   - RPE >= 9.5 (failed)   → drop a "big" jump, reset reps to the low end
 *   - RPE >= 9 (grinding)   → drop a "small" jump, reset reps to the low end
 *   - Came in easy AND hit top of rep range → +"small" jump
 *   - Otherwise hold the just-used weight + reps
 *
 * The next set is always re-anchored to the just-logged set's weight so
 * failures cascade properly down a multi-set chain.
 */
import type { SetEntry, Units } from '@/types';

const LB_PER_KG = 2.20462;

function plateKgFor(units: Units, weightKg: number): { small: number; big: number } {
  if (units === 'imperial') {
    const lb = weightKg * LB_PER_KG;
    if (lb < 20) {
      // Small dumbbells — 1-lb jumps make sense.
      return { small: 1 / LB_PER_KG, big: 2 / LB_PER_KG };
    }
    return { small: 5 / LB_PER_KG, big: 10 / LB_PER_KG };
  }
  // metric
  return { small: 2.5, big: 5 };
}

function roundToDisplay(weightKg: number, units: Units): number {
  if (units === 'imperial') {
    const lb = weightKg * LB_PER_KG;
    // 0.5-lb precision under 20 lb (dumbbells), whole-lb above.
    const stepped = lb < 20 ? Math.round(lb * 2) / 2 : Math.round(lb);
    return stepped / LB_PER_KG;
  }
  // metric — 0.5 kg precision (matches the smallest plate pair).
  return Math.round(weightKg * 2) / 2;
}

export function nudgeNextSet(
  just: SetEntry,
  prescribedRepsLow: number | undefined,
  prescribedRepsHigh: number | undefined,
  prescribedRIR: number | undefined,
  nextRaw: SetEntry,
  units: Units = 'metric',
  /** The active microcycle's target RIR. Used to skip weight adjustments on
   *  "easy" weeks (RIR >= 2) — those sets are supposed to be easy, so the
   *  nudge holds weight steady regardless of how the prior set felt. Hard
   *  weeks (RIR <= 1, or no RIR known) get the full nudge behavior. */
  microTargetRIR?: number,
): SetEntry {
  if (!just.completed || just.weightKg == null) return nextRaw;
  if (nextRaw.completed) return nextRaw; // never overwrite a locked set

  const rpe = just.rpe ?? null;
  const reps = just.reps ?? 0;
  const high = prescribedRepsHigh ?? reps;
  const low = prescribedRepsLow;
  const targetRpe = prescribedRIR != null ? Math.max(1, Math.min(10, 10 - prescribedRIR)) : null;
  const { small, big } = plateKgFor(units, just.weightKg);

  // "Easy week" — the user is on a high-RIR week and is meant to leave reps
  // in the tank. Hold weight steady regardless of how the set felt. Reps
  // also stay as-is. (Ad-hoc / no-RIR contexts fall through to the full
  // nudge behavior — only an explicit easy-week signal disables it.)
  const isEasyWeek = microTargetRIR != null && microTargetRIR >= 2;
  if (isEasyWeek) {
    return { ...nextRaw, weightKg: roundToDisplay(just.weightKg, units), reps: nextRaw.reps };
  }

  let nextWeight = just.weightKg;
  let nextReps = nextRaw.reps;

  if (rpe != null && rpe >= 9.5) {
    nextWeight = Math.max(0, just.weightKg - big);
    if (low) nextReps = low;
  } else if (rpe != null && rpe >= 9) {
    nextWeight = Math.max(0, just.weightKg - small);
    if (low) nextReps = low;
  } else if (targetRpe != null && rpe != null && rpe <= targetRpe - 1 && reps >= high) {
    nextWeight = just.weightKg + small;
  }
  // Otherwise hold the just-used weight (already set above).

  return { ...nextRaw, weightKg: roundToDisplay(nextWeight, units), reps: nextReps };
}
