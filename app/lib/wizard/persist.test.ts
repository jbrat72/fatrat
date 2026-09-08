import { describe, it, expect } from 'vitest';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import { ALL_EQUIPMENT } from '@/lib/exercise/equipment';
import type { UserProfile } from '@/types';
import type { WizardState } from './types';
import { WIZARD_MUSCLES } from './types';
import { representativeWeek, generateWeek } from './engine';
import { buildWizardInput } from './persist';
import { buildCustomTemplate } from '@/lib/program/templateProgram';

const USER: UserProfile = {
  userId: 'u1', displayName: 'Tester', units: 'imperial', experience: '2yr-plus',
  periodizationFamiliarity: 'fuzzy', primaryGoal: 'build-muscle', daysPerWeek: 5,
  timePerSessionMin: 60, equipment: ['commercial-gym'], mode: 'INTERMEDIATE',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
};
function st(): WizardState {
  const s: WizardState = {
    name: 'My Plan', goal: { primary: 'muscle', secondary: null }, experience: { level: 'intermediate', status: 'consistent' },
    profile: { ageBand: '30', sex: 'male', bodyWeightKg: 84, injuries: [], stubbornAreas: [] },
    schedule: { daysPerWeek: 5, sessionMinutes: 60, startDow: 1, restDays: [3, 6, 0], durationWeeks: 8 },
    equipment: { environment: 'gym', items: ALL_EQUIPMENT, profileId: 'default' },
    trainingStyle: { baseStyle: 'bodybuilding', volumeFramework: 'evidence', periodizationStrategy: 'none' },
    split: { type: 'bro' }, prioritization: { tiers: {} },
    setsAndReps: { repRange: 'hypertrophy', setTypes: ['straight'], autoVary: false },
    restAndTempo: { restPreference: 'auto', tempoEnabled: false, tempoStyle: null },
    core: { method: 'block', frequency: '2x', blockExercises: '2-3', days: [] },
    cardio: { included: 'no', type: [], frequency: null, placement: null, durationMinutes: null },
    progression: { type: 'double', deloadProtocol: 'scheduled', deloadFrequency: 4, deloadStyle: 'volume' },
    baselines: { methods: {}, values: {}, calibrationWeek: false, allConservative: false },
  };
  WIZARD_MUSCLES.forEach((m) => (s.prioritization.tiers[m] = 'grow'));
  return s;
}

describe('buildWizardInput', () => {
  it('maps the reviewed week into a valid CustomProgramInput', () => {
    const s = st();
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const input = buildWizardInput(s, days, USER, GLOBAL_EXERCISES);
    expect(input.daysPerWeek).toBe(days.length);
    expect(input.week1.length).toBe(days.length);
    expect(input.weeks).toBe(8);
    expect(input.splitType).toBe('bro-split');
    expect(input.programStyle).toBe('periodization'); // evidence volume
    expect(input.workOffsets?.length).toBe(days.length);
    // every slot has a real library exercise id
    const ids = new Set(GLOBAL_EXERCISES.map((e) => e.id));
    input.week1.flat().forEach((slot) => { expect(ids.has(slot.exerciseId)).toBe(true); expect(slot.exerciseName.length).toBeGreaterThan(0); });
    expect(input.allowed.has('barbell')).toBe(true);
  });

  it('seeds startingWeights from a known 1RM on an anchor lift', () => {
    const s = st();
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const anchor = days.flatMap((d) => d.exercises).find((e) => e.anchor && e.exerciseId);
    expect(anchor).toBeTruthy();
    const id = anchor!.exerciseId as string;
    s.baselines.methods[id] = 'known';
    s.baselines.values[id] = { oneRM: 100 }; // imperial lb
    const input = buildWizardInput(s, days, USER, GLOBAL_EXERCISES);
    const sw = input.startingWeights?.[id];
    expect(sw).toBeTruthy();
    // 100 lb 1RM -> ~78.9 lb working for 8 reps -> ~35.8 kg
    expect(sw!.weightKg!).toBeGreaterThan(30);
    expect(sw!.weightKg!).toBeLessThan(40);
  });

  it('carries exercise picks and core superset groups through to the saved template', () => {
    const s = st();
    s.core = { method: 'superset', frequency: 'every', blockExercises: '1-2', days: [] };
    const chestPool = GLOBAL_EXERCISES.filter((e) => e.primaryMuscle === 'chest');
    s.exercisePicks = { chest: [chestPool[2]!.id, chestPool[3]!.id] };
    s.split.fixedExercises = false; // rotated weeks must ALSO respect picks
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const input = buildWizardInput(s, days, USER, GLOBAL_EXERCISES);
    expect(input.exercisePicks).toEqual(s.exercisePicks);
    const tpl = buildCustomTemplate(input);
    for (const week of tpl.weeks) {
      const chest = week.days.flatMap((d) => d.exercises).filter((e) => chestPool.some((c) => c.id === e.exerciseId));
      expect(chest.length).toBeGreaterThan(0);
      expect(chest.every((e) => s.exercisePicks!.chest!.includes(e.exerciseId))).toBe(true);
    }
    // Every week-1 day has core paired with a lift via a shared superset group.
    for (const d of tpl.weeks[0]!.days) {
      const core = d.exercises.filter((e) => GLOBAL_EXERCISES.find((g) => g.id === e.exerciseId)?.primaryMuscle === 'core');
      expect(core.length).toBe(2);
      for (const c of core) {
        expect(c.setStyle).toBe('superset');
        expect(d.exercises.filter((e) => e !== c && e.supersetGroup === c.supersetGroup)).toHaveLength(1);
      }
    }
  });
});
