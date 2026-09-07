import { describe, it, expect } from 'vitest';
import { usableTemplateSlots } from './templateSlots';
import type { ProgramTemplate, ExerciseDefinition } from '@/types';

const defs: Record<string, ExerciseDefinition> = {
  rdl: { id: 'rdl', name: 'Dumbbell RDL', primaryMuscle: 'hamstrings', equipment: 'dumbbell' } as ExerciseDefinition,
  thrust: { id: 'thrust', name: 'Barbell Hip Thrust', primaryMuscle: 'glutes', equipment: 'barbell' } as ExerciseDefinition,
};

function tpl(isCustom: boolean): ProgramTemplate {
  return {
    id: 't', name: 'Day 1: Glutes', description: '', kind: 'workout', daysPerWeek: 1,
    split: 'upper-lower', defaultPhase: 'hypertrophy', progressionScheme: 'linear', minMode: 'BASIC',
    isCustom,
    weeks: [{ weekIndex: 0, days: [{ dayLabel: 'Workout', exercises: [
      { exerciseId: 'rdl', prescribedSets: 3 },
      { exerciseId: 'thrust', prescribedSets: 3 },
      { exerciseId: 'unknown', prescribedSets: 3 },
    ] }] }],
  } as ProgramTemplate;
}

// Dumbbells only — no barbell.
const items = ['Dumbbells — Fixed'];

describe('usableTemplateSlots', () => {
  it('filters a stock template through the user equipment, keeping unresolved defs', () => {
    const out = usableTemplateSlots(tpl(false), defs, items).map((s) => s.exerciseId);
    expect(out).toEqual(['rdl', 'unknown']);
  });

  it('never drops exercises from a custom workout — the author chose them', () => {
    // Regression: a 4-exercise custom workout opened with only the exercises
    // the DEFAULT equipment profile covered.
    const out = usableTemplateSlots(tpl(true), defs, items).map((s) => s.exerciseId);
    expect(out).toEqual(['rdl', 'thrust', 'unknown']);
  });
});
