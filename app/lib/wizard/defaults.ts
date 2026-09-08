/**
 * Plan Wizard v2 — default answers.
 *
 * Pure functions that derive a sensible answer for a wizard page from what the
 * user has already said. Two callers:
 *   - the Advanced wizard pre-fills each page with these when the user first
 *     lands on it (they can override anything);
 *   - the Basic wizard never shows most pages, so applyBasicDefaults() fills
 *     every unanswered field before review/generation.
 *
 * Keeping them here (not in the component) means both modes agree exactly.
 */
import type { MuscleGroup } from '@/types';
import { WIZARD_MUSCLES, type WizardState, type WizExperience, type WizTier, type RepRange, type RestPref, type CoreMethod, type VolumeFramework, type PeriodizationStrategy } from './types';

/** Monday-anchored training-day offsets for N days/week. */
export const DAY_OFFSETS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

export function defaultRestDays(startDow: number, d: number): number[] {
  const work = new Set(DAY_OFFSETS[d] || []); const rest: number[] = [];
  for (let off = 0; off < 7; off++) if (!work.has(off)) rest.push((startDow + off) % 7);
  return rest;
}

export function levelRank(l: WizExperience | null | undefined): number {
  return ({ beginner: 0, novice: 1, intermediate: 2, advanced: 3 } as Record<string, number>)[l || ''] ?? 0;
}
/** Effective level — one tier down after a 12+ month layoff. */
export function effLevel(s: WizardState): WizExperience | null {
  const l = s.experience.level;
  if (s.experience.status === 'layoff12' && l) { const o: WizExperience[] = ['beginner', 'novice', 'intermediate', 'advanced']; const i = o.indexOf(l); if (i > 0) return o[i - 1]; }
  return l;
}

export function defaultTier(s: WizardState, m: MuscleGroup): WizTier {
  const g = s.goal.primary;
  const inn = (list: string[]) => list.includes(m);
  if (g === 'strength') return inn(['chest', 'back', 'quads']) ? 'emphasize' : inn(['biceps', 'forearms', 'calves']) ? 'maintain' : 'grow';
  if (g === 'athletic') return inn(['quads', 'hamstrings', 'glutes']) ? 'emphasize' : inn(['biceps', 'forearms', 'calves']) ? 'maintain' : 'grow';
  if (g === 'transform') return inn(['chest', 'back', 'quads']) ? 'emphasize' : 'grow';
  return 'grow';
}

export function defaultVolumeFramework(s: WizardState): VolumeFramework {
  const bs = s.trainingStyle.baseStyle, lv = effLevel(s);
  if (bs === 'hit' || bs === 'fullbody') return 'med';
  if (s.equipment.environment === 'bodyweight') return 'auto';
  if (s.experience.level === 'beginner' || s.experience.level === 'novice') return 'fixed';
  if (bs === 'bodybuilding' || s.goal.primary === 'leanout') return 'evidence';
  if (levelRank(lv) >= 3) return 'auto';
  return 'evidence';
}
export function defaultPeriodization(s: WizardState): PeriodizationStrategy {
  const bs = s.trainingStyle.baseStyle;
  if (s.experience.level === 'beginner' || bs === 'hit') return 'none';
  if (bs === 'powerbuilding') return 'dup';
  return 'none';
}

export function defaultRepRange(s: WizardState): RepRange {
  const bs = s.trainingStyle.baseStyle, g = s.goal.primary;
  return bs === 'powerlifting' ? 'strength' : bs === 'bodybuilding' ? 'hypertrophy' : bs === 'powerbuilding' ? 'mixed'
    : g === 'transform' ? 'mixed' : g === 'leanout' ? 'hypertrophy' : g === 'strength' ? 'strength' : 'hypertrophy';
}
export function defaultRestPreference(s: WizardState): RestPref {
  const bs = s.trainingStyle.baseStyle, g = s.goal.primary;
  return (bs === 'powerlifting' || g === 'strength') ? 'long' : (g === 'transform' || g === 'leanout' || g === 'fitness' || g === 'muscle') ? 'moderate' : 'auto';
}
export function defaultCore(s: WizardState): { method: CoreMethod; frequency: string } {
  const bs = s.trainingStyle.baseStyle;
  const method: CoreMethod = bs === 'bodybuilding' ? 'block' : (bs === 'fullbody' || bs === 'hit') ? 'superset' : s.goal.primary === 'athletic' ? 'superset' : 'block';
  const frequency = s.experience.level === 'beginner' ? '2x' : s.goal.primary === 'athletic' ? '3x' : 'everyother';
  return { method, frequency };
}
export function defaultCardio(s: WizardState): WizardState['cardio'] {
  const g = s.goal.primary;
  const base = { included: 'no', type: [] as string[], frequency: null, placement: null, durationMinutes: null };
  if (g === 'transform') return { included: 'yes', type: ['hiit', 'liss'], frequency: 3, placement: 'offdays', durationMinutes: 20 };
  if (g === 'leanout') return { included: 'yes', type: ['liss'], frequency: 3, placement: 'offdays', durationMinutes: 30 };
  if (g === 'athletic') return { included: 'yes', type: ['circuit'], frequency: 2, placement: 'separate', durationMinutes: 20 };
  if (g === 'fitness') return { included: 'yes', type: ['liss', 'hiit'], frequency: 3, placement: 'separate', durationMinutes: 30 };
  return base;
}
export function defaultProgression(s: WizardState): WizardState['progression'] {
  const lv = effLevel(s);
  let type = s.experience.level === 'beginner' ? 'linear' : levelRank(lv) >= 3 ? 'rpe' : 'double';
  if (s.trainingStyle.periodizationStrategy === 'dup') type = 'undulating';
  if (s.trainingStyle.baseStyle === 'hit') type = 'double';
  return { type, deloadProtocol: 'scheduled', deloadFrequency: 4, deloadStyle: 'volume' };
}

/** Answers the Basic wizard assumes for the pages it never shows. Applied when
 *  Basic is chosen, so the pages it DOES show (style, split, core) get the
 *  same recommendations the Advanced flow would make for this profile. */
export function applyBasicIdentity(s: WizardState): void {
  s.mode = 'basic';
  if (!s.goal.primary) s.goal.primary = 'muscle';
  if (!s.experience.level) s.experience.level = 'intermediate';
  if (!s.experience.status) s.experience.status = 'consistent';
}

/** Fill every still-unanswered field with its default. Idempotent: anything
 *  the user (or a page) already set is left alone. Run before review/generate
 *  in Basic mode; harmless in Advanced. */
export function applyBasicDefaults(s: WizardState): void {
  applyBasicIdentity(s);
  if (!s.schedule.sessionMinutes) s.schedule.sessionMinutes = 60;
  if (!s.schedule.durationWeeks) s.schedule.durationWeeks = 8;
  if (!s.schedule.daysPerWeek) s.schedule.daysPerWeek = 3;
  if (s.schedule.restDays.length === 0) s.schedule.restDays = defaultRestDays(s.schedule.startDow, s.schedule.daysPerWeek);
  if (!s.trainingStyle.baseStyle) s.trainingStyle.baseStyle = s.equipment.environment === 'bodyweight' ? 'calisthenics' : 'fullbody';
  if (s.trainingStyle.baseStyle === 'hit') { s.trainingStyle.volumeFramework = 'med'; s.trainingStyle.periodizationStrategy = 'none'; }
  if (!s.trainingStyle.volumeFramework) s.trainingStyle.volumeFramework = defaultVolumeFramework(s);
  if (!s.trainingStyle.periodizationStrategy) s.trainingStyle.periodizationStrategy = defaultPeriodization(s);
  if (Object.keys(s.prioritization.tiers).length === 0) WIZARD_MUSCLES.forEach((m) => { s.prioritization.tiers[m] = defaultTier(s, m); });
  if (!s.setsAndReps.repRange) s.setsAndReps.repRange = defaultRepRange(s);
  if (s.setsAndReps.setTypes.length === 0 || s.trainingStyle.baseStyle === 'hit') s.setsAndReps.setTypes = ['straight'];
  if (!s.restAndTempo.restPreference) s.restAndTempo.restPreference = defaultRestPreference(s);
  if (!s.core.method) { const c = defaultCore(s); s.core.method = c.method; s.core.frequency = c.frequency; }
  if (s.cardio.included === null) s.cardio = defaultCardio(s);
  if (!s.progression.type) s.progression = defaultProgression(s);
  if (!s.progression.deloadProtocol) { s.progression.deloadProtocol = 'scheduled'; s.progression.deloadFrequency = 4; s.progression.deloadStyle = 'volume'; }
}
