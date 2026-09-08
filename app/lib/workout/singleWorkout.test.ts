import { describe, it, expect } from 'vitest';
import { inferCategory, repRangeForIntent, estimateMinutes, describeWorkout, slotsToEntries } from './singleWorkout';
import type { ExerciseDefinition, TemplateExerciseSlot } from '@/types';

const defs: Record<string, ExerciseDefinition> = {
  bench: { id: 'bench', name: 'Bench Press', primaryMuscle: 'chest', equipment: 'barbell', patterns: ['compound', 'push'] } as ExerciseDefinition,
  curl: { id: 'curl', name: 'Curl', primaryMuscle: 'biceps', equipment: 'dumbbell', patterns: ['isolation'] } as ExerciseDefinition,
  plank: { id: 'plank', name: 'Plank', primaryMuscle: 'core', equipment: 'bodyweight', metric: 'time' } as ExerciseDefinition,
};

describe('inferCategory', () => {
  it('classifies by the muscles trained, ignoring core', () => {
    expect(inferCategory(['chest', 'triceps', 'core'])).toBe('upper-body');
    expect(inferCategory(['quads', 'glutes'])).toBe('lower-body');
    expect(inferCategory(['core'])).toBe('core');
    expect(inferCategory(['chest', 'quads'])).toBe('full-body');
    expect(inferCategory([])).toBe('custom');
  });
});

describe('repRangeForIntent', () => {
  it('gives compounds and isolations different strength ranges', () => {
    expect(repRangeForIntent('strength', defs.bench)).toEqual({ repsLow: 4, repsHigh: 6 });
    expect(repRangeForIntent('strength', defs.curl)).toEqual({ repsLow: 6, repsHigh: 8 });
    expect(repRangeForIntent('endurance', defs.bench)).toEqual({ repsLow: 12, repsHigh: 20 });
    expect(repRangeForIntent('hypertrophy', defs.curl)).toEqual({ repsLow: 10, repsHigh: 15 });
  });
});

describe('describeWorkout / estimateMinutes', () => {
  const slots: TemplateExerciseSlot[] = [
    { exerciseId: 'bench', prescribedSets: 4 },
    { exerciseId: 'curl', prescribedSets: 3 },
    { exerciseId: 'plank', prescribedSets: 3, timeLow: 30, timeHigh: 60 },
  ];
  it('names muscles, totals sets, estimates time', () => {
    const d = describeWorkout(slots, 90, defs);
    expect(d).toMatch(/^Chest, Biceps, Core · 10 sets · ~\d+ min$/);
  });
  it('shorter rest → shorter estimate; supersets share rest', () => {
    const long = estimateMinutes(slots, 180, defs);
    const short = estimateMinutes(slots, 45, defs);
    expect(short).toBeLessThan(long);
    const ss = slots.map((s) => ({ ...s, setStyle: 'superset' as const, supersetGroup: 1 }));
    expect(estimateMinutes(ss, 180, defs)).toBeLessThan(long);
  });
  it('per-exercise rest override beats the workout rest', () => {
    const base = estimateMinutes([{ exerciseId: 'bench', prescribedSets: 10 }], 60, defs);
    const over = estimateMinutes([{ exerciseId: 'bench', prescribedSets: 10, restSeconds: 300 }], 60, defs);
    expect(over).toBeGreaterThan(base);
  });
});

describe('slotsToEntries', () => {
  it('carries structure, rest, prefills, and prefers the live def for metric', () => {
    const out = slotsToEntries([
      { exerciseId: 'bench', prescribedSets: 3, repsLow: 5, repsHigh: 8, startingWeightKg: 80, setStyle: 'superset', supersetGroup: 2, restSeconds: 150 },
      { exerciseId: 'plank', prescribedSets: 2, timeLow: 45, timeHigh: 60, muscle: 'core' },
      { exerciseId: 'gone', prescribedSets: 1, name: 'Deleted Move', muscle: 'back' },
    ], defs);
    expect(out[0]).toMatchObject({ name: 'Bench Press', muscle: 'chest', metric: 'weight-reps', setStyle: 'superset', supersetGroup: 2, restSeconds: 150, prescribedRepsLow: 5 });
    expect(out[0]!.sets.map((s) => [s.weightKg, s.reps])).toEqual([[80, 5], [80, 5], [80, 5]]);
    expect(out[1]).toMatchObject({ metric: 'time', muscle: 'core' });
    expect(out[1]!.sets[0]).toMatchObject({ timeSec: 45, weightKg: undefined, reps: undefined });
    // A slot whose exercise no longer exists still renders from its denormalized copy.
    expect(out[2]).toMatchObject({ name: 'Deleted Move', muscle: 'back' });
  });
});
