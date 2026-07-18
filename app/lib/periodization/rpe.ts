import type { BasicFeel, IntermediateFeel, EffortRPE, UserMode } from '@/types';
import { effortShort } from './terminology';

/** Map BASIC mode's 3-button feel to RPE. */
export function rpeFromBasicFeel(feel: BasicFeel): EffortRPE {
  switch (feel) {
    case 'easy':       return 6;
    case 'just-right': return 7.5;
    case 'hard':       return 9;
  }
}

/** Map INTERMEDIATE mode's 5-button feel to RPE. */
export function rpeFromIntermediateFeel(feel: IntermediateFeel): EffortRPE {
  switch (feel) {
    case 'smooth':   return 6;
    case 'solid':    return 7;
    case 'tough':    return 8;
    case 'grinding': return 9;
    case 'failed':   return 10;
  }
}

/**
 * Reverse mapping for display:
 * given an RPE, what BasicFeel best represents it?
 * Used when downshifting a user from ADVANCED to BASIC — we never destroy
 * historical RPE values, but we present them as the nearest feel bucket.
 */
export function basicFeelFromRPE(rpe: EffortRPE): BasicFeel {
  if (rpe <= 6.5) return 'easy';
  if (rpe <= 8)   return 'just-right';
  return 'hard';
}

/** Display equivalent for INTERMEDIATE mode. */
export function intermediateFeelFromRPE(rpe: EffortRPE): IntermediateFeel {
  if (rpe <= 6.5) return 'smooth';
  if (rpe <= 7.5) return 'solid';
  if (rpe <= 8.5) return 'tough';
  if (rpe <= 9.5) return 'grinding';
  return 'failed';
}

/** RIR (reps-in-reserve) equivalent for an RPE. RIR = 10 - RPE, floor at 0. */
export function rirFromRPE(rpe: EffortRPE): number {
  return Math.max(0, 10 - rpe);
}

/** RPE given a target RIR. */
export function rpeFromRIR(rir: number): EffortRPE {
  return Math.max(1, Math.min(10, 10 - rir));
}

/** Short, mode-appropriate label for a recorded effort — e.g. "Solid",
 *  "Hard", or "RPE 8" — used in the in-workout PREV column.
 *  Thin alias over terminology.effortShort, which is the single source of
 *  truth for the buckets and casing (this used to be an independent copy
 *  that had drifted to "Just Right" vs "Just right"). */
export function effortFeelLabel(rpe: EffortRPE, mode: UserMode): string {
  return effortShort(mode, rpe);
}
