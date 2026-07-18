/**
 * Calibration-week e1RM seeding.
 *
 * After the calibration week is completed, estimate each lift's e1RM from the
 * logged top sets (averaged Epley/Brzycki) and seed working weights into the
 * later weeks that don't yet have a weight. Best-effort: lifts without a
 * reliable estimate are skipped, and only weight-based exercises are touched.
 */
import type { DataRepository } from '@/lib/firestore/repository';
import type { Mesocycle, Microcycle } from '@/types';
import { estimate1RM, isReliableE1RM } from './e1rm';
import { isPerformedSet } from '@/lib/session/performedSets';

/** Inverse Epley — the working weight to hit `reps` given an estimated 1RM. */
function workingWeight(e1RM: number, reps: number): number {
  const w = e1RM / (1 + reps / 30);
  return Math.round(w * 2) / 2; // nearest 0.5 kg
}

export async function seedWeightsFromCalibration(
  repo: DataRepository,
  meso: Mesocycle,
  calMicro: Microcycle,
): Promise<void> {
  const calSessions = await repo.listSessionsInMicrocycle(calMicro.id);
  // Best reliable e1RM per exercise, from the calibration week's logged sets.
  const e1: Record<string, number> = {};
  for (const s of calSessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        // Skipped calibration sets carry prescribed weight/reps and no RPE —
        // without this filter they'd seed every later week from phantom lifts.
        if (!isPerformedSet(set) || set.weightKg == null || set.reps == null) continue;
        if (!isReliableE1RM(set.reps, set.rpe)) continue;
        const est = estimate1RM({ weight: set.weightKg, reps: set.reps, rpe: set.rpe });
        if (est > 0 && est > (e1[ex.exerciseId] ?? 0)) e1[ex.exerciseId] = est;
      }
    }
  }
  if (Object.keys(e1).length === 0) return;

  const micros = await repo.listMicrocycles(meso.id);
  const later = micros.filter((m) => m.weekNumber > calMicro.weekNumber);
  for (const m of later) {
    const sessions = await repo.listSessionsInMicrocycle(m.id);
    for (const s of sessions) {
      let changed = false;
      const exercises = s.exercises.map((ex) => {
        const est = e1[ex.exerciseId];
        if (est == null) return ex;
        // Only seed weighted lifts — added-load on bodyweight doesn't transfer.
        if (ex.metric && ex.metric !== 'weight-reps' && ex.metric !== 'weight-time') return ex;
        let exChanged = false;
        const sets = ex.sets.map((set) => {
          if (set.weightKg != null) return set;
          const reps = set.reps ?? ex.prescribedRepsLow;
          if (reps == null) return set;
          exChanged = true; changed = true;
          return { ...set, weightKg: workingWeight(est, reps) };
        });
        return exChanged ? { ...ex, sets } : ex;
      });
      if (changed) await repo.upsertSession({ ...s, exercises });
    }
  }
}
