/**
 * Phase- and exercise-appropriate rest defaults (seconds).
 * Pure function — the UI rest timer asks for these on auto-start.
 */
import type { MesocyclePhaseType, MovementPattern } from '@/types';

export function defaultRestSec(
  phase: MesocyclePhaseType,
  patterns: MovementPattern[] = [],
): number {
  const isCompound = patterns.includes('compound');
  const isIsolation = patterns.includes('isolation') && !isCompound;

  switch (phase) {
    case 'strength':
    case 'power':
    case 'peaking':
      return isCompound ? 240 : 180;       // 3-4 min compound, 2-3 min smaller
    case 'hypertrophy':
      if (isIsolation) return 75;          // 60-90s isolation
      if (isCompound)  return 150;         // 2-3 min compound
      return 120;
    case 'deload':
      return isCompound ? 120 : 60;        // shorter; we're not pushing intensity
  }
}
