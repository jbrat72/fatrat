'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { Button, TextField, InlineNumber, MuscleBadge, ChoiceCard } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import {
  generateWeekLayout, defaultEmphasisFrequency, findBackToBackMuscles,
  assignExercises, exercisesForMuscle, allowedEquipmentTypes, volumeRamp,
  generateCustomProgram, buildCustomTemplate, suggestStartingWeight, defaultTimeRange, dayOffsetsFor,
  fullBodyLayout, upperLowerLayout, pplLayout,
  TEMPLATE_MUSCLES, MAX_EMPHASIZE,
  DEFAULT_EMPHASIS_SLOTS, MIN_EMPHASIS_SLOTS, MAX_EMPHASIS_SLOTS,
  type MuscleTier, type AssignedWeek, type AssignedSlot, type CustomProgramInput,
} from '@/lib/program';
import { DEFAULT_LANDMARKS } from '@/lib/periodization';
import { personalizeLibrary } from '@/lib/exercise/personalize';
import { todayIso } from '@/lib/ui/date';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import type { MuscleGroup, ExerciseDefinition, EquipmentAccess, WorkoutSession, ProgramTemplate, SplitType, SetStyle } from '@/types';
import { inferTiers } from '@/lib/program/inferTiers';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the wizard opens pre-loaded with this template's layout. */
  initialTemplate?: ProgramTemplate | null;
  /** When set, saving as a template updates this template id (modify mode) instead of creating a new one. */
  modifyTemplateId?: string;
  /** Called after a program is activated ('activate') or saved ('template'). */
  onSaved?: (mode: 'activate' | 'template') => void;
}

const WEEK_OPTIONS = [3, 4, 5, 6, 7, 8];
const DAY_OPTIONS = [2, 3, 4, 5, 6, 7];
const START_DAYS: { label: string; dow: number }[] = [
  { label: 'Mon', dow: 1 }, { label: 'Tue', dow: 2 }, { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 }, { label: 'Fri', dow: 5 }, { label: 'Sat', dow: 6 },
  { label: 'Sun', dow: 0 },
];
const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type WorkoutType = 'emphasis' | 'full-body' | 'upper-lower' | 'PPL';
type ProgramStyle = 'traditional' | 'periodization';
const PROGRAM_STYLES: { value: ProgramStyle; label: string; description: string }[] = [
  {
    value: 'traditional',
    label: 'Traditional program',
    description: 'Build a multi-week program designed around your goals using traditional progressions and set types.',
  },
  {
    value: 'periodization',
    label: 'Periodization training',
    description: 'Structured in mesocycles — weekly volume ramps toward a peak, then a deload. Uses RIR targets and volume landmarks.',
  },
];

type CircuitStyle = 'classic' | 'speed';
const CIRCUIT_STYLES: { value: CircuitStyle; label: string; description: string }[] = [
  {
    value: 'classic',
    label: 'Classic Circuit',
    description: 'Move through the exercises with full rest between sets — standard strength pacing.',
  },
  {
    value: 'speed',
    label: 'Speed Circuit',
    description: 'Short rest between exercises to keep your heart rate up — more of a conditioning workout.',
  },
];

const SET_STYLES: { value: SetStyle; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'superset', label: 'Superset' },
  { value: 'drop', label: 'Drop set' },
  { value: 'pyramid', label: 'Pyramid' },
];

const WORKOUT_TYPES: { value: WorkoutType; label: string; description: string }[] = [
  {
    value: 'emphasis',
    label: 'Body Part Emphasis',
    description: 'Isolate one or two muscle groups per day (e.g. Chest & Biceps). Best at 4-5 days/week. Lets you emphasize and grow specific muscles.',
  },
  {
    value: 'full-body',
    label: 'Full Body',
    description: 'Every muscle group, every training day. A maintenance-style plan — no emphasis or growth priorities.',
  },
  {
    value: 'upper-lower',
    label: 'Upper / Lower Split',
    description: 'Alternate upper-body days (chest, back, arms, shoulders) and lower-body days (quads, hamstrings, glutes, calves). Usually 2-4 days/week.',
  },
  {
    value: 'PPL',
    label: 'Push / Pull / Legs',
    description: 'A 3-day cycle — Push (chest, shoulders, triceps), Pull (back, biceps, rear delts), Legs (lower body & core).',
  },
];

/** Map the wizard's workout type to the stored SplitType, and back. */
function splitTypeOf(wt: WorkoutType): SplitType {
  if (wt === 'full-body') return 'full-body';
  if (wt === 'upper-lower') return 'upper-lower';
  if (wt === 'PPL') return 'PPL';
  return 'bro-split';
}
function workoutTypeOf(split: SplitType): WorkoutType {
  if (split === 'full-body') return 'full-body';
  if (split === 'upper-lower') return 'upper-lower';
  if (split === 'PPL') return 'PPL';
  return 'emphasis';
}

/** Label for a training day, by workout type and work-day index. */
function dayBucketLabel(wt: WorkoutType, workIdx: number): string | null {
  if (wt === 'full-body') return 'Full Body';
  if (wt === 'upper-lower') return workIdx % 2 === 0 ? 'Upper' : 'Lower';
  if (wt === 'PPL') return ['Push', 'Pull', 'Legs'][workIdx % 3] ?? null;
  return null;
}
const MAX_DAYS = 7;
const TIERS: MuscleTier[] = ['maintain', 'grow', 'emphasize'];
const TIER_LABEL: Record<MuscleTier, string> = { maintain: 'Maintain', grow: 'Grow', emphasize: 'Emphasize' };
const TIER_RANK: Record<MuscleTier, number> = { emphasize: 0, grow: 1, maintain: 2 };
const STEP_TITLES = ['Workout', 'Frequency', 'Prioritize muscles', 'Week layout', 'Week 1 exercises', 'Starting weights, reps & rest'];
const REST_OPTIONS = [30, 45, 60, 90, 120, 180, 240, 300];
function fmtRest(s: number): string {
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string }[] = [
  { value: 'commercial-gym', label: 'Full commercial gym' },
  { value: 'home-gym', label: 'Home gym (barbell + rack)' },
  { value: 'dumbbells-only', label: 'Dumbbells only' },
  { value: 'bodyweight', label: 'Bodyweight only' },
  { value: 'bodyweight-bands', label: 'Bodyweight + bands' },
  { value: 'bodyweight-kettlebells', label: 'Bodyweight + kettlebells' },
  { value: 'bodyweight-dumbbells', label: 'Bodyweight + dumbbells' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'limited-hotel', label: 'Limited / hotel gym' },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** The next date on or after `iso` whose weekday matches `dow` (0 = Sunday). */
function nextDowOnOrAfter(iso: string, dow: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Default rest weekdays for a start day + training-day count — the complement
 * of the auto-spread work days. The start day is always a work day.
 */
function defaultRestDays(startDow: number, daysPerWeek: number): number[] {
  const workOffsets = new Set(dayOffsetsFor(daysPerWeek));
  const rest: number[] = [];
  for (let off = 0; off < 7; off++) {
    if (!workOffsets.has(off)) rest.push((startDow + off) % 7);
  }
  return rest;
}

function defaultTiers(): Partial<Record<MuscleGroup, MuscleTier>> {
  const t: Partial<Record<MuscleGroup, MuscleTier>> = {};
  for (const m of TEMPLATE_MUSCLES) t[m] = 'grow';
  return t;
}

function tierPillClass(tier: MuscleTier): string {
  if (tier === 'emphasize') return 'bg-accent/15 text-accent border-accent/40';
  if (tier === 'grow') return 'bg-info/15 text-info border-info/40';
  return 'bg-bg-elev text-ink-dim border-ink-line';
}

function tierTextClass(tier: MuscleTier): string {
  if (tier === 'emphasize') return 'text-accent';
  if (tier === 'grow') return 'text-info';
  return 'text-ink-mute';
}

/**
 * Custom-template creator (Page 1). A four-step wizard: frequency (name,
 * weeks, days, equipment), muscle prioritisation, the generated week layout,
 * and confirming the exercises for week 1 — then save it as the active
 * program or as a reusable template.
 */
export function TemplateWizard({ open, onClose, onSaved, initialTemplate, modifyTemplateId }: Props) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [programStyle, setProgramStyle] = useState<ProgramStyle>('periodization');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('emphasis');
  const [circuitStyle, setCircuitStyle] = useState<CircuitStyle>('classic');
  const [timesThrough, setTimesThrough] = useState(3);
  const [preferredSetStyle, setPreferredSetStyle] = useState<SetStyle>('straight');
  const [muscleSetStyles, setMuscleSetStyles] = useState<Partial<Record<MuscleGroup, 'superset' | 'drop'>>>({});
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [startDow, setStartDow] = useState(1); // 1 = Monday
  const [restDays, setRestDays] = useState<number[]>(() => defaultRestDays(1, 4));
  const [equipment, setEquipment] = useState<EquipmentAccess>('commercial-gym');
  const [tiers, setTiers] = useState<Partial<Record<MuscleGroup, MuscleTier>>>(defaultTiers);
  const [emphasisFreq, setEmphasisFreq] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [emphasisSlots, setEmphasisSlots] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [coreFreqOverride, setCoreFreqOverride] = useState<number | null>(null);
  const [coreSlots, setCoreSlots] = useState(DEFAULT_EMPHASIS_SLOTS);
  const [maxSetsPerExercise, setMaxSetsPerExercise] = useState(4);
  const [restSeconds, setRestSeconds] = useState(120);
  const [leadMuscle, setLeadMuscle] = useState<MuscleGroup | null>(null);
  const [library, setLibrary] = useState<ExerciseDefinition[]>([]);
  const [editedWeek, setEditedWeek] = useState<AssignedWeek | null>(null);
  const [modifyDay, setModifyDay] = useState<number | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ day: number; index: number } | null>(null);
  const [armedMove, setArmedMove] = useState<{ day: number; muscle: MuscleGroup } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justArmed = useRef(false);
  const initRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightEdits, setWeightEdits] = useState<Record<string, { weight?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }>>({});
  const [history, setHistory] = useState<WorkoutSession[]>([]);

  // On open: load the exercise library (curated by the user's favorites +
  // hidden) and default equipment to the profile.
  useEffect(() => {
    if (!open || !user) return;
    setEquipment(user.equipment[0] ?? 'commercial-gym');
    let cancelled = false;
    (async () => {
      const repo = getRepository();
      const [global, custom, prefs, sessions] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
        repo.getExercisePrefs(user.userId),
        repo.listSessions(user.userId),
      ]);
      if (!cancelled) {
        setLibrary(personalizeLibrary([...custom, ...global], prefs));
        setHistory(sessions);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  // When opened from a saved/library template, pre-load the wizard with it.
  // Runs once the exercise library is available so ids resolve to exercises.
  useEffect(() => {
    if (!open || !initialTemplate || !user || library.length === 0) return;
    if (initRef.current === initialTemplate.id) return;
    initRef.current = initialTemplate.id;

    const t = initialTemplate;
    const day0s = t.weeks[0]?.days ?? [];
    const tDays = clamp(day0s.length, 2, 7);
    const tWeeks = clamp(t.weeks.length, 3, 8);

    const trained: MuscleGroup[] = [];
    let coreDays = 0;
    let coreSlotsMax = 0;
    const seedUnits = user.units;
    const seedInc = seedUnits === 'imperial' ? 5 : 2.5;
    const seedWeightEdits: Record<string, { weight?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }> = {};
    const rawDays = day0s.map((day) => {
      let coreOnDay = 0;
      const slots = day.exercises.map((slot) => {
        const def = library.find((e) => e.id === slot.exerciseId);
        const muscle: MuscleGroup = def?.primaryMuscle ?? 'core';
        if (muscle === 'core') coreOnDay += 1;
        else if (!trained.includes(muscle)) trained.push(muscle);
        // Surface the slot's starting weight (kg) into the wizard's display
        // units so the starting-weights step opens pre-filled with the
        // user's existing prescription.
        const seedWeightDisplay = slot.startingWeightKg != null
          ? Math.round(((kgToDisplay(slot.startingWeightKg, seedUnits) ?? 0)) / seedInc) * seedInc
          : undefined;
        seedWeightEdits[slot.exerciseId] = {
          weight: seedWeightDisplay,
          repsLow: slot.repsLow,
          repsHigh: slot.repsHigh,
          timeLow: slot.timeLow,
          timeHigh: slot.timeHigh,
        };
        return { muscle, exerciseId: slot.exerciseId, exerciseName: def?.name ?? slot.exerciseId };
      });
      if (coreOnDay > 0) { coreDays += 1; coreSlotsMax = Math.max(coreSlotsMax, coreOnDay); }
      return slots;
    });

    // Tiers: the template's own, else inferred from history. Muscles the
    // template does not train are left out (N/A).
    const inferred = inferTiers(history, trained);
    const newTiers: Partial<Record<MuscleGroup, MuscleTier>> = {};
    for (const m of TEMPLATE_MUSCLES) {
      if (trained.includes(m)) newTiers[m] = t.muscleTiers?.[m] ?? inferred[m] ?? 'grow';
    }
    const tierOf = (m: MuscleGroup): MuscleTier => (m === 'core' ? 'grow' : newTiers[m] ?? 'grow');
    const assigned: AssignedWeek = rawDays.map((day) =>
      day.map((d) => ({ muscle: d.muscle, tier: tierOf(d.muscle), exerciseId: d.exerciseId, exerciseName: d.exerciseName })),
    );

    setStep(0);
    setWorkoutType(workoutTypeOf(t.split));
    setProgramStyle(t.programStyle ?? 'periodization');
    setName(t.name);
    setWeeks(tWeeks);
    setDaysPerWeek(tDays);
    setRestDays(defaultRestDays(1, tDays));
    setTiers(newTiers);
    setEditedWeek(assigned);
    setCoreFreqOverride(coreDays);
    setCoreSlots(coreSlotsMax > 0 ? clamp(coreSlotsMax, MIN_EMPHASIS_SLOTS, MAX_EMPHASIS_SLOTS) : DEFAULT_EMPHASIS_SLOTS);
    setRestSeconds(t.restSeconds ?? 120);
    setWeightEdits(seedWeightEdits);
  }, [open, initialTemplate, user, library, history]);

  // Long-press move is per-step — drop the armed muscle when the step changes.
  // Scroll the new step to the top. We use scrollTo with 'auto' to override any
  // inherited smooth-scroll CSS, and run on requestAnimationFrame + a 50ms
  // setTimeout so it beats focus-induced scrolling from form fields that mount
  // with the new content. Also scroll the window itself as a belt-and-suspenders.
  useEffect(() => {
    setArmedMove(null);
    const toTop = () => {
      mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    };
    toTop();
    const raf = requestAnimationFrame(toTop);
    const t = window.setTimeout(toTop, 50);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
  }, [step]);

  // Also reset scroll whenever the wizard first opens.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [open]);

  const emphasizeCount = useMemo(
    () => TEMPLATE_MUSCLES.filter((m) => tiers[m] === 'emphasize').length,
    [tiers],
  );
  const emphasizedMuscles = useMemo(
    () => TEMPLATE_MUSCLES.filter((m) => tiers[m] === 'emphasize'),
    [tiers],
  );
  // Full Body has no tier step — every muscle trains at maintenance volume.
  const effectiveTiers = useMemo<Partial<Record<MuscleGroup, MuscleTier>>>(() => {
    if (workoutType !== 'full-body') return tiers;
    const out: Partial<Record<MuscleGroup, MuscleTier>> = { core: 'maintain' };
    for (const m of TEMPLATE_MUSCLES) if (tiers[m] != null) out[m] = 'maintain';
    return out;
  }, [workoutType, tiers]);
  const musclesByTier = useMemo(
    () => TEMPLATE_MUSCLES.filter((m) => effectiveTiers[m] != null)
      .sort((a, b) => TIER_RANK[effectiveTiers[a]!] - TIER_RANK[effectiveTiers[b]!]),
    [effectiveTiers],
  );

  const effectiveLead: MuscleGroup | undefined =
    leadMuscle && tiers[leadMuscle] === 'emphasize' ? leadMuscle : emphasizedMuscles[0];

  const allowed = useMemo(() => allowedEquipmentTypes([equipment]), [equipment]);

  // Core's effective days/week — defaults to every training day, capped by it.
  const coreFreq = Math.min(coreFreqOverride ?? daysPerWeek, daysPerWeek);

  // Body Part Emphasis is the only type whose day layout the user hand-edits;
  // the others have a structure fixed by the workout type.
  const canEditLayout = workoutType === 'emphasis';
  // Modify + long-press to rearrange days is offered on every workout type.
  const canModifyLayout = true;
  const isPeriodized = programStyle === 'periodization';
  const isCircuit = programStyle === 'traditional' && workoutType === 'full-body';
  // Traditional programs don't offer the free-form Body Part Emphasis type.
  const availableWorkoutTypes = useMemo(
    () => WORKOUT_TYPES.filter((wt) => programStyle === 'periodization' || wt.value !== 'emphasis'),
    [programStyle],
  );
  const chooseProgramStyle = (ps: ProgramStyle) => {
    setProgramStyle(ps);
    if (ps === 'traditional' && workoutType === 'emphasis') chooseWorkoutType('full-body');
    setEditedWeek(null);
  };
  // Switching workout type also picks sensible core defaults: Upper/Lower
  // and PPL historically scheduled core only on lower/leg days, with one slot;
  // Full Body / Emphasis default to every training day with two slots.
  const chooseWorkoutType = (wt: WorkoutType) => {
    setWorkoutType(wt);
    if (wt === 'upper-lower') {
      setCoreFreqOverride(Math.max(1, Math.floor(daysPerWeek / 2)));
      setCoreSlots(1);
    } else if (wt === 'PPL') {
      setCoreFreqOverride(Math.max(1, Math.floor(daysPerWeek / 3)));
      setCoreSlots(1);
    } else {
      setCoreFreqOverride(null);
      setCoreSlots(DEFAULT_EMPHASIS_SLOTS);
    }
    setEditedWeek(null);
  };
  const toggleMuscleStyle = (m: MuscleGroup, style: 'superset' | 'drop') => {
    setMuscleSetStyles((prev) => {
      const next = { ...prev };
      if (next[m] === style) delete next[m];
      else next[m] = style;
      return next;
    });
  };
  const generatedLayout = useMemo(
    () => {
      if (workoutType === 'full-body') return fullBodyLayout(daysPerWeek, coreFreq, coreSlots, TEMPLATE_MUSCLES.filter((m) => tiers[m] != null));
      if (workoutType === 'upper-lower') return upperLowerLayout(daysPerWeek, tiers, coreFreq, coreSlots);
      if (workoutType === 'PPL') return pplLayout(daysPerWeek, tiers, coreFreq, coreSlots);
      return generateWeekLayout({
        weeks, daysPerWeek, tiers,
        emphasisFrequency: emphasisFreq,
        emphasisSlotsPerDay: emphasisSlots,
        leadMuscle: effectiveLead,
        core: { daysPerWeek: coreFreq, slotsPerDay: coreSlots },
      });
    },
    [workoutType, weeks, daysPerWeek, tiers, emphasisFreq, emphasisSlots, effectiveLead, coreFreq, coreSlots],
  );
  const freshWeek = useMemo(
    () => assignExercises(generatedLayout, library, allowed),
    [generatedLayout, library, allowed],
  );
  const week: AssignedWeek = editedWeek ?? freshWeek;
  const backToBack = useMemo(() => findBackToBackMuscles(week), [week]);
  const layoutHasCore = useMemo(() => week.some((d) => d.some((s) => s.muscle === 'core')), [week]);
  // How many exercise slots each muscle gets across the whole week.
  const slotCountByMuscle = useMemo(() => {
    const counts = new Map<MuscleGroup, number>();
    for (const day of week) for (const s of day) counts.set(s.muscle, (counts.get(s.muscle) ?? 0) + 1);
    return counts;
  }, [week]);

  const units = user?.units ?? 'metric';
  const wLabel = weightLabel(units);
  const wInc = units === 'imperial' ? 5 : 2.5;
  const wDecimals = units === 'imperial' ? 0 : 1;

  // Every distinct exercise across the confirmed week — one starting-weight row each.
  const uniqueExercises = useMemo(() => {
    const seen = new Map<string, { slot: AssignedSlot; def: ExerciseDefinition }>();
    for (const day of week) {
      for (const slot of day) {
        if (seen.has(slot.exerciseId)) continue;
        const def = library.find((e) => e.id === slot.exerciseId);
        if (def) seen.set(slot.exerciseId, { slot, def });
      }
    }
    return [...seen.values()];
  }, [week, library]);

  // Suggested starting weight + rep range per exercise, merged with user edits.
  // Weight is held in display units; converted to kg on save.
  const startingPlan = useMemo(() => {
    const out: Record<string, { weight: number; repsLow: number; repsHigh: number; timeLow: number; timeHigh: number; basis: 'history' | 'estimate' }> = {};
    if (!user) return out;
    for (const { slot, def } of uniqueExercises) {
      const sug = suggestStartingWeight(def, user, history);
      const dt = defaultTimeRange(def);
      const ed = weightEdits[slot.exerciseId] ?? {};
      const suggestedDisplay = Math.round(((kgToDisplay(sug.weightKg, units) ?? 0)) / wInc) * wInc;
      out[slot.exerciseId] = {
        weight: ed.weight ?? suggestedDisplay,
        repsLow: ed.repsLow ?? sug.repsLow,
        repsHigh: ed.repsHigh ?? sug.repsHigh,
        timeLow: ed.timeLow ?? dt.timeLow,
        timeHigh: ed.timeHigh ?? dt.timeHigh,
        basis: sug.basis,
      };
    }
    return out;
  }, [uniqueExercises, user, history, weightEdits, units, wInc]);

  if (!open) return null;

  const totalSteps = STEP_TITLES.length;

  const reset = () => {
    setStep(0); setProgramStyle('periodization'); setWorkoutType('emphasis');
    setCircuitStyle('classic'); setTimesThrough(3);
    setPreferredSetStyle('straight'); setMuscleSetStyles({}); setName(''); setWeeks(4); setDaysPerWeek(4); setStartDow(1); setRestDays(defaultRestDays(1, 4));
    setTiers(defaultTiers()); setEmphasisFreq({}); setEmphasisSlots({}); setLeadMuscle(null);
    setCoreFreqOverride(null); setCoreSlots(DEFAULT_EMPHASIS_SLOTS); setMaxSetsPerExercise(4); setRestSeconds(120);
    setEditedWeek(null); setModifyDay(null); setSwapTarget(null);
    setSaveOpen(false); setSaving(false); setWeightEdits({}); setArmedMove(null);
    initRef.current = null;
  };
  const close = () => { reset(); onClose(); };

  // Any upstream change discards manual edits so the proposal stays fresh.
  const setTier = (m: MuscleGroup, tier: MuscleTier | null) => {
    if (tier === 'emphasize' && tiers[m] !== 'emphasize' && emphasizeCount >= MAX_EMPHASIZE) return;
    setTiers((prev) => {
      const next = { ...prev };
      if (tier == null) delete next[m];
      else next[m] = tier;
      return next;
    });
    setEditedWeek(null);
  };
  const chooseWeeks = (w: number) => { setWeeks(w); setEditedWeek(null); };
  const chooseDays = (d: number) => { setDaysPerWeek(d); setRestDays(defaultRestDays(startDow, d)); setEditedWeek(null); };
  const chooseStartDow = (dow: number) => { setStartDow(dow); setRestDays(defaultRestDays(dow, daysPerWeek)); };
  const toggleRestDay = (dow: number) => {
    if (dow === startDow || daysPerWeek >= 7 || restDays.includes(dow)) return;
    setRestDays((prev) => {
      const next = [...prev, dow];
      while (next.length > 7 - daysPerWeek) next.shift();
      return next;
    });
  };
  const chooseEquipment = (eq: EquipmentAccess) => { setEquipment(eq); setEditedWeek(null); };
  const chooseLead = (m: MuscleGroup) => { setLeadMuscle(m); setEditedWeek(null); };
  const addTrainingDay = () => {
    if (daysPerWeek >= MAX_DAYS) return;
    setDaysPerWeek(daysPerWeek + 1);
    setRestDays(defaultRestDays(startDow, daysPerWeek + 1));
    setEditedWeek(null);
  };

  const emphFreqOf = (m: MuscleGroup) =>
    emphasisFreq[m] ?? defaultEmphasisFrequency(m, daysPerWeek, emphasizedMuscles);
  const bumpEmphFreq = (m: MuscleGroup, delta: number) => {
    const next = clamp(emphFreqOf(m) + delta, 1, daysPerWeek);
    setEmphasisFreq((prev) => ({ ...prev, [m]: next }));
    setEditedWeek(null);
  };

  const emphSlotsOf = (m: MuscleGroup) => emphasisSlots[m] ?? DEFAULT_EMPHASIS_SLOTS;
  const bumpEmphSlots = (m: MuscleGroup, delta: number) => {
    const next = clamp(emphSlotsOf(m) + delta, MIN_EMPHASIS_SLOTS, MAX_EMPHASIS_SLOTS);
    setEmphasisSlots((prev) => ({ ...prev, [m]: next }));
    setEditedWeek(null);
  };

  const bumpCoreFreq = (delta: number) => {
    setCoreFreqOverride(clamp((coreFreqOverride ?? daysPerWeek) + delta, 0, daysPerWeek));
    setEditedWeek(null);
  };
  const bumpCoreSlots = (delta: number) => {
    setCoreSlots(clamp(coreSlots + delta, MIN_EMPHASIS_SLOTS, MAX_EMPHASIS_SLOTS));
    setEditedWeek(null);
  };

  const editDay = (day: number, mutate: (slots: AssignedSlot[]) => AssignedSlot[]) => {
    const base = week.map((d) => [...d]);
    base[day] = mutate(base[day] ?? []).slice().sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
    setEditedWeek(base);
  };
  const addSlot = (day: number, muscle: MuscleGroup) => {
    const options = exercisesForMuscle(muscle, library, allowed);
    editDay(day, (slots) => {
      const used = new Set(slots.map((s) => s.exerciseId));
      const pick = options.find((e) => !used.has(e.id)) ?? options[0];
      return [...slots, {
        muscle,
        tier: tiers[muscle] ?? 'grow',
        exerciseId: pick?.id ?? `muscle:${muscle}`,
        exerciseName: pick?.name ?? muscle,
      }];
    });
  };
  const removeSlot = (day: number, index: number) =>
    editDay(day, (slots) => slots.filter((_, i) => i !== index));
  const applySwap = (ex: ExerciseDefinition) => {
    if (!swapTarget) return;
    const { day, index } = swapTarget;
    editDay(day, (slots) => slots.map((s, i) =>
      i === index ? { ...s, exerciseId: ex.id, exerciseName: ex.name } : s));
    setSwapTarget(null);
  };

  // ----- Long-press to move a muscle from one day to another -----
  const startPress = (day: number, muscle: MuscleGroup) => {
    if (!canModifyLayout) return;
    justArmed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setArmedMove({ day, muscle });
      justArmed.current = true; // swallow the click that ends this long-press
      pressTimer.current = null;
    }, 400);
  };
  const clearPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  // Moves every slot of `muscle` from one day to another, re-sorting by tier.
  const moveMuscle = (fromDay: number, toDay: number, muscle: MuscleGroup) => {
    if (fromDay === toDay) return;
    const base = week.map((d) => [...d]);
    const moving = (base[fromDay] ?? []).filter((s) => s.muscle === muscle);
    if (moving.length === 0) return;
    base[fromDay] = (base[fromDay] ?? []).filter((s) => s.muscle !== muscle);
    base[toDay] = [...(base[toDay] ?? []), ...moving]
      .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
    setEditedWeek(base);
  };
  // Removes every slot of `muscle` from a single day (short-press × on a pill).
  const removeMuscle = (day: number, muscle: MuscleGroup) => {
    const base = week.map((d) => [...d]);
    base[day] = (base[day] ?? []).filter((s) => s.muscle !== muscle);
    setEditedWeek(base);
  };

  const swapSlot: AssignedSlot | null =
    swapTarget ? (week[swapTarget.day]?.[swapTarget.index] ?? null) : null;
  const swapOptions = swapSlot ? exercisesForMuscle(swapSlot.muscle, library, allowed) : [];

  const handleSave = async (mode: 'activate' | 'template') => {
    if (!user || saving) return;
    setSaving(true);
    const repo = getRepository();
    const startingWeights: Record<string, { weightKg?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }> = {};
    for (const [id, p] of Object.entries(startingPlan)) {
      const def = library.find((e) => e.id === id);
      const metric = def?.metric ?? 'weight-reps';
      const useReps = metric === 'weight-reps' || metric === 'reps';
      const useTime = metric === 'time' || metric === 'weight-time';
      const useWeight = metric === 'weight-reps' || metric === 'weight-time';
      const isBand = def?.equipment === 'band';
      const repsLow = useReps ? Math.max(1, Math.round(p.repsLow)) : undefined;
      const timeLow = useTime ? Math.max(1, Math.round(p.timeLow)) : undefined;
      startingWeights[id] = {
        weightKg: useWeight && !isBand ? (displayToKg(p.weight, user.units) ?? 0) : undefined,
        repsLow,
        repsHigh: useReps && repsLow != null ? Math.max(repsLow, Math.round(p.repsHigh)) : undefined,
        timeLow,
        timeHigh: useTime && timeLow != null ? Math.max(timeLow, Math.round(p.timeHigh)) : undefined,
      };
    }
    const workOffsets: number[] = [];
    for (let off = 0; off < 7; off++) {
      if (!restDays.includes((startDow + off) % 7)) workOffsets.push(off);
    }
    const input: CustomProgramInput = {
      name, weeks, daysPerWeek, week1: week, tiers: effectiveTiers, library, allowed,
      userId: user.userId, creatorName: user.displayName,
      goal: user.primaryGoal, startDate: nextDowOnOrAfter(todayIso(), startDow), startingWeights,
      workOffsets, splitType: splitTypeOf(workoutType), programStyle,
      timesThrough: isCircuit ? timesThrough : undefined,
      circuitStyle: isCircuit ? circuitStyle : undefined,
      preferredSetStyle, muscleSetStyles,
      maxSetsPerExercise,
      restSeconds,
    };
    try {
      if (mode === 'activate') {
        // Archive any active plan (Mesocycle) so only the new block is "current".
        const mesos = await repo.listMesocycles(user.userId);
        for (const mz of mesos) {
          if (mz.status === 'active') await repo.upsertMesocycle({ ...mz, status: 'archived' });
        }
        const prog = generateCustomProgram(input);
        await repo.upsertMesocycle(prog.mesocycle);
        for (const mi of prog.microcycles) await repo.upsertMicrocycle(mi);
        for (const s of prog.sessions) await repo.upsertSession(s);
      } else {
        const built = buildCustomTemplate(input);
        await repo.upsertTemplate(modifyTemplateId ? { ...built, id: modifyTemplateId } : built);
      }
      onSaved?.(mode);
    } finally {
      setSaving(false);
    }
    close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <header className="shrink-0 border-b border-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-12">
          <div className="section-head">TEMPLATE WIZARD</div>
          <button
            type="button"
            onClick={close}
            className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="h-1 bg-ink-line">
          <div className="h-1 bg-accent transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="text-xs text-ink-mute tracking-wider2 mb-1">STEP {step + 1} / {totalSteps}</div>
          <h2 className="text-xl font-semibold mb-4">{STEP_TITLES[step]}</h2>

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <div className="section-head mb-1">Workout name</div>
                <TextField
                  placeholder="e.g. Summer Arms Block"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <div className="section-head mb-1">Program style</div>
                <p className="text-xs text-ink-dim mb-2">How the plan progresses over time.</p>
                <div className="space-y-2">
                  {PROGRAM_STYLES.map((ps) => (
                    <ChoiceCard
                      key={ps.value}
                      value={ps.value}
                      label={ps.label}
                      description={ps.description}
                      selected={programStyle === ps.value}
                      onSelect={() => chooseProgramStyle(ps.value)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="section-head mb-1">Workout type</div>
                <p className="text-xs text-ink-dim mb-2">How your training week is structured.</p>
                <div className="space-y-2">
                  {availableWorkoutTypes.map((wt) => (
                    <ChoiceCard
                      key={wt.value}
                      value={wt.value}
                      label={wt.label}
                      description={wt.description}
                      selected={workoutType === wt.value}
                      onSelect={() => chooseWorkoutType(wt.value)}
                    />
                  ))}
                </div>
              </div>
              {programStyle === 'traditional' && workoutType === 'full-body' && (
                <div>
                  <div className="section-head mb-1">Circuit style</div>
                  <p className="text-xs text-ink-dim mb-2">How you move through the exercises.</p>
                  <div className="space-y-2">
                    {CIRCUIT_STYLES.map((cs) => (
                      <ChoiceCard
                        key={cs.value}
                        value={cs.value}
                        label={cs.label}
                        description={cs.description}
                        selected={circuitStyle === cs.value}
                        onSelect={() => setCircuitStyle(cs.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="section-head mb-1">Equipment</div>
                <p className="text-xs text-ink-dim mb-2">Defaults to your profile — change it for this block if needed.</p>
                <select
                  value={equipment}
                  onChange={(e) => chooseEquipment(e.target.value as EquipmentAccess)}
                  className="w-full h-11 px-3 rounded-lg bg-bg-input border border-ink-line text-ink text-sm font-medium"
                >
                  {EQUIPMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="section-head mb-1">How many weeks?</div>
                <p className="text-xs text-ink-dim mb-2">The length of this training block.</p>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_OPTIONS.map((w) => (
                    <PillButton key={w} selected={weeks === w} onClick={() => chooseWeeks(w)}>{w}</PillButton>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-head mb-1">How many days per week?</div>
                <p className="text-xs text-ink-dim mb-2">How many times you train each week.</p>
                <div className="flex gap-2 flex-wrap">
                  {DAY_OPTIONS.map((d) => (
                    <PillButton key={d} selected={daysPerWeek === d} onClick={() => chooseDays(d)}>{d}</PillButton>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-head mb-1">Start day</div>
                <p className="text-xs text-ink-dim mb-2">
                  Which day of the week your plan begins. Week 1 starts on the next one.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {START_DAYS.map((sd) => (
                    <PillButton key={sd.dow} selected={startDow === sd.dow} onClick={() => chooseStartDow(sd.dow)}>
                      {sd.label}
                    </PillButton>
                  ))}
                </div>
                <p className="text-xs text-ink-mute mt-2 tnum">
                  Starts {new Date(nextDowOnOrAfter(todayIso(), startDow) + 'T00:00:00')
                    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {workoutType === 'full-body' && (
                <div>
                  <p className="text-sm text-ink-dim mb-3">
                    Full Body trains every muscle group each day. Tap a muscle to leave it out of
                    this plan — the rest are trained at a steady volume.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {TEMPLATE_MUSCLES.map((m) => {
                      const included = tiers[m] != null;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTier(m, included ? null : 'grow')}
                          aria-pressed={included}
                          className={cn(
                            'rounded-md px-3 py-2 text-sm font-medium border transition',
                            included
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg-input text-ink-mute border-ink-line line-through',
                          )}
                        >
                          {cap(m)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {workoutType !== 'full-body' && (
                <p className="text-sm text-ink-dim mb-1">
                  {workoutType === 'emphasis' ? (
                    <>Sort each muscle into a tier. <span className="text-ink">Emphasize</span> the 2–3
                    muscles you most want to grow — they are trained most often, first in the week, and
                    first in each day. <span className="text-ink">Grow</span> muscles are trained
                    moderately; <span className="text-ink">Maintain</span> muscles just once a week. Mark a muscle
                    <span className="text-ink"> N/A</span> to leave it out of this plan.</>
                  ) : (
                    <>Your day structure is fixed by the split — these tiers just fine-tune volume.
                    <span className="text-ink"> Emphasize</span> a muscle for an extra exercise on its
                    training day, or mark one <span className="text-ink">N/A</span> to drop it.</>
                  )}
                </p>
              )}
              {workoutType !== 'full-body' && (
                <div className={cn('text-xs mb-3', emphasizeCount >= MAX_EMPHASIZE ? 'text-warn' : 'text-ink-mute')}>
                  {emphasizeCount} / {MAX_EMPHASIZE} emphasized
                </div>
              )}
              {workoutType !== 'full-body' && (
              <div className="space-y-1.5">
                {TEMPLATE_MUSCLES.map((m) => {
                  const naSel = tiers[m] == null;
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-sm font-medium">{cap(m)}</span>
                      <div className="flex-1 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setTier(m, null)}
                          aria-label={`Exclude ${cap(m)} from this plan`}
                          className={cn(
                            'h-9 w-10 shrink-0 rounded-md text-[11px] font-medium border transition',
                            naSel
                              ? 'bg-bg-elev border-ink-dim text-ink'
                              : 'bg-bg-input border-ink-line text-ink-mute hover:text-ink',
                          )}
                        >
                          N/A
                        </button>
                        <div className="flex-1 grid grid-cols-3 gap-1">
                          {TIERS.map((t) => {
                            const isSel = tiers[m] === t;
                            const blocked = t === 'emphasize' && !isSel && emphasizeCount >= MAX_EMPHASIZE;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTier(m, t)}
                                disabled={blocked}
                                className={cn(
                                  'h-9 rounded-md text-xs font-medium border transition',
                                  isSel && t === 'maintain' && 'bg-bg-elev border-ink-dim text-ink',
                                  isSel && t === 'grow' && 'bg-info/20 border-info text-info',
                                  isSel && t === 'emphasize' && 'bg-accent border-accent text-white',
                                  !isSel && 'bg-bg-input border-ink-line text-ink-dim hover:text-ink',
                                  blocked && 'opacity-30 pointer-events-none',
                                )}
                              >
                                {TIER_LABEL[t]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              {workoutType !== 'full-body' && (
                <div className="card p-3 mt-3">
                  <div className="section-head mb-1">SET STYLES</div>
                  {programStyle === 'traditional' && (
                    <div className="mb-3">
                      <p className="text-xs text-ink-dim mb-2">
                        Your preferred set style — the basis for the plan, with variety mixed in.
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {SET_STYLES.map((ss) => (
                          <button
                            key={ss.value}
                            type="button"
                            onClick={() => setPreferredSetStyle(ss.value)}
                            className={cn(
                              'rounded-md px-3 py-1.5 text-xs font-medium border transition',
                              preferredSetStyle === ss.value
                                ? 'bg-accent text-white border-accent'
                                : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                            )}
                          >
                            {ss.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-ink-dim mb-1.5">
                    Designate muscle groups for a specific style (optional).
                  </p>
                  <div className="text-2xs text-ink-mute tracking-wider2 uppercase mb-1">Supersets</div>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {musclesByTier.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMuscleStyle(m, 'superset')}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium border transition',
                          muscleSetStyles[m] === 'superset'
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                        )}
                      >
                        {cap(m)}
                      </button>
                    ))}
                  </div>
                  <div className="text-2xs text-ink-mute tracking-wider2 uppercase mb-1">Drop sets</div>
                  <div className="flex gap-1 flex-wrap">
                    {musclesByTier.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMuscleStyle(m, 'drop')}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium border transition',
                          muscleSetStyles[m] === 'drop'
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                        )}
                      >
                        {cap(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-ink-dim mb-3">
                <span className="text-ink font-medium">{name.trim() || 'Untitled template'}</span> — one
                training week that repeats across all {weeks} weeks.
                {canModifyLayout && ' Use Modify to add or drop a muscle on any day.'}
              </p>

              <div className="card p-3 mb-3">
                <div className="section-head mb-2">WORK DAYS</div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, p) => {
                    const dow = (startDow + p) % 7;
                    const rest = restDays.includes(dow);
                    return (
                      <div key={p} className="flex flex-col items-center gap-1">
                        <span className="text-2xs text-ink-dim">{DOW_ABBR[dow]}</span>
                        <div
                          className={cn(
                            'h-9 w-full rounded-md border flex items-center justify-center text-2xs font-semibold',
                            rest
                              ? 'bg-crosshatch border-ink-line/60 text-ink-mute'
                              : 'bg-accent/15 border-accent/40 text-accent',
                          )}
                        >
                          {rest ? 'Rest' : 'Work'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {daysPerWeek >= 7 ? (
                  <p className="text-xs text-ink-mute mt-3">You train every day &mdash; no rest days.</p>
                ) : (
                  <>
                    <div className="section-head mt-3 mb-1">Rest days</div>
                    <p className="text-xs text-ink-dim mb-2">
                      Tap a day to make it rest. You have {7 - daysPerWeek} rest day{7 - daysPerWeek === 1 ? '' : 's'}
                      {' '}&mdash; marking a new one frees up the oldest. Your start day stays a work day.
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }, (_, p) => {
                        const dow = (startDow + p) % 7;
                        const rest = restDays.includes(dow);
                        const isStart = dow === startDow;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => toggleRestDay(dow)}
                            disabled={isStart}
                            aria-label={
                              isStart
                                ? `${DOW_FULL[dow]} is the start day`
                                : rest
                                  ? `${DOW_FULL[dow]} is a rest day`
                                  : `Make ${DOW_FULL[dow]} a rest day`
                            }
                            className={cn(
                              'h-9 rounded-md border text-2xs font-semibold transition',
                              rest && 'bg-crosshatch border-ink-dim text-ink',
                              !rest && !isStart && 'bg-bg-input border-ink-line text-ink-dim hover:text-ink',
                              isStart && 'bg-accent/15 border-accent/40 text-accent opacity-80',
                            )}
                          >
                            {DOW_ABBR[dow]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {canEditLayout && backToBack.length > 0 && (
                <div className="rounded-[14px] border border-warn/40 bg-warn/10 p-3 mb-3">
                  <div className="text-sm font-medium text-warn mb-1">Back-to-back training days</div>
                  <p className="text-xs text-ink-dim">
                    {backToBack.map(cap).join(', ')} {backToBack.length === 1 ? 'is' : 'are'} trained on
                    consecutive days — there isn&apos;t room to space {backToBack.length === 1 ? 'it' : 'them'} out
                    at {daysPerWeek} days/week. Lower a muscle&apos;s days/week below, or add a training day.
                  </p>
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={addTrainingDay} disabled={daysPerWeek >= MAX_DAYS}>
                      {daysPerWeek >= MAX_DAYS ? 'Already at 7 days/week' : 'Add a training day'}
                    </Button>
                  </div>
                </div>
              )}

              {canEditLayout && emphasizedMuscles.length >= 2 && (
                <div className="card p-3 mb-3">
                  <div className="section-head mb-2">START THE WEEK WITH</div>
                  <div className="flex flex-wrap gap-1.5">
                    {emphasizedMuscles.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => chooseLead(m)}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-xs font-medium border transition',
                          effectiveLead === m
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                        )}
                      >
                        {cap(m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canEditLayout && emphasizedMuscles.length > 0 && (
                <div className="card p-3 mb-3">
                  <div className="section-head mb-1">EMPHASIS MUSCLES</div>
                  <p className="text-xs text-ink-dim mb-2">
                    For each emphasized muscle, set how many days a week it is trained and how many
                    exercises it gets on each of those days.
                  </p>
                  <div className="space-y-3">
                    {emphasizedMuscles.map((m, i) => {
                      const f = emphFreqOf(m);
                      const sl = emphSlotsOf(m);
                      return (
                        <div key={m} className={cn('space-y-1.5', i > 0 && 'border-t border-ink-line pt-3')}>
                          <span className="text-sm font-medium">{cap(m)}</span>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-ink-dim">Days / week</span>
                            <div className="flex items-center gap-2">
                              <StepBtn label="Fewer days" disabled={f <= 1} onClick={() => bumpEmphFreq(m, -1)}>−</StepBtn>
                              <span className="numeric text-sm w-16 text-center">{f} day{f === 1 ? '' : 's'}</span>
                              <StepBtn label="More days" disabled={f >= daysPerWeek} onClick={() => bumpEmphFreq(m, 1)}>+</StepBtn>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-ink-dim">Exercises / day</span>
                            <div className="flex items-center gap-2">
                              <StepBtn label="Fewer exercises" disabled={sl <= MIN_EMPHASIS_SLOTS} onClick={() => bumpEmphSlots(m, -1)}>−</StepBtn>
                              <span className="numeric text-sm w-16 text-center">{sl}</span>
                              <StepBtn label="More exercises" disabled={sl >= MAX_EMPHASIS_SLOTS} onClick={() => bumpEmphSlots(m, 1)}>+</StepBtn>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="card p-3 mb-3">
                <div className="section-head mb-1">CORE</div>
                <p className="text-xs text-ink-dim mb-2">
                  Core trains on its own schedule, separate from the muscle
                  tiers. Set how many days a week it is trained and how many
                  exercises it gets on each of those days.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-dim">Days / week</span>
                    <div className="flex items-center gap-2">
                      <StepBtn label="Fewer days" disabled={coreFreq <= 0} onClick={() => bumpCoreFreq(-1)}>−</StepBtn>
                      <span className="numeric text-sm w-16 text-center">{coreFreq} day{coreFreq === 1 ? '' : 's'}</span>
                      <StepBtn label="More days" disabled={coreFreq >= daysPerWeek} onClick={() => bumpCoreFreq(1)}>+</StepBtn>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-dim">Exercises / day</span>
                    <div className="flex items-center gap-2">
                      <StepBtn label="Fewer exercises" disabled={coreSlots <= MIN_EMPHASIS_SLOTS} onClick={() => bumpCoreSlots(-1)}>−</StepBtn>
                      <span className="numeric text-sm w-16 text-center">{coreSlots}</span>
                      <StepBtn label="More exercises" disabled={coreSlots >= MAX_EMPHASIS_SLOTS} onClick={() => bumpCoreSlots(1)}>+</StepBtn>
                    </div>
                  </div>
                </div>
              </div>

              {isCircuit && (
                <div className="card p-3 mb-3">
                  <div className="section-head mb-1">CIRCUIT ROUNDS</div>
                  <p className="text-xs text-ink-dim mb-2">
                    How many times you move through the full circuit each session.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-dim">Times through</span>
                    <div className="flex items-center gap-2">
                      <StepBtn label="Fewer rounds" disabled={timesThrough <= 1} onClick={() => setTimesThrough((t) => Math.max(1, t - 1))}>−</StepBtn>
                      <span className="numeric text-sm w-16 text-center">{timesThrough}</span>
                      <StepBtn label="More rounds" disabled={timesThrough >= 6} onClick={() => setTimesThrough((t) => Math.min(6, t + 1))}>+</StepBtn>
                    </div>
                  </div>
                </div>
              )}

              {!canModifyLayout ? (
                <p className="text-xs text-ink-mute mb-2">
                  Days follow your workout-type structure — swap individual exercises on the next step.
                </p>
              ) : armedMove ? (
                <div className="rounded-[14px] border border-accent bg-accent/10 p-3 mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink">
                    Moving <span className="font-semibold">{cap(armedMove.muscle)}</span> &mdash; tap a
                    highlighted day to drop it.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setArmedMove(null)}>Cancel</Button>
                </div>
              ) : (
                <p className="text-xs text-ink-mute mb-2">
                  Long-press a muscle to move it to another day.
                </p>
              )}

              <div className="space-y-2">
                {(() => {
                  let workIdx = -1;
                  return Array.from({ length: 7 }, (_, p) => {
                    const dow = (startDow + p) % 7;
                    if (restDays.includes(dow)) {
                      return (
                        <div key={`rest-${p}`} className="card p-3 bg-crosshatch">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-ink-dim">{DOW_FULL[dow]}</span>
                            <span className="text-xs text-ink-mute tracking-wider2 uppercase">Rest day</span>
                          </div>
                        </div>
                      );
                    }
                    workIdx += 1;
                    const i = workIdx;
                    const slots = week[i] ?? [];
                    const bucket = dayBucketLabel(workoutType, i);
                    const isSource = armedMove?.day === i;
                    const isTarget = armedMove != null && !isSource;
                    return (
                      <div
                        key={`work-${i}`}
                        onClick={() => {
                          if (justArmed.current) { justArmed.current = false; return; }
                          if (!armedMove) return;
                          if (isSource) { setArmedMove(null); return; }
                          moveMuscle(armedMove.day, i, armedMove.muscle);
                          setArmedMove(null);
                        }}
                        className={cn(
                          'card p-3 transition',
                          isTarget && '!border-accent !border-dashed !bg-accent/10 cursor-pointer',
                          isSource && 'opacity-70',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">
                            Day {i + 1}{' '}
                            <span className="text-ink-mute font-normal">
                              &middot; {DOW_FULL[dow]}{bucket ? ` · ${bucket}` : ''}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-mute tnum">
                              {slots.length === 0 ? 'Empty' : `${slots.length} exercise${slots.length === 1 ? '' : 's'}`}
                            </span>
                            {canModifyLayout && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setArmedMove(null); setModifyDay(i); }}
                              >
                                Modify
                              </Button>
                            )}
                          </div>
                        </div>
                        {slots.length === 0 ? (
                          isTarget && armedMove && (
                            <p className="text-xs text-accent">Tap to move {cap(armedMove.muscle)} here</p>
                          )
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {slots.map((slot, j) => {
                              const lifted = isSource && armedMove?.muscle === slot.muscle;
                              return (
                                <span
                                  key={j}
                                  onMouseDown={() => startPress(i, slot.muscle)}
                                  onMouseUp={clearPress}
                                  onMouseLeave={clearPress}
                                  onTouchStart={() => startPress(i, slot.muscle)}
                                  onTouchEnd={clearPress}
                                  onTouchMove={clearPress}
                                  onContextMenu={(e) => e.preventDefault()}
                                  className={cn(
                                    'select-none inline-flex items-center gap-1 rounded-md pl-2 pr-1 py-1 text-xs font-medium border transition',
                                    tierPillClass(slot.tier),
                                    lifted && 'ring-2 ring-accent',
                                  )}
                                >
                                  {cap(slot.muscle)}
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); removeMuscle(i, slot.muscle); }}
                                    aria-label={`Remove ${cap(slot.muscle)} from day ${i + 1}`}
                                    className="shrink-0 -mr-0.5 w-4 h-4 rounded flex items-center justify-center text-[11px] leading-none opacity-60 hover:opacity-100"
                                  >
                                    ✕
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {!isCircuit && (<>
              <div className="card p-3 mt-3 mb-3">
                <div className="section-head mb-1">VOLUME PER WEEK</div>
                <p className="text-xs text-ink-dim mb-2">
                  Hard sets per muscle — {isPeriodized ? <>builds toward each muscle&apos;s ceiling, then deloads</> : <>held steady each week</>}, capped per exercise below.
                </p>
                <div className="flex items-center justify-between border-b border-ink-line pb-2 mb-2">
                  <div className="min-w-0 pr-2">
                    <span className="text-xs text-ink-dim">Max sets per exercise</span>
                    <p className="text-2xs text-ink-mute mt-0.5">No exercise is prescribed more than this.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StepBtn label="Fewer sets" disabled={maxSetsPerExercise <= 1} onClick={() => setMaxSetsPerExercise((v) => Math.max(1, v - 1))}>−</StepBtn>
                    <span className="numeric text-sm w-8 text-center">{maxSetsPerExercise}</span>
                    <StepBtn label="More sets" disabled={maxSetsPerExercise >= 8} onClick={() => setMaxSetsPerExercise((v) => Math.min(8, v + 1))}>+</StepBtn>
                  </div>
                </div>
                <div
                  className="grid gap-x-1 gap-y-1 items-center"
                  style={{ gridTemplateColumns: `4.75rem repeat(${weeks}, minmax(0, 1fr))` }}
                >
                  <div />
                  {Array.from({ length: weeks }, (_, w) => (
                    <div key={w} className="text-2xs text-center text-ink-mute tracking-wide">
                      {isPeriodized && w === weeks - 1 ? 'DL' : `W${w + 1}`}
                    </div>
                  ))}
                  {musclesByTier.map((m) => {
                    const raw = volumeRamp(effectiveTiers[m]!, weeks, DEFAULT_LANDMARKS[m], isPeriodized);
                    const slots = slotCountByMuscle.get(m) ?? 0;
                    const ramp = raw.map((n) => (slots > 0 ? clamp(n, slots, slots * maxSetsPerExercise) : n));
                    return (
                      <Fragment key={m}>
                        <div className={cn('text-xs font-medium truncate', tierTextClass(effectiveTiers[m]!))}>{cap(m)}</div>
                        {ramp.map((n, w) => (
                          <div
                            key={w}
                            className={cn('numeric text-xs text-center', isPeriodized && w === weeks - 1 ? 'text-ink-mute' : 'text-ink-dim')}
                          >
                            {n}
                          </div>
                        ))}
                      </Fragment>
                    );
                  })}
                  {layoutHasCore && (() => {
                    const raw = volumeRamp(effectiveTiers.core ?? 'grow', weeks, DEFAULT_LANDMARKS.core, isPeriodized);
                    const slots = slotCountByMuscle.get('core') ?? 0;
                    const ramp = raw.map((n) => (slots > 0 ? clamp(n, slots, slots * maxSetsPerExercise) : n));
                    return (
                      <Fragment key="core">
                        <div className="text-xs font-medium truncate text-info">Core</div>
                        {ramp.map((n, w) => (
                          <div
                            key={w}
                            className={cn('numeric text-xs text-center', isPeriodized && w === weeks - 1 ? 'text-ink-mute' : 'text-ink-dim')}
                          >
                            {n}
                          </div>
                        ))}
                      </Fragment>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 mb-3 text-[11px] text-ink-mute">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Emphasize</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-info" /> Grow</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink-mute" /> Maintain</span>
              </div>
              </>)}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm text-ink-dim mb-3">
                Confirm the exercises for week 1 — tap any to swap it. Exercises rotate across days
                (and across the other weeks) so you are not repeating the same lift.
              </p>
              <div className="space-y-2">
                {week.map((slots, i) => (
                  <div key={i} className="card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">
                        Day {i + 1}
                        {dayBucketLabel(workoutType, i) && (
                          <span className="text-ink-mute font-normal"> · {dayBucketLabel(workoutType, i)}</span>
                        )}
                      </span>
                      <span className="text-xs text-ink-mute tnum">
                        {slots.length === 0 ? 'Rest day' : `${slots.length} exercise${slots.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    {slots.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map((slot, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => setSwapTarget({ day: i, index: j })}
                            className={cn(
                              'rounded-md px-2 py-1 text-xs font-medium border transition hover:brightness-125',
                              tierPillClass(slot.tier),
                            )}
                            aria-label={`Swap ${slot.exerciseName}`}
                          >
                            {slot.exerciseName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="text-sm text-ink-dim mb-3">
                Set the starting weight and rep range for each exercise. We have
                suggested values from your training history where it exists, or an
                estimate from your profile &mdash; adjust anything that looks off.
              </p>
              <div className="card p-3 mb-3">
                <div className="section-head mb-1">REST BETWEEN SETS</div>
                <p className="text-xs text-ink-dim mb-2">
                  How long to rest between sets — the rest timer auto-starts with this.
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {REST_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setRestSeconds(sec)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium border transition tnum',
                        restSeconds === sec
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                      )}
                    >
                      {fmtRest(sec)}
                    </button>
                  ))}
                </div>
              </div>
              {uniqueExercises.length === 0 ? (
                <p className="text-sm text-ink-mute">
                  No exercises to set up yet &mdash; add some on the earlier steps.
                </p>
              ) : (
                <div className="space-y-2">
                  {uniqueExercises.map(({ slot, def }) => {
                    const plan = startingPlan[slot.exerciseId];
                    if (!plan) return null;
                    const setEdit = (patch: { weight?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }) =>
                      setWeightEdits((prev) => ({
                        ...prev,
                        [slot.exerciseId]: { ...(prev[slot.exerciseId] ?? {}), ...patch },
                      }));
                    const metric = def.metric ?? 'weight-reps';
                    const showWeight = metric === 'weight-reps' || metric === 'weight-time';
                    const showReps = metric === 'weight-reps' || metric === 'reps';
                    const showTime = metric === 'time' || metric === 'weight-time';
                    return (
                      <div key={slot.exerciseId} className="card p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{slot.exerciseName}</div>
                            <div className="text-[11px] text-ink-mute mt-0.5">
                              {showWeight
                                ? (plan.basis === 'history'
                                    ? 'Suggested from your history'
                                    : 'Estimated from your profile')
                                : (showTime ? 'Pick a starting time' : 'Bodyweight — pick a rep range')}
                            </div>
                          </div>
                          <MuscleBadge muscle={slot.muscle} />
                        </div>
                        <div className="flex items-end gap-2">
                          {showWeight && (
                            <div className="flex-1 min-w-0">
                              <div className="section-head mb-1">Weight</div>
                              {def.equipment === 'band' ? (
                                <div className="w-full h-11 px-2 rounded-lg bg-bg-input border border-ink-line text-sm font-semibold text-center text-ink-dim flex items-center justify-center">
                                  Band
                                </div>
                              ) : (
                                <InlineNumber
                                  value={plan.weight}
                                  onChange={(v) => setEdit({ weight: v ?? 0 })}
                                  step={wInc}
                                  min={0}
                                  decimals={wDecimals}
                                  unit={wLabel}
                                  ariaLabel={`Starting weight for ${slot.exerciseName}`}
                                />
                              )}
                            </div>
                          )}
                          {showReps && (<>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Reps low</div>
                            <InlineNumber
                              value={plan.repsLow}
                              onChange={(v) => setEdit({ repsLow: v ?? 1 })}
                              step={1}
                              min={1}
                              max={50}
                              unit="reps"
                              ariaLabel={`Low reps for ${slot.exerciseName}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Reps high</div>
                            <InlineNumber
                              value={plan.repsHigh}
                              onChange={(v) => setEdit({ repsHigh: v ?? 1 })}
                              step={1}
                              min={1}
                              max={50}
                              unit="reps"
                              ariaLabel={`High reps for ${slot.exerciseName}`}
                            />
                          </div>
                          </>)}
                          {showTime && (<>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Time low</div>
                            <InlineNumber
                              value={plan.timeLow}
                              onChange={(v) => setEdit({ timeLow: v ?? 1 })}
                              step={5}
                              min={1}
                              max={600}
                              unit="s"
                              ariaLabel={`Low time for ${slot.exerciseName}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Time high</div>
                            <InlineNumber
                              value={plan.timeHigh}
                              onChange={(v) => setEdit({ timeHigh: v ?? 1 })}
                              step={5}
                              min={1}
                              max={600}
                              unit="s"
                              ariaLabel={`High time for ${slot.exerciseName}`}
                            />
                          </div>
                          </>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-ink-line bg-bg">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={close}>Cancel</Button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button onClick={() => setSaveOpen(true)}>Save</Button>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>

      {modifyDay !== null && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end" onClick={() => setModifyDay(null)}>
          <div
            className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
              <div className="section-head">MODIFY DAY {modifyDay + 1}</div>
              <button
                type="button"
                onClick={() => setModifyDay(null)}
                className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3 space-y-4 pb-8">
              <div>
                <div className="section-head mb-2">This day — tap to remove</div>
                {(week[modifyDay] ?? []).length === 0 ? (
                  <p className="text-sm text-ink-mute">Rest day — add a muscle below.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(week[modifyDay] ?? []).map((slot, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => removeSlot(modifyDay, j)}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-medium border flex items-center gap-1.5',
                          tierPillClass(slot.tier),
                        )}
                        aria-label={`Remove ${cap(slot.muscle)}`}
                      >
                        {cap(slot.muscle)} <span aria-hidden>✕</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="section-head mb-2">Add a muscle</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...TEMPLATE_MUSCLES, 'core' as MuscleGroup].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => addSlot(modifyDay, m)}
                      className="rounded-md px-2 py-1 text-xs font-medium border border-ink-line bg-bg-input text-ink-dim hover:text-ink hover:border-ink-dim transition"
                    >
                      + {cap(m)}
                    </button>
                  ))}
                </div>
              </div>
              <Button block onClick={() => setModifyDay(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {swapTarget && swapSlot && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end" onClick={() => setSwapTarget(null)}>
          <div
            className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
              <div>
                <div className="section-head">SWAP EXERCISE</div>
                <div className="text-xs text-ink-dim mt-0.5">{cap(swapSlot.muscle)} · Day {swapTarget.day + 1}</div>
              </div>
              <button
                type="button"
                onClick={() => setSwapTarget(null)}
                className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3 space-y-1.5 pb-8">
              {swapOptions.length === 0 && (
                <p className="text-sm text-ink-mute">No other exercises for this muscle with this equipment.</p>
              )}
              {swapOptions.map((ex) => {
                const current = ex.id === swapSlot.exerciseId;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => applySwap(ex)}
                    className={cn(
                      'w-full text-left card flex items-center justify-between gap-3 p-2.5 transition',
                      current ? '!border-accent' : 'hover:border-ink-dim',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{ex.name}</div>
                      <div className="text-xs text-ink-dim capitalize">{ex.equipment}</div>
                    </div>
                    {current && <span className="text-accent text-xs font-semibold shrink-0">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {saveOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end" onClick={() => { if (!saving) setSaveOpen(false); }}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
              <div>
                <div className="section-head">{modifyTemplateId ? 'SAVE CHANGES' : 'SAVE TEMPLATE'}</div>
                <div className="text-xs text-ink-dim mt-0.5 tnum">
                  {name.trim() || 'Untitled template'} · {weeks} weeks · {daysPerWeek} days/week
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                disabled={saving}
                className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink disabled:opacity-40"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 space-y-2 pb-8">
              <Button block size="lg" disabled={saving} onClick={() => handleSave('activate')}>
                {saving ? 'Saving…' : 'Make it active now'}
              </Button>
              <Button block variant="ghost" size="lg" disabled={saving} onClick={() => handleSave('template')}>
                {modifyTemplateId ? 'Save changes' : 'Save as a template'}
              </Button>
              <p className="text-xs text-ink-mute text-center pt-2">
                &ldquo;Make it active&rdquo; starts this program now and archives your current one.
                {modifyTemplateId
                  ? ' “Save changes” updates this template — your active program is untouched.'
                  : ' “Save as a template” adds it to Browse templates to start later.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PillButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition',
        selected ? 'bg-accent text-white border-accent' : 'bg-bg-card text-ink border-ink-line hover:border-ink-dim',
      )}
    >
      {children}
    </button>
  );
}

function StepBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-8 h-8 rounded-md bg-bg-input border border-ink-line text-ink-dim text-lg flex items-center justify-center hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
