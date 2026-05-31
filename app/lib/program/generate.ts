/**
 * Program generator — turns a ProgramTemplate into a full set of records
 * (Mesocycle, Microcycles, WorkoutSessions) for a user.
 *
 * Pure function. Caller is responsible for persisting the result via the
 * DataRepository.
 */
import type {
  ProgramTemplate,
  UserProfile,
  Mesocycle,
  Microcycle,
  WorkoutSession,
  ExerciseDefinition,
  SetEntry,
  ExerciseEntry,
  EquipmentAccess,
  EquipmentType,
  MuscleGroup,
  MuscleTier,
  UserExercisePrefs,
} from '@/types';
import { STANDARD_RIR_PROGRESSION } from '@/types';

export interface GenerateInput {
  template: ProgramTemplate;
  user: UserProfile;
  /** ISO date for the first session (we lay out subsequent sessions on the
   *  same weekday pattern based on daysPerWeek). */
  startDate: string;
  /** Required for muscle denormalization + equipment-based swaps. */
  exerciseLibrary: ExerciseDefinition[];
  /** How many weeks the mesocycle should run (default 4, deload baked in). */
  weeks?: number;
  /** Per-muscle volume priority chosen for this block. Falls back to the
   *  template's own tiers (custom templates) when omitted. */
  muscleTiers?: Partial<Record<MuscleGroup, MuscleTier>>;
  /** The user's favorites + hidden — exercise picks prefer favorites and skip
   *  hidden exercises where a replacement exists. */
  exercisePrefs?: UserExercisePrefs;
}

export interface GenerateOutput {
  mesocycle: Mesocycle;
  microcycles: Microcycle[];
  sessions: WorkoutSession[];
}

/**
 * Map user-selected equipment access to the EquipmentType values the exercise
 * library uses. "commercial-gym" implies everything is available.
 */
function allowedEquipment(access: EquipmentAccess[]): Set<EquipmentType> {
  const set = new Set<EquipmentType>();
  for (const a of access) {
    switch (a) {
      case 'commercial-gym':
        ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','smith'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'home-gym':
        ['barbell','dumbbell','bodyweight'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'dumbbells-only':
        ['dumbbell','bodyweight'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'bodyweight':
        set.add('bodyweight');
        break;
      case 'bodyweight-bands':
        ['bodyweight','band'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'bodyweight-kettlebells':
        ['bodyweight','kettlebell'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'bodyweight-dumbbells':
        ['bodyweight','dumbbell'].forEach((e) => set.add(e as EquipmentType));
        break;
      case 'bands':
        set.add('band');
        break;
      case 'limited-hotel':
        ['dumbbell','bodyweight','band'].forEach((e) => set.add(e as EquipmentType));
        break;
    }
  }
  if (set.size === 0) {
    // Permissive default — never block a workout because of missing equipment data.
    ['barbell','dumbbell','machine','cable','bodyweight'].forEach((e) => set.add(e as EquipmentType));
  }
  return set;
}

/**
 * Resolve the exercise for a template slot using the user's available
 * equipment and personalization. Keeps the original where it works; otherwise
 * finds a same-muscle replacement, preferring favorites and skipping hidden
 * exercises. Returns the original id if no swap is found.
 */
function swapExercise(
  exerciseId: string,
  library: ExerciseDefinition[],
  allowed: Set<EquipmentType>,
  excludedNames: Set<string>,
  hidden: Set<string>,
  favorites: Set<string>,
): ExerciseDefinition | null {
  const original = library.find((e) => e.id === exerciseId);
  if (!original) return null;
  const equipOk = allowed.has(original.equipment) && !excludedNames.has(original.name.toLowerCase());
  if (equipOk && !hidden.has(original.id)) return original;

  // Need a replacement: same primary muscle, allowed equipment, not excluded,
  // not hidden. Favorites win.
  const candidates = library.filter(
    (e) =>
      e.id !== original.id &&
      e.primaryMuscle === original.primaryMuscle &&
      allowed.has(e.equipment) &&
      !excludedNames.has(e.name.toLowerCase()) &&
      !hidden.has(e.id),
  );
  const pick = candidates.find((e) => favorites.has(e.id)) ?? candidates[0];
  if (pick) return pick;
  // No replacement available — keep the original if it is at least usable
  // with the user's equipment (a hidden-only conflict shouldn't break the day).
  return equipOk ? original : null;
}

/** Conservative starting weight given a user's baseline and a rep-range floor. */
function startingWeightKg(
  user: UserProfile,
  exerciseId: string,
  primaryMuscle: string,
  repsLow: number,
): number | undefined {
  const baseline = user.strengthBaseline;
  if (!baseline) return undefined;
  // %1RM rough mapping: 5 reps ≈ 85%, 8 ≈ 75%, 10 ≈ 70%, 12 ≈ 65%.
  const pct = repsLow <= 5 ? 0.85 : repsLow <= 8 ? 0.75 : repsLow <= 10 ? 0.7 : 0.65;
  // Convert user's 1RM (stored in user units; we treat baseline as in their unit and convert).
  const oneRM =
    exerciseId.startsWith('squat')           ? baseline.squat :
    exerciseId.startsWith('bench')           ? baseline.bench :
    exerciseId.startsWith('deadlift')        ? baseline.deadlift :
    exerciseId.startsWith('ohp')             ? baseline.overheadPress :
    primaryMuscle === 'quads' ? baseline.squat :
    primaryMuscle === 'chest' ? baseline.bench :
    primaryMuscle === 'back' && exerciseId === 'deadlift' ? baseline.deadlift :
    primaryMuscle === 'shoulders' ? baseline.overheadPress :
    undefined;
  if (oneRM == null) return undefined;
  // baseline is stored in user units; convert to kg if imperial.
  const kg = user.units === 'imperial' ? oneRM / 2.20462 : oneRM;
  // Be conservative — the engine will ramp up from here.
  return Math.round((kg * pct) / 2.5) * 2.5;
}

/** Add `days` days to an ISO YYYY-MM-DD date string. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Map session ordinal to a day-of-week pattern based on daysPerWeek.
 *  e.g. 3 days/wk → Mon/Wed/Fri (offsets 0, 2, 4). */
function dayOffsets(daysPerWeek: number): number[] {
  const presets: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[daysPerWeek] ?? presets[3]!;
}

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateProgram(input: GenerateInput): GenerateOutput {
  const { template, user, startDate, exerciseLibrary } = input;
  const weeks = input.weeks ?? 4; // default 4-week meso (deload happens at end / via detector)
  const allowed = allowedEquipment(user.equipment);
  const excludedNames = new Set(
    (user.constraints?.excludedLifts ?? []).map((s) => s.toLowerCase()),
  );
  const hidden = new Set(input.exercisePrefs?.hidden ?? []);
  const favorites = new Set(input.exercisePrefs?.favorites ?? []);

  // The day count comes from the template; each meso week uses its own week
  // pattern when the template defines several (custom templates ramp volume
  // week to week). Single-week templates reuse week 0 for every week.
  const daysPerWeek = Math.min(template.daysPerWeek, user.daysPerWeek);
  const templateDaysFor = (week: number) => {
    const weekPattern = template.weeks[Math.min(week, template.weeks.length - 1)]!;
    const days = weekPattern.days.slice(0, daysPerWeek);
    while (days.length < daysPerWeek) {
      days.push(weekPattern.days[days.length % weekPattern.days.length]!);
    }
    return days;
  };

  const mesoId  = uid('meso');

  const microcycles: Microcycle[] = [];
  const sessions: WorkoutSession[] = [];

  const dayOff = dayOffsets(daysPerWeek);

  for (let week = 0; week < weeks; week++) {
    const microId = uid('micro');
    const sessionIds: string[] = [];

    const targetRIR = STANDARD_RIR_PROGRESSION[Math.min(week, STANDARD_RIR_PROGRESSION.length - 1)] ?? 1;
    const templateDays = templateDaysFor(week);

    for (let d = 0; d < daysPerWeek; d++) {
      const templateDay = templateDays[d]!;
      const sessionId = uid('day');
      const isoDate = addDays(startDate, week * 7 + (dayOff[d] ?? d));
      const dowJs = new Date(isoDate + 'T00:00:00').getDay() as 0|1|2|3|4|5|6;

      const exercises: ExerciseEntry[] = templateDay.exercises.map((slot) => {
        const def = swapExercise(slot.exerciseId, exerciseLibrary, allowed, excludedNames, hidden, favorites);
        const muscle = def?.primaryMuscle ?? 'core';
        const name = def?.name ?? slot.exerciseId;
        const metric = def?.metric ?? 'weight-reps';
        const useReps = metric === 'weight-reps' || metric === 'reps';
        const useTime = metric === 'time' || metric === 'weight-time';
        const useWeight = metric === 'weight-reps' || metric === 'weight-time';
        const repsLow = slot.repsLow ?? 8;
        const repsHigh = slot.repsHigh ?? 12;
        const timeLow = slot.timeLow ?? 30;
        const timeHigh = slot.timeHigh ?? 60;
        const startWt = def && useWeight
          ? startingWeightKg(user, def.id, def.primaryMuscle, repsLow)
          : undefined;

        const sets: SetEntry[] = Array.from({ length: slot.prescribedSets }, (_, i) => ({
          setIndex: i,
          weightKg: useWeight ? startWt : undefined,
          reps: useReps ? repsLow : undefined,
          timeSec: useTime ? timeLow : undefined,
          completed: false,
        }));

        return {
          exerciseId: def?.id ?? slot.exerciseId,
          name,
          muscle,
          prescribedSets: slot.prescribedSets,
          prescribedRepsLow: useReps ? repsLow : undefined,
          prescribedRepsHigh: useReps ? repsHigh : undefined,
          prescribedTimeLow: useTime ? timeLow : undefined,
          prescribedTimeHigh: useTime ? timeHigh : undefined,
          metric,
          prescribedRIR: slot.startingRIR != null ? Math.max(0, slot.startingRIR - week) : targetRIR,
          sets,
        };
      });

      const session: WorkoutSession = {
        id: sessionId,
        userId: user.userId,
        microcycleId: microId,
        mesocycleId: mesoId,
        planName: template.name,
        date: isoDate,
        dayOfWeek: dowJs,
        completed: false,
        exercises,
        cardio: [],
      };
      sessions.push(session);
      sessionIds.push(sessionId);
    }

    microcycles.push({
      id: microId,
      mesocycleId: mesoId,
      userId: user.userId,
      weekNumber: week + 1,
      splitType: template.split,
      status: week === 0 ? 'active' : 'draft',
      targetRIR,
      sessionIds,
    });
  }

  const mesocycle: Mesocycle = {
    id: mesoId,
    userId: user.userId,
    name: template.name,
    goal: user.primaryGoal,
    startDate,
    phaseType: template.defaultPhase,
    weeks,
    progressionScheme: template.progressionScheme,
    weekIndex: 0,
    status: 'active',
    microcycleIds: microcycles.map((m) => m.id),
    muscleTiers: input.muscleTiers ?? template.muscleTiers,
  };

  return { mesocycle, microcycles, sessions };
}
