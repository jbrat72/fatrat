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

export interface EquipmentProfile {
  id: string;
  /** User-facing name, e.g. "Home", "Commercial Gym". */
  name: string;
  /** Granular Page-5 checklist labels owned at this location. */
  items: string[];
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
  /** Legacy single granular list — superseded by `equipmentProfiles`, kept as a
   *  migration source for users created before profiles existed. */
  equipmentItems?: string[];
  /** Named equipment setups (e.g. Home, Commercial Gym). A program is built for
   *  one of these and references it by id. */
  equipmentProfiles?: EquipmentProfile[];
  /** Which profile is used by default (wizard pre-selects it). */
  defaultEquipmentProfileId?: string;

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
  /** Play a double-beep when the rest / exercise timer hits zero. Default on
   *  (undefined === enabled); set false in Settings to mute. */
  soundsEnabled?: boolean;
  /** Set true once the v0.61 Macrocycle-retirement migration has run for this user. */
  migratedMacroDrop?: boolean;
  /** Set true once the v0.62 sessions→days relabel migration has run for this user. */
  migratedSessionsToDays?: boolean;
  /** Set true once existing plans have been defaulted to fixed exercises. */
  migratedFixedExercises?: boolean;
  /** Set true once the unsorted-microcycle week-status/weekIndex repair has run. */
  migratedWeekStatusRepair?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface BodyWeightEntry {
  date: string;   // ISO YYYY-MM-DD
  weightKg: number;
  note?: string;
}
