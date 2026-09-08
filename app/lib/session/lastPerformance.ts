/**
 * "Last time" lookup: the most recent performed sets per exercise across a
 * user's prior sessions, keyed by exercise id AND normalized name (the name
 * fallback catches ids that drifted between sessions — same rule the workout
 * screen's PREV column and hydrateFromHistory use).
 */
import type { WorkoutSession, SetEntry } from '@/types';
import { isPerformedSet } from './performedSets';

export interface LastPerf { byId: Record<string, SetEntry[]>; byName: Record<string, SetEntry[]> }

const nameKey = (n: string) => n.trim().toLowerCase();
const recorded = (s: SetEntry) => isPerformedSet(s) && (s.weightKg != null || s.reps != null || s.timeSec != null);

export function buildLastPerf(sessions: WorkoutSession[], excludeSessionId?: string): LastPerf {
  const byId: Record<string, SetEntry[]> = {};
  const byName: Record<string, SetEntry[]> = {};
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (s.id === excludeSessionId) continue;
    for (const ex of s.exercises) {
      const nk = nameKey(ex.name);
      if (byId[ex.exerciseId] && byName[nk]) continue;
      const done = ex.sets.filter(recorded);
      if (!done.length) continue;
      if (!byId[ex.exerciseId]) byId[ex.exerciseId] = done;
      if (nk && !byName[nk]) byName[nk] = done;
    }
  }
  return { byId, byName };
}

/** Sets from the last time this exercise was performed, or undefined. */
export function lookupLastPerf(perf: LastPerf, ex: { exerciseId: string; name: string; swappedFromExerciseId?: string }): SetEntry[] | undefined {
  return perf.byId[ex.exerciseId]
    ?? (ex.swappedFromExerciseId ? perf.byId[ex.swappedFromExerciseId] : undefined)
    ?? perf.byName[nameKey(ex.name)];
}

/** The heaviest/most representative set from a last-time list: the last one. */
export function lastSetOf(sets: SetEntry[] | undefined): SetEntry | undefined {
  return sets && sets.length ? sets[sets.length - 1] : undefined;
}
