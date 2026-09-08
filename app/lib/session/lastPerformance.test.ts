import { describe, it, expect } from 'vitest';
import { buildLastPerf, lookupLastPerf, lastSetOf } from './lastPerformance';
import type { WorkoutSession } from '@/types';

const mk = (id: string, date: string, exerciseId: string, name: string, sets: Array<Partial<WorkoutSession['exercises'][0]['sets'][0]>>): WorkoutSession => ({
  id, userId: 'u', date, dayOfWeek: 1, completed: true, cardio: [],
  exercises: [{ exerciseId, name, muscle: 'chest', prescribedSets: sets.length, sets: sets.map((s, i) => ({ setIndex: i, completed: true, ...s })) }],
});

describe('lastPerformance', () => {
  it('returns the most recent performed sets, by id then by name', () => {
    const perf = buildLastPerf([
      mk('a', '2026-05-01', 'bench', 'Bench Press', [{ weightKg: 80, reps: 8 }]),
      mk('b', '2026-05-08', 'bench-v2', 'bench press ', [{ weightKg: 85, reps: 6 }]),
      mk('c', '2026-05-15', 'bench', 'Bench Press', [{ weightKg: 90, reps: 5, setType: 'skip' }]), // skipped → not history
    ]);
    expect(lastSetOf(lookupLastPerf(perf, { exerciseId: 'bench', name: 'Bench Press' }))).toMatchObject({ weightKg: 80 });
    expect(lastSetOf(lookupLastPerf(perf, { exerciseId: 'new-id', name: 'Bench Press' }))).toMatchObject({ weightKg: 85 });
    expect(lookupLastPerf(perf, { exerciseId: 'nope', name: 'Nope' })).toBeUndefined();
  });
  it('excludes the current session', () => {
    const perf = buildLastPerf([mk('cur', '2026-05-15', 'bench', 'Bench', [{ weightKg: 100, reps: 1 }])], 'cur');
    expect(lookupLastPerf(perf, { exerciseId: 'bench', name: 'Bench' })).toBeUndefined();
  });
});
