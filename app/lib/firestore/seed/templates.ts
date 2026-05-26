import type { ProgramTemplate, TemplateExerciseSlot } from '@/types';

/** Build a simple uniform-week template (week 1 spec is reused; engine handles ramp). */
function week(days: { dayLabel: string; slots: TemplateExerciseSlot[] }[]) {
  return [{ weekIndex: 0, days: days.map((d) => ({ dayLabel: d.dayLabel, exercises: d.slots })) }];
}

const slot = (
  exerciseId: string,
  sets: number,
  repsLow: number,
  repsHigh: number,
  rir = 3,
): TemplateExerciseSlot => ({ exerciseId, prescribedSets: sets, repsLow, repsHigh, startingRIR: rir });

export const GLOBAL_TEMPLATES: ProgramTemplate[] = [
  /* ---- BASIC (3) ---- */
  {
    id: 'tpl-full-body-3x',
    name: 'Full Body, 3 days/week',
    description: 'Three short whole-body workouts per week. Great if you just want to stay strong and consistent.',
    daysPerWeek: 3,
    split: 'full-body',
    defaultPhase: 'hypertrophy',
    progressionScheme: 'linear',
    minMode: 'BASIC',
    goodForGoals: ['maintain', 'general-fitness'],
    weeks: week([
      { dayLabel: 'Day 1', slots: [
        slot('squat-back-barbell', 3, 5, 8),
        slot('bench-press-barbell', 3, 5, 8),
        slot('row-barbell', 3, 6, 10),
      ]},
      { dayLabel: 'Day 2', slots: [
        slot('rdl-barbell', 3, 6, 10),
        slot('ohp-barbell', 3, 5, 8),
        slot('lat-pulldown', 3, 8, 12),
      ]},
      { dayLabel: 'Day 3', slots: [
        slot('squat-back-barbell', 3, 6, 10),
        slot('bench-press-dumbbell', 3, 8, 12),
        slot('row-dumbbell', 3, 8, 12),
      ]},
    ]),
  },
  {
    id: 'tpl-tone-maintain',
    name: 'Tone & Maintain',
    description: 'Light strength work plus a little cardio. Good for staying fit without grinding.',
    daysPerWeek: 3,
    split: 'full-body',
    defaultPhase: 'hypertrophy',
    progressionScheme: 'linear',
    minMode: 'BASIC',
    goodForGoals: ['lose-fat', 'general-fitness', 'maintain'],
    weeks: week([
      { dayLabel: 'Day 1', slots: [
        slot('goblet-squat', 3, 10, 12),
        slot('bench-press-dumbbell', 3, 10, 12),
        slot('row-dumbbell', 3, 10, 12),
        slot('plank', 3, 30, 60),
      ]},
      { dayLabel: 'Day 2', slots: [
        slot('rdl-dumbbell', 3, 10, 12),
        slot('ohp-dumbbell', 3, 10, 12),
        slot('lat-pulldown', 3, 10, 12),
      ]},
      { dayLabel: 'Day 3', slots: [
        slot('lunge-dumbbell', 3, 10, 12),
        slot('pushup', 3, 8, 15),
        slot('row-cable-seated', 3, 10, 12),
      ]},
    ]),
  },
  {
    id: 'tpl-get-started',
    name: 'Get Started',
    description: 'A friendly introduction to lifting. Two short workouts a week and we build from there.',
    daysPerWeek: 2,
    split: 'full-body',
    defaultPhase: 'hypertrophy',
    progressionScheme: 'linear',
    minMode: 'BASIC',
    goodForGoals: ['general-fitness'],
    weeks: week([
      { dayLabel: 'Day 1', slots: [
        slot('goblet-squat', 2, 8, 12),
        slot('pushup', 2, 5, 10),
        slot('row-dumbbell', 2, 8, 12),
      ]},
      { dayLabel: 'Day 2', slots: [
        slot('rdl-dumbbell', 2, 8, 12),
        slot('ohp-dumbbell', 2, 8, 12),
        slot('lat-pulldown', 2, 8, 12),
      ]},
    ]),
  },

  /* ---- INTERMEDIATE / ADVANCED (3+) ---- */
  {
    id: 'tpl-ppl-6day',
    name: 'Push / Pull / Legs (6 days)',
    description: 'Six-day hypertrophy split. High frequency, plenty of volume per muscle.',
    daysPerWeek: 6,
    split: 'PPL',
    defaultPhase: 'hypertrophy',
    progressionScheme: 'rir-based',
    minMode: 'INTERMEDIATE',
    goodForGoals: ['build-muscle'],
    weeks: week([
      { dayLabel: 'Push A', slots: [
        slot('bench-press-barbell', 3, 6, 8),
        slot('ohp-dumbbell', 3, 8, 10),
        slot('chest-fly-cable', 3, 10, 12),
        slot('tricep-pushdown-cable', 3, 10, 12),
      ]},
      { dayLabel: 'Pull A', slots: [
        slot('row-barbell', 3, 6, 8),
        slot('lat-pulldown', 3, 8, 10),
        slot('face-pull', 3, 12, 15),
        slot('curl-dumbbell', 3, 8, 12),
      ]},
      { dayLabel: 'Legs A', slots: [
        slot('squat-back-barbell', 3, 5, 7),
        slot('rdl-barbell', 3, 6, 8),
        slot('leg-extension', 3, 10, 12),
        slot('calf-raise-standing', 4, 10, 12),
      ]},
      { dayLabel: 'Push B', slots: [
        slot('bench-press-incline-dumbbell', 3, 8, 10),
        slot('ohp-barbell', 3, 5, 8),
        slot('lateral-raise-cable', 3, 12, 15),
        slot('skull-crusher', 3, 8, 10),
      ]},
      { dayLabel: 'Pull B', slots: [
        slot('pull-up', 3, 5, 10),
        slot('row-cable-seated', 3, 10, 12),
        slot('rear-delt-fly-dumbbell', 3, 12, 15),
        slot('hammer-curl', 3, 8, 12),
      ]},
      { dayLabel: 'Legs B', slots: [
        slot('squat-front-barbell', 3, 5, 7),
        slot('leg-press', 3, 8, 10),
        slot('leg-curl-seated', 3, 10, 12),
        slot('calf-raise-seated', 4, 12, 15),
      ]},
    ]),
  },
  {
    id: 'tpl-upper-lower-4day',
    name: 'Upper / Lower (4 days)',
    description: 'Balanced four-day split. Solid choice for size and strength.',
    daysPerWeek: 4,
    split: 'upper-lower',
    defaultPhase: 'hypertrophy',
    progressionScheme: 'rir-based',
    minMode: 'INTERMEDIATE',
    goodForGoals: ['build-muscle', 'get-stronger'],
    weeks: week([
      { dayLabel: 'Upper A', slots: [
        slot('bench-press-barbell', 4, 5, 8),
        slot('row-barbell', 4, 6, 8),
        slot('ohp-dumbbell', 3, 8, 10),
        slot('curl-cable', 3, 10, 12),
      ]},
      { dayLabel: 'Lower A', slots: [
        slot('squat-back-barbell', 4, 4, 6),
        slot('rdl-barbell', 3, 6, 8),
        slot('leg-extension', 3, 10, 12),
        slot('calf-raise-standing', 4, 10, 12),
      ]},
      { dayLabel: 'Upper B', slots: [
        slot('bench-press-incline-dumbbell', 3, 8, 10),
        slot('pull-up', 3, 5, 10),
        slot('lateral-raise-dumbbell', 3, 12, 15),
        slot('tricep-pushdown-cable', 3, 10, 12),
      ]},
      { dayLabel: 'Lower B', slots: [
        slot('deadlift', 3, 3, 5),
        slot('lunge-dumbbell', 3, 8, 10),
        slot('leg-curl-lying', 3, 10, 12),
        slot('calf-raise-seated', 4, 12, 15),
      ]},
    ]),
  },
  {
    id: 'tpl-531-4day',
    name: '5/3/1 Style (4 days)',
    description: 'Strength-focused with submaximal main lifts. Slow, steady gains.',
    daysPerWeek: 4,
    split: 'upper-lower',
    defaultPhase: 'strength',
    progressionScheme: 'linear',
    minMode: 'ADVANCED',
    goodForGoals: ['get-stronger'],
    weeks: week([
      { dayLabel: 'Squat Day', slots: [
        slot('squat-back-barbell', 3, 3, 5, 1),
        slot('leg-press', 3, 8, 10),
        slot('plank', 3, 30, 60),
      ]},
      { dayLabel: 'Bench Day', slots: [
        slot('bench-press-barbell', 3, 3, 5, 1),
        slot('row-barbell', 3, 6, 8),
        slot('curl-barbell', 3, 8, 10),
      ]},
      { dayLabel: 'Deadlift Day', slots: [
        slot('deadlift', 3, 3, 5, 1),
        slot('rdl-barbell', 3, 6, 8),
        slot('hanging-leg-raise', 3, 6, 12),
      ]},
      { dayLabel: 'OHP Day', slots: [
        slot('ohp-barbell', 3, 3, 5, 1),
        slot('lat-pulldown', 3, 8, 10),
        slot('tricep-pushdown-cable', 3, 10, 12),
      ]},
    ]),
  },
];
