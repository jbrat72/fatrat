/**
 * /lib/periodization — PORTABLE CORE.
 * - Zero React imports.
 * - Zero Firestore imports.
 * - Pure functions only. Fully unit-testable.
 *
 * Modes never appear inside the engine; they only choose which scheme to call
 * and how to translate the result for display.
 */
export * from './rpe';
export * from './e1rm';
export * from './progression';
export * from './deload';
export * from './volume';
export * from './mode';
export * from './terminology';
export * from './rest';
export * from './modeDiff';
export * from './adjustFromFeedback';
export * from './adjustFromSoreness';
