/**
 * Shared formatting for a logged/prescribed set's value (the "30 lb × 10",
 * "× 6", "45s", or "Skipped" text). Metric- and unit-aware. Used by every
 * read-only set renderer so they stay consistent.
 */
import type { SetEntry, ExerciseMetric, Units, ExerciseEntry } from '@/types';
import { kgToDisplay, weightLabel } from './units';
import { formatSeconds } from './time';

/**
 * The prescribed hold/carry window (seconds) for a time-based exercise, as a
 * display string like "30–60s". Older plans were generated before time-based
 * exercises stored a prescribed range, leaving `prescribedTimeLow/High`
 * undefined — which rendered as "?–?s". Fall back to any time already on the
 * sets, then to the app's default 30–60s window (what current generation
 * seeds), so a time exercise always shows a real target.
 */
export function prescribedTimeLabel(ex: Pick<ExerciseEntry, 'prescribedTimeLow' | 'prescribedTimeHigh' | 'sets'>): string {
  const fromSets = ex.sets?.find((s) => s.timeSec != null)?.timeSec;
  const low = ex.prescribedTimeLow ?? fromSets ?? 30;
  const high = ex.prescribedTimeHigh ?? Math.max(low, 60);
  return `${low}–${high}s`;
}

export function formatSetValue(
  set: SetEntry,
  metric: ExerciseMetric,
  units: Units,
  completed = true,
): string {
  if (set.setType === 'skip') return 'Skipped';
  const ph = completed ? '—' : '?';
  const w = kgToDisplay(set.weightKg, units);
  const wl = weightLabel(units);
  const wStr = w != null ? `${w} ${wl}` : ph;
  switch (metric) {
    case 'time':        return set.timeSec != null ? formatSeconds(set.timeSec) : ph;
    case 'weight-time': return `${wStr} × ${set.timeSec != null ? formatSeconds(set.timeSec) : ph}`;
    case 'reps':        return `× ${set.reps ?? ph}`;
    default:            return `${wStr} × ${set.reps ?? ph}`;
  }
}

/**
 * Compact "previous performance" label for the PREV column in the in-workout
 * table — weight without its unit, e.g. "35 × 8", "× 12", or "45s". Returns
 * "—" when there's nothing recorded for that set last time.
 */
export function formatPrev(
  set: SetEntry | undefined,
  metric: ExerciseMetric,
  units: Units,
): string {
  if (!set || set.setType === 'skip') return '—';
  const w = kgToDisplay(set.weightKg, units);
  switch (metric) {
    case 'time':        return set.timeSec != null ? formatSeconds(set.timeSec) : '—';
    case 'weight-time': return `${w ?? '—'} × ${set.timeSec != null ? formatSeconds(set.timeSec) : '—'}`;
    case 'reps':        return set.reps != null ? `× ${set.reps}` : '—';
    default:            return w != null || set.reps != null ? `${w ?? '—'} × ${set.reps ?? '—'}` : '—';
  }
}
