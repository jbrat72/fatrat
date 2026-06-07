/**
 * Training-plan hierarchy: Mesocycle (training block) -> Microcycle (week).
 *
 * The `Macrocycle` wrapper was retired in v0.61 — every plan is now a single
 * mesocycle, and the fields the UI used to read off macros (name, goal,
 * startDate, targetDate, status) live directly on Mesocycle.
 *
 * All effort always stored as RPE 1-10 internally regardless of mode.
 */
import type { MuscleGroup } from './exercise';

/** Volume priority a muscle is given within a program (Template Wizard). */
export type MuscleTier = 'maintain' | 'grow' | 'emphasize';

export type MesocyclePhaseType =
  | 'hypertrophy'
  | 'strength'
  | 'power'
  | 'peaking'
  | 'deload';

export type ProgressionScheme =
  | 'linear'
  | 'undulating'
  | 'set-progression'
  | 'rir-based';

export type SplitType =
  | 'PPL'
  | 'upper-lower'
  | 'full-body'
  | 'bro-split'
  | 'custom';

export type CycleStatus = 'active' | 'completed' | 'draft' | 'archived';

export interface Mesocycle {
  id: string;
  userId: string;
  /** User-facing plan name (e.g. "Push/Pull/Legs"). */
  name: string;
  /** Free-form training goal (e.g. "Off-season Hypertrophy"). Was Macrocycle.goal. */
  goal: string;
  /** ISO date the plan starts. Was Macrocycle.startDate. */
  startDate: string;
  /** Optional ISO target/completion date. Was Macrocycle.targetDate. */
  targetDate?: string;
  phaseType: MesocyclePhaseType;
  weeks: number;             // typically 4-6
  progressionScheme: ProgressionScheme;
  /** 'traditional' programs omit the periodization model (RIR targets, deload). */
  programStyle?: 'traditional' | 'periodization';
  /** Full-body circuit pacing, when the plan is a circuit. */
  circuitStyle?: 'classic' | 'speed';
  /** Preferred set style + per-muscle superset/drop designations. */
  preferredSetStyle?: 'straight' | 'superset' | 'drop' | 'pyramid';
  muscleSetStyles?: Partial<Record<MuscleGroup, 'superset' | 'drop'>>;
  /** User-chosen rest between sets (seconds). When set, overrides the
   *  phase/movement default in the workout rest timer. */
  restSeconds?: number;
  weekIndex: number;         // 0-based; current week within meso
  status: CycleStatus;
  microcycleIds: string[];   // ordered
  /** Per-muscle volume priority, set by the Template Wizard. Drives tier-aware
   *  soreness adjustment. Absent on older / non-wizard programs. */
  muscleTiers?: Partial<Record<MuscleGroup, MuscleTier>>;
  /** Equipment profile this plan was built for — Swap/Add filter against it
   *  (live: editing that profile changes what's available here). */
  equipmentProfileId?: string;
}

export interface Microcycle {
  id: string;
  mesocycleId: string;
  userId: string;
  weekNumber: number;        // 1-based within meso
  splitType: SplitType;
  status: CycleStatus;
  /** Target RIR for the week — drives auto-progression in ADVANCED. */
  targetRIR?: number;
  sessionIds: string[];      // ordered by day-of-week
}

/** Standard 4-week meso RIR progression (week 1 high RIR -> week 4 low). */
export const STANDARD_RIR_PROGRESSION: number[] = [3, 2, 1, 0];
