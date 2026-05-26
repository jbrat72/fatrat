/**
 * Deload / Easy-Week detection.
 *
 * Triggers (per spec):
 *   - Scheduled (end of meso, or every 5-6 weeks in BASIC).
 *   - Performance trending down 3+ sessions on main lifts.
 *   - User-logged declining readiness (sleep/soreness/motivation) — ADVANCED only.
 */
import type { WorkoutSession, UserMode } from '@/types';
import { estimate1RM } from './e1rm';

export type DeloadReason =
  | 'scheduled-meso-end'
  | 'scheduled-basic-rotation'
  | 'performance-trend-down'
  | 'low-readiness';

export interface DeloadSignal {
  shouldDeload: boolean;
  reason?: DeloadReason;
}

export interface ReadinessLog {
  date: string;     // ISO
  sleep: number;    // 1-5
  soreness: number; // 1-5 (5 = very sore)
  motivation: number; // 1-5
}

export interface DeloadInputs {
  mode: UserMode;
  weekInMeso: number;
  weeksInMeso: number;
  weeksSinceLastDeload: number;
  recentSessions: WorkoutSession[];   // chronological asc, most recent last
  mainLiftExerciseIds: string[];      // e.g. squat/bench/dl exercise ids
  recentReadiness?: ReadinessLog[];   // ADVANCED only
}

const PERFORMANCE_WINDOW = 3;

export function detectDeload(input: DeloadInputs): DeloadSignal {
  // 1) Scheduled — end of mesocycle.
  if (input.weekInMeso >= input.weeksInMeso - 1) {
    return { shouldDeload: true, reason: 'scheduled-meso-end' };
  }

  // 1b) BASIC mode: every 5-6 weeks a quiet easy week.
  if (input.mode === 'BASIC' && input.weeksSinceLastDeload >= 5) {
    return { shouldDeload: true, reason: 'scheduled-basic-rotation' };
  }

  // 2) Performance trend down on main lifts.
  const e1rms = mainLiftE1RMSeries(input.recentSessions, input.mainLiftExerciseIds);
  if (e1rms.length >= PERFORMANCE_WINDOW && trendingDown(e1rms, PERFORMANCE_WINDOW)) {
    return { shouldDeload: true, reason: 'performance-trend-down' };
  }

  // 3) Readiness — ADVANCED only.
  if (
    input.mode === 'ADVANCED' &&
    input.recentReadiness &&
    input.recentReadiness.length >= 3 &&
    lowReadiness(input.recentReadiness)
  ) {
    return { shouldDeload: true, reason: 'low-readiness' };
  }

  return { shouldDeload: false };
}

function mainLiftE1RMSeries(
  sessions: WorkoutSession[],
  mainLiftIds: string[],
): number[] {
  const result: number[] = [];
  for (const s of sessions) {
    let best = 0;
    for (const ex of s.exercises) {
      if (!mainLiftIds.includes(ex.exerciseId)) continue;
      for (const set of ex.sets) {
        if (!set.completed || set.weightKg == null || set.reps == null) continue;
        best = Math.max(
          best,
          estimate1RM({ weight: set.weightKg, reps: set.reps, rpe: set.rpe }),
        );
      }
    }
    if (best > 0) result.push(best);
  }
  return result;
}

function trendingDown(values: number[], windowN: number): boolean {
  const tail = values.slice(-windowN);
  if (tail.length < windowN) return false;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i]! >= tail[i - 1]!) return false;
  }
  return true;
}

function lowReadiness(logs: ReadinessLog[]): boolean {
  const tail = logs.slice(-3);
  // sleep low, soreness high, motivation low for all 3
  return tail.every(
    (l) => l.sleep <= 2 && l.soreness >= 4 && l.motivation <= 2,
  );
}

/** ~50% volume cap and RPE 6 ceiling for a deload week. */
export const DELOAD_VOLUME_FACTOR = 0.5;
export const DELOAD_RPE_CAP = 6;
