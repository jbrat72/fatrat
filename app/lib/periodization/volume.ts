/**
 * Volume math — hard sets per muscle group per week, plus MEV/MAV/MRV bands.
 * Used by both the engine and the volume dashboard (INTERMEDIATE/ADVANCED).
 */
import type { MuscleGroup, WorkoutSession, EffortRPE } from '@/types';
import { isWorkingSet } from '@/lib/session/performedSets';

/** A "hard set" is conventionally one taken to RPE >= 5 (>=5 RIR away from failure
 *  doesn't count). When effort is missing we still count completed sets. */
const HARD_SET_RPE_THRESHOLD: EffortRPE = 5;

export function countHardSets(sessions: WorkoutSession[]): Record<MuscleGroup, number> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        // Working sets only: skips (completed:true + setType:'skip', no RPE)
        // and warmups must not count toward weekly hard-set volume.
        if (!isWorkingSet(set)) continue;
        if (set.rpe != null && set.rpe < HARD_SET_RPE_THRESHOLD) continue;
        out[ex.muscle] = (out[ex.muscle] ?? 0) + 1;
      }
    }
  }
  return out as Record<MuscleGroup, number>;
}

/** Approximate per-muscle landmarks (Israetel-style). Per-user calibration TODO. */
export interface VolumeLandmarks {
  mev: number; // minimum effective volume
  mav: number; // maximum adaptive volume
  mrv: number; // maximum recoverable volume
}

export const DEFAULT_LANDMARKS: Record<MuscleGroup, VolumeLandmarks> = {
  chest:      { mev: 8,  mav: 16, mrv: 22 },
  back:       { mev: 10, mav: 18, mrv: 25 },
  shoulders:  { mev: 8,  mav: 16, mrv: 22 },
  biceps:     { mev: 6,  mav: 14, mrv: 20 },
  triceps:    { mev: 6,  mav: 14, mrv: 18 },
  forearms:   { mev: 0,  mav: 8,  mrv: 14 },
  quads:      { mev: 8,  mav: 16, mrv: 20 },
  hamstrings: { mev: 6,  mav: 14, mrv: 20 },
  glutes:     { mev: 0,  mav: 12, mrv: 16 },
  calves:     { mev: 6,  mav: 12, mrv: 18 },
  core:       { mev: 0,  mav: 12, mrv: 20 },
  neck:       { mev: 0,  mav: 6,  mrv: 12 },
};

export type VolumeStatus = 'below-mev' | 'in-range' | 'near-mrv' | 'over-mrv';

export function volumeStatus(
  hardSets: number,
  landmarks: VolumeLandmarks = { mev: 8, mav: 16, mrv: 22 },
): VolumeStatus {
  if (hardSets < landmarks.mev) return 'below-mev';
  if (hardSets > landmarks.mrv) return 'over-mrv';
  if (hardSets > landmarks.mav) return 'near-mrv';
  return 'in-range';
}

/** Simple green/yellow/red color used by INTERMEDIATE volume indicator. */
export function volumeTrafficLight(status: VolumeStatus): 'red' | 'yellow' | 'green' {
  switch (status) {
    case 'below-mev':  return 'yellow';
    case 'in-range':   return 'green';
    case 'near-mrv':   return 'yellow';
    case 'over-mrv':   return 'red';
  }
}
