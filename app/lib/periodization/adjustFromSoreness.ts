/**
 * Turn a pre-session soreness rating into a volume action for the muscle.
 * Pure function — mirrors adjustFromFeedback. The caller applies the result
 * to the current week's sessions.
 *
 * Soreness ratings (template_notes Page 2):
 *   1 — never got sore    → recovered easily, room for more volume
 *   2 — healed a while ago → recovered well, hold
 *   3 — healed just on time → ideal, hold
 *   4 — still sore        → too much, ease the volume back
 *
 * The response is tier-aware: a muscle on EMPHASIZE chases recovered-easily
 * harder (two sets), a GROW muscle gets one, and a MAINTAIN muscle holds —
 * adding volume to a muscle you only want to maintain defeats the point.
 * "Still sore" eases back by a set regardless of tier — recovery comes first.
 */
import type { SorenessRating, MuscleTier } from '@/types';

export type SorenessAction = 'add' | 'hold' | 'reduce';

export interface SorenessSuggestion {
  action: SorenessAction;
  /** Δ sets per exercise the action implies (>0 add, 0 hold, <0 reduce). */
  setsDelta: number;
  note: string;
}

export function adjustFromSoreness(
  rating: SorenessRating,
  tier: MuscleTier = 'grow',
): SorenessSuggestion {
  switch (rating) {
    case 1:
      if (tier === 'maintain') {
        return {
          action: 'hold',
          setsDelta: 0,
          note: 'Recovered easily — but this muscle is on maintenance, so volume holds.',
        };
      }
      if (tier === 'emphasize') {
        return {
          action: 'add',
          setsDelta: 2,
          note: 'Recovered easily on a priority muscle — adding two sets to push it.',
        };
      }
      return {
        action: 'add',
        setsDelta: 1,
        note: 'Recovered easily — room for a little more volume.',
      };
    case 2:
      return { action: 'hold', setsDelta: 0, note: 'Recovered well — staying the course.' };
    case 3:
      return { action: 'hold', setsDelta: 0, note: 'Healed right on time — ideal, no change.' };
    case 4:
      return { action: 'reduce', setsDelta: -1, note: 'Still sore — easing the volume back.' };
  }
}
