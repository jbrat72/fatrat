/**
 * One-shot: default existing plans to fixed exercises. Plans built before the
 * fixed/variety option rotated exercises week to week; this rewrites each
 * not-yet-completed future-week session to use week 1's exact exercises (by day
 * + position), keeping that week's own set counts / prescriptions. Logged
 * (completed) sessions are never touched.
 *
 * Repository-based so it works in both mock and Firebase modes. Idempotent —
 * gated by `profile.migratedFixedExercises` and skips mesos already marked
 * fixed.
 */
import { getRepository } from '@/lib/firestore';
import type { UserProfile, ExerciseEntry } from '@/types';

export async function migrateFixedExercises(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedFixedExercises) return profile;
  const repo = getRepository();
  try {
    const mesos = await repo.listMesocycles(profile.userId);
    for (const meso of mesos) {
      if (meso.fixedExercises) continue;
      const micros = (await repo.listMicrocycles(meso.id)).sort((a, b) => a.weekNumber - b.weekNumber);
      if (micros.length > 1) {
        const w1 = (await repo.listSessionsInMicrocycle(micros[0]!.id)).sort((a, b) => a.date.localeCompare(b.date));
        const w1DayExs = w1.map((s) => s.exercises.map((ex) => ({ exerciseId: ex.exerciseId, name: ex.name, muscle: ex.muscle, metric: ex.metric })));
        for (let w = 1; w < micros.length; w++) {
          const sessions = (await repo.listSessionsInMicrocycle(micros[w]!.id)).sort((a, b) => a.date.localeCompare(b.date));
          for (let d = 0; d < sessions.length; d++) {
            const s = sessions[d]!;
            if (s.completed) continue;
            const tmpl = w1DayExs[d];
            if (!tmpl) continue;
            let changed = false;
            const exercises: ExerciseEntry[] = s.exercises.map((ex, i) => {
              const t = tmpl[i];
              if (!t || t.exerciseId === ex.exerciseId) return ex;
              changed = true;
              return { ...ex, exerciseId: t.exerciseId, name: t.name, muscle: t.muscle, metric: t.metric };
            });
            if (changed) await repo.upsertSession({ ...s, exercises });
          }
        }
      }
      await repo.upsertMesocycle({ ...meso, fixedExercises: true });
    }
    const migrated: UserProfile = { ...profile, migratedFixedExercises: true, updatedAt: new Date().toISOString() };
    await repo.upsertProfile(migrated);
    return migrated;
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[migrateFixedExercises] failed', err);
    return profile;
  }
}
