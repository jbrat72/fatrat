/**
 * Shared formatting for a logged/prescribed set's value (the "30 lb × 10",
 * "× 6", "45s", or "Skipped" text). Metric- and unit-aware. Used by every
 * read-only set renderer so they stay consistent.
 */
import type { SetEntry, ExerciseMetric, Units } from '@/types';
import { kgToDisplay, weightLabel } from './units';

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
    case 'time':        return `${set.timeSec ?? ph}s`;
    case 'weight-time': return `${wStr} × ${set.timeSec ?? ph}s`;
    case 'reps':        return `× ${set.reps ?? ph}`;
    default:            return `${wStr} × ${set.reps ?? ph}`;
  }
}
