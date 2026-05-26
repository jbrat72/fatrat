import { describe, it, expect } from 'vitest';
import { generateProgram } from './generate';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed/exercises';
import { GLOBAL_TEMPLATES } from '@/lib/firestore/seed/templates';
import type { UserProfile } from '@/types';

function mkUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: 'u1',
    displayName: 'Test',
    units: 'imperial',
    experience: '6mo-2yr',
    periodizationFamiliarity: 'fuzzy',
    primaryGoal: 'build-muscle',
    daysPerWeek: 3,
    timePerSessionMin: 60,
    equipment: ['commercial-gym'],
    mode: 'INTERMEDIATE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('generateProgram', () => {
  const fullBody = GLOBAL_TEMPLATES.find((t) => t.id === 'tpl-full-body-3x')!;

  it('produces daysPerWeek × weeks sessions', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser({ daysPerWeek: 3 }),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
      weeks: 4,
    });
    expect(out.microcycles).toHaveLength(4);
    expect(out.sessions).toHaveLength(12);
    expect(out.macrocycle.status).toBe('active');
    expect(out.mesocycle.weeks).toBe(4);
  });

  it('ramps target RIR down across weeks (3 -> 2 -> 1 -> 0)', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser(),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
      weeks: 4,
    });
    expect(out.microcycles[0]!.targetRIR).toBe(3);
    expect(out.microcycles[1]!.targetRIR).toBe(2);
    expect(out.microcycles[2]!.targetRIR).toBe(1);
    expect(out.microcycles[3]!.targetRIR).toBe(0);
  });

  it('first microcycle is active, rest are draft', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser(),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
    });
    expect(out.microcycles[0]!.status).toBe('active');
    out.microcycles.slice(1).forEach((m) => expect(m.status).toBe('draft'));
  });

  it('uses baseline 1RM to seed conservative starting weights', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser({
        units: 'imperial',
        strengthBaseline: { squat: 300, bench: 200, deadlift: 400, overheadPress: 120 },
      }),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
    });
    const session0 = out.sessions[0]!;
    const squat = session0.exercises.find((e) => e.exerciseId === 'squat-back-barbell');
    expect(squat).toBeTruthy();
    const startWt = squat!.sets[0]!.weightKg;
    expect(startWt).toBeGreaterThan(0);
    // 300 lb 1RM ≈ 136 kg, at 75% (8-rep range floor 5) → ~115 kg, rounded to 2.5.
    expect(startWt!).toBeGreaterThanOrEqual(95);
    expect(startWt!).toBeLessThanOrEqual(130);
  });

  it('skips dumbbell-only user when only barbell exercises exist for a slot', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser({ equipment: ['dumbbells-only'] }),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
    });
    for (const session of out.sessions) {
      for (const ex of session.exercises) {
        const def = GLOBAL_EXERCISES.find((e) => e.id === ex.exerciseId);
        // After swap, the substituted exercise should be in the dumbbell/bodyweight set
        if (def) {
          expect(['dumbbell','bodyweight']).toContain(def.equipment);
        }
      }
    }
  });

  it('excluded lifts are swapped out', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser({
        constraints: { excludedLifts: ['Barbell Bench Press'] },
      }),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
    });
    for (const s of out.sessions) {
      for (const ex of s.exercises) {
        expect(ex.name.toLowerCase()).not.toBe('barbell bench press');
      }
    }
  });

  it('sessions are dated forward from start', () => {
    const out = generateProgram({
      template: fullBody,
      user: mkUser({ daysPerWeek: 3 }),
      startDate: '2026-05-04',
      exerciseLibrary: GLOBAL_EXERCISES,
    });
    const dates = out.sessions.map((s) => s.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! >= dates[i - 1]!).toBe(true);
    }
    expect(dates[0]).toBe('2026-05-04');
  });
});
