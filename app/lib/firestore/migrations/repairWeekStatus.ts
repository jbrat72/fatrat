/**
 * One-shot repair for a week-advance bug (pre-v0.97.3): `listMicrocycles`
 * returned weeks unsorted, so `planAdvance` activated `micros[idx + 1]` — not
 * necessarily the next week. Completing a week could activate the wrong week,
 * bump `meso.weekIndex` too far, and strand the real next week as 'draft'
 * ("Upcoming"). That made the Plan header and Weeks list show the wrong week.
 *
 * This recomputes, for every in-progress mesocycle, the correct linear state:
 * weeks fully logged (all sessions completed) become 'completed'; the first
 * not-fully-logged week becomes 'active'; later weeks become 'draft'; and
 * `meso.weekIndex` is set to the active week's index. Sessions are never
 * touched. Idempotent — gated by `profile.migratedWeekStatusRepair` and only
 * writes docs whose status / weekIndex actually changed.
 */
import { getRepository } from '@/lib/firestore';
import type { UserProfile, CycleStatus } from '@/types';

export async function migrateWeekStatusRepair(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedWeekStatusRepair) return profile;
  const repo = getRepository();
  try {
    const mesos = await repo.listMesocycles(profile.userId);
    for (const meso of mesos) {
      if (meso.status !== 'active') continue;
      const micros = (await repo.listMicrocycles(meso.id)).sort((a, b) => a.weekNumber - b.weekNumber);
      if (micros.length === 0) continue;

      // A week is "done" when it has sessions and all of them are completed
      // (matches how planAdvance flips a microcycle to 'completed').
      const done: boolean[] = [];
      for (const m of micros) {
        const sessions = await repo.listSessionsInMicrocycle(m.id);
        done.push(sessions.length > 0 && sessions.every((s) => s.completed));
      }

      let activeIdx = done.findIndex((d) => !d);
      const allDone = activeIdx === -1;

      for (let i = 0; i < micros.length; i++) {
        const m = micros[i]!;
        let status: CycleStatus;
        if (allDone) status = 'completed';
        else if (i < activeIdx) status = 'completed';
        else if (i === activeIdx) status = 'active';
        else status = 'draft';
        if (m.status !== status) await repo.upsertMicrocycle({ ...m, status });
      }

      if (allDone) {
        // Every week logged — the meso itself is finished (it was still
        // 'active' here, per the guard above, so this always changes it).
        const lastWeekIndex = micros[micros.length - 1]!.weekNumber - 1;
        await repo.upsertMesocycle({ ...meso, weekIndex: lastWeekIndex, status: 'completed' });
      } else {
        const correctIndex = micros[activeIdx]!.weekNumber - 1;
        if (meso.weekIndex !== correctIndex) {
          await repo.upsertMesocycle({ ...meso, weekIndex: correctIndex });
        }
      }
    }
    const migrated: UserProfile = { ...profile, migratedWeekStatusRepair: true, updatedAt: new Date().toISOString() };
    await repo.upsertProfile(migrated);
    return migrated;
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[migrateWeekStatusRepair] failed', err);
    return profile;
  }
}
