import { describe, it, expect } from 'vitest';
import { ALL_EQUIPMENT } from '@/lib/exercise/equipment';
import type { WizardState } from './types';
import { BASIC_FLOW, ADVANCED_FLOW, wizardFlow } from './types';
import { applyBasicDefaults, applyBasicIdentity, defaultRestDays } from './defaults';

function blank(): WizardState {
  return {
    name: '',
    goal: { primary: null, secondary: null },
    experience: { level: null, status: null },
    profile: { ageBand: '30', sex: 'male', bodyWeightKg: 84, injuries: [], stubbornAreas: [] },
    schedule: { daysPerWeek: null, sessionMinutes: null, startDow: 1, restDays: [], durationWeeks: null },
    equipment: { environment: 'gym', items: ALL_EQUIPMENT, profileId: 'default' },
    trainingStyle: { baseStyle: null, volumeFramework: null, periodizationStrategy: null },
    split: { type: null },
    prioritization: { tiers: {} },
    setsAndReps: { repRange: null, setTypes: [], autoVary: false },
    restAndTempo: { restPreference: null, tempoEnabled: false, tempoStyle: null },
    core: { method: null, frequency: null, blockExercises: '2-3', days: [] },
    cardio: { included: null, type: [], frequency: null, placement: null, durationMinutes: null },
    progression: { type: null, deloadProtocol: null, deloadFrequency: null, deloadStyle: null },
    baselines: { methods: {}, values: {}, calibrationWeek: false, allConservative: false },
  };
}

describe('wizard flows', () => {
  it('basic asks equipment, schedule, style, split, core, exercises, then review + program', () => {
    expect(BASIC_FLOW).toEqual(['equipment', 'schedule', 'style', 'split', 'core', 'exercises', 'review', 'program']);
    expect(wizardFlow('basic')).toBe(BASIC_FLOW);
    expect(wizardFlow(undefined)).toBe(ADVANCED_FLOW); // pre-v0.108 states
  });
  it('advanced puts the Exercises page right before Review', () => {
    const i = ADVANCED_FLOW.indexOf('exercises');
    expect(ADVANCED_FLOW[i + 1]).toBe('review');
    expect(ADVANCED_FLOW[i + 2]).toBe('program');
    expect(ADVANCED_FLOW).toHaveLength(17);
  });
});

describe('applyBasicDefaults', () => {
  it('fills every question Basic never asks, leaving the asked ones alone', () => {
    const s = blank();
    applyBasicIdentity(s);
    // What the Basic pages collected:
    s.schedule.daysPerWeek = 4; s.schedule.sessionMinutes = 45; s.schedule.durationWeeks = 6;
    s.schedule.restDays = defaultRestDays(1, 4);
    s.trainingStyle.baseStyle = 'powerbuilding';
    s.split.type = 'ul2';
    s.core.method = 'superset'; s.core.frequency = '2x';
    applyBasicDefaults(s);

    expect(s.mode).toBe('basic');
    expect(s.goal.primary).toBe('muscle');
    expect(s.experience).toEqual({ level: 'intermediate', status: 'consistent' });
    // asked values untouched
    expect(s.schedule).toMatchObject({ daysPerWeek: 4, sessionMinutes: 45, durationWeeks: 6 });
    expect(s.trainingStyle.baseStyle).toBe('powerbuilding');
    expect(s.split.type).toBe('ul2');
    expect(s.core).toMatchObject({ method: 'superset', frequency: '2x' });
    // derived defaults
    expect(s.trainingStyle.volumeFramework).toBe('evidence');
    expect(s.trainingStyle.periodizationStrategy).toBe('dup');
    expect(Object.keys(s.prioritization.tiers)).toHaveLength(10);
    expect(s.setsAndReps.repRange).toBe('mixed');
    expect(s.setsAndReps.setTypes).toEqual(['straight']);
    expect(s.restAndTempo.restPreference).toBe('moderate');
    expect(s.cardio.included).toBe('no');
    expect(s.progression).toEqual({ type: 'undulating', deloadProtocol: 'scheduled', deloadFrequency: 4, deloadStyle: 'volume' });
  });

  it('is idempotent and never overrides an explicit answer', () => {
    const s = blank();
    s.goal.primary = 'strength';
    s.trainingStyle.baseStyle = 'powerlifting';
    applyBasicDefaults(s);
    const once = structuredClone(s);
    applyBasicDefaults(s);
    expect(s).toEqual(once);
    expect(s.goal.primary).toBe('strength');
    expect(s.setsAndReps.repRange).toBe('strength');
    expect(s.restAndTempo.restPreference).toBe('long');
    expect(s.prioritization.tiers.chest).toBe('emphasize');
  });
});
