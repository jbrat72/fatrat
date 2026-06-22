/**
 * One-shot: collapse duplicate exercise NAMES down to a single canonical
 * exercise. Duplicates (same name, different ids — usually a custom exercise
 * colliding with a built-in or another custom) caused split history and a
 * stale-metric bug. A built-in/library exercise wins over a custom; among
 * customs, the first by id. Duplicate custom exercises are deleted and every
 * logged session is re-pointed by NAME to the canonical id (also refreshing the
 * denormalized name/muscle/metric). Completed sets (weights/reps) are untouched.
 *
 * Idempotent — gated by `profile.migratedDedupeExercises`.
 */
import { getRepository } from '@/lib/firestore';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import type { UserProfile, ExerciseDefinition, WorkoutSession } from '@/types';

const norm = (s: string) => s.trim().toLowerCase();
const isCustomId = (id: string) => id.startsWith('custom-');

export async function migrateDedupeExerciseNames(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedDedupeExercisesV2) return profile;
  const repo = getRepository();
  try {
    const globals = await repo.listGlobalExercises().catch(() => [] as ExerciseDefinition[]);
    const customs = await repo.listUserExercises(profile.userId).catch(() => [] as ExerciseDefinition[]);

    // Canonical def per normalized name. Library beats custom; otherwise the
    // first one seen stays. Seed + repo globals are library; customs last.
    const canonical = new Map<string, ExerciseDefinition>();
    const consider = (e: ExerciseDefinition, isLibrary: boolean) => {
      const k = norm(e.name);
      const cur = canonical.get(k);
      if (!cur) { canonical.set(k, e); return; }
      if (isLibrary && isCustomId(cur.id)) canonical.set(k, e); // library replaces custom
    };
    for (const e of GLOBAL_EXERCISES) consider(e, true);
    for (const e of globals) consider(e, true);
    for (const e of customs) consider(e, false);

    // Delete custom exercises that are duplicates (a different def is canonical
    // for their name).
    for (const c of customs) {
      const canon = canonical.get(norm(c.name));
      if (canon && canon.id !== c.id) {
        try { await repo.deleteUserExercise(profile.userId, c.id); } catch { /* keep going */ }
      }
    }

    // Re-point every session's exercises by name to the canonical id. Catches
    // old/drifted ids that aren't even in the current library.
    const sessions = await repo.listSessions(profile.userId, { limit: 1000 }).catch(() => [] as WorkoutSession[]);
    for (const s of sessions) {
      let changed = false;
      const exercises = s.exercises.map((ex) => {
        const canon = canonical.get(norm(ex.name));
        if (!canon || canon.id === ex.exerciseId) return ex;
        changed = true;
        return {
          ...ex,
          exerciseId: canon.id,
          name: canon.name,
          muscle: canon.primaryMuscle,
          metric: canon.metric ?? 'weight-reps',
        };
      });
      if (changed) { try { await repo.upsertSession({ ...s, exercises }); } catch { /* keep going */ } }
    }

    const migrated: UserProfile = { ...profile, migratedDedupeExercises: true, migratedDedupeExercisesV2: true, updatedAt: new Date().toISOString() };
    await repo.upsertProfile(migrated);
    return migrated;
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[migrateDedupeExerciseNames] failed', err);
    return profile;
  }
}
