/**
 * Pure in-workout session transforms + focus helpers. Extracted from the
 * workout page so the domain rules (soreness volume adjustments, straight-set
 * override, skip sweep, superset focus order) are testable and reusable
 * instead of living inside a 1000-line client component.
 */
import type { WorkoutSession, ExerciseEntry, SetEntry, MuscleGroup } from '@/types';
import { isPerformedSet } from '@/lib/session/performedSets';

/** What the soreness check-in decided to do with the muscle's volume today. */
export type SorenessAction = 'add' | 'reduce' | 'skip' | 'none';

/**
 * Apply a soreness-driven volume change to a session's exercise list.
 * `count` is the number of sets to add / remove per matching exercise — it
 * carries the tier-aware magnitude (emphasized muscles add two, etc.).
 */
export function adjustExercises(
  exercises: ExerciseEntry[],
  muscle: MuscleGroup,
  action: SorenessAction,
  count: number,
): ExerciseEntry[] {
  if (action === 'none') return exercises;
  if (action === 'skip') {
    // Drop the muscle's exercises that have not been started yet.
    return exercises.filter((ex) => ex.muscle !== muscle || ex.sets.some((s) => s.completed));
  }
  return exercises.map((ex) => {
    if (ex.muscle !== muscle) return ex;
    if (action === 'add') {
      const sets: SetEntry[] = [...ex.sets];
      for (let k = 0; k < count; k++) {
        const last = sets[sets.length - 1];
        sets.push({ setIndex: sets.length, weightKg: last?.weightKg, reps: last?.reps, completed: false });
      }
      return { ...ex, sets, prescribedSets: sets.length };
    }
    // reduce — drop up to `count` not-yet-completed sets, never below one set.
    let sets: SetEntry[] = [...ex.sets];
    for (let k = 0; k < count; k++) {
      if (sets.length <= 1) break;
      let removeIdx = -1;
      for (let i = sets.length - 1; i >= 0; i--) {
        if (!sets[i]!.completed) { removeIdx = i; break; }
      }
      if (removeIdx === -1) break;
      sets = sets.filter((_, i) => i !== removeIdx);
    }
    sets = sets.map((s, i) => ({ ...s, setIndex: i }));
    return { ...ex, sets, prescribedSets: sets.length };
  });
}

/**
 * Converts an exercise list to plain straight sets — un-pairs supersets, drops
 * the drop-set rows, and flattens pyramid steps. Used by the day-start override.
 */
export function straighten(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map((ex) => {
    let sets = ex.sets;
    if (ex.setStyle === 'drop') {
      sets = sets.filter((set) => set.setType !== 'drop').map((set, i) => ({ ...set, setIndex: i }));
    }
    if (ex.setStyle === 'pyramid') {
      const base = sets[0]?.weightKg;
      sets = sets.map((set) => ({ ...set, weightKg: base, reps: ex.prescribedRepsLow ?? set.reps }));
    }
    return { ...ex, setStyle: 'straight' as const, supersetGroup: undefined, sets };
  });
}

/**
 * The Finish sweep: every set never logged becomes a skip (completed:true +
 * setType:'skip') so finishing leaves no pending sets and history shows
 * programmed-but-skipped work. Stats go through isPerformedSet, which
 * filters these out.
 */
export function sweepPendingToSkips(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => (s.completed ? s : { ...s, completed: true, setType: 'skip' as const })),
  }));
}

/** True when every exercise for `muscle` has all its sets completed. */
export function muscleFinished(session: WorkoutSession, muscle: MuscleGroup): boolean {
  const exs = session.exercises.filter((e) => e.muscle === muscle);
  if (exs.length === 0) return false;
  let anyCompleted = false;
  for (const ex of exs) {
    for (const s of ex.sets) {
      if (s.completed) anyCompleted = true;
      else return false;
    }
  }
  return anyCompleted;
}

/** Muscles with at least one genuinely performed set this session.
 *  Core is intentionally excluded — feedback prompts skip it. */
export function workedMuscles(session: WorkoutSession): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const ex of session.exercises) {
    if (ex.muscle === 'core') continue;
    if (ex.sets.some(isPerformedSet)) seen.add(ex.muscle);
  }
  return [...seen];
}

/** Worked muscles that do not yet have feedback recorded. */
export function musclesMissingFeedback(session: WorkoutSession): MuscleGroup[] {
  const have = new Set((session.feedback?.perMuscle ?? []).map((p) => p.muscle));
  return workedMuscles(session).filter((m) => !have.has(m));
}

export function findNextPending(
  session: WorkoutSession,
  start: { fromExercise: number; fromSet: number } = { fromExercise: 0, fromSet: 0 },
): { exIdx: number; setIdx: number } | null {
  for (let i = start.fromExercise; i < session.exercises.length; i++) {
    const ex = session.exercises[i]!;
    const startSet = i === start.fromExercise ? start.fromSet : 0;
    for (let j = startSet; j < ex.sets.length; j++) {
      if (!ex.sets[j]!.completed) return { exIdx: i, setIdx: j };
    }
  }
  for (let i = 0; i < session.exercises.length; i++) {
    const ex = session.exercises[i]!;
    for (let j = 0; j < ex.sets.length; j++) {
      if (!ex.sets[j]!.completed) return { exIdx: i, setIdx: j };
    }
  }
  return null;
}

/**
 * The next set to focus after logging (exIdx, setIdx). For a superset, focus
 * alternates between the paired exercises (A1, B1, A2, B2 …); otherwise it is
 * the plain next pending set.
 */
export function nextFocusAfter(
  session: WorkoutSession,
  exIdx: number,
  setIdx: number,
): { exIdx: number; setIdx: number } | null {
  const group = session.exercises[exIdx]?.supersetGroup;
  if (group != null) {
    const gIdxs = session.exercises
      .map((e, i) => (e.supersetGroup === group ? i : -1))
      .filter((i) => i >= 0);
    const pos = gIdxs.indexOf(exIdx);
    const maxSets = Math.max(...gIdxs.map((i) => session.exercises[i]!.sets.length));
    let s = setIdx;
    let p = pos + 1;
    while (s < maxSets) {
      while (p < gIdxs.length) {
        const ei = gIdxs[p]!;
        const set = session.exercises[ei]!.sets[s];
        if (set && !set.completed) return { exIdx: ei, setIdx: s };
        p += 1;
      }
      p = 0;
      s += 1;
    }
    const lastIdx = gIdxs[gIdxs.length - 1]!;
    return findNextPending(session, { fromExercise: lastIdx + 1, fromSet: 0 });
  }
  return findNextPending(session, { fromExercise: exIdx, fromSet: setIdx + 1 });
}
