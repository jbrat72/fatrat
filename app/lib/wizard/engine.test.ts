import { describe, it, expect } from 'vitest';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import { ALL_EQUIPMENT } from '@/lib/exercise/equipment';
import type { WizardState } from './types';
import { WIZARD_MUSCLES } from './types';
import {
  weekStructure, muscleSetsForWeek, generateWeek, availableEquipment,
  representativeWeek, isVolumeRamped, poolFor, coreDayIndices,
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
    equipment: { environment: 'gym', items: ALL_EQUIPMENT, profileId: 'default' },
    trainingStyle: { baseStyle: 'bodybuilding', volumeFramework: 'fixed', periodizationStrategy: 'none' },
    split: { type: 'bro' },
    prioritization: { tiers: {} },
    setsAndReps: { repRange: 'hypertrophy', setTypes: ['straight'], autoVary: false },
    restAndTempo: { restPreference: 'auto', tempoEnabled: false, tempoStyle: null },
    core: { method: 'block', frequency: '2x', blockExercises: '2-3', days: [] },
    cardio: { included: 'no', type: [], frequency: null, placement: null, durationMinutes: null },
    progression: { type: 'double', deloadProtocol: 'scheduled', deloadFrequency: 4, deloadStyle: 'volume' },
    baselines: { methods: {}, values: {}, calibrationWeek: false, allConservative: false },
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
    const s = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Adjustable'], profileId: 'default' }, split: { type: 'ul2' }, schedule: { daysPerWeek: 4, sessionMinutes: 60, startDow: 1, restDays: [3, 5, 6, 0], durationWeeks: 8 } });
    const avail = availableEquipment(s);
    expect(avail.has('barbell')).toBe(false);
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const all = days.flatMap((d) => d.exercises);
    const lib = new Map(GLOBAL_EXERCISES.map((e) => [e.id, e]));
    expect(all.every((e) => !e.exerciseId || lib.get(e.exerciseId)!.equipment !== 'barbell')).toBe(true);
  });

  it('week structure includes calibration + scheduled deloads', () => {
    const s = baseState({ baselines: { methods: {}, values: {}, calibrationWeek: true, allConservative: false } });
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
    const names = poolFor('core', GLOBAL_EXERCISES, s.equipment.items, new Set()).map((e) => e.name);
    expect(names).toContain('Plank');
    expect(names).toContain('Side Plank');
    expect(names).toContain('Decline Sit-up');
  });

  it('equipment-specific bodyweight moves are gated by the granular checklist', () => {
    // home gym WITHOUT ab wheel / pull-up bar
    const s = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Adjustable'], profileId: 'default' } });
    const items = s.equipment.items;
    const core = poolFor('core', GLOBAL_EXERCISES, items, new Set()).map((e) => e.name);
    expect(core).not.toContain('Ab Wheel Rollout');     // needs Ab Wheel
    expect(core).not.toContain('Hanging Leg Raise');    // needs Pull-Up Bar
    expect(core).toContain('Plank');                    // pure bodyweight — still there
    const back = poolFor('back', GLOBAL_EXERCISES, items, new Set()).map((e) => e.name);
    expect(back).not.toContain('Pull-up');              // needs Pull-Up Bar
    // now WITH ab wheel + pull-up bar
    const s2 = baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Ab Wheel', 'Pull-Up Bar'], profileId: 'default' } });
    const core2 = poolFor('core', GLOBAL_EXERCISES, s2.equipment.items, new Set()).map((e) => e.name);
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

  it('requiresEquipment gates machines and benches by the checklist', () => {
    const q = (s: WizardState) => poolFor('quads', GLOBAL_EXERCISES, s.equipment.items, new Set()).map((e) => e.name);
    const ch = (s: WizardState) => poolFor('chest', GLOBAL_EXERCISES, s.equipment.items, new Set()).map((e) => e.name);
    expect(q(baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Leg Press'], profileId: 'default' } }))).toContain('Leg Press');
    expect(q(baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable'], profileId: 'default' } }))).not.toContain('Leg Press');
    // adjustable bench satisfies flat; also unlocks incline
    const adj = ch(baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Adjustable'], profileId: 'default' } }));
    expect(adj).toContain('Dumbbell Bench Press');
    expect(adj).toContain('Incline Dumbbell Bench Press');
    // flat bench only: flat ok, incline excluded
    const flat = ch(baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable', 'Bench — Flat'], profileId: 'default' } }));
    expect(flat).toContain('Dumbbell Bench Press');
    expect(flat).not.toContain('Incline Dumbbell Bench Press');
    // owning the full equipment list unlocks machines, etc.
    expect(q(baseState({ equipment: { environment: 'gym', items: ALL_EQUIPMENT, profileId: 'default' } }))).toContain('Leg Press');
    // dumbbell flat press is floor-capable — no bench required
    expect(ch(baseState({ equipment: { environment: 'home', items: ['Dumbbells — Adjustable'], profileId: 'default' } }))).toContain('Dumbbell Bench Press');
    // barbell lifts require a rack
    expect(q(baseState({ equipment: { environment: 'home', items: ['Barbell & Plates'], profileId: 'default' } }))).not.toContain('Back Squat');
    expect(q(baseState({ equipment: { environment: 'home', items: ['Barbell & Plates', 'Power / Squat Rack'], profileId: 'default' } }))).toContain('Back Squat');
    // floor lifts don't need a rack — barbell alone is enough
    const bk = (s: WizardState) => poolFor('back', GLOBAL_EXERCISES, s.equipment.items, new Set()).map((e) => e.name);
    const barOnly = bk(baseState({ equipment: { environment: 'home', items: ['Barbell & Plates'], profileId: 'default' } }));
    expect(barOnly).toContain('Deadlift');
    expect(barOnly).toContain('Barbell Row');
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

  it('exercise picks narrow the pool and all of a muscle’s sets land on them', () => {
    const s = baseState();
    const all = poolFor('chest', GLOBAL_EXERCISES, ALL_EQUIPMENT);
    const picked = all.slice(-2).map((e) => e.id); // two non-compound picks
    s.exercisePicks = { chest: picked };
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const chest = days.flatMap((d) => d.exercises).filter((e) => e.muscle === 'chest');
    expect(chest.length).toBeGreaterThan(0);
    expect(chest.every((e) => picked.includes(e.exerciseId!))).toBe(true);
    // Sets still reconcile with the volume card even with a 2-exercise pool.
    expect(chest.reduce((a, e) => a + e.sets, 0)).toBe(muscleSetsForWeek(s, 'chest', wk, loadCount));
  });

  it('a single pick is never listed twice in a day — it absorbs the sets', () => {
    const s = baseState();
    const one = poolFor('chest', GLOBAL_EXERCISES, ALL_EQUIPMENT)[0]!.id;
    s.exercisePicks = { chest: [one] };
    const { wk, loadCount } = representativeWeek(s);
    const chestDay = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount).find((d) => d.type === 'Chest')!;
    const chest = chestDay.exercises.filter((e) => e.muscle === 'chest');
    expect(chest).toHaveLength(1);
    expect(chest[0]!.sets).toBe(muscleSetsForWeek(s, 'chest', wk, loadCount));
  });

  it('picks that no longer resolve fall back to the full pool', () => {
    const pool = poolFor('chest', GLOBAL_EXERCISES, ALL_EQUIPMENT, new Set(), ['nope-1', 'nope-2']);
    expect(pool.length).toBe(poolFor('chest', GLOBAL_EXERCISES, ALL_EQUIPMENT).length);
  });

  it('core frequency limits which days get core work', () => {
    const s = baseState(); // 5 days, core block 2x
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    const withCore = days.filter((d) => d.exercises.some((e) => e.muscle === 'core'));
    expect(withCore).toHaveLength(2);
    expect(coreDayIndices(s, [1, 2, 3, 4, 5])).toEqual([0, 3]);
    s.core.frequency = 'every';
    expect(coreDayIndices(s, [1, 2, 3, 4, 5])).toEqual([0, 1, 2, 3, 4]);
    s.core.frequency = 'everyother';
    expect(coreDayIndices(s, [1, 2, 3, 4, 5])).toEqual([0, 2, 4]);
  });

  it('“superset between lifts” pairs each core exercise with a lift in a shared group', () => {
    const s = baseState();
    s.core = { method: 'superset', frequency: 'every', blockExercises: '1-2', days: [] };
    const { wk, loadCount } = representativeWeek(s);
    const days = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount);
    for (const d of days) {
      const core = d.exercises.filter((e) => e.muscle === 'core');
      expect(core).toHaveLength(2);
      for (const c of core) {
        expect(c.setStyle).toBe('superset');
        expect(c.supersetGroup).toBeDefined();
        const partners = d.exercises.filter((e) => e !== c && e.supersetGroup === c.supersetGroup);
        expect(partners).toHaveLength(1);
        expect(partners[0]!.muscle).not.toBe('core');
        expect(partners[0]!.setStyle).toBe('superset');
        // The core move sits directly after its partner lift.
        expect(d.exercises.indexOf(c)).toBe(d.exercises.indexOf(partners[0]!) + 1);
      }
    }
  });

  it('“dedicated core block” still appends straight core sets at the end', () => {
    const s = baseState();
    s.core = { method: 'block', frequency: 'every', blockExercises: '2-3', days: [] };
    const { wk, loadCount } = representativeWeek(s);
    const d = generateWeek(s, GLOBAL_EXERCISES, wk, loadCount)[0]!;
    const core = d.exercises.filter((e) => e.muscle === 'core');
    expect(core).toHaveLength(3);
    expect(core.every((e) => e.setStyle === 'straight' && e.supersetGroup == null)).toBe(true);
    expect(d.exercises.slice(-3).every((e) => e.muscle === 'core')).toBe(true);
  });
});
