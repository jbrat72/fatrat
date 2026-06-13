/**
 * Pure helpers for the day-of "structure" choices (supersets / pyramid / drop)
 * applied to a session's exercise list. Shared by the Today card editor.
 */
import type { ExerciseEntry, SetEntry, SetStyle } from '@/types';

/** Remove any auto-added drop set, reindexing what remains. */
export function clearDropSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.setType !== 'drop').map((s, i) => ({ ...s, setIndex: i }));
}

/** Apply a non-superset style to one exercise (drop appends a back-off set). */
function withStyle(ex: ExerciseEntry, style: SetStyle): ExerciseEntry {
  let sets = clearDropSets(ex.sets);
  if (style === 'drop') {
    const last = sets[sets.length - 1];
    const w = last?.weightKg != null ? Math.round((last.weightKg * 0.7) / 2.5) * 2.5 : undefined;
    sets = [...sets, { setIndex: sets.length, weightKg: w, completed: false, setType: 'drop' }];
  }
  return { ...ex, setStyle: style, supersetGroup: undefined, sets };
}

/** Set a straight/pyramid/drop style on one exercise, unlinking any superset. */
export function applyStyleAt(exs: ExerciseEntry[], idx: number, style: SetStyle): ExerciseEntry[] {
  const next = exs.map((e) => ({ ...e }));
  const cur = next[idx]!;
  if (cur.supersetGroup != null) {
    for (let k = 0; k < next.length; k++) {
      if (k !== idx && next[k]!.supersetGroup === cur.supersetGroup) next[k] = withStyle(next[k]!, 'straight');
    }
  }
  next[idx] = withStyle(cur, style);
  return next;
}

/** Pair two exercises into a (new) superset group, placed contiguously. */
export function pairSuperset(exs: ExerciseEntry[], a: number, b: number): ExerciseEntry[] {
  const next = exs.map((e) => ({ ...e }));
  const gid = Math.max(0, ...next.map((e) => e.supersetGroup ?? 0)) + 1;
  const clearGroupOf = (i: number) => {
    const g = next[i]!.supersetGroup;
    if (g == null) return;
    for (let k = 0; k < next.length; k++) if (next[k]!.supersetGroup === g) next[k] = withStyle(next[k]!, 'straight');
  };
  clearGroupOf(a); clearGroupOf(b);
  const exA: ExerciseEntry = { ...next[a]!, setStyle: 'superset', supersetGroup: gid, sets: clearDropSets(next[a]!.sets) };
  const exB: ExerciseEntry = { ...next[b]!, setStyle: 'superset', supersetGroup: gid, sets: clearDropSets(next[b]!.sets) };
  const insertAt = Math.min(a, b);
  const base = next.filter((_, i) => i !== a && i !== b);
  base.splice(insertAt, 0, exA, exB);
  return base;
}

/** Break a superset group back into straight sets. */
export function unlinkGroup(exs: ExerciseEntry[], group: number): ExerciseEntry[] {
  return exs.map((e) => (e.supersetGroup === group ? withStyle(e, 'straight') : e));
}

/** Set how many sets an exercise has, before logging. Keeps any completed
 *  sets, pads from the last set or trims the pending tail. */
export function setSetCount(exs: ExerciseEntry[], idx: number, count: number): ExerciseEntry[] {
  const next = exs.map((e) => ({ ...e }));
  const ex = next[idx]!;
  const completed = ex.sets.filter((s) => s.completed);
  const pending = ex.sets.filter((s) => !s.completed);
  const target = Math.max(completed.length, 1, count);
  const pendTarget = target - completed.length;
  const pend = pending.slice(0, pendTarget);
  const base = pending[pending.length - 1] ?? completed[completed.length - 1];
  while (pend.length < pendTarget) {
    pend.push({ setIndex: 0, weightKg: base?.weightKg, reps: base?.reps, timeSec: base?.timeSec, completed: false });
  }
  const sets = [...completed, ...pend].map((s, i) => ({ ...s, setIndex: i }));
  next[idx] = { ...ex, sets, prescribedSets: target };
  return next;
}

/** Map each superset group id → a display letter (A, B, …) in order. */
export function groupLetters(exs: ExerciseEntry[]): Map<number, string> {
  const map = new Map<number, string>();
  let n = 0;
  for (const e of exs) if (e.supersetGroup != null && !map.has(e.supersetGroup)) map.set(e.supersetGroup, String.fromCharCode(65 + n++));
  return map;
}

/**
 * Remove the exercise at `idx`. If it belonged to a superset group that's now
 * left with fewer than two members, that group is dissolved (remaining member
 * reverts to a straight set).
 */
export function removeExerciseAt(exs: ExerciseEntry[], idx: number): ExerciseEntry[] {
  const removed = exs[idx];
  let next = exs.filter((_, i) => i !== idx);
  const g = removed?.supersetGroup;
  if (g != null && next.filter((e) => e.supersetGroup === g).length < 2) {
    next = next.map((e) => (e.supersetGroup === g ? { ...e, supersetGroup: undefined, setStyle: 'straight' as const } : e));
  }
  return next;
}
