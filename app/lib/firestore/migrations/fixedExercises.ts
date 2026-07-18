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
import type { UserProfile, ExerciseEntry, WorkoutSession } from '@/types';

export async function migrateFixedExercises(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedFixedExercises) return profile;
  const repo = getRepository();
  // No internal try/catch: a failure must propagate to UserProvider's error
  // path (visible retry screen) instead of silently proceeding un-migrated.
  const mesos = await repo.listMesocycles(profile.userId);
  for (const meso of mesos) {
    if (meso.fixedExercises) continue;
    const micros = (await repo.listMicrocycles(meso.id)).sort((a, b) => a.weekNumber - b.weekNumber);
    const sessionWrites: WorkoutSession[] = [];
    if (micros.length > 1) {
      // One query for the whole plan; group per week client-side.
      const all = await repo.listSessionsForMeso(meso.id);
      const byMicro = new Map<string, WorkoutSession[]>();
      for (const s of all) {
        if (!s.microcycleId) continue;
        const arr = byMicro.get(s.microcycleId) ?? [];
        arr.push(s);
        byMicro.set(s.microcycleId, arr);
      }
      const week = (id: string) => (byMicro.get(id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      const w1 = week(micros[0]!.id);
      const w1DayExs = w1.map((s) => s.exercises.map((ex) => ({ exerciseId: ex.exerciseId, name: ex.name, muscle: ex.muscle, metric: ex.metric })));
      for (let w = 1; w < micros.length; w++) {
        const sessions = week(micros[w]!.id);
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
          if (changed) sessionWrites.push({ ...s, exercises });
        }
      }
    }
    // One atomic commit per meso (sessions + the fixed flag together).
    await repo.commitPlanBatch(profile.userId, {
      sessions: sessionWrites,
      mesocycles: [{ ...meso, fixedExercises: true }],
    });
  }
  const migrated: UserProfile = { ...profile, migratedFixedExercises: true, updatedAt: new Date().toISOString() };
  await repo.upsertProfile(migrated);
  return migrated;
}
