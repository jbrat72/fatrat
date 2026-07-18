/**
 * Recap analytics for a completed (or near-complete) mesocycle.
 */
import type { WorkoutSession } from '@/types';
import { estimate1RM, isReliableE1RM } from '@/lib/periodization/e1rm';
import { isPerformedSet } from '@/lib/session/performedSets';

export interface MesoLiftStat {
  exerciseId: string;
  exerciseName: string;
  /** Earliest reliable e1RM in the meso. */
  startE1RM: number;
  /** Latest reliable e1RM in the meso. */
  endE1RM: number;
  /** End - Start (in the same units as recorded). */
  delta: number;
}

export interface MesoRecap {
  totalSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  rpeMean: number | null;
  rpeCompliance: number | null;
  liftGains: MesoLiftStat[];
}

/** Mean of an array of numbers, or null if empty. */
function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function recapMesocycle(sessions: WorkoutSession[], targetRIRs: number[]): MesoRecap {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  const allRPE: number[] = [];
  const complianceFlags: number[] = []; // 1 = within ±1 of target RIR, 0 = not

  // group e1RM samples per exercise
  const series = new Map<string, { name: string; first?: { date: string; e1: number }; last?: { date: string; e1: number } }>();

  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!s.completed) continue;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        // Skipped sets keep their prefilled weight/reps — they must not add
        // tonnage or feed the e1RM gain stats.
        if (!isPerformedSet(set) || set.weightKg == null || set.reps == null) continue;
        totalSets += 1;
        totalReps += set.reps;
        totalVolumeKg += set.weightKg * set.reps;
        if (set.rpe != null) {
          allRPE.push(set.rpe);
          if (targetRIRs.length > 0) {
            // assume average target across the meso; compliance ±1 RIR (i.e. ±1 RPE)
            const tgtRpe = 10 - (targetRIRs.reduce((a, b) => a + b, 0) / targetRIRs.length);
            complianceFlags.push(Math.abs(set.rpe - tgtRpe) <= 1 ? 1 : 0);
          }
        }
        if (isReliableE1RM(set.reps, set.rpe)) {
          const e1 = estimate1RM({ weight: set.weightKg, reps: set.reps, rpe: set.rpe });
          if (e1 > 0) {
            const cur = series.get(ex.exerciseId) ?? { name: ex.name };
            if (!cur.first || s.date < cur.first.date) cur.first = { date: s.date, e1 };
            if (!cur.last  || s.date > cur.last.date)  cur.last  = { date: s.date, e1 };
            cur.name = ex.name;
            series.set(ex.exerciseId, cur);
          }
        }
      }
    }
  }

  const liftGains: MesoLiftStat[] = [];
  for (const [id, v] of series.entries()) {
    if (!v.first || !v.last) continue;
    liftGains.push({
      exerciseId: id,
      exerciseName: v.name,
      startE1RM: v.first.e1,
      endE1RM:   v.last.e1,
      delta:     v.last.e1 - v.first.e1,
    });
  }
  liftGains.sort((a, b) => b.delta - a.delta);

  return {
    totalSessions: sessions.filter((s) => s.completed).length,
    totalSets,
    totalReps,
    totalVolumeKg,
    rpeMean:       mean(allRPE),
    rpeCompliance: mean(complianceFlags),
    liftGains,
  };
}
