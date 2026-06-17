/**
 * Time-series builders for charts.
 *   weightSeries — top-set weight per session, chronological.
 *   e1rmSeries   — averaged Epley+Brzycki estimate per top set.
 */
import type { WorkoutSession, EffortRPE } from '@/types';
import { estimate1RM, isReliableE1RM } from '@/lib/periodization/e1rm';

export interface SeriesPoint {
  date: string;          // ISO
  sessionId: string;
  /** Top set weight in kg (or the metric the engine returns). */
  value: number;
  reps: number;
  rpe?: EffortRPE;
  isPR?: boolean;
}

function pickTopSet(sessionExercise: WorkoutSession['exercises'][number]) {
  return sessionExercise.sets
    .filter((s) => s.completed && s.weightKg != null && s.reps != null)
    .sort((a, b) => {
      if ((b.weightKg ?? 0) !== (a.weightKg ?? 0)) return (b.weightKg ?? 0) - (a.weightKg ?? 0);
      return (b.reps ?? 0) - (a.reps ?? 0);
    })[0];
}

export function weightSeries(
  sessions: WorkoutSession[],
  exerciseId: string,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!s.completed) continue; // only finished workouts feed progression
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const top = pickTopSet(ex);
    if (!top) continue;
    points.push({
      date: s.date,
      sessionId: s.id,
      value: top.weightKg!,
      reps: top.reps!,
      rpe: top.rpe,
    });
  }
  // Mark PRs (running max).
  let max = -Infinity;
  for (const p of points) {
    if (p.value > max) { max = p.value; p.isPR = true; }
  }
  return points;
}

export function e1rmSeries(
  sessions: WorkoutSession[],
  exerciseId: string,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!s.completed) continue; // only finished workouts feed progression
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const top = pickTopSet(ex);
    if (!top || !isReliableE1RM(top.reps!, top.rpe)) continue;
    const e1rm = estimate1RM({ weight: top.weightKg!, reps: top.reps!, rpe: top.rpe });
    if (e1rm <= 0) continue;
    points.push({
      date: s.date,
      sessionId: s.id,
      value: e1rm,
      reps: top.reps!,
      rpe: top.rpe,
    });
  }
  let max = -Infinity;
  for (const p of points) {
    if (p.value > max) { max = p.value; p.isPR = true; }
  }
  return points;
}

/** All distinct exercises the user has performed at least one logged set of. */
export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  totalSets: number;
  lastDate: string;
}

export function exerciseSummaries(sessions: WorkoutSession[]): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const logged = ex.sets.filter((x) => x.completed).length;
      if (logged === 0) continue;
      const cur = map.get(ex.exerciseId);
      if (!cur) {
        map.set(ex.exerciseId, {
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          totalSets: logged,
          lastDate: s.date,
        });
      } else {
        cur.totalSets += logged;
        if (s.date > cur.lastDate) cur.lastDate = s.date;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}
