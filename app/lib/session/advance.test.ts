import { describe, it, expect } from 'vitest';
import { planAdvance } from './advance';
import type { Microcycle, Mesocycle, WorkoutSession } from '@/types';

function micro(id: string, weekNumber: number, status: Microcycle['status']): Microcycle {
  return { id, mesocycleId: 'meso1', userId: 'u', weekNumber, splitType: 'PPL', status, sessionIds: [] };
}
function meso(id: string, weeks: number, weekIndex: number): Mesocycle {
  return { id, macrocycleId: 'macro1', userId: 'u', name: 'M', phaseType: 'hypertrophy', weeks, progressionScheme: 'rir-based', weekIndex, status: 'active', microcycleIds: [] };
}
function session(id: string, completed: boolean): WorkoutSession {
  return { id, userId: 'u', date: '2026-05-01', dayOfWeek: 1, completed, exercises: [], cardio: [] };
}

describe('planAdvance', () => {
  it('makes no changes when the week still has pending sessions', () => {
    const out = planAdvance({
      completedSession: session('s1', true),
      microSessions: [session('s1', true), session('s2', false), session('s3', false)],
      microcycle: micro('m1', 1, 'active'),
      micros: [micro('m1', 1, 'active'), micro('m2', 2, 'draft')],
      mesocycle: meso('meso1', 4, 0),
    });
    expect(out).toEqual({});
  });

  it('marks micro complete + activates next when last session of week is done', () => {
    const out = planAdvance({
      completedSession: session('s3', true),
      microSessions: [session('s1', true), session('s2', true), session('s3', true)],
      microcycle: micro('m1', 1, 'active'),
      micros: [micro('m1', 1, 'active'), micro('m2', 2, 'draft')],
      mesocycle: meso('meso1', 4, 0),
    });
    expect(out.microcycleCompleted?.status).toBe('completed');
    expect(out.microcycleActivated?.id).toBe('m2');
    expect(out.microcycleActivated?.status).toBe('active');
    expect(out.mesocycleWeekIndex).toBe(1);
    expect(out.mesocycleCompleted).toBeUndefined();
  });

  it('marks meso complete when last micro is finished', () => {
    const out = planAdvance({
      completedSession: session('s1', true),
      microSessions: [session('s1', true)],
      microcycle: micro('m4', 4, 'active'),
      micros: [
        micro('m1', 1, 'completed'),
        micro('m2', 2, 'completed'),
        micro('m3', 3, 'completed'),
        micro('m4', 4, 'active'),
      ],
      mesocycle: meso('meso1', 4, 3),
    });
    expect(out.microcycleCompleted?.id).toBe('m4');
    expect(out.microcycleActivated).toBeUndefined();
    expect(out.mesocycleCompleted?.id).toBe('meso1');
    expect(out.mesocycleCompleted?.status).toBe('completed');
  });
});
