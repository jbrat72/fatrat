/**
 * Per-user personalization of the shared exercise library.
 *
 * Pure functions — no React, no Firestore. The user's UserExercisePrefs
 * (favorites + hidden) are layered over the global + custom exercise list so
 * each user gets a curated catalog without changing it for anyone else.
 */
import type { ExerciseDefinition, UserExercisePrefs } from '@/types';

export const EMPTY_EXERCISE_PREFS: UserExercisePrefs = { favorites: [], hidden: [] };

/**
 * The library a user actually wants to use: hidden exercises removed and
 * favorites sorted to the front (original order kept within each group).
 * Program building passes the result so generated programs and swaps draw
 * from the user's curated catalog — favorites first, hidden never.
 */
export function personalizeLibrary(
  library: ExerciseDefinition[],
  prefs: UserExercisePrefs,
): ExerciseDefinition[] {
  const hidden = new Set(prefs.hidden);
  const favorites = new Set(prefs.favorites);
  const visible = library.filter((e) => !hidden.has(e.id));
  const fav = visible.filter((e) => favorites.has(e.id));
  const rest = visible.filter((e) => !favorites.has(e.id));
  return [...fav, ...rest];
}

export function isFavorite(prefs: UserExercisePrefs, id: string): boolean {
  return prefs.favorites.includes(id);
}

export function isHidden(prefs: UserExercisePrefs, id: string): boolean {
  return prefs.hidden.includes(id);
}

/** Toggle an id in favorites — returns new prefs (immutable). */
export function toggleFavorite(prefs: UserExercisePrefs, id: string): UserExercisePrefs {
  const has = prefs.favorites.includes(id);
  return {
    ...prefs,
    favorites: has ? prefs.favorites.filter((x) => x !== id) : [...prefs.favorites, id],
  };
}

/**
 * Toggle an id in hidden — returns new prefs (immutable). Hiding an exercise
 * also clears its favorite flag: the two states are mutually exclusive.
 */
export function toggleHidden(prefs: UserExercisePrefs, id: string): UserExercisePrefs {
  const has = prefs.hidden.includes(id);
  if (has) {
    return { ...prefs, hidden: prefs.hidden.filter((x) => x !== id) };
  }
  return {
    favorites: prefs.favorites.filter((x) => x !== id),
    hidden: [...prefs.hidden, id],
  };
}
