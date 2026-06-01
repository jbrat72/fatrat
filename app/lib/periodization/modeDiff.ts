/**
 * What changes when a user switches modes? Pure presentational text.
 * Used by the Settings → Mode switch preview.
 */
import type { UserMode } from '@/types';

export interface ModeDiff {
  gained: string[];
  hidden: string[];
}

const FEATURE_BY_MODE: Record<UserMode, string[]> = {
  BASIC: [
    'Easy / Just-Right / Hard effort buttons',
    'Personal-best card on History',
    'Plain-English progress callouts',
    'Quiet easy weeks every 5–6 weeks',
  ],
  INTERMEDIATE: [
    '5-button effort scale (Easy / Solid / Tough / Hard / Failed)',
    'Training-block (mesocycle) view',
    'Simple weight-over-time line charts',
    'Weekly volume traffic-light grid',
    'End-of-block plain-English recap',
  ],
  ADVANCED: [
    'Full RPE 1–10 + RIR scale',
    'Training-block (mesocycle / microcycle) structure',
    'e1RM tracking with RPE overlay',
    'MEV / MAV / MRV volume dashboard with MRV warning',
    'Readiness-based deload detection',
    'Full mesocycle review at block end',
  ],
};

export function previewModeDiff(from: UserMode, to: UserMode): ModeDiff {
  if (from === to) return { gained: [], hidden: [] };
  const fromSet = new Set(FEATURE_BY_MODE[from]);
  const toSet   = new Set(FEATURE_BY_MODE[to]);
  const gained = [...toSet].filter((f) => !fromSet.has(f));
  const hidden = [...fromSet].filter((f) => !toSet.has(f));
  return { gained, hidden };
}
