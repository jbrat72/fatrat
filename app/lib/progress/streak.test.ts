import { describe, it, expect } from 'vitest';
import { streakStats, isoWeekStamp } from './streak';
import type { WorkoutSession, UserProfile } from '@/types';

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: 'u', displayName: 'T', units: 'imperial',
    experience: '6mo-2yr', periodizationFamiliarity: 'fuzzy',
    primaryGoal: 'build-muscle', daysPerWeek: 3, timePerSessionMin: 60,
    equipment: ['commercial-gym'], mode: 'INTERMEDIATE',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
function s(id: string, date: string, completed = true): WorkoutSession {
  return { id, userId: 'u', date, dayOfWeek: 1, completed, exercises: [], cardio: [] };
}

describe('streakStats', () => {
  it('totalCompleted counts only completed sessions', () => {
    const out = streakStats([s('a','2026-05-01'), s('b','2026-05-02',false)], user(), new Date('2026-05-15'));
    expect(out.totalCompleted).toBe(1);
  });

  it('streak = 3 when last 3 weeks hit the plan', () => {
    // user planned 2 days/week. Anchor today = 2026-05-15 (Friday).
    const sessions = [
      s('a','2026-05-12'), s('b','2026-05-13'),  // week of 5/11
      s('c','2026-05-05'), s('d','2026-05-06'),  // week of 5/4
      s('e','2026-04-28'), s('f','2026-04-30'),  // week of 4/27
    ];
    const out = streakStats(sessions, user({ daysPerWeek: 2 }), new Date('2026-05-15'));
    expect(out.currentStreak).toBe(3);
  });

  it('current-week incomplete does NOT break the streak', () => {
    // user planned 2/wk. Today (Wed) only has 1 logged for this week → don't break.
    const sessions = [
      s('w0','2026-05-13'),               // 1 done this week
      s('p1','2026-05-04'), s('p2','2026-05-06'), // prior week complete
    ];
    const out = streakStats(sessions, user({ daysPerWeek: 2 }), new Date('2026-05-15'));
    expect(out.currentStreak).toBe(1);
  });

  it('thisWeek.done counts current-week completed', () => {
    const sessions = [s('a','2026-05-13'), s('b','2026-05-14')];
    const out = streakStats(sessions, user({ daysPerWeek: 3 }), new Date('2026-05-15'));
    expect(out.thisWeek.done).toBe(2);
    expect(out.thisWeek.planned).toBe(3);
  });
});

describe('isoWeekStamp', () => {
  it('Monday anchors stay on Monday', () => {
    expect(isoWeekStamp(new Date('2026-05-11'))).toBe('2026-05-11'); // a Monday
    expect(isoWeekStamp(new Date('2026-05-13'))).toBe('2026-05-11'); // Wednesday → that Monday
    expect(isoWeekStamp(new Date('2026-05-17'))).toBe('2026-05-11'); // Sunday → previous Monday
  });
});
