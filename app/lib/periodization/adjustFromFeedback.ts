/**
 * Convert a session's subjective feedback into per-muscle adjustments for the
 * NEXT session. Pure function — caller writes the result through the repo.
 *
 * Feedback scales (types/session.ts):
 *   Volume:
 *     not-enough     +2 sets next time
 *     just-right      no change
 *     pushed-limits  -1 set
 *     too-much       -2 sets
 *   Pump:
 *     low + volume not already high  → slight volume increase (+1)
 *   Joint pain (overall = worst per-muscle):
 *     high  → cap weight progression and never add volume
 */
import type { SessionFeedback, MuscleGroup, VolumeLevel } from '@/types';

export interface MuscleAdjustment {
  muscle: MuscleGroup;
  /** Δ sets to add (+) or remove (−) for that muscle on the next session. */
  setsDelta: number;
  /** Cap weight progression (don't increase load). */
  capWeight: boolean;
  /** Plain-English explanation we surface in the recap / Today screen. */
  note: string;
}

const VOLUME_DELTA: Record<VolumeLevel, number> = {
  'not-enough': 2,
  'just-right': 0,
  'pushed-limits': -1,
  'too-much': -2,
};

export function adjustFromFeedback(fb: SessionFeedback): MuscleAdjustment[] {
  const out: MuscleAdjustment[] = [];
  const painCap = fb.jointPainOverall === 'high';

  for (const m of fb.perMuscle) {
    let setsDelta = VOLUME_DELTA[m.volume];
    const reasons: string[] = [];

    if (m.volume === 'not-enough') reasons.push('volume felt too low');
    else if (m.volume === 'pushed-limits') reasons.push('volume was high');
    else if (m.volume === 'too-much') reasons.push('volume was too much');

    if (m.pump === 'low' && (m.volume === 'not-enough' || m.volume === 'just-right')) {
      setsDelta += 1;
      reasons.push('low pump');
    }

    let capWeight = false;
    if (painCap) {
      capWeight = true;
      setsDelta = Math.min(setsDelta, 0);
      reasons.push('joint pain — hold load');
    }

    out.push({
      muscle: m.muscle,
      setsDelta,
      capWeight,
      note: reasons.join(', ') || 'on track',
    });
  }
  return out;
}
