import { describe, it, expect } from 'vitest';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import type { WizardState } from './types';
import { WIZARD_MUSCLES } from './types';
import {
  weekStructure, muscleSetsForWeek, generateWeek, availableEquipment,
  representativeWeek, isVolumeRamped,
} from './engine';

function baseState(over: Partial<WizardState> = {}): WizardState {
  const s: WizardState = {
    name: 'Test',
    goal: { primary: 'muscle', secondary: null },
    experience: { level: 'intermediate', status: 'consistent' },
    profile: { ageBand: '30', sex: 'male', bodyWeightKg: 84, injuries: [], stubbornAreas: [] },
    schedule: { daysPerWeek: 5, sessionMinutes: 60, startDow: 1, restDays: [3, 6, 0], durationWeeks: 8 },
    equipment: { environment: 'commercial', items: [] },
    trainingStyle: { baseStyle: 'bodybuilding', volumeFramework: 'fixed', periodizationStrategy: 'none' },
    split: { type: 'bro' },
    prioritization: { tiers: {} },
    setsAndReps: { repRange: 'hypertrophy', setTypes: ['straight'], autoVary: false },
    restAndTempo: { restPreference: 'auto', tempoEnabled: false, tempoStyle: null },
    core: { method: 'block', frequency: '2x', blockExercises: '2-3', days: [] },
    cardio: { included: 'no', type: [], frequency: null, placement: null, durationMinutes: null },
    progression: { type: 'double', deloadProtocol: 'scheduled', deloadFrequency: 4, deloadStyle: 'volume' },
    baselines: { methods: {}, calibrationWeek: false, allConservative: false },
  };
  WIZARD_MUSCLES.forEach((m) => (s.prioritization.tiers[m] = 'grow'));
  return { ...s, ...over };
}

describe('wizard engine', () => {
  it('volume-drives exercise count: bro chest grow ~= 12 sets across multiple exercises', () => {
    const s = baseState();
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const chestDay = days.find((d) => d.type === 'Chest')!;
    const chestEx = chestDay.exercises.filter((e) => e.muscle === 'chest');
    const sets = chestEx.reduce((a, e) => a + e.sets, 0);
    expect(sets).toBe(muscleSetsForWeek(s, 'chest', wk, loadCount));
    expect(chestEx.length).toBeGreaterThanOrEqual(3); // not piled onto 1-2 exercises
    expect(chestEx.every((e) => /chest/i.test('chest'))).toBe(true);
  });

  it('reconciles: each muscle’s program sets == volume-card target (load week)', () => {
    const s = baseState();
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const got: Record<string, number> = {};
    days.forEach((d) => d.exercises.forEach((e) => { if (e.muscle !== 'core') got[e.muscle] = (got[e.muscle] || 0) + e.sets; }));
    WIZARD_MUSCLES.forEach((m) => {
      const target = muscleSetsForWeek(s, m, wk, loadCount);
      if ((got[m] || 0) > 0 || target > 0) expect(got[m] || 0).toBe(target);
    });
  });

  it('filters by equipment: dumbbell home gym produces no barbell lifts', () => {
    const s = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Adjustable'] }, split: { type: 'ul2' }, schedule: { daysPerWeek: 4, sessionMinutes: 60, startDow: 1, restDays: [3, 5, 6, 0], durationWeeks: 8 } });
    const avail = availableEquipment(s);
    expect(avail.has('barbell')).toBe(false);
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const all = days.flatMap((d) => d.exercises);
    const lib = new Map(GLOBAL_EXERCISES.map((e) => [e.id, e]));
    expect(all.every((e) => !e.exerciseId || lib.get(e.exerciseId)!.equipment !== 'barbell')).toBe(true);
  });

  it('week structure includes calibration + scheduled deloads', () => {
    const s = baseState({ baselines: { methods: {}, calibrationWeek: true, allConservative: false } });
    const { cols } = weekStructure(s);
    expect(cols[0].kind).toBe('cal');
    expect(cols.filter((c) => c.kind === 'deload').length).toBe(2); // every 4th week of 8
    expect(cols.filter((c) => c.kind === 'load').length).toBe(6);
  });

  it('evidence-based volume ramps across load weeks', () => {
    const s = baseState({ trainingStyle: { baseStyle: 'bodybuilding', volumeFramework: 'evidence', periodizationStrategy: 'none' } });
    expect(isVolumeRamped(s)).toBe(true);
    const { cols, loadCount } = weekStructure(s);
    const loads = cols.filter((c) => c.kind === 'load');
    const first = muscleSetsForWeek(s, 'chest', loads[0], loadCount);
    const last = muscleSetsForWeek(s, 'chest', loads[loads.length - 1], loadCount);
    expect(last).toBeGreaterThan(first);
  });
});
