/**
 * Plan Wizard v2 — generation engine.
 *
 * Pure functions. Given a WizardState and the exercise library, produces:
 *   - weekStructure(): the week-by-week shape (optional calibration week +
 *     scheduled deloads), used by the Page 15 volume card and Page 16.
 *   - muscleSetsForWeek(): a muscle's hard-set target for a given week, derived
 *     from its tier + Israetel-style volume landmarks (Emphasize→MRV, Grow→MAV,
 *     Maintain→~½MEV). Single source of truth for both the card and generation.
 *   - generateWeek(): the volume-driven program for one week — each muscle's
 *     weekly target is split across its training days, then across exercises at
 *     ~3 sets each, selecting only equipment-valid movements from the library.
 *
 * Mirrors the approved mockup. No React, no Firestore.
 */
import type { ExerciseDefinition, EquipmentType, MuscleGroup } from '@/types';
import { DEFAULT_LANDMARKS } from '@/lib/periodization';
import {
  WIZARD_MUSCLES, type WizardState, type WizTier, type WeekCol,
  type GeneratedDay, type GeneratedExercise,
} from './types';

export const DEFAULT_SETS = 3;
const MAX_EMPHASIZE = 3;

/* ---------------- split structures (mirror the mockup) ---------------- */

export const SPLIT_SEQ: Record<string, string[]> = {
  fb2: ['Full Body', 'Full Body'], ul: ['Upper', 'Lower'], fb3: ['Full Body', 'Full Body', 'Full Body'],
  ppl: ['Push', 'Pull', 'Legs'], ulf: ['Upper', 'Lower', 'Full Body'], ul2: ['Upper', 'Lower', 'Upper', 'Lower'],
  ppl1: ['Push', 'Pull', 'Legs', 'Push'], phul: ['Upper', 'Lower', 'Upper', 'Lower'],
  pplul: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'], bro: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'],
  phat: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'], ulppl: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
  ppl2: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
  arnold: ['Chest+Back', 'Shoulders+Arms', 'Legs', 'Chest+Back', 'Shoulders+Arms', 'Legs'],
  pplul1: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Push'],
};

/** Muscles trained on each day type (deduped). */
export const DAY_MUSCLES: Record<string, MuscleGroup[]> = {
  'Full Body': ['quads', 'chest', 'back', 'hamstrings', 'shoulders'],
  'Upper': ['chest', 'back', 'shoulders', 'triceps', 'biceps', 'forearms'],
  'Lower': ['quads', 'hamstrings', 'glutes', 'calves'],
  'Push': ['chest', 'shoulders', 'triceps'], 'Pull': ['back', 'biceps', 'forearms'],
  'Legs': ['quads', 'hamstrings', 'glutes', 'calves'],
  'Chest': ['chest'], 'Back': ['back'], 'Shoulders': ['shoulders'], 'Arms': ['biceps', 'triceps', 'forearms'],
  'Chest+Back': ['chest', 'back'], 'Shoulders+Arms': ['shoulders', 'biceps', 'triceps'],
};

/* ---------------- equipment ---------------- */

/** Map the granular Page-5 environment + checklist to the coarse EquipmentType
 *  set the exercise library is tagged with. Bodyweight is always available. */
export function availableEquipment(state: WizardState): Set<EquipmentType> {
  const env = state.equipment.environment;
  const all: EquipmentType[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith'];
  if (env === 'commercial') return new Set(all);
  if (env === 'bodyweight') return new Set<EquipmentType>(['bodyweight']);
  const s = new Set<EquipmentType>(['bodyweight']);
  const items = state.equipment.items || [];
  const has = (label: string) => items.includes(label);
  if (env === 'hotel') { s.add('band'); s.add('dumbbell'); }
  if (has('Barbell & Plates') || has('EZ Curl Bar') || has('Trap Bar')) s.add('barbell');
  if (has('Dumbbells — Fixed') || has('Dumbbells — Adjustable')) s.add('dumbbell');
  if (has('Kettlebells')) s.add('kettlebell');
  if (has('Resistance Bands')) s.add('band');
  if (has('Smith Machine')) s.add('smith');
  if (has('Cable Machine') || has('Functional Trainer')) s.add('cable');
  for (const m of ['Leg Press', 'Lat Pulldown / Row', 'Chest/Shoulder Press Machine', 'Leg Curl/Extension', 'Pec Deck', 'Hack Squat']) {
    if (has(m)) { s.add('machine'); break; }
  }
  return s;
}

/* ---------------- volume model ---------------- */

export function isBlock(state: WizardState): boolean {
  return state.trainingStyle.periodizationStrategy === 'block';
}
export function isVolumeRamped(state: WizardState): boolean {
  return state.trainingStyle.volumeFramework === 'evidence' || isBlock(state);
}
export function durationWeeks(state: WizardState): number {
  return state.schedule.durationWeeks === 'ongoing' ? 8 : (state.schedule.durationWeeks || 8);
}

/** Build the week columns: optional calibration week, then training weeks with
 *  scheduled deloads inserted per the progression deload protocol. */
export function weekStructure(state: WizardState): { cols: WeekCol[]; loadCount: number } {
  const base = durationWeeks(state);
  const scheduled = state.progression.deloadProtocol === 'scheduled' && !!state.progression.deloadFrequency;
  const cols: WeekCol[] = [];
  let loadIdx = 0;
  if (state.baselines.calibrationWeek) cols.push({ label: 'Cal', kind: 'cal' });
  for (let i = 0; i < base; i++) {
    if (scheduled && (i + 1) % (state.progression.deloadFrequency as number) === 0) {
      cols.push({ label: 'DL', kind: 'deload' });
    } else {
      cols.push({ label: 'W' + (loadIdx + 1), kind: 'load', loadIdx });
      loadIdx++;
    }
  }
  return { cols, loadCount: loadIdx };
}

/** Hard-set target for one muscle on a given week column. */
export function muscleSetsForWeek(state: WizardState, m: MuscleGroup, wk: WeekCol, loadCount: number): number {
  const tier = state.prioritization.tiers[m];
  if (tier == null) return 0;
  const lm = DEFAULT_LANDMARKS[m];
  const maintain = Math.max(1, Math.round(lm.mev * 0.5));
  const steady = tier === 'emphasize' ? lm.mav : tier === 'grow' ? Math.round((lm.mev + lm.mav) / 2) : maintain;
  const peak = tier === 'emphasize' ? lm.mrv : tier === 'grow' ? lm.mav : maintain;
  if (wk.kind === 'cal') return Math.max(1, Math.round(steady * 0.4));
  if (wk.kind === 'deload') return Math.max(1, Math.round(steady * 0.5));
  if (isVolumeRamped(state)) {
    const lc = Math.max(1, loadCount - 1);
    const t = lc > 0 ? (wk.loadIdx || 0) / lc : 0;
    return Math.max(1, Math.round(lm.mev + (peak - lm.mev) * t));
  }
  return steady;
}

/** How many times per week a muscle is trained, per the chosen split. */
export function timesPerWeek(state: WizardState): Partial<Record<MuscleGroup, number>> {
  const seq = SPLIT_SEQ[state.split.type || ''] || [];
  const t: Partial<Record<MuscleGroup, number>> = {};
  seq.forEach((type) => (DAY_MUSCLES[type] || []).forEach((m) => { t[m] = (t[m] || 0) + 1; }));
  return t;
}

/* ---------------- exercise selection ---------------- */

function repsFor(state: WizardState, anchor: boolean): number {
  const rr = state.setsAndReps.repRange;
  if (rr === 'strength') return anchor ? 5 : 6;
  if (rr === 'endurance') return 15;
  if (rr === 'mixed') return anchor ? 5 : 10;
  return anchor ? 8 : 10; // hypertrophy / default
}

/** Equipment-valid exercises for a muscle, compounds first (anchors lead). */
export function poolFor(
  m: MuscleGroup, library: ExerciseDefinition[], avail: Set<EquipmentType>, hidden: Set<string>,
): ExerciseDefinition[] {
  const ok = library.filter((e) =>
    e.primaryMuscle === m && avail.has(e.equipment) && !hidden.has(e.id) &&
    (e.metric == null || e.metric === 'weight-reps' || e.metric === 'reps'));
  const isCompound = (e: ExerciseDefinition) => e.patterns?.includes('compound');
  return ok.sort((a, b) => Number(isCompound(b)) - Number(isCompound(a)));
}
const isAnchor = (e: ExerciseDefinition) => !!e.patterns?.includes('compound') && (e.equipment === 'barbell' || e.equipment === 'dumbbell');

/* ---------------- program generation ---------------- */

function workDows(state: WizardState): number[] {
  const sd = state.schedule.startDow, rest = state.schedule.restDays;
  const out: number[] = [];
  for (let p = 0; p < 7; p++) { const dow = (sd + p) % 7; if (!rest.includes(dow)) out.push(dow); }
  return out;
}

/**
 * Generate the full program for one week column. Each muscle's weekly target is
 * split exactly across its training days, then into exercises at ~DEFAULT_SETS
 * sets each (so day totals reconcile with the volume card). Core is included as
 * its own muscle group when the core method calls for it.
 */
export function generateWeek(
  state: WizardState, library: ExerciseDefinition[], wk: WeekCol, loadCount: number,
  opts?: { hidden?: string[] },
): GeneratedDay[] {
  const avail = availableEquipment(state);
  const hidden = new Set(opts?.hidden || []);
  const seq = SPLIT_SEQ[state.split.type || ''] || ['Full Body', 'Full Body'];
  const tpw = timesPerWeek(state);
  const dows = workDows(state);
  const emph = WIZARD_MUSCLES.filter((m) => state.prioritization.tiers[m] === 'emphasize');

  // weekly target -> per-occurrence allocation that sums exactly to the target
  const alloc: Partial<Record<MuscleGroup, number[]>> = {};
  for (const m of WIZARD_MUSCLES) {
    const tp = tpw[m] || 0; if (tp <= 0 || state.prioritization.tiers[m] == null) continue;
    const T = muscleSetsForWeek(state, m, wk, loadCount);
    const b = Math.floor(T / tp), r = T - b * tp;
    alloc[m] = Array.from({ length: tp }, (_, i) => b + (i < r ? 1 : 0));
  }
  const occ: Partial<Record<MuscleGroup, number>> = {};

  const days = seq.map((type, di): GeneratedDay => {
    const muscles = DAY_MUSCLES[type] || DAY_MUSCLES['Full Body'];
    const exercises: GeneratedExercise[] = [];
    muscles.forEach((m) => {
      if (state.prioritization.tiers[m] == null || !alloc[m]) return;
      const idx = occ[m] || 0; occ[m] = idx + 1;
      const setsToday = (alloc[m] as number[])[idx] || 0;
      if (setsToday <= 0) return;
      const pool = poolFor(m, library, avail, hidden);
      if (pool.length === 0) return;
      const nEx = Math.max(1, Math.round(setsToday / DEFAULT_SETS));
      const b = Math.floor(setsToday / nEx), r = setsToday - b * nEx;
      for (let i = 0; i < nEx; i++) {
        const sets = b + (i < r ? 1 : 0); if (sets <= 0) continue;
        const e = pool[(i + di) % pool.length];
        const anchor = isAnchor(e) && i === 0;
        exercises.push({ exerciseId: e.id, name: e.name, muscle: m, sets, reps: repsFor(state, anchor), anchor });
      }
    });
    return { dow: dows[di], type, emphasis: di === 0 && emph.length ? `${emph[0]} emphasis` : '', exercises };
  });

  // core as its own group
  const cm = state.core.method;
  if (cm && cm !== 'none' && cm !== 'compound') {
    const n = ({ '1-2': 2, '2-3': 3, '3-4': 4 } as Record<string, number>)[state.core.blockExercises] || 3;
    const lowback = state.profile.injuries.includes('lowback');
    let corePool = poolFor('core', library, avail, hidden);
    if (lowback) corePool = corePool.filter((e) => !e.patterns?.includes('hinge')); // crude flexion guard
    const targets = cm === 'day' ? (days[0] ? [days[0]] : []) : days;
    targets.forEach((d) => {
      for (let i = 0; i < n && i < corePool.length; i++) {
        const e = corePool[i];
        exercisesPush(d, { exerciseId: e.id, name: e.name, muscle: 'core', sets: 3, reps: 12, anchor: false });
      }
    });
  }
  return days;
}
function exercisesPush(d: GeneratedDay, ex: GeneratedExercise) { d.exercises.push(ex); }

/** Representative load week for display (mid-block for Block periodization). */
export function representativeWeek(state: WizardState): { wk: WeekCol; loadCount: number } {
  const { cols, loadCount } = weekStructure(state);
  const loads = cols.filter((c) => c.kind === 'load');
  const wk = loads[0] || cols[0] || { label: 'W1', kind: 'load', loadIdx: 0 };
  return { wk, loadCount };
}
