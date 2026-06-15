import { describe, it, expect } from 'vitest';
import { hydrateFromHistory } from './hydrateFromHistory';
import type { WorkoutSession } from '@/types';

function mkSession(id: string, date: string, sets: Array<{ weight?: number; reps?: number; completed?: boolean }>): WorkoutSession {
  return {
    id, userId: 'u', date, dayOfWeek: 1, completed: false,
    exercises: [{
      exerciseId: 'bench', name: 'Bench', muscle: 'chest',
      prescribedSets: sets.length,
      sets: sets.map((s, i) => ({
        setIndex: i,
        weightKg: s.weight,
        reps: s.reps,
        completed: s.completed ?? false,
      })),
    }],
    cardio: [],
  };
}

describe('hydrateFromHistory', () => {
  it('backfills weight + reps from the most recent prior session', () => {
    const prior = mkSession('p1', '2026-05-01', [
      { weight: 100, reps: 8, completed: true },
      { weight: 100, reps: 7, completed: true },
      { weight: 100, reps: 6, completed: true },
    ]);
    const today = mkSession('t1', '2026-05-08', [
      {}, {}, {},
    ]);
    const out = hydrateFromHistory(today, [prior]);
    expect(out.exercises[0]!.sets.map((s) => s.weightKg)).toEqual([100, 100, 100]);
    expect(out.exercises[0]!.sets.map((s) => s.reps)).toEqual([8, 7, 6]);
  });

  it('falls back to last completed prior set when today has more sets', () => {
    const prior = mkSession('p1', '2026-05-01', [
      { weight: 100, reps: 8, completed: true },
    ]);
    const today = mkSession('t1', '2026-05-08', [{}, {}, {}]);
    const out = hydrateFromHistory(today, [prior]);
    expect(out.exercises[0]!.sets.map((s) => s.reps)).toEqual([8, 8, 8]);
  });

  it('does NOT overwrite if any set in today is already logged', () => {
    const prior = mkSession('p1', '2026-05-01', [{ weight: 100, reps: 8, completed: true }]);
    const today = mkSession('t1', '2026-05-08', [
      { weight: 80, reps: 10, completed: true }, // user already logged
      {},
    ]);
    const out = hydrateFromHistory(today, [prior]);
    expect(out).toBe(today);
  });

  it('preserves manual edits (existing weight/reps on a non-completed set)', () => {
    const prior = mkSession('p1', '2026-05-01', [{ weight: 100, reps: 8, completed: true }]);
    const today = mkSession('t1', '2026-05-08', [{ weight: 120, reps: 5 }]);
    const out = hydrateFromHistory(today, [prior]);
    expect(out.exercises[0]!.sets[0]!.weightKg).toBe(120);
    expect(out.exercises[0]!.sets[0]!.reps).toBe(5);
  });

  it('handles no history gracefully', () => {
    const today = mkSession('t1', '2026-05-08', [{}, {}, {}]);
    const out = hydrateFromHistory(today, []);
    expect(out.exercises[0]!.sets.every((s) => s.reps == null)).toBe(true);
  });

  it('never changes the set count, even when prior feedback asked for more volume', () => {
    const prior: WorkoutSession = {
      ...mkSession('p1', '2026-05-01', [{ weight: 100, reps: 8, completed: true }]),
      feedback: {
        perMuscle: [{ muscle: 'chest', volume: 'not-enough', pump: 'low', pain: 'none' }],
        jointPainOverall: 'none',
        collectedAt: '2026-05-01T00:00:00.000Z',
      },
    };
    // User trimmed today down to 3 sets.
    const today = mkSession('t1', '2026-05-08', [{}, {}, {}]);
    const out = hydrateFromHistory(today, [prior]);
    expect(out.exercises[0]!.sets).toHaveLength(3);
  });
});
