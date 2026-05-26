import { describe, it, expect } from 'vitest';
import { personalBests, bigFourPRs } from './personalBests';
import { weightSeries, e1rmSeries, exerciseSummaries } from './series';
import { weeklyVolume, muscleAtMRVRisk } from './volumeWeek';
import type { WorkoutSession } from '@/types';

function mkSession(opts: {
  id: string; date: string;
  squat?: { w: number; r: number; rpe?: number }[];
  bench?: { w: number; r: number; rpe?: number }[];
}): WorkoutSession {
  return {
    id: opts.id, userId: 'u', date: opts.date, dayOfWeek: 1, completed: true,
    exercises: [
      ...(opts.squat ? [{
        exerciseId: 'squat-back-barbell', name: 'Back Squat', muscle: 'quads' as const,
        prescribedSets: opts.squat.length,
        sets: opts.squat.map((s, i) => ({ setIndex: i, weightKg: s.w, reps: s.r, rpe: s.rpe, completed: true })),
      }] : []),
      ...(opts.bench ? [{
        exerciseId: 'bench-press-barbell', name: 'Barbell Bench Press', muscle: 'chest' as const,
        prescribedSets: opts.bench.length,
        sets: opts.bench.map((s, i) => ({ setIndex: i, weightKg: s.w, reps: s.r, rpe: s.rpe, completed: true })),
      }] : []),
    ],
    cardio: [],
  };
}

describe('personal bests', () => {
  it('returns the heaviest set per exercise', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-01-01', squat: [{ w: 100, r: 5 }] }),
      mkSession({ id: 's2', date: '2026-01-08', squat: [{ w: 110, r: 5 }] }),
      mkSession({ id: 's3', date: '2026-01-15', squat: [{ w: 100, r: 8 }] }),
    ];
    const prs = personalBests(sessions);
    expect(prs).toHaveLength(1);
    expect(prs[0]!.weightKg).toBe(110);
    expect(prs[0]!.reps).toBe(5);
  });

  it('tiebreaks heavier-set ties by reps', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-01-01', bench: [{ w: 100, r: 6 }] }),
      mkSession({ id: 's2', date: '2026-01-08', bench: [{ w: 100, r: 8 }] }),
    ];
    const prs = personalBests(sessions);
    expect(prs[0]!.reps).toBe(8);
  });

  it('omits exercises with no completed sets', () => {
    const sessions: WorkoutSession[] = [{
      id: 's1', userId: 'u', date: '2026-01-01', dayOfWeek: 1, completed: false,
      exercises: [{
        exerciseId: 'deadlift', name: 'Deadlift', muscle: 'back',
        prescribedSets: 3,
        sets: [{ setIndex: 0, weightKg: 100, reps: 5, completed: false }],
      }],
      cardio: [],
    }];
    expect(personalBests(sessions)).toHaveLength(0);
  });

  it('bigFourPRs preserves canonical order', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-01-01', bench: [{ w: 80, r: 5 }] }),
      mkSession({ id: 's2', date: '2026-01-02', squat: [{ w: 120, r: 5 }] }),
    ];
    const four = bigFourPRs(sessions);
    expect(four.map((p) => p.exerciseId)).toEqual(['squat-back-barbell', 'bench-press-barbell']);
  });
});

describe('series', () => {
  it('weightSeries is chronological and flags PRs at running max', () => {
    const sessions = [
      mkSession({ id: 's2', date: '2026-01-08', squat: [{ w: 110, r: 5 }] }),
      mkSession({ id: 's1', date: '2026-01-01', squat: [{ w: 100, r: 5 }] }),
      mkSession({ id: 's3', date: '2026-01-15', squat: [{ w: 105, r: 5 }] }),
    ];
    const pts = weightSeries(sessions, 'squat-back-barbell');
    expect(pts.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15']);
    expect(pts.map((p) => p.isPR)).toEqual([true, true, undefined]);
  });

  it('e1rmSeries skips unreliable rep ranges', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-01-01', squat: [{ w: 100, r: 2 }] }), // too few reps -> unreliable
      mkSession({ id: 's2', date: '2026-01-08', squat: [{ w: 100, r: 5 }] }), // OK
    ];
    const pts = e1rmSeries(sessions, 'squat-back-barbell');
    expect(pts).toHaveLength(1);
    expect(pts[0]!.value).toBeGreaterThan(100);
  });

  it('exerciseSummaries aggregates set counts', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-01-01', squat: [{ w: 100, r: 5 }, { w: 100, r: 5 }] }),
      mkSession({ id: 's2', date: '2026-01-08', squat: [{ w: 100, r: 5 }] }),
    ];
    const summary = exerciseSummaries(sessions);
    expect(summary[0]!.totalSets).toBe(3);
    expect(summary[0]!.lastDate).toBe('2026-01-08');
  });
});

describe('weekly volume', () => {
  it('counts hard sets per muscle with traffic light status', () => {
    // Push chest above MEV (8) by logging 10 hard sets
    const session: WorkoutSession = {
      id: 's1', userId: 'u', date: '2026-01-01', dayOfWeek: 1, completed: true,
      exercises: [{
        exerciseId: 'bench-press-barbell', name: 'Bench', muscle: 'chest',
        prescribedSets: 10,
        sets: Array.from({ length: 10 }, (_, i) => ({
          setIndex: i, weightKg: 100, reps: 8, rpe: 8, completed: true,
        })),
      }],
      cardio: [],
    };
    const entries = weeklyVolume([session]);
    const chest = entries.find((e) => e.muscle === 'chest')!;
    expect(chest.sets).toBe(10);
    expect(chest.light).toBe('green');
  });

  it('flags MRV risk', () => {
    const session: WorkoutSession = {
      id: 's1', userId: 'u', date: '2026-01-01', dayOfWeek: 1, completed: true,
      exercises: [{
        exerciseId: 'bench-press-barbell', name: 'Bench', muscle: 'chest',
        prescribedSets: 25,
        sets: Array.from({ length: 25 }, (_, i) => ({
          setIndex: i, weightKg: 100, reps: 8, rpe: 8, completed: true,
        })),
      }],
      cardio: [],
    };
    const entries = weeklyVolume([session]);
    const risky = muscleAtMRVRisk(entries);
    expect(risky.some((r) => r.muscle === 'chest')).toBe(true);
  });
});
