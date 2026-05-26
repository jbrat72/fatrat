/**
 * Infer a starting volume tier for each muscle from recent training history.
 * Used to pre-fill the tier picker when a user starts a library template, so
 * the suggestion reflects what they have actually been training.
 *
 * Pure function — no React, no Firestore.
 *
 * Heuristic: estimate weekly hard sets per muscle from the last 14 days of
 * completed sessions, then compare against the muscle's landmarks:
 *  - at/above MAV          → emphasize (already training it hard)
 *  - below MEV / untrained → maintain
 *  - in between            → grow
 */
import type { WorkoutSession, MuscleGroup, MuscleTier } from '@/types';
import { countHardSets, DEFAULT_LANDMARKS } from '@/lib/periodization';

const WINDOW_DAYS = 14;

export function inferTiers(
  sessions: WorkoutSession[],
  muscles: MuscleGroup[],
): Record<MuscleGroup, MuscleTier> {
  // Completed sessions within the recent window.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const recent = sessions.filter((s) => s.completed && s.date >= cutoffIso);

  // countHardSets sums the whole window; normalise to a per-week estimate.
  const total = countHardSets(recent);
  const weeks = WINDOW_DAYS / 7;

  const out = {} as Record<MuscleGroup, MuscleTier>;
  for (const m of muscles) {
    const perWeek = (total[m] ?? 0) / weeks;
    const lm = DEFAULT_LANDMARKS[m];
    if (perWeek <= 0 || perWeek < lm.mev) out[m] = 'maintain';
    else if (perWeek >= lm.mav) out[m] = 'emphasize';
    else out[m] = 'grow';
  }
  return out;
}
