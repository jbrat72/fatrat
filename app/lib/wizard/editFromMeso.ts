/**
 * Reconstruct a (best-effort) wizard state from an already-activated plan, for
 * plans created before the wizard state was persisted on the template. Recovers
 * the structural choices the mesocycle + its week-1 sessions actually store
 * (name, length, equipment, muscle tiers, set types, fixed flag, and the full
 * week-1 program). Goal / experience / training-style aren't stored on the plan,
 * so those stay at their defaults for the user to re-confirm.
 */
import type { Mesocycle, UserProfile, WorkoutSession, MuscleGroup } from '@/types';
import type { WizardState, GeneratedDay, GeneratedExercise, WizTier } from './types';
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

export function wizardEditFromMeso(
  user: UserProfile,
  meso: Mesocycle,
  week1Sessions: WorkoutSession[],
): { state: WizardState; program: Record<number, GeneratedDay[]> } {
  const s = baseState(user);
  s.name = meso.name;
  s.schedule.durationWeeks = meso.weeks;
  if (meso.equipmentProfileId) {
    s.equipment.profileId = meso.equipmentProfileId;
    s.equipment.items = itemsForProfile(user, meso.equipmentProfileId);
    s.equipment.environment = isBodyweightOnly(s.equipment.items) ? 'bodyweight' : 'gym';
  }
  if (meso.muscleTiers) {
    s.prioritization.tiers = { ...(meso.muscleTiers as Partial<Record<MuscleGroup, WizTier>>) };
  }
  s.setsAndReps.setTypes = [...(meso.allowedSetTypes ?? [])];
  s.split.fixedExercises = meso.fixedExercises ?? true;
  if (meso.restSeconds != null) {
    s.restAndTempo.restPreference = meso.restSeconds <= 60 ? 'short' : meso.restSeconds <= 120 ? 'moderate' : 'long';
  }

  const days = [...week1Sessions].sort((a, b) => a.date.localeCompare(b.date));
  s.schedule.daysPerWeek = days.length || null;
  if (days[0]) s.schedule.startDow = days[0].dayOfWeek;

  const program: Record<number, GeneratedDay[]> = {
    0: days.map((sess): GeneratedDay => ({
      dow: sess.dayOfWeek,
      type: '',
      emphasis: '',
      dayMuscles: Array.from(new Set(sess.exercises.map((e) => e.muscle))) as MuscleGroup[],
      exercises: sess.exercises.map((ex): GeneratedExercise => {
        const metric = ex.metric ?? 'weight-reps';
        const timeBased = metric === 'time' || metric === 'weight-time';
        return {
          exerciseId: ex.exerciseId,
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets.length,
          reps: (timeBased ? ex.prescribedTimeLow : ex.prescribedRepsLow) ?? 0,
          metric,
          setStyle: ex.setStyle ?? 'straight',
          supersetGroup: ex.supersetGroup,
          anchor: false,
        };
      }),
    })),
  };
  return { state: s, program };
}
