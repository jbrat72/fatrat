/**
 * Weekly hard-set volume by muscle group.
 * Filters sessions to a microcycle (or any window) and uses the existing
 * countHardSets logic from /lib/periodization/volume.
 */
import type { WorkoutSession, MuscleGroup } from '@/types';
import {
  countHardSets,
  DEFAULT_LANDMARKS,
  volumeStatus,
  volumeTrafficLight,
  type VolumeStatus,
  type VolumeLandmarks,
} from '@/lib/periodization/volume';

export interface WeeklyVolumeEntry {
  muscle: MuscleGroup;
  sets: number;
  landmarks: VolumeLandmarks;
  status: VolumeStatus;
  light: 'red' | 'yellow' | 'green';
}

const ALL_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'neck',
];

export function weeklyVolume(sessions: WorkoutSession[]): WeeklyVolumeEntry[] {
  const counts = countHardSets(sessions);
  return ALL_MUSCLES.map((m) => {
    const sets = counts[m] ?? 0;
    const landmarks = DEFAULT_LANDMARKS[m];
    const status = volumeStatus(sets, landmarks);
    return {
      muscle: m,
      sets,
      landmarks,
      status,
      light: volumeTrafficLight(status),
    };
  });
}

/** Muscles that exceeded MRV — surfaced to ADVANCED users as a warning callout. */
export function muscleAtMRVRisk(entries: WeeklyVolumeEntry[]): WeeklyVolumeEntry[] {
  return entries.filter((e) => e.status === 'over-mrv' || e.status === 'near-mrv');
}
