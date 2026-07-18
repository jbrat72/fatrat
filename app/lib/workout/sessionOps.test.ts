import { describe, it, expect } from 'vitest';
import {
  adjustExercises, straighten, sweepPendingToSkips,
  workedMuscles, musclesMissingFeedback, findNextPending, nextFocusAfter,
} from './sessionOps';
import type { WorkoutSession, ExerciseEntry, MuscleGroup } from '@/types';

function ex(muscle: MuscleGroup, sets: Array<{ completed?: boolean; setType?: 'skip' | 'drop' }>, over: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    exerciseId: `${muscle}-x`, name: muscle, muscle,
    prescribedSets: sets.length,
    sets: sets.map((s, i) => ({ setIndex: i, completed: s.completed ?? false, setType: s.setType })),
    ...over,
  };
}
function mkSession(exercises: ExerciseEntry[]): WorkoutSession {
  return { id: 's1', userId: 'u1', date: '2026-07-01', dayOfWeek: 3, completed: false, exercises, cardio: [] };
}

describe('adjustExercises', () => {
  it('add appends N pending sets copying the last set values', () => {
    const out = adjustExercises([ex('chest', [{ completed: true }, {}])], 'chest', 'add', 2);
    expect(out[0]!.sets).toHaveLength(4);
    expect(out[0]!.prescribedSets).toBe(4);
    expect(out[0]!.sets.every((s, i) => s.setIndex === i)).toBe(true);
  });
  it('reduce removes pending sets from the end, never below one', () => {
    const out = adjustExercises([ex('chest', [{ completed: true }, {}, {}])], 'chest', 'reduce', 5);
    expect(out[0]!.sets).toHaveLength(1);
    expect(out[0]!.sets[0]!.completed).toBe(true);
  });
  it('skip drops unstarted exercises of the muscle, keeps started ones', () => {
    const started = ex('chest', [{ completed: true }, {}]);
    const unstarted = ex('chest', [{}, {}]);
    const other = ex('back', [{}]);
    const out = adjustExercises([started, unstarted, other], 'chest', 'skip', 0);
    expect(out).toEqual([started, other]);
  });
  it('does not touch other muscles', () => {
    const back = ex('back', [{}]);
    const out = adjustExercises([ex('chest', [{}]), back], 'chest', 'add', 1);
    expect(out[1]).toBe(back);
  });
});

describe('straighten', () => {
  it('unpairs supersets and drops drop-set rows', () => {
    const a = ex('chest', [{}, { setType: 'drop' }], { setStyle: 'drop', supersetGroup: 1 });
    const out = straighten([a]);
    expect(out[0]!.sets).toHaveLength(1);
    expect(out[0]!.supersetGroup).toBeUndefined();
    expect(out[0]!.setStyle).toBe('straight');
  });
});

describe('sweepPendingToSkips', () => {
  it('marks pending sets skipped and leaves logged sets alone', () => {
    const out = sweepPendingToSkips([ex('chest', [{ completed: true }, {}])]);
    expect(out[0]!.sets[0]!.setType).toBeUndefined();
    expect(out[0]!.sets[1]).toMatchObject({ completed: true, setType: 'skip' });
  });
});

describe('workedMuscles / musclesMissingFeedback', () => {
  it('counts performed sets only — skips and core excluded', () => {
    const s = mkSession([
      ex('chest', [{ completed: true }]),
      ex('back', [{ completed: true, setType: 'skip' }]),
      ex('core', [{ completed: true }]),
    ]);
    expect(workedMuscles(s)).toEqual(['chest']);
    expect(musclesMissingFeedback(s)).toEqual(['chest']);
  });
});

describe('focus helpers', () => {
  it('findNextPending walks forward then wraps', () => {
    const s = mkSession([ex('chest', [{ completed: true }, {}]), ex('back', [{}])]);
    expect(findNextPending(s)).toEqual({ exIdx: 0, setIdx: 1 });
    expect(findNextPending(s, { fromExercise: 1, fromSet: 0 })).toEqual({ exIdx: 1, setIdx: 0 });
    // wrap: nothing pending from ex1 set1 → falls back to first pending overall
    expect(findNextPending(s, { fromExercise: 1, fromSet: 1 })).toEqual({ exIdx: 0, setIdx: 1 });
  });
  it('nextFocusAfter alternates within a superset (A1 → B1 → A2 → B2)', () => {
    const a = ex('chest', [{}, {}], { supersetGroup: 1 });
    const b = ex('back', [{}, {}], { supersetGroup: 1 });
    const s = mkSession([a, b]);
    expect(nextFocusAfter(s, 0, 0)).toEqual({ exIdx: 1, setIdx: 0 }); // after A1 → B1
    expect(nextFocusAfter(s, 1, 0)).toEqual({ exIdx: 0, setIdx: 1 }); // after B1 → A2
  });
});
