/**
 * Time-series builders for charts.
 *   topSetSeries — metric-aware per-session "top set" for an exercise: heaviest
 *                  for weight-*, most reps for reps, longest hold for time. Each
 *                  point carries weight/reps/time so the chart can plot whichever
 *                  axis the exercise supports.
 *   weightSeries — top-set weight per session (weight-based exercises only).
 *   e1rmSeries   — averaged Epley+Brzycki estimate per top set (weight-reps).
 *
 * Only finished sessions feed these (a pending workout's sets must not appear),
 * and skipped sets are ignored.
 */
import type { WorkoutSession, EffortRPE, ExerciseMetric } from '@/types';
import { estimate1RM, isReliableE1RM } from '@/lib/periodization/e1rm';

type SessionExercise = WorkoutSession['exercises'][number];
export type ExerciseMatcher = (ex: SessionExercise) => boolean;

/** Match a logged exercise by its id (or the id it was swapped from). */
export function byExerciseId(id: string): ExerciseMatcher {
  return (ex) => ex.exerciseId === id || ex.swappedFromExerciseId === id;
}

/** Match by normalized name — consolidates the same exercise across id drift. */
export function byExerciseName(name: string): ExerciseMatcher {
  const n = name.trim().toLowerCase();
  return (ex) => ex.name.trim().toLowerCase() === n;
}

/** A bare id string is treated as an id match, for backward compatibility. */
function resolveMatcher(match: string | ExerciseMatcher): ExerciseMatcher {
  return typeof match === 'function' ? match : byExerciseId(match);
}

export function metricOf(ex: SessionExercise): ExerciseMetric {
  return ex.metric ?? 'weight-reps';
}

/**
 * The "top set" of an exercise this session, chosen by the exercise's metric:
 * weight-* → heaviest (tiebreak by reps/time); reps → most reps; time → longest
 * hold. Unlogged and skipped sets are ignored.
 */
function pickTopSet(ex: SessionExercise) {
  const metric = metricOf(ex);
  const done = ex.sets.filter((s) => s.completed && s.setType !== 'skip');
  let qualified: typeof done;
  switch (metric) {
    case 'reps':
      qualified = done.filter((s) => s.reps != null);
      qualified.sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0));
      break;
    case 'time':
      qualified = done.filter((s) => s.timeSec != null);
      qualified.sort((a, b) => (b.timeSec ?? 0) - (a.timeSec ?? 0));
      break;
    case 'weight-time':
      qualified = done.filter((s) => s.timeSec != null);
      qualified.sort((a, b) => ((b.weightKg ?? 0) - (a.weightKg ?? 0)) || ((b.timeSec ?? 0) - (a.timeSec ?? 0)));
      break;
    default: // weight-reps
      qualified = done.filter((s) => s.reps != null);
      qualified.sort((a, b) => ((b.weightKg ?? 0) - (a.weightKg ?? 0)) || ((b.reps ?? 0) - (a.reps ?? 0)));
  }
  return qualified[0];
}

export interface SeriesPoint {
  date: string;          // ISO
  sessionId: string;
  /** Primary value for the exercise's metric — weight(kg) for weight-*, reps for
   *  reps, seconds for time. Used for PR detection and as the e1RM value. */
  value: number;
  weightKg?: number;
  reps?: number;
  timeSec?: number;
  rpe?: EffortRPE;
  metric: ExerciseMetric;
  isPR?: boolean;
}

/** Flag running-max PRs over `value`. */
function markPRs(points: SeriesPoint[]) {
  let max = -Infinity;
  for (const p of points) {
    if (p.value > max) { max = p.value; p.isPR = true; }
  }
}

/** Metric-aware top-set series; one point per finished session. */
export function topSetSeries(
  sessions: WorkoutSession[],
  match: string | ExerciseMatcher,
): SeriesPoint[] {
  const matches = resolveMatcher(match);
  const points: SeriesPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!s.completed) continue;
    const ex = s.exercises.find(matches);
    if (!ex) continue;
    const top = pickTopSet(ex);
    if (!top) continue;
    const metric = metricOf(ex);
    const value =
      metric === 'reps' ? (top.reps ?? 0)
      : metric === 'time' ? (top.timeSec ?? 0)
      : (top.weightKg ?? 0);
    points.push({
      date: s.date,
      sessionId: s.id,
      value,
      weightKg: top.weightKg,
      reps: top.reps,
      timeSec: top.timeSec,
      rpe: top.rpe,
      metric,
    });
  }
  markPRs(points);
  return points;
}

/** Top-set weight per session, for weight-based exercises (value = weight kg). */
export function weightSeries(
  sessions: WorkoutSession[],
  match: string | ExerciseMatcher,
): SeriesPoint[] {
  const points = topSetSeries(sessions, match)
    .filter((p) => p.weightKg != null)
    .map((p) => ({ ...p, value: p.weightKg!, isPR: undefined }));
  markPRs(points); // PRs on weight, not the metric primary
  return points;
}

export function e1rmSeries(
  sessions: WorkoutSession[],
  match: string | ExerciseMatcher,
): SeriesPoint[] {
  const matches = resolveMatcher(match);
  const points: SeriesPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!s.completed) continue;
    const ex = s.exercises.find(matches);
    if (!ex) continue;
    const top = pickTopSet(ex);
    if (!top || top.weightKg == null || top.reps == null || !isReliableE1RM(top.reps, top.rpe)) continue;
    const e1rm = estimate1RM({ weight: top.weightKg, reps: top.reps, rpe: top.rpe });
    if (e1rm <= 0) continue;
    points.push({
      date: s.date,
      sessionId: s.id,
      value: e1rm,
      weightKg: top.weightKg,
      reps: top.reps,
      timeSec: top.timeSec,
      rpe: top.rpe,
      metric: metricOf(ex),
    });
  }
  markPRs(points);
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
