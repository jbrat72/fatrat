/**
 * Best-effort WizardState from a library ProgramTemplate, so "Use This Template"
 * can open the current Plan Wizard v2 seeded from a built-in program (replacing
 * the legacy template wizard). Maps the structure a template actually stores —
 * name, length, days, split metadata, tiers, rest, and the full week-1 program.
 * Goal / experience / baselines aren't in a template, so they reset for the user
 * to confirm in the wizard (same as editing an existing plan).
 */
import type { ProgramTemplate, UserProfile, MuscleGroup, ExerciseMetric } from '@/types';
import type { WizardState, GeneratedDay, GeneratedExercise, WizTier } from './types';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import { defaultProfileId, itemsForProfile, isBodyweightOnly } from '@/lib/exercise/equipment';

function baseState(user: UserProfile): WizardState {
  const eqProfileId = defaultProfileId(user);
  const eqItems = itemsForProfile(user, eqProfileId);
  return {
    name: '',
    goal: { primary: null, secondary: null },
    experience: { level: null, status: null },
    profile: {
      ageBand: '30', sex: user.sex === 'female' ? 'female' : 'male',
      bodyWeightKg: user.weightKg ?? 80, injuries: [], stubbornAreas: [],
    },
    schedule: { daysPerWeek: null, sessionMinutes: null, startDow: 1, restDays: [], durationWeeks: null },
    equipment: { environment: isBodyweightOnly(eqItems) ? 'bodyweight' : 'gym', items: eqItems, profileId: eqProfileId },
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

export function wizardFromTemplate(
  user: UserProfile,
  template: ProgramTemplate,
): { state: WizardState; program: Record<number, GeneratedDay[]> } {
  const defs = new Map(GLOBAL_EXERCISES.map((e) => [e.id, e]));
  const s = baseState(user);
  s.name = template.name;
  s.schedule.durationWeeks = template.weeks.length || null;
  if (template.muscleTiers) {
    s.prioritization.tiers = { ...(template.muscleTiers as Partial<Record<MuscleGroup, WizTier>>) };
  }
  if (template.restSeconds != null) {
    s.restAndTempo.restPreference =
      template.restSeconds <= 60 ? 'short' : template.restSeconds <= 120 ? 'moderate' : 'long';
  }

  const days = template.weeks[0]?.days ?? [];
  s.schedule.daysPerWeek = days.length || null;

  const program: Record<number, GeneratedDay[]> = {
    0: days.map((day, i): GeneratedDay => {
      const exercises = day.exercises.map((slot): GeneratedExercise => {
        const def = defs.get(slot.exerciseId);
        const metric: ExerciseMetric =
          def?.metric ?? (slot.timeLow != null && slot.repsLow == null ? 'time' : 'weight-reps');
        const timeBased = metric === 'time' || metric === 'weight-time';
        return {
          exerciseId: slot.exerciseId,
          name: def?.name ?? slot.name ?? slot.exerciseId,
          muscle: def?.primaryMuscle ?? slot.muscle ?? 'core',
          sets: slot.prescribedSets,
          reps: (timeBased ? slot.timeLow : slot.repsLow) ?? 0,
          metric,
          setStyle: 'straight',
          supersetGroup: undefined,
          anchor: false,
        };
      });
      return {
        dow: (s.schedule.startDow + i) % 7,
        type: '',
        emphasis: '',
        dayMuscles: Array.from(new Set(exercises.map((e) => e.muscle))) as MuscleGroup[],
        exercises,
      };
    }),
  };
  return { state: s, program };
}
