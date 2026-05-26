import { describe, it, expect } from 'vitest';
import { detectDeload } from './deload';
import type { WorkoutSession } from '@/types';

function mkSession(id: string, e1rmTopWeight: number): WorkoutSession {
  return {
    id,
    userId: 'u',
    date: '2026-01-01',
    dayOfWeek: 1,
    completed: true,
    exercises: [
      {
        exerciseId: 'squat',
        name: 'Back Squat',
        muscle: 'quads',
        prescribedSets: 3,
        sets: [
          { setIndex: 0, weightKg: e1rmTopWeight, reps: 5, rpe: 8, completed: true },
        ],
      },
    ],
    cardio: [],
  };
}

describe('deload detection', () => {
  it('fires at scheduled meso end', () => {
    const sig = detectDeload({
      mode: 'ADVANCED',
      weekInMeso: 3,
      weeksInMeso: 4,
      weeksSinceLastDeload: 3,
      recentSessions: [],
      mainLiftExerciseIds: ['squat'],
    });
    expect(sig.shouldDeload).toBe(true);
    expect(sig.reason).toBe('scheduled-meso-end');
  });

  it('BASIC fires every 5 weeks even without scheduled end', () => {
    const sig = detectDeload({
      mode: 'BASIC',
      weekInMeso: 1,
      weeksInMeso: 99,
      weeksSinceLastDeload: 5,
      recentSessions: [],
      mainLiftExerciseIds: ['squat'],
    });
    expect(sig.shouldDeload).toBe(true);
    expect(sig.reason).toBe('scheduled-basic-rotation');
  });

  it('fires on monotonic 3-session decline of e1RM', () => {
    const sessions = [
      mkSession('a', 140),
      mkSession('b', 135),
      mkSession('c', 130),
    ];
    const sig = detectDeload({
      mode: 'INTERMEDIATE',
      weekInMeso: 1,
      weeksInMeso: 4,
      weeksSinceLastDeload: 2,
      recentSessions: sessions,
      mainLiftExerciseIds: ['squat'],
    });
    expect(sig.shouldDeload).toBe(true);
    expect(sig.reason).toBe('performance-trend-down');
  });

  it('does not fire when performance is flat', () => {
    const sessions = [
      mkSession('a', 140),
      mkSession('b', 140),
      mkSession('c', 140),
    ];
    const sig = detectDeload({
      mode: 'INTERMEDIATE',
      weekInMeso: 1,
      weeksInMeso: 4,
      weeksSinceLastDeload: 2,
      recentSessions: sessions,
      mainLiftExerciseIds: ['squat'],
    });
    expect(sig.shouldDeload).toBe(false);
  });

  it('readiness trigger is ADVANCED-only', () => {
    const lowReadiness = [
      { date: 'd1', sleep: 2, soreness: 5, motivation: 1 },
      { date: 'd2', sleep: 1, soreness: 5, motivation: 2 },
      { date: 'd3', sleep: 2, soreness: 4, motivation: 1 },
    ];
    const adv = detectDeload({
      mode: 'ADVANCED',
      weekInMeso: 1,
      weeksInMeso: 4,
      weeksSinceLastDeload: 2,
      recentSessions: [],
      mainLiftExerciseIds: ['squat'],
      recentReadiness: lowReadiness,
    });
    expect(adv.shouldDeload).toBe(true);
    expect(adv.reason).toBe('low-readiness');

    const inter = detectDeload({
      mode: 'INTERMEDIATE',
      weekInMeso: 1,
      weeksInMeso: 4,
      weeksSinceLastDeload: 2,
      recentSessions: [],
      mainLiftExerciseIds: ['squat'],
      recentReadiness: lowReadiness,
    });
    expect(inter.shouldDeload).toBe(false);
  });
});
