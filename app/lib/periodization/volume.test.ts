import { describe, it, expect } from 'vitest';
import { countHardSets, volumeStatus, volumeTrafficLight } from './volume';
import type { WorkoutSession } from '@/types';

const session: WorkoutSession = {
  id: 's1',
  userId: 'u',
  date: '2026-01-01',
  dayOfWeek: 1,
  completed: true,
  exercises: [
    {
      exerciseId: 'bench',
      name: 'Bench Press',
      muscle: 'chest',
      prescribedSets: 3,
      sets: [
        { setIndex: 0, weightKg: 100, reps: 8, rpe: 8, completed: true },
        { setIndex: 1, weightKg: 100, reps: 8, rpe: 8, completed: true },
        { setIndex: 2, weightKg: 100, reps: 7, rpe: 4, completed: true }, // too easy
        { setIndex: 3, weightKg: 100, reps: 0, completed: false },         // skipped
      ],
    },
    {
      exerciseId: 'row',
      name: 'Barbell Row',
      muscle: 'back',
      prescribedSets: 3,
      sets: [
        { setIndex: 0, weightKg: 90, reps: 8, rpe: 8, completed: true },
        { setIndex: 1, weightKg: 90, reps: 8, completed: true }, // no RPE -> counted
      ],
    },
  ],
  cardio: [],
};

describe('volume math', () => {
  it('counts only completed hard sets per muscle', () => {
    const counts = countHardSets([session]);
    expect(counts.chest).toBe(2);
    expect(counts.back).toBe(2);
  });

  it('classifies volume status', () => {
    expect(volumeStatus(5, { mev: 8, mav: 16, mrv: 22 })).toBe('below-mev');
    expect(volumeStatus(12, { mev: 8, mav: 16, mrv: 22 })).toBe('in-range');
    expect(volumeStatus(20, { mev: 8, mav: 16, mrv: 22 })).toBe('near-mrv');
    expect(volumeStatus(25, { mev: 8, mav: 16, mrv: 22 })).toBe('over-mrv');
  });

  it('maps status to traffic light colors', () => {
    expect(volumeTrafficLight('below-mev')).toBe('yellow');
    expect(volumeTrafficLight('in-range')).toBe('green');
    expect(volumeTrafficLight('near-mrv')).toBe('yellow');
    expect(volumeTrafficLight('over-mrv')).toBe('red');
  });
});
