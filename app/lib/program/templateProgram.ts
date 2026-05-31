/**
 * Template program building — turns a generated week layout into something
 * concrete: real exercises, a per-week volume ramp, and finally a full set of
 * program records (or a reusable ProgramTemplate).
 *
 * Pure functions — no React, no Firestore. The caller persists the result.
 */
import type {
  MuscleGroup, ExerciseDefinition, EquipmentAccess, EquipmentType,
  Mesocycle, Microcycle, WorkoutSession, ExerciseEntry, SetEntry, SplitType, SetStyle,
  ProgramTemplate, TemplateWeek, TemplateExerciseSlot,
} from '@/types';
import { DEFAULT_LANDMARKS, type VolumeLandmarks } from '@/lib/periodization';
import type { MuscleTier, WeekLayout } from './templateLayout';
import { defaultRepRange, defaultTimeRange, exerciseMetric } from './startingWeights';

/** A muscle slot with a concrete exercise assigned to it. */
export interface AssignedSlot {
  muscle: MuscleGroup;
  tier: MuscleTier;
  exerciseId: string;
  exerciseName: string;
}

/** A generated week with exercises filled in — one ordered list per day. */
export type AssignedWeek = AssignedSlot[][];

/** Calendar offsets that spread N training days across a 7-day week. */
const DAY_OFFSETS: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};
export function dayOffsetsFor(n: number): number[] {
  return DAY_OFFSETS[n] ?? Array.from({ length: n }, (_, i) => i);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

let _uidCounter = 0;
function uid(prefix: string): string {
  _uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_uidCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Spread `total` across `parts` slots as evenly as possible, min 1 each. */
function distribute(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const rem = ((total % parts) + parts) % parts;
  return Array.from({ length: parts }, (_, i) => Math.max(1, base + (i < rem ? 1 : 0)));
}

/** Target RIR for a meso week — ramps 3 → 1, with the final week a deload (4). */
function rirForWeek(week: number, weeks: number): number {
  if (week === weeks - 1) return 4;
  const working = weeks - 1;
  if (working <= 1) return 2;
  return clamp(Math.round(3 - 2 * (week / (working - 1))), 0, 3);
}

/* ---------- equipment + exercise assignment ---------- */

/** The EquipmentType set a user can train with, from their equipment access. */
export function allowedEquipmentTypes(access: EquipmentAccess[]): Set<EquipmentType> {
  const set = new Set<EquipmentType>();
  const add = (...es: EquipmentType[]) => es.forEach((e) => set.add(e));
  for (const a of access) {
    if (a === 'commercial-gym') add('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith');
    else if (a === 'home-gym') add('barbell', 'dumbbell', 'bodyweight');
    else if (a === 'dumbbells-only') add('dumbbell', 'bodyweight');
    else if (a === 'bodyweight') add('bodyweight');
    else if (a === 'bodyweight-bands') add('bodyweight', 'band');
    else if (a === 'bodyweight-kettlebells') add('bodyweight', 'kettlebell');
    else if (a === 'bodyweight-dumbbells') add('bodyweight', 'dumbbell');
    else if (a === 'bands') add('band');
    else if (a === 'limited-hotel') add('dumbbell', 'bodyweight', 'band');
  }
  if (set.size === 0) add('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight');
  return set;
}

/**
 * Exercises that train a given muscle, preferring ones the user has equipment
 * for. Falls back to all same-muscle exercises if the user's kit covers none.
 */
export function exercisesForMuscle(
  muscle: MuscleGroup,
  library: ExerciseDefinition[],
  allowed: Set<EquipmentType>,
): ExerciseDefinition[] {
  const sameMuscle = library.filter((e) => e.primaryMuscle === muscle);
  const inKit = sameMuscle.filter((e) => allowed.has(e.equipment));
  return inKit.length > 0 ? inKit : sameMuscle;
}

/**
 * Auto-assigns a real exercise to every muscle slot. Each muscle rotates
 * through its available exercises so the choice varies every time the muscle
 * is worked — slot to slot and day to day — with reuse spaced out.
 *
 * `rotationOffset` shifts where each muscle starts in its rotation; passing the
 * week index lets the same layout produce different exercises week to week.
 */
export function assignExercises(
  layout: WeekLayout,
  library: ExerciseDefinition[],
  allowed: Set<EquipmentType>,
  rotationOffset = 0,
): AssignedWeek {
  const rotation = new Map<MuscleGroup, number>();
  return layout.map((day) =>
    day.map((slot): AssignedSlot => {
      const options = exercisesForMuscle(slot.muscle, library, allowed);
      const i = rotation.get(slot.muscle) ?? rotationOffset;
      rotation.set(slot.muscle, i + 1);
      const pick = options.length > 0 ? options[i % options.length] : undefined;
      return {
        muscle: slot.muscle,
        tier: slot.tier,
        exerciseId: pick?.id ?? `muscle:${slot.muscle}`,
        exerciseName: pick?.name ?? slot.muscle,
      };
    }),
  );
}

/* ---------- volume ---------- */

/**
 * Per-week target hard sets for one muscle, by tier (template_notes Page 2):
 *  - everything starts near MEV in week 1;
 *  - emphasis ramps up to MRV by the last working week;
 *  - grow ramps up to MAV;
 *  - maintain holds a low maintenance volume throughout;
 *  - the final week is a deload (~half of the starting volume).
 *
 * Returns one number per week (length === `weeks`).
 */
export function volumeRamp(
  tier: MuscleTier,
  weeks: number,
  lm: VolumeLandmarks,
  periodized = true,
): number[] {
  const maintain = Math.max(1, Math.round(lm.mev * 0.5));
  if (!periodized) {
    // Traditional — a steady weekly volume, no ramp and no deload week.
    const steady =
      tier === 'emphasize' ? lm.mav
      : tier === 'grow' ? Math.round((lm.mev + lm.mav) / 2)
      : maintain;
    return Array.from({ length: weeks }, () => Math.max(1, steady));
  }
  const out: number[] = [];
  const working = Math.max(1, weeks - 1); // the final week is a deload
  for (let w = 0; w < weeks; w++) {
    if (w === weeks - 1 && weeks > 1) { out.push(maintain); continue; }
    const t = working > 1 ? w / (working - 1) : 0;
    let start = lm.mev;
    let end = lm.mev;
    if (tier === 'emphasize') end = lm.mrv;
    else if (tier === 'grow') end = lm.mav;
    else { start = maintain; end = maintain; }
    out.push(Math.max(1, Math.round(start + (end - start) * t)));
  }
  return out;
}

/* ---------- program / template generation ---------- */

export interface CustomProgramInput {
  name: string;
  weeks: number;
  daysPerWeek: number;
  /** User-confirmed week 1 (layout + exercises). The muscle layout repeats. */
  week1: AssignedWeek;
  tiers: Partial<Record<MuscleGroup, MuscleTier>>;
  library: ExerciseDefinition[];
  allowed: Set<EquipmentType>;
  userId: string;
  /** Display name of the creator — shown on custom templates in the library. */
  creatorName: string;
  goal: string;
  startDate: string;
  /** Per-exercise starting plan, keyed by exercise id. Reps for rep-based,
   *  seconds for time-based, weight for weighted variants. */
  startingWeights?: Record<string, { weightKg?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }>;
  /** Calendar offsets (0-6 from the start date) for each training day, in
   *  order. When omitted, training days are auto-spread across the week. */
  workOffsets?: number[];
  /** Split/structure of the plan. Recorded on microcycles + the template. */
  splitType?: SplitType;
  /** 'traditional' omits the periodization model (no RIR targets, no deload). */
  programStyle?: 'traditional' | 'periodization';
  /** Full-body circuit: how many times through the circuit, and its style. */
  timesThrough?: number;
  circuitStyle?: 'classic' | 'speed';
  /** Preferred set style + per-muscle superset/drop designations. */
  preferredSetStyle?: SetStyle;
  muscleSetStyles?: Partial<Record<MuscleGroup, 'superset' | 'drop'>>;
  /** Hard cap on the number of sets any single exercise is prescribed. */
  maxSetsPerExercise?: number;
  /** User-chosen rest between sets (seconds). */
  restSeconds?: number;
}

export interface GeneratedProgram {
  mesocycle: Mesocycle;
  microcycles: Microcycle[];
  sessions: WorkoutSession[];
}

interface WeekMaterial {
  /** Non-empty training days for the week. */
  trainingDays: AssignedWeek;
  /** Per-slot set counts, parallel to `trainingDays`. */
  setCounts: number[][];
  targetRIR?: number;
}

/**
 * Resolves every meso week: which exercises (rotated per week) and how many
 * sets each slot gets (the volume ramp, distributed across the muscle's slots).
 */
function materializeWeeks(input: CustomProgramInput): WeekMaterial[] {
  const periodized = input.programStyle !== 'traditional';
  const isCircuit = input.programStyle === 'traditional' && input.splitType === 'full-body';
  const rounds = Math.max(1, Math.round(input.timesThrough ?? 3));
  const layout: WeekLayout = input.week1.map((day) => day.map((s) => ({ muscle: s.muscle, tier: s.tier })));
  const out: WeekMaterial[] = [];
  for (let w = 0; w < input.weeks; w++) {
    const assigned = w === 0 ? input.week1 : assignExercises(layout, input.library, input.allowed, w);
    const trainingDays = assigned.filter((d) => d.length > 0);

    const slotCount = new Map<MuscleGroup, number>();
    for (const day of trainingDays) {
      for (const slot of day) slotCount.set(slot.muscle, (slotCount.get(slot.muscle) ?? 0) + 1);
    }

    let setCounts: number[][];
    if (isCircuit) {
      // Circuit — every exercise is done once per round, `rounds` rounds.
      setCounts = trainingDays.map((day) => day.map(() => rounds));
    } else {
      const queue = new Map<MuscleGroup, number[]>();
      for (const [muscle, count] of slotCount) {
        const tier = input.tiers[muscle] ?? 'grow';
        const weekly = volumeRamp(tier, input.weeks, DEFAULT_LANDMARKS[muscle], periodized)[w] ?? 1;
        queue.set(muscle, distribute(weekly, count));
      }
      const cursor = new Map<MuscleGroup, number>();
      const cap = input.maxSetsPerExercise;
      setCounts = trainingDays.map((day) =>
        day.map((slot) => {
          const arr = queue.get(slot.muscle) ?? [];
          const i = cursor.get(slot.muscle) ?? 0;
          cursor.set(slot.muscle, i + 1);
          const n = arr[i] ?? 1;
          return cap != null ? Math.min(n, cap) : n;
        }),
      );
    }

    out.push({ trainingDays, setCounts, targetRIR: periodized ? rirForWeek(w, input.weeks) : undefined });
  }
  return out;
}

/**
 * Turns the wizard's choices into a full, ready-to-train program: a macrocycle,
 * one mesocycle, a microcycle per week, and a WorkoutSession per training day —
 * with the volume ramp baked into per-week set counts and exercises rotated
 * week to week.
 */
export function generateCustomProgram(input: CustomProgramInput): GeneratedProgram {
  const material = materializeWeeks(input);
  const periodized = input.programStyle !== 'traditional';
  const mesoId = uid('meso');
  const microcycles: Microcycle[] = [];
  const sessions: WorkoutSession[] = [];

  material.forEach((wk, w) => {
    const microId = uid('micro');
    const sessionIds: string[] = [];
    const offsets = input.workOffsets ?? dayOffsetsFor(wk.trainingDays.length);

    wk.trainingDays.forEach((day, i) => {
      const isoDate = addDaysIso(input.startDate, w * 7 + (offsets[i] ?? i));
      const dayOfWeek = new Date(isoDate + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const exercises: ExerciseEntry[] = day.map((slot, j) => {
        const n = wk.setCounts[i]?.[j] ?? 1;
        const def = input.library.find((e) => e.id === slot.exerciseId);
        const metric = exerciseMetric(def);
        const useReps = metric === 'weight-reps' || metric === 'reps';
        const useTime = metric === 'time' || metric === 'weight-time';
        const useWeight = metric === 'weight-reps' || metric === 'weight-time';

        const sw = input.startingWeights?.[slot.exerciseId];
        const dr = defaultRepRange(def);
        const dt = defaultTimeRange(def);
        const repsLow = useReps ? (sw?.repsLow ?? dr.repsLow) : undefined;
        const repsHigh = useReps && repsLow != null
          ? Math.max(repsLow, sw?.repsHigh ?? dr.repsHigh)
          : undefined;
        const timeLow = useTime ? (sw?.timeLow ?? dt.timeLow) : undefined;
        const timeHigh = useTime && timeLow != null
          ? Math.max(timeLow, sw?.timeHigh ?? dt.timeHigh)
          : undefined;
        // Seed the starting weight on week 1 only; later weeks fill in from
        // logged history as the block is trained.
        const weightKg = useWeight && w === 0 ? sw?.weightKg : undefined;
        const setStyle: SetStyle =
          input.muscleSetStyles?.[slot.muscle]
          ?? (input.programStyle === 'traditional' ? (input.preferredSetStyle ?? 'straight') : 'straight');
        // Pyramid + drop styles only apply to weight-reps exercises; they fall
        // back to plain straight sets for time / pure-rep / weight-time.
        const usePyramid = setStyle === 'pyramid' && metric === 'weight-reps';
        const useDrop = setStyle === 'drop' && metric === 'weight-reps';
        const sets: SetEntry[] = Array.from({ length: n }, (_, k): SetEntry => {
          if (usePyramid && n > 1 && repsLow != null && repsHigh != null) {
            const stepW = weightKg != null
              ? Math.round((weightKg * (1 + k * 0.075)) / 2.5) * 2.5
              : undefined;
            const stepR = Math.round(repsHigh - ((repsHigh - repsLow) * k) / (n - 1));
            return { setIndex: k, weightKg: stepW, reps: stepR, completed: false };
          }
          return {
            setIndex: k,
            weightKg: useWeight ? weightKg : undefined,
            reps: useReps ? repsLow : undefined,
            timeSec: useTime ? timeLow : undefined,
            completed: false,
          };
        });
        if (useDrop && sets.length > 0) {
          const last = sets[sets.length - 1]!;
          sets.push({
            setIndex: sets.length,
            weightKg: last.weightKg != null ? Math.round((last.weightKg * 0.7) / 2.5) * 2.5 : undefined,
            completed: false,
            setType: 'drop',
          });
        }
        return {
          exerciseId: slot.exerciseId,
          name: slot.exerciseName,
          muscle: slot.muscle,
          prescribedSets: n,
          prescribedRepsLow: repsLow,
          prescribedRepsHigh: repsHigh,
          prescribedTimeLow: timeLow,
          prescribedTimeHigh: timeHigh,
          prescribedRIR: wk.targetRIR,
          metric,
          setStyle,
          sets,
        };
      });
      // Pair consecutive superset-tagged exercises into superset groups.
      let ssGroup = 0;
      for (let k = 0; k < exercises.length - 1; k++) {
        if (
          exercises[k]!.setStyle === 'superset' && exercises[k]!.supersetGroup == null &&
          exercises[k + 1]!.setStyle === 'superset'
        ) {
          ssGroup += 1;
          exercises[k]!.supersetGroup = ssGroup;
          exercises[k + 1]!.supersetGroup = ssGroup;
          k += 1;
        }
      }
      const sessionId = uid('day');
      sessions.push({
        id: sessionId,
        userId: input.userId,
        microcycleId: microId,
        mesocycleId: mesoId,
        planName: input.name.trim() || 'Custom program',
        date: isoDate,
        dayOfWeek,
        completed: false,
        exercises,
        cardio: [],
      });
      sessionIds.push(sessionId);
    });

    microcycles.push({
      id: microId,
      mesocycleId: mesoId,
      userId: input.userId,
      weekNumber: w + 1,
      splitType: input.splitType ?? 'custom',
      status: w === 0 ? 'active' : 'draft',
      targetRIR: wk.targetRIR,
      sessionIds,
    });
  });

  const name = input.name.trim() || 'Custom program';
  const mesocycle: Mesocycle = {
    id: mesoId,
    userId: input.userId,
    name,
    goal: input.goal,
    startDate: input.startDate,
    phaseType: 'hypertrophy',
    weeks: input.weeks,
    progressionScheme: periodized ? 'rir-based' : 'linear',
    programStyle: input.programStyle ?? 'periodization',
    circuitStyle: input.circuitStyle,
    preferredSetStyle: input.preferredSetStyle,
    muscleSetStyles: input.muscleSetStyles,
    restSeconds: input.restSeconds,
    weekIndex: 0,
    status: 'active',
    microcycleIds: microcycles.map((m) => m.id),
    muscleTiers: input.tiers,
  };

  return { mesocycle, microcycles, sessions };
}

/**
 * Builds a reusable ProgramTemplate from the wizard's choices — a multi-week
 * template whose per-week set counts carry the volume ramp. Used by the
 * "save as a template" path so the block can be started again later.
 */
export function buildCustomTemplate(input: CustomProgramInput): ProgramTemplate {
  const material = materializeWeeks(input);
  const dayCount = material[0]?.trainingDays.length ?? input.daysPerWeek;
  const weeks: TemplateWeek[] = material.map((wk, w) => ({
    weekIndex: w,
    days: wk.trainingDays.map((day, i) => ({
      dayLabel: `Day ${i + 1}`,
      exercises: day.map((slot, j): TemplateExerciseSlot => {
        const def = input.library.find((e) => e.id === slot.exerciseId);
        const metric = exerciseMetric(def);
        const sw = input.startingWeights?.[slot.exerciseId];
        const dr = defaultRepRange(def);
        const dt = defaultTimeRange(def);
        const useReps = metric === 'weight-reps' || metric === 'reps';
        const useTime = metric === 'time' || metric === 'weight-time';
        const repsLow = useReps ? (sw?.repsLow ?? dr.repsLow) : undefined;
        const timeLow = useTime ? (sw?.timeLow ?? dt.timeLow) : undefined;
        return {
          exerciseId: slot.exerciseId,
          prescribedSets: wk.setCounts[i]?.[j] ?? 1,
          repsLow,
          repsHigh: useReps && repsLow != null ? Math.max(repsLow, sw?.repsHigh ?? dr.repsHigh) : undefined,
          timeLow,
          timeHigh: useTime && timeLow != null ? Math.max(timeLow, sw?.timeHigh ?? dt.timeHigh) : undefined,
        };
      }),
    })),
  }));
  return {
    id: uid('tpl'),
    name: input.name.trim() || 'Custom template',
    description: `Custom ${input.weeks}-week block`,
    daysPerWeek: dayCount,
    split: input.splitType ?? 'custom',
    defaultPhase: 'hypertrophy',
    progressionScheme: input.programStyle === 'traditional' ? 'linear' : 'rir-based',
    programStyle: input.programStyle ?? 'periodization',
    minMode: 'BASIC',
    isCustom: true,
    createdBy: input.creatorName,
    muscleTiers: input.tiers,
    restSeconds: input.restSeconds,
    weeks,
  };
}
