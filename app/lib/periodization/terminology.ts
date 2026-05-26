/**
 * Terminology axis — separate from UserMode.
 *
 * `mode` (BASIC/INTERMEDIATE/ADVANCED) controls feature depth. Whether the UI
 * shows training *jargon* — RIR/RPE numbers, MEV/MAV/MRV volume landmarks,
 * mesocycle/microcycle naming — is a separate, opt-in choice.
 *
 * All three modes default to plain terminology. INTERMEDIATE/ADVANCED users
 * may opt into advanced terms (in onboarding or Settings). BASIC users never
 * see jargon.
 *
 * Pure functions — no React, no Firestore.
 */
import type { UserMode } from '@/types';

/** The slice of a profile these helpers need. */
export interface TerminologyUser {
  mode: UserMode;
  advancedTerminology?: boolean;
}

/** True when the user has opted into advanced training jargon. */
export function usesAdvancedTerminology(user: TerminologyUser): boolean {
  return user.mode !== 'BASIC' && user.advancedTerminology === true;
}

/**
 * Effective mode for *terminology* rendering. Components that branch on
 * BASIC/INTERMEDIATE/ADVANCED purely to pick vocabulary should be fed this
 * instead of the raw mode.
 *
 * An ADVANCED user who hasn't opted into advanced terminology reads as
 * INTERMEDIATE — plain effort words, no RPE/RIR or MEV/MAV/MRV numbers —
 * while keeping every ADVANCED *feature*.
 */
export function terminologyMode(user: TerminologyUser): UserMode {
  if (usesAdvancedTerminology(user)) return 'ADVANCED';
  return user.mode === 'ADVANCED' ? 'INTERMEDIATE' : user.mode;
}
