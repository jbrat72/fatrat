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
import type { UserMode, EffortRPE, WorkoutSession, Mesocycle } from '@/types';

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

/**
 * True when a session participates in the periodization model — i.e. it
 * belongs to an active mesocycle whose `programStyle` is not 'traditional'.
 *
 * Use this to gate periodization-only behavior: soreness check-in, per-muscle
 * pump/volume/joint-pain feedback prompts, post-workout "tune the next session"
 * copy, RIR/RPE prescription readouts, deload language, etc.
 *
 * Ad-hoc sessions (no microcycleId) and Traditional-style programs both read
 * as `false`. Pass `null`/`undefined` for `meso` when one isn't loaded.
 */
export function isPeriodizedSession(
  session: Pick<WorkoutSession, 'microcycleId'> | null | undefined,
  meso: Pick<Mesocycle, 'programStyle'> | null | undefined,
): boolean {
  if (!session?.microcycleId) return false;
  if (!meso) return false;
  return meso.programStyle !== 'traditional';
}

/**
 * Per-set effort label, terminology-aware.
 *   BASIC        → Easy / Just right / Hard
 *   INTERMEDIATE → Easy / Solid / Tough / Hard / Failed
 *   ADVANCED     → `RPE X` (raw number)
 *
 * Single source of truth — used by the workout summary, the day-detail sheet,
 * and anywhere else a logged RPE is rendered as words.
 */
export function effortShort(mode: UserMode, rpe: EffortRPE): string {
  if (mode === 'BASIC') {
    if (rpe <= 6.5) return 'Easy';
    if (rpe <= 8)   return 'Just right';
    return 'Hard';
  }
  if (mode === 'INTERMEDIATE') {
    if (rpe <= 6.5) return 'Easy';
    if (rpe <= 7.5) return 'Solid';
    if (rpe <= 8.5) return 'Tough';
    if (rpe <= 9.5) return 'Hard';
    return 'Failed';
  }
  return `RPE ${rpe}`;
}
