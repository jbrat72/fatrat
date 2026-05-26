/**
 * Logged workout sessions. Sets and cardio are embedded for Firestore-friendly
 * single-document reads/writes.
 */
import type { MuscleGroup, ExerciseMetric } from './exercise';

export type EffortRPE = number; // 1-10, may be fractional (e.g., 7.5)

/** Generic feel buckets — UI maps these to RPE per mode. */
export type BasicFeel = 'easy' | 'just-right' | 'hard';
export type IntermediateFeel =
  | 'smooth'   // RPE 6
  | 'solid'    // RPE 7
  | 'tough'    // RPE 8
  | 'grinding' // RPE 9
  | 'failed';  // RPE 10

export type SetType = 'regular' | 'myorep' | 'myorep-match' | 'drop' | 'warmup' | 'skip';

/** How an exercise's sets are performed. */
export type SetStyle = 'straight' | 'superset' | 'drop' | 'pyramid';

export interface SetEntry {
  setIndex: number;     // 0-based order within the exercise
  weightKg?: number;    // stored metric; UI converts
  reps?: number;
  /** Seconds, for time-based exercises (planks, holds, carries). */
  timeSec?: number;
  /** Logged effort in RPE space. May be derived from BasicFeel/IntermediateFeel. */
  rpe?: EffortRPE;
  completed: boolean;
  restSec?: number;     // actual rest taken if measured
  setType?: SetType;
  isPR?: boolean;
  note?: string;
}

export interface ExerciseEntry {
  exerciseId: string;
  name: string;           // denormalized for fast render
  muscle: MuscleGroup;    // primary muscle (denormalized for badge color)
  prescribedSets: number; // target count
  prescribedRepsLow?: number;
  prescribedRepsHigh?: number;
  /** Prescribed hold time per set (seconds) — for time / weight-time exercises. */
  prescribedTimeLow?: number;
  prescribedTimeHigh?: number;
  prescribedRIR?: number;
  /** How sets are measured (denormalized from the exercise definition). */
  metric?: ExerciseMetric;
  /** Prescribed set style (straight / superset / drop / pyramid). */
  setStyle?: SetStyle;
  /** Exercises sharing a supersetGroup (within a session) are a superset. */
  supersetGroup?: number;
  sets: SetEntry[];
  notes?: string;
  /** When user swaps an exercise mid-session we remember the original. */
  swappedFromExerciseId?: string;
}

export type CardioActivity =
  | 'treadmill'
  | 'bike'
  | 'elliptical'
  | 'rower'
  | 'walking'
  | 'running-outdoor'
  | 'stair-climber'
  | 'swimming'
  | 'other';

export interface CardioEntry {
  activityType: CardioActivity;
  durationMin: number;
  distanceKm?: number;
  avgHR?: number;
  effortRPE?: EffortRPE;
  /** Treadmill: belt speed in km/h (stored). Display converted to mph for imperial users. */
  speedKph?: number;
  /** Treadmill: incline percent (0–15 typical). */
  inclinePct?: number;
  /** Machine cardio (elliptical/rower/stair-climber/other): resistance level 1–10. */
  resistanceLevel?: number;
  notes?: string;
}

/**
 * Pre-session recovery check (template_notes Page 2). Asked at the start of the
 * first exercise for a muscle, reporting how sore that muscle got after the
 * previous session that trained it.
 *   1 — never got sore
 *   2 — healed a while ago
 *   3 — healed just on time
 *   4 — still sore
 */
export type SorenessRating = 1 | 2 | 3 | 4;

export interface MuscleSoreness {
  muscle: MuscleGroup;
  rating: SorenessRating;
  collectedAt: string; // ISO datetime
}

export interface WorkoutSession {
  id: string;
  userId: string;
  microcycleId?: string;
  mesocycleId?: string;
  macrocycleId?: string;
  date: string;            // ISO YYYY-MM-DD
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  completed: boolean;
  startedAt?: string;      // ISO datetime
  completedAt?: string;    // ISO datetime
  exercises: ExerciseEntry[];
  /** Snapshot of the prescribed exercises while the day is switched to straight
   *  sets — lets the original set styles be restored. */
  prescribedExercises?: ExerciseEntry[];
  cardio: CardioEntry[];
  /** Soreness reported at the start of this session about the prior session. */
  soreness?: MuscleSoreness[];
  notes?: string;
  feedback?: SessionFeedback;
}

/**
 * Post-session subjective feedback (RP-style). Collected per muscle group as
 * the muscle is finished during the workout — discrete, plain-language scales.
 */
export type PainLevel = 'none' | 'low' | 'moderate' | 'high';
export type PumpLevel = 'low' | 'moderate' | 'amazing';
export type VolumeLevel = 'not-enough' | 'just-right' | 'pushed-limits' | 'too-much';

export interface PerMuscleFeedback {
  muscle: MuscleGroup;
  pump: PumpLevel;
  volume: VolumeLevel;
  pain: PainLevel;
}

export interface SessionFeedback {
  /** Worst per-muscle joint pain reported in the session. */
  jointPainOverall: PainLevel;
  perMuscle: PerMuscleFeedback[];
  collectedAt: string; // ISO
}
