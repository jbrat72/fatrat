/**
 * Mode-recommendation logic.
 * Pure function — given experience + periodization familiarity, return a
 * recommended UserMode and a one-sentence explanation we can show the user.
 *
 * The recommendation is a *default*, not a gate; the user is always free to
 * choose any mode at signup or switch later.
 */
import type {
  UserMode,
  ExperienceTier,
  PeriodizationFamiliarity,
} from '@/types';

export interface ModeRecommendation {
  mode: UserMode;
  /** Short, plain-English explanation we render under the recommendation. */
  reason: string;
}

/**
 * Scoring:
 *   experience      lt6mo=0, 6mo-2yr=1, 2yr-plus=2
 *   familiarity     none=0,  fuzzy=1,   fluent=2
 * Sum:  0-1 -> BASIC, 2 -> INTERMEDIATE, 3-4 -> ADVANCED
 *
 * Edge cases per spec:
 *   - Fluent familiarity always at least nudges to INTERMEDIATE.
 *   - "2yr-plus" + "none" still recommends INTERMEDIATE (experience matters too).
 */
export function recommendMode(
  experience: ExperienceTier,
  familiarity: PeriodizationFamiliarity,
): ModeRecommendation {
  const expScore = experience === 'lt6mo' ? 0 : experience === '6mo-2yr' ? 1 : 2;
  const famScore = familiarity === 'none' ? 0 : familiarity === 'fuzzy' ? 1 : 2;
  const total = expScore + famScore;

  let mode: UserMode;
  if (total <= 1) mode = 'BASIC';
  else if (total === 2) mode = 'INTERMEDIATE';
  else mode = 'ADVANCED';

  // Familiarity nudges:
  if (familiarity === 'fluent' && mode === 'BASIC') mode = 'INTERMEDIATE';
  if (experience === '2yr-plus' && mode === 'BASIC') mode = 'INTERMEDIATE';

  const reason = reasonFor(mode, experience, familiarity);
  return { mode, reason };
}

function reasonFor(
  mode: UserMode,
  exp: ExperienceTier,
  fam: PeriodizationFamiliarity,
): string {
  if (mode === 'BASIC') {
    return "You're new to lifting — BASIC keeps things simple. No jargon, just today's workout and a friendly progress nudge each week.";
  }
  if (mode === 'INTERMEDIATE') {
    if (exp === '2yr-plus' && fam === 'none') {
      return "You've got real training experience but haven't dug into periodization — INTERMEDIATE adds light structure without the deep theory.";
    }
    return "You've got some lifting under your belt. INTERMEDIATE adds structured training blocks and progress charts without the full system overhead.";
  }
  return "You know your stuff. ADVANCED unlocks the full periodization system: RPE/RIR targets, MEV/MAV/MRV tracking, and e1RM charts.";
}
