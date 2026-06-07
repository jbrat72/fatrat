import { describe, it, expect } from 'vitest';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import type { WizardState } from './types';
import { WIZARD_MUSCLES } from './types';
import {
  weekStructure, muscleSetsForWeek, generateWeek, availableEquipment,
  representativeWeek, isVolumeRamped, poolFor,
} from './engine';

function defaultRest(startDow: number, d: number): number[] {
  const DO: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  const work = new Set(DO[d] || []); const rest: number[] = [];
  for (let off = 0; off < 7; off++) if (!work.has(off)) rest.push((startDow + off) % 7);
  return rest;
}
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

  it('core pool includes time-based holds (plank, side plank)', () => {
    const s = baseState();
    const names = poolFor('core', GLOBAL_EXERCISES, availableEquipment(s), new Set()).map((e) => e.name);
    expect(names).toContain('Plank');
    expect(names).toContain('Side Plank');
    expect(names).toContain('Decline Sit-up');
  });

  it('equipment-specific bodyweight moves are gated by the granular checklist', () => {
    // home gym WITHOUT ab wheel / pull-up bar
    const s = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Adjustable'] } });
    const avail = availableEquipment(s); const items = new Set(s.equipment.items);
    const core = poolFor('core', GLOBAL_EXERCISES, avail, new Set(), items).map((e) => e.name);
    expect(core).not.toContain('Ab Wheel Rollout');     // needs Ab Wheel
    expect(core).not.toContain('Hanging Leg Raise');    // needs Pull-Up Bar
    expect(core).toContain('Plank');                    // pure bodyweight — still there
    const back = poolFor('back', GLOBAL_EXERCISES, avail, new Set(), items).map((e) => e.name);
    expect(back).not.toContain('Pull-up');              // needs Pull-Up Bar
    // now WITH ab wheel + pull-up bar
    const s2 = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Ab Wheel', 'Pull-Up Bar'] } });
    const core2 = poolFor('core', GLOBAL_EXERCISES, availableEquipment(s2), new Set(), new Set(s2.equipment.items)).map((e) => e.name);
    expect(core2).toContain('Ab Wheel Rollout');
  });

  it('time-based core exercises carry a time metric (seconds, not reps)', () => {
    const s = baseState(); // bro split, core method 'block'
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const coreEx = days.flatMap((d) => d.exercises).filter((e) => e.muscle === 'core');
    const plank = coreEx.find((e) => e.name === 'Plank');
    if (plank) { expect(plank.metric).toBe('time'); expect(plank.reps).toBe(30); }
    const lib = new Map(GLOBAL_EXERCISES.map((e) => [e.id, e]));
    coreEx.forEach((e) => { if (e.exerciseId) expect(e.metric).toBe(lib.get(e.exerciseId)!.metric ?? 'weight-reps'); });
  });

  it('core varies day to day (not the same exercises every day)', () => {
    const s = baseState({ split: { type: 'fb3' }, schedule: { daysPerWeek: 3, sessionMinutes: 60, startDow: 1, restDays: defaultRest(1, 3), durationWeeks: 8 } });
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const coreByDay = days.map((d) => d.exercises.filter((e) => e.muscle === 'core').map((e) => e.name).join(','));
    // at least two days should differ
    expect(new Set(coreByDay).size).toBeGreaterThan(1);
  });

  it('custom split honors the per-day muscle layout', () => {
    const s = baseState({
      split: { type: 'custom', customDays: [['chest', 'back'], ['quads', 'hamstrings']] },
      core: { method: 'none', frequency: null, blockExercises: '2-3', days: [] },
      schedule: { daysPerWeek: 2, sessionMinutes: 60, startDow: 1, restDays: defaultRest(1, 2), durationWeeks: 8 },
    });
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    expect(days.length).toBe(2);
    expect(new Set(days[0].exercises.map((e) => e.muscle))).toEqual(new Set(['chest', 'back']));
    expect(new Set(days[1].exercises.map((e) => e.muscle))).toEqual(new Set(['quads', 'hamstrings']));
  });
});
