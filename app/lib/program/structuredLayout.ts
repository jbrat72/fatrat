/**
 * Layout generators for the non-emphasis workout types.
 *
 * Unlike the Body Part Emphasis generator (templateLayout.ts), these do NOT
 * spread muscles across non-adjacent days — the week's structure is fixed by
 * the chosen workout type, so the same muscle group can (and does) recur on
 * consecutive training days.
 *
 * Pure functions — no React, no Firestore.
 */
import type { MuscleGroup } from '@/types';
import type { MuscleTier, WeekLayout, MuscleSlot } from './templateLayout';

/** Upper / Lower split buckets. */
export const UPPER_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'];
export const LOWER_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Push / Pull / Legs buckets. */
export const PUSH_MUSCLES: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
export const PULL_MUSCLES: MuscleGroup[] = ['back', 'biceps', 'forearms'];
export const LEG_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Every muscle trained on a Full Body day (core is added separately). */
export const FULL_BODY_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves',
];

/** Exercise slots a muscle gets on a day it is trained, by tier. */
function slotsForTier(tier: MuscleTier): number {
  return tier === 'emphasize' ? 2 : 1;
}

/**
 * Build one day's slots from a muscle list and a tier lookup. A muscle with no
 * tier (marked N/A) is skipped; an emphasised muscle gets a second slot.
 */
function buildDay(
  muscles: MuscleGroup[],
  tiers: Partial<Record<MuscleGroup, MuscleTier>>,
): MuscleSlot[] {
  const day: MuscleSlot[] = [];
  for (const m of muscles) {
    const tier = tiers[m];
    if (!tier) continue;
    for (let i = 0; i < slotsForTier(tier); i++) day.push({ muscle: m, tier });
  }
  return day;
}

/** Full Body — every muscle plus core, every training day, maintenance volume. */
export function fullBodyLayout(
  daysPerWeek: number,
  coreDays = 0,
  coreSlots = 0,
  muscles: MuscleGroup[] = FULL_BODY_MUSCLES,
): WeekLayout {
  const days = Math.max(1, Math.floor(daysPerWeek));
  const cd = Math.min(Math.max(0, Math.floor(coreDays)), days);
  const cs = Math.max(0, Math.floor(coreSlots));
  return Array.from({ length: days }, (_, d) => {
    const day: MuscleSlot[] = muscles.map((m) => ({ muscle: m, tier: 'maintain' as MuscleTier }));
    if (d < cd) for (let i = 0; i < cs; i++) day.push({ muscle: 'core', tier: 'maintain' });
    return day;
  });
}

/** Upper / Lower — training days alternate upper and lower; core on first N days. */
export function upperLowerLayout(
  daysPerWeek: number,
  tiers: Partial<Record<MuscleGroup, MuscleTier>>,
  coreDays = 0,
  coreSlots = 0,
): WeekLayout {
  const days = Math.max(1, Math.floor(daysPerWeek));
  const cd = Math.min(Math.max(0, Math.floor(coreDays)), days);
  const cs = Math.max(0, Math.floor(coreSlots));
  return Array.from({ length: days }, (_, d) => {
    const isUpper = d % 2 === 0;
    const day = buildDay(isUpper ? UPPER_MUSCLES : LOWER_MUSCLES, tiers);
    if (d < cd) for (let i = 0; i < cs; i++) day.push({ muscle: 'core', tier: 'grow' });
    return day;
  });
}

/** Push / Pull / Legs — training days cycle push, pull, legs; core on first N days. */
export function pplLayout(
  daysPerWeek: number,
  tiers: Partial<Record<MuscleGroup, MuscleTier>>,
  coreDays = 0,
  coreSlots = 0,
): WeekLayout {
  const days = Math.max(1, Math.floor(daysPerWeek));
  const cd = Math.min(Math.max(0, Math.floor(coreDays)), days);
  const cs = Math.max(0, Math.floor(coreSlots));
  const buckets: MuscleGroup[][] = [PUSH_MUSCLES, PULL_MUSCLES, LEG_MUSCLES];
  return Array.from({ length: days }, (_, d) => {
    const which = d % 3;
    const day = buildDay(buckets[which]!, tiers);
    if (d < cd) for (let i = 0; i < cs; i++) day.push({ muscle: 'core', tier: 'grow' });
    return day;
  });
}
