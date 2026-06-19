/**
 * Shared formatting for a logged/prescribed set's value (the "30 lb × 10",
 * "× 6", "45s", or "Skipped" text). Metric- and unit-aware. Used by every
 * read-only set renderer so they stay consistent.
 */
import type { SetEntry, ExerciseMetric, Units } from '@/types';
import { kgToDisplay, weightLabel } from './units';
import { formatSeconds } from './time';

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
