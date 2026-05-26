/**
 * Display copy + ordered option lists for the post-session feedback scales
 * (types/session.ts). One place so the modal, the history views, and any
 * future surface all stay in sync.
 */
import type { PainLevel, PumpLevel, VolumeLevel } from '@/types';

export const PUMP_OPTIONS: { value: PumpLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'amazing', label: 'Amazing' },
];

export const VOLUME_OPTIONS: { value: VolumeLevel; label: string }[] = [
  { value: 'not-enough', label: 'Not enough' },
  { value: 'just-right', label: 'Just right' },
  { value: 'pushed-limits', label: 'Pushed limits' },
  { value: 'too-much', label: 'Too much' },
];

export const PAIN_OPTIONS: { value: PainLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

export const PUMP_LABEL: Record<PumpLevel, string> = {
  low: 'Low', moderate: 'Moderate', amazing: 'Amazing',
};
export const VOLUME_LABEL: Record<VolumeLevel, string> = {
  'not-enough': 'Not enough',
  'just-right': 'Just right',
  'pushed-limits': 'Pushed limits',
  'too-much': 'Too much',
};
export const PAIN_LABEL: Record<PainLevel, string> = {
  none: 'None', low: 'Low', moderate: 'Moderate', high: 'High',
};

/** Ordinal rank for joint pain — higher is worse. Used to derive the overall. */
export const PAIN_RANK: Record<PainLevel, number> = {
  none: 0, low: 1, moderate: 2, high: 3,
};

/** The worst (highest-rank) pain level across a set of readings. */
export function worstPain(levels: PainLevel[]): PainLevel {
  return levels.reduce<PainLevel>(
    (worst, l) => (PAIN_RANK[l] > PAIN_RANK[worst] ? l : worst),
    'none',
  );
}
