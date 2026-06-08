/**
 * Template layout generator (custom-template wizard, Page 1).
 *
 * Pure functions — no React, no Firestore. Given a training frequency and a
 * Maintain / Grow / Emphasize priority for each muscle, this produces one
 * training week of ordered muscle "slots". The same week repeats across the
 * meso; per-week volume progression and real exercise assignment are layered
 * on in later steps.
 *
 * Structuring rules (from template_notes.txt):
 *  - Emphasis muscles are trained most often, placed first in the week and
 *    first in each day, and get two exercise slots per training day by
 *    default — overridable per muscle (2 or 3) via emphasisSlotsPerDay.
 *  - Grow muscles are trained moderately, one slot per day.
 *  - Maintain muscles are trained once per week, one slot.
 *  - A muscle is NOT trained on back-to-back days — a hard priority. When a
 *    frequency is too high to fit non-adjacent days, two muscles share a day
 *    rather than create back-to-back days; `findBackToBackMuscles` reports any
 *    that still end up consecutive so the UI can warn.
 *  - Default emphasis frequencies are shared across the week so emphasised
 *    muscles spread onto different days rather than piling onto the same day.
 *  - Bigger muscles fatigue more, so emphasised big muscles train fewer days.
 */
import type { MuscleGroup } from '@/types';

export type { MuscleTier } from '@/types';
import type { MuscleTier } from '@/types';

/** Muscle groups the wizard lets the user sort into tiers. Core is excluded —
 *  it runs on its own track, configured separately (see TemplateLayoutInput.core). */
export const TEMPLATE_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves',
];

/** Recommended ceiling on emphasised muscles per meso. */
export const MAX_EMPHASIZE = 3;

/** Exercise slots an emphasised muscle gets on each day it is trained. */
export const DEFAULT_EMPHASIS_SLOTS = 2;
export const MIN_EMPHASIS_SLOTS = 1;
export const MAX_EMPHASIS_SLOTS = 3;

/** Larger muscles fatigue more and recover slower — they train fewer days/week. */
export const LARGE_MUSCLES: MuscleGroup[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes'];

export function isLargeMuscle(m: MuscleGroup): boolean {
  return LARGE_MUSCLES.includes(m);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Emphasised muscles in canonical (TEMPLATE_MUSCLES) order. */
export function emphasizedMusclesOf(tiers: Partial<Record<MuscleGroup, MuscleTier>>): MuscleGroup[] {
  return TEMPLATE_MUSCLES.filter((m) => tiers[m] === 'emphasize');
}

/**
 * Default days/week for an EMPHASISED muscle. The week's training days are
 * shared out across the emphasised muscles so they land on different days
 * rather than all piling onto the same day. The share is then capped by
 * muscle size and by what the week length can space out.
 */
export function defaultEmphasisFrequency(
  muscle: MuscleGroup,
  daysPerWeek: number,
  emphasized: MuscleGroup[],
): number {
  const count = Math.max(1, emphasized.length);
  const idx = Math.max(0, emphasized.indexOf(muscle));
  // Share the days across emphasised muscles; the first few take the remainder.
  const distributed = Math.floor(daysPerWeek / count) + (idx < daysPerWeek % count ? 1 : 0);
  const sizeCap = isLargeMuscle(muscle) ? 2 : 3;
  const spacingCap = Math.ceil(daysPerWeek / 2);
  return clamp(Math.min(Math.max(distributed, 1), sizeCap, spacingCap), 1, daysPerWeek);
}

export interface TemplateLayoutInput {
  weeks: number;
  daysPerWeek: number;
  /** Tier for each muscle. Muscles omitted from the map are left out entirely. */
  tiers: Partial<Record<MuscleGroup, MuscleTier>>;
  /** Per-muscle days/week override for emphasised muscles. */
  emphasisFrequency?: Partial<Record<MuscleGroup, number>>;
  /** Per-muscle exercises/day override for emphasised muscles (1–3). */
  emphasisSlotsPerDay?: Partial<Record<MuscleGroup, number>>;
  /** Emphasised muscle that should lead the week (claim the earliest days). */
  leadMuscle?: MuscleGroup;
  /** Core training track — its own days/week and exercises/day, independent
   *  of the Maintain/Grow/Emphasize tiers. */
  core?: { daysPerWeek: number; slotsPerDay: number };
}

export interface MuscleSlot {
  muscle: MuscleGroup;
  tier: MuscleTier;
  /** Carried through from the wizard so set style / supersets persist per week. */
  setStyle?: import('@/types').SetStyle;
  supersetGroup?: number;
}

/** A generated week: one ordered list of muscle slots per training day. */
export type WeekLayout = MuscleSlot[][];

const TIER_RANK: Record<MuscleTier, number> = { emphasize: 0, grow: 1, maintain: 2 };

/** Default exercise slots a muscle gets on each day it is trained, by tier. */
export function slotsPerDay(tier: MuscleTier): number {
  return tier === 'emphasize' ? DEFAULT_EMPHASIS_SLOTS : 1;
}

/** Days per week a muscle is trained, by tier (emphasis is size-aware + overridable). */
export function frequencyFor(
  muscle: MuscleGroup,
  tier: MuscleTier,
  daysPerWeek: number,
  emphasized: MuscleGroup[],
  emphasisFrequency?: Partial<Record<MuscleGroup, number>>,
): number {
  if (tier === 'emphasize') {
    const raw = emphasisFrequency?.[muscle] ?? defaultEmphasisFrequency(muscle, daysPerWeek, emphasized);
    return clamp(Math.round(raw), 1, daysPerWeek);
  }
  if (tier === 'grow') return clamp(2, 1, daysPerWeek);
  return 1; // maintain
}

/** Exercises/day a muscle gets, by tier — emphasis is overridable (1–3). */
export function slotsPerDayFor(
  muscle: MuscleGroup,
  tier: MuscleTier,
  emphasisSlotsPerDay?: Partial<Record<MuscleGroup, number>>,
): number {
  if (tier !== 'emphasize') return slotsPerDay(tier);
  const raw = emphasisSlotsPerDay?.[muscle] ?? DEFAULT_EMPHASIS_SLOTS;
  return clamp(Math.round(raw), MIN_EMPHASIS_SLOTS, MAX_EMPHASIS_SLOTS);
}

/** All k-element subsets of [0, n), in ascending lexicographic order. */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];
  const recurse = (start: number) => {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i <= n - (k - combo.length); i++) {
      combo.push(i);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

/**
 * Picks `freq` day indices for one muscle. Evaluates every possible set of
 * days and scores them so that:
 *  1. avoiding back-to-back days dominates everything else;
 *  2. then spreading onto less-loaded days (so muscles split apart);
 *  3. then, for emphasis muscles, biasing toward earlier days.
 */
function pickDays(days: number, freq: number, dayLoad: number[], earlyBias: boolean): number[] {
  const k = clamp(freq, 1, days);
  let best: number[] = [];
  let bestScore = Infinity;
  for (const combo of combinations(days, k)) {
    let adjacency = 0;
    for (let i = 1; i < combo.length; i++) {
      if (combo[i]! - combo[i - 1]! === 1) adjacency++;
    }
    let load = 0;
    let early = 0;
    for (const d of combo) { load += dayLoad[d] ?? 0; early += d; }
    const score = adjacency * 1_000_000 + load * 100 + (earlyBias ? early : 0);
    if (score < bestScore) { bestScore = score; best = combo; }
  }
  return best;
}

/**
 * Generates one training week of ordered muscle slots.
 * The returned array has `daysPerWeek` entries; a day may be empty (a rest day)
 * if there are more days than the prioritised muscles need.
 */
export function generateWeekLayout(input: TemplateLayoutInput): WeekLayout {
  const days = Math.max(1, Math.floor(input.daysPerWeek));
  const week: MuscleSlot[][] = Array.from({ length: days }, () => []);
  const dayLoad: number[] = new Array<number>(days).fill(0);
  const emphasized = emphasizedMusclesOf(input.tiers);

  // Process muscles in tier order — emphasis first. The lead muscle is pulled
  // to the front of its tier so it claims the earliest days.
  const muscles = (Object.keys(input.tiers) as MuscleGroup[])
    .filter((m) => input.tiers[m] != null)
    .sort((a, b) => {
      const ra = TIER_RANK[input.tiers[a]!];
      const rb = TIER_RANK[input.tiers[b]!];
      if (ra !== rb) return ra - rb;
      if (input.leadMuscle) {
        if (a === input.leadMuscle) return -1;
        if (b === input.leadMuscle) return 1;
      }
      return 0;
    });

  for (const muscle of muscles) {
    const tier = input.tiers[muscle]!;
    const freq = frequencyFor(muscle, tier, days, emphasized, input.emphasisFrequency);
    const slots = slotsPerDayFor(muscle, tier, input.emphasisSlotsPerDay);
    const trainingDays = pickDays(days, freq, dayLoad, tier === 'emphasize');
    for (const d of trainingDays) {
      const day = week[d]!;
      for (let s = 0; s < slots; s++) day.push({ muscle, tier });
      dayLoad[d] = (dayLoad[d] ?? 0) + slots;
    }
  }

  // Order each day's slots by tier — emphasis first. Sort is stable, so a
  // muscle's slots stay grouped together.
  for (const day of week) {
    day.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  }

  // Core is added last on each of its training days, after the tier sort — it
  // runs on its own schedule rather than through the Maintain/Grow/Emphasize
  // tiers. Its slots carry the 'grow' tier so volume + colour stay sensible.
  if (input.core && input.core.daysPerWeek >= 1 && input.core.slotsPerDay >= 1) {
    const coreFreq = clamp(Math.round(input.core.daysPerWeek), 1, days);
    const coreSlots = clamp(Math.round(input.core.slotsPerDay), 1, MAX_EMPHASIS_SLOTS);
    for (const d of pickDays(days, coreFreq, dayLoad, false)) {
      const day = week[d]!;
      for (let s = 0; s < coreSlots; s++) day.push({ muscle: 'core', tier: 'grow' });
    }
  }

  return week;
}

/**
 * Returns the muscles that end up trained on back-to-back days in a layout.
 * Non-empty only when a muscle's frequency is too high to space out at the
 * chosen week length — the UI uses this to warn the user.
 */
export function findBackToBackMuscles(layout: WeekLayout): MuscleGroup[] {
  const daysOf = new Map<MuscleGroup, number[]>();
  layout.forEach((slots, d) => {
    for (const m of new Set(slots.map((s) => s.muscle))) {
      const arr = daysOf.get(m) ?? [];
      arr.push(d);
      daysOf.set(m, arr);
    }
  });
  const offenders: MuscleGroup[] = [];
  for (const [muscle, dayList] of daysOf) {
    const sorted = [...dayList].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]! - sorted[i - 1]! === 1) { offenders.push(muscle); break; }
    }
  }
  // Core trains on its own (often daily) schedule — consecutive core days are
  // intentional, so core never counts as a back-to-back offender.
  return offenders.filter((m) => m !== 'core');
}
