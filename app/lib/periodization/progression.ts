/**
 * Progressive overload engine.
 * Pure functions — given prior session performance, return the next prescription.
 *
 * The engine is mode-agnostic. Modes select which scheme is used.
 */
import type {
  ProgressionScheme,
  SetEntry,
  EffortRPE,
} from '@/types';
import { rirFromRPE } from './rpe';
import { isPerformedSet } from '@/lib/session/performedSets';

/** Top set among sets actually performed (skips carry prefilled weight/reps
 *  and must not drive the next prescription). */
function performedTopSet(sets: SetEntry[], requireValues = true): SetEntry | undefined {
  return sets
    .filter((s) => isPerformedSet(s) && (!requireValues || (s.weightKg != null && s.reps != null)))
    .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0];
}

export interface PriorPerformance {
  /** Sets logged in the most recent session of this exercise (most recent first not required). */
  sets: SetEntry[];
  /** Prescribed reps target from that session (low end of range). */
  prescribedRepsLow: number;
  prescribedRepsHigh: number;
  prescribedRIR?: number;
}

export interface Prescription {
  weightKg: number;
  reps: number;       // low end of range; UI may also show range
  sets: number;
  targetRIR: number;
  /** Plain-English rationale we can surface in higher modes. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Linear progression — BASIC default                                  */
/* ------------------------------------------------------------------ */

export interface LinearOptions {
  /** Increment to add when last session felt easy. */
  upKg?: number;
  /** Increment to subtract when last session was repeatedly hard. */
  downKg?: number;
  /** How many consecutive hard sessions before reducing. */
  hardStreakForDecrement?: number;
}

const DEFAULT_LINEAR: Required<LinearOptions> = {
  upKg: 2.5,
  downKg: 2.5,
  hardStreakForDecrement: 2,
};

/**
 * Linear: if the top set last time felt easy/just-right and reps were met, add weight.
 * Hold if it was hard but reps were met. Reduce if hard AND reps missed,
 * or if user has flagged repeated hard sessions upstream.
 */
export function nextLinear(
  prior: PriorPerformance,
  recentHardStreak = 0,
  opts: LinearOptions = {},
): Prescription {
  const o = { ...DEFAULT_LINEAR, ...opts };
  const topSet = performedTopSet(prior.sets);

  const lastWeight = topSet?.weightKg ?? 0;
  const lastReps = topSet?.reps ?? prior.prescribedRepsLow;
  const lastRpe: EffortRPE | undefined = topSet?.rpe;

  const metReps = lastReps >= prior.prescribedRepsLow;
  const wasHard = lastRpe != null ? lastRpe >= 9 : false;

  let weight = lastWeight;
  let note = 'Hold — same weight as last session.';

  if (recentHardStreak >= o.hardStreakForDecrement) {
    weight = Math.max(0, lastWeight - o.downKg);
    note = 'Reduced load — last few sessions felt hard.';
  } else if (metReps && !wasHard) {
    weight = lastWeight + o.upKg;
    note = `Added ${o.upKg} kg — last session went well.`;
  } else if (!metReps && wasHard) {
    weight = Math.max(0, lastWeight - o.downKg);
    note = 'Reduced load — missed reps and effort was high.';
  }

  return {
    weightKg: weight,
    reps: prior.prescribedRepsLow,
    sets: Math.max(1, prior.sets.length || 3),
    targetRIR: prior.prescribedRIR ?? 2,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* RIR-based progression — INTERMEDIATE/ADVANCED                       */
/* Holds load roughly constant, pushes effort closer to failure each   */
/* week by lowering target RIR.                                        */
/* ------------------------------------------------------------------ */

export function nextRIRBased(
  prior: PriorPerformance,
  weekIndex: number,
  weeksInMeso: number,
): Prescription {
  const topSet = performedTopSet(prior.sets);

  const lastWeight = topSet?.weightKg ?? 0;
  const lastRpe = topSet?.rpe;

  // Standard ramp: start at 3 RIR, drop ~1 per week until week N-1.
  const targetRIR = Math.max(0, 3 - weekIndex);

  // If user already hit target RIR last week, micro-bump weight ~2.5%.
  let weight = lastWeight;
  let note = `Same load, push to ${targetRIR} RIR.`;
  if (lastRpe != null && rirFromRPE(lastRpe) > targetRIR + 1) {
    weight = roundToPlate(lastWeight * 1.025);
    note = 'Slight load bump — you left reps in the tank.';
  }

  // Final week: hold load, target 0-1 RIR.
  if (weekIndex === weeksInMeso - 1) {
    note = 'Final push — target 0-1 RIR.';
  }

  return {
    weightKg: weight,
    reps: prior.prescribedRepsLow,
    sets: Math.max(1, prior.sets.length || 3),
    targetRIR,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Set progression — ADVANCED                                          */
/* Adds a set per week from MEV -> MRV, holds load.                    */
/* ------------------------------------------------------------------ */

export function nextSetProgression(
  prior: PriorPerformance,
  weekIndex: number,
  mev: number,
  mrv: number,
): Prescription {
  const topSet = performedTopSet(prior.sets, false);
  const sets = Math.min(mrv, mev + weekIndex);
  return {
    weightKg: topSet?.weightKg ?? 0,
    reps: prior.prescribedRepsLow,
    sets,
    targetRIR: Math.max(0, 3 - weekIndex),
    note: `Volume ramp: ${sets} sets this week.`,
  };
}

/* ------------------------------------------------------------------ */
/* Undulating — INTERMEDIATE/ADVANCED                                  */
/* Rotates rep-range targets within the week.                          */
/* ------------------------------------------------------------------ */

export function nextUndulating(
  prior: PriorPerformance,
  dayOfWeekIndex: number,
): Prescription {
  // 3-day cadence: heavy (5-6), moderate (8-10), light (12-15).
  const bands: Array<[number, number]> = [
    [5, 6],
    [8, 10],
    [12, 15],
  ];
  const [lo, hi] = bands[dayOfWeekIndex % bands.length]!;
  const topSet = performedTopSet(prior.sets, false);

  // Translate prior heavy set to lighter band roughly by % drop.
  const dropFactor = lo >= 10 ? 0.7 : lo >= 7 ? 0.85 : 1;
  const weight = roundToPlate((topSet?.weightKg ?? 0) * dropFactor);

  return {
    weightKg: weight,
    reps: lo,
    sets: Math.max(1, prior.sets.length || 3),
    targetRIR: 2,
    note: `Day target: ${lo}-${hi} reps.`,
  };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export interface DispatchContext {
  scheme: ProgressionScheme;
  prior: PriorPerformance;
  weekIndex: number;
  weeksInMeso: number;
  dayOfWeekIndex: number;
  recentHardStreak?: number;
  mev?: number;
  mrv?: number;
}

export function nextPrescription(ctx: DispatchContext): Prescription {
  switch (ctx.scheme) {
    case 'linear':
      return nextLinear(ctx.prior, ctx.recentHardStreak ?? 0);
    case 'rir-based':
      return nextRIRBased(ctx.prior, ctx.weekIndex, ctx.weeksInMeso);
    case 'set-progression':
      return nextSetProgression(
        ctx.prior,
        ctx.weekIndex,
        ctx.mev ?? 3,
        ctx.mrv ?? 8,
      );
    case 'undulating':
      return nextUndulating(ctx.prior, ctx.dayOfWeekIndex);
  }
}

/** Round to the nearest 2.5kg plate. */
export function roundToPlate(weightKg: number, plate = 2.5): number {
  if (weightKg <= 0) return 0;
  return Math.round(weightKg / plate) * plate;
}
