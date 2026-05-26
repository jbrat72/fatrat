/**
 * Estimated 1RM — averaged Epley + Brzycki, valid in 3-10 rep range.
 * Returns 0 when inputs are non-positive.
 *
 * Epley:   1RM = w * (1 + reps/30)
 * Brzycki: 1RM = w * 36 / (37 - reps)
 *
 * If RPE is supplied, we adjust by approximating "reps if taken to failure":
 * effective_reps = reps + RIR, where RIR = 10 - rpe.
 */
import type { EffortRPE } from '@/types';
import { rirFromRPE } from './rpe';

export interface E1RMInput {
  weight: number;     // any unit; output uses the same unit
  reps: number;
  rpe?: EffortRPE;
}

const VALID_REP_MIN = 1;
const VALID_REP_MAX = 12; // we clamp display to 3-10 separately

export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps < VALID_REP_MIN) return 0;
  return weight * (1 + reps / 30);
}

export function brzycki1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps < VALID_REP_MIN || reps >= 37) return 0;
  return (weight * 36) / (37 - reps);
}

/** Averaged e1RM — preferred for charting/progression. */
export function estimate1RM({ weight, reps, rpe }: E1RMInput): number {
  if (weight <= 0 || reps < VALID_REP_MIN) return 0;
  const effectiveReps =
    rpe != null ? Math.max(VALID_REP_MIN, reps + rirFromRPE(rpe)) : reps;
  if (effectiveReps > VALID_REP_MAX + 6) {
    // Too far outside the valid band — the formulas drift; fall back to Epley.
    return epley1RM(weight, effectiveReps);
  }
  const e = epley1RM(weight, effectiveReps);
  const b = brzycki1RM(weight, effectiveReps);
  if (e === 0) return b;
  if (b === 0) return e;
  return (e + b) / 2;
}

/** True if the (reps, rpe) pair falls inside the band where e1RM is reliable. */
export function isReliableE1RM(reps: number, rpe?: EffortRPE): boolean {
  const effective = rpe != null ? reps + rirFromRPE(rpe) : reps;
  return effective >= 3 && effective <= 10;
}
