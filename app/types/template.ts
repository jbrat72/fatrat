/**
 * Pre-built program templates. Tagged by mode so we can filter what each user
 * sees in the templates library.
 */
import type { UserMode } from './profile';
import type {
  SplitType,
  MesocyclePhaseType,
  ProgressionScheme,
  MuscleTier,
} from './periodization';
import type { MuscleGroup } from './exercise';

export interface TemplateExerciseSlot {
  exerciseId: string;
  prescribedSets: number;
  /** Reps target (omitted for purely time-based exercises). */
  repsLow?: number;
  repsHigh?: number;
  /** Hold/carry duration (seconds) for time / weight-time exercises. */
  timeLow?: number;
  timeHigh?: number;
  /** Starting weight (kg) — used by single-workout templates so the
   *  Ad-Hoc logger opens pre-filled. Programs source weights separately. */
  startingWeightKg?: number;
  startingRIR?: number;
  /** Optional acceptable swap muscle group when user lacks equipment. */
  fallbackMuscle?: MuscleGroup;
}

export interface TemplateDay {
  dayLabel: string;            // "Push A", "Lower", "Full Body 1"
  exercises: TemplateExerciseSlot[];
}

export interface TemplateWeek {
  weekIndex: number;           // 0-based
  days: TemplateDay[];
}

/** Kinds of saved template. Programs span weeks (with periodization model);
 *  single workouts are one-shot ad-hoc routines that pre-populate the
 *  AdHocWorkoutModal. */
export type TemplateKind = 'program' | 'workout';

/** Loose category for single-workout templates — drives grouping in the picker. */
export type WorkoutCategory = 'upper-body' | 'lower-body' | 'core' | 'full-body' | 'custom';

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;         // plain-English; no jargon for BASIC users
  /** Defaults to 'program' when omitted (so older saved templates stay valid). */
  kind?: TemplateKind;
  /** For kind === 'workout' — coarse category used by the picker UI. */
  category?: WorkoutCategory;
  daysPerWeek: number;
  split: SplitType;
  defaultPhase: MesocyclePhaseType;
  progressionScheme: ProgressionScheme;
  /** 'traditional' templates omit the periodization model. */
  programStyle?: 'traditional' | 'periodization';
  /** Lowest mode this template is offered in. Higher modes also see it. */
  minMode: UserMode;
  /** True for user-built templates (Template Wizard); false/undefined = global. */
  isCustom?: boolean;
  /** Display name of the user who created a custom template. */
  createdBy?: string;
  /** Suggested goals this template is good for. */
  goodForGoals?: string[];
  /** Per-muscle volume priority. Set by the Template Wizard for custom
   *  templates; library templates leave it unset and the user picks tiers
   *  (pre-filled from training history) when starting the program. */
  muscleTiers?: Partial<Record<MuscleGroup, MuscleTier>>;
  /** User-chosen rest between sets (seconds). */
  restSeconds?: number;
  /** True for a Plan Wizard draft the user saved to finish later. */
  isDraft?: boolean;
  /** Serialized WizardState (JSON) so a draft can be reopened and resumed. */
  draftState?: string;
  weeks: TemplateWeek[];
}
