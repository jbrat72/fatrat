/**
 * Plan Wizard v2 — state model.
 *
 * Mirrors the approved interactive mockup. This is the single object the wizard
 * accumulates and hands to the engine (lib/wizard/engine.ts) to generate a
 * program. Profile-derived fields (age band, sex, bodyweight, injuries) are
 * copied in read-only from the user's FATRAT profile when the wizard opens.
 */
import type { MuscleGroup, ExerciseMetric } from '@/types';

export type WizGoal =
  | 'muscle' | 'strength' | 'transform' | 'leanout' | 'fitness' | 'athletic';
export type WizExperience = 'beginner' | 'novice' | 'intermediate' | 'advanced';
export type WizStatus =
  | 'consistent' | 'break_short' | 'break_long' | 'layoff12' | 'scratch';
export type WizTier = 'maintain' | 'grow' | 'emphasize';
export type BaseStyle =
  | 'powerlifting' | 'bodybuilding' | 'hit' | 'powerbuilding' | 'fullbody' | 'calisthenics';
export type VolumeFramework = 'fixed' | 'evidence' | 'auto' | 'med';
export type PeriodizationStrategy = 'none' | 'dup' | 'weekly';
export type RepRange = 'strength' | 'hypertrophy' | 'endurance' | 'mixed';
export type CoreMethod = 'block' | 'day' | 'superset' | 'compound' | 'none';
export type RestPref = 'short' | 'moderate' | 'long' | 'auto';
export type DeloadProtocol = 'scheduled' | 'reactive' | 'none';
export type BaselineMethod = 'known' | 'working' | 'conservative' | 'calibration';

/** The 10 muscle groups the wizard prioritizes (core runs on its own track). */
export const WIZARD_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves',
];

export interface WizardProfile {
  ageBand: 'u18' | '18' | '30' | '40' | '50' | '60';
  sex: 'male' | 'female';
  bodyWeightKg: number;
  injuries: string[];       // 'shoulder' | 'lowback' | 'knee' | 'elbow' | 'hip' | 'neck'
  stubbornAreas: string[];  // 'belly' | 'glutes' | 'lovehandles' | 'arms' | 'thighs' | 'chest' | 'calves'
}

export interface WizardState {
  name: string;
  goal: { primary: WizGoal | null; secondary: string | null };
  experience: { level: WizExperience | null; status: WizStatus | null };
  profile: WizardProfile;
  schedule: {
    daysPerWeek: number | null;
    sessionMinutes: number | null;
    startDow: number;            // 0=Sun .. 6=Sat
    restDays: number[];          // day-of-week indices
    durationWeeks: number | 'ongoing' | null;
  };
  equipment: { environment: string | null; items: string[]; profileId: string };
  trainingStyle: {
    baseStyle: BaseStyle | null;
    volumeFramework: VolumeFramework | null;
    periodizationStrategy: PeriodizationStrategy | null;
  };
  split: { type: string | null; customDays?: MuscleGroup[][] };
  prioritization: { tiers: Partial<Record<MuscleGroup, WizTier>> };
  setsAndReps: { repRange: RepRange | null; setTypes: string[]; autoVary: boolean };
  restAndTempo: { restPreference: RestPref | null; tempoEnabled: boolean; tempoStyle: string | null };
  core: { method: CoreMethod | null; frequency: string | null; blockExercises: string; days: number[] };
  cardio: {
    included: string | null; type: string[];
    frequency: number | null; placement: string | null; durationMinutes: number | null;
  };
  progression: {
    type: string | null; deloadProtocol: DeloadProtocol | null;
    deloadFrequency: number | null; deloadStyle: string | null;
  };
  baselines: { methods: Record<string, BaselineMethod>; values: Record<string, { oneRM?: number; weight?: number; reps?: number }>; calibrationWeek: boolean; allConservative: boolean };
}

/** One column in the program's week structure (calibration / load / deload). */
export interface WeekCol {
  label: string;
  kind: 'cal' | 'load' | 'deload';
  loadIdx?: number;   // 0-based index among load weeks (for ramp math)
}

export interface GeneratedExercise {
  exerciseId: string | null;  // null = no library match (placeholder)
  name: string;
  muscle: MuscleGroup;
  sets: number;
  /** rep count for rep-based metrics; seconds for time-based metrics. */
  reps: number;
  metric: ExerciseMetric;     // 'weight-reps' | 'reps' | 'time' | 'weight-time'
  anchor: boolean;            // primary compound the progression tracks
}

export interface GeneratedDay {
  dow: number;                // day-of-week index
  type: string;               // e.g. 'Push', 'Chest', 'Upper', 'Full Body'
  emphasis: string;
  dayMuscles: MuscleGroup[];  // muscles assigned to this day (for the add-exercise picker)
  exercises: GeneratedExercise[];
}
