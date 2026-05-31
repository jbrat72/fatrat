/**
 * User-mode + profile data.
 * Mode is presentational only — same schema is used across BASIC/INTERMEDIATE/ADVANCED.
 *
 * Mode controls feature depth. Terminology (jargon vs plain words) is a
 * separate axis: see `advancedTerminology` below. All modes default to plain
 * terminology; INTERMEDIATE/ADVANCED users may opt into advanced terms.
 */

export type UserMode = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

export type Units = 'imperial' | 'metric'; // imperial = lb/in; metric = kg/cm
export type Sex = 'male' | 'female' | 'other' | 'prefer-not-to-say';

export type ExperienceTier = 'lt6mo' | '6mo-2yr' | '2yr-plus';
export type PeriodizationFamiliarity = 'none' | 'fuzzy' | 'fluent';

export type PrimaryGoal =
  | 'build-muscle'
  | 'get-stronger'
  | 'lose-fat'
  | 'maintain'
  | 'general-fitness'
  | 'sport-specific';

export type EquipmentAccess =
  | 'commercial-gym'
  | 'home-gym'
  | 'dumbbells-only'
  | 'bodyweight'
  | 'bodyweight-bands'
  | 'bodyweight-kettlebells'
  | 'bodyweight-dumbbells'
  | 'bands'
  | 'limited-hotel';

export type CommonInjurySite =
  | 'lower-back'
  | 'shoulders'
  | 'knees'
  | 'wrists'
  | 'elbows';

export interface StrengthBaseline {
  squat?: number;   // 1RM estimate in user's units
  bench?: number;
  deadlift?: number;
  overheadPress?: number;
}

export interface Constraints {
  injuryNotes?: string;             // free text
  injurySites?: CommonInjurySite[]; // multi-select checklist
  excludedLifts?: string[];         // e.g., ["overhead press"]
}

export interface UserProfile {
  userId: string;
  displayName: string;
  dob?: string;          // ISO date (YYYY-MM-DD)
  sex?: Sex;
  heightCm?: number;     // always stored metric; UI converts
  weightKg?: number;     // always stored metric
  units: Units;

  experience: ExperienceTier;
  periodizationFamiliarity: PeriodizationFamiliarity;

  primaryGoal: PrimaryGoal;
  secondaryGoal?: PrimaryGoal;
  targetDate?: string;   // ISO date or label like "summer"
  targetLabel?: string;  // freeform fallback ("By summer")

  daysPerWeek: number;        // 2..7
  timePerSessionMin: 30 | 45 | 60 | 75 | 90;
  equipment: EquipmentAccess[];

  constraints?: Constraints;
  strengthBaseline?: StrengthBaseline;

  /**
   * Weekday the calendar grid starts on (0 = Sunday, 1 = Monday …). Display
   * only — it does not affect when sessions are scheduled. Defaults to Monday.
   */
  weekStartsOn?: number;

  mode: UserMode;
  /**
   * Opt-in to advanced training terminology — RIR/RPE numbers, MEV/MAV/MRV
   * volume landmarks, mesocycle/microcycle naming. Only meaningful for
   * INTERMEDIATE/ADVANCED users; absent or false means plain language.
   */
  advancedTerminology?: boolean;
  /** Set true once the v0.61 Macrocycle-retirement migration has run for this user. */
  migratedMacroDrop?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface BodyWeightEntry {
  date: string;   // ISO YYYY-MM-DD
  weightKg: number;
  note?: string;
}
