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
import type { Microcycle, Mesocycle, UserProfile, CycleStatus } from '@/types';

export async function migrateWeekStatusRepair(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedWeekStatusRepair) return profile;
  const repo = getRepository();
  // No internal try/catch: a failure must propagate to UserProvider's error
  // path (visible retry screen) instead of silently proceeding un-migrated.
  const mesos = await repo.listMesocycles(profile.userId);
  for (const meso of mesos) {
    if (meso.status !== 'active') continue;
    const micros = (await repo.listMicrocycles(meso.id)).sort((a, b) => a.weekNumber - b.weekNumber);
    if (micros.length === 0) continue;

    // One query for the whole plan; group per week client-side.
    const all = await repo.listSessionsForMeso(meso.id);
    const byMicro = new Map<string, typeof all>();
    for (const s of all) {
      if (!s.microcycleId) continue;
      const arr = byMicro.get(s.microcycleId) ?? [];
      arr.push(s);
      byMicro.set(s.microcycleId, arr);
    }
    // A week is "done" when it has sessions and all of them are completed
    // (matches how planAdvance flips a microcycle to 'completed').
    const done = micros.map((m) => {
      const sessions = byMicro.get(m.id) ?? [];
      return sessions.length > 0 && sessions.every((s) => s.completed);
    });

    const activeIdx = done.findIndex((d) => !d);
    const allDone = activeIdx === -1;

    const microWrites: Microcycle[] = [];
    for (let i = 0; i < micros.length; i++) {
      const m = micros[i]!;
      let status: CycleStatus;
      if (allDone) status = 'completed';
      else if (i < activeIdx) status = 'completed';
      else if (i === activeIdx) status = 'active';
      else status = 'draft';
      if (m.status !== status) microWrites.push({ ...m, status });
    }

    const mesoWrites: Mesocycle[] = [];
    if (allDone) {
      // Every week logged — the meso itself is finished (it was still
      // 'active' here, per the guard above, so this always changes it).
      const lastWeekIndex = micros[micros.length - 1]!.weekNumber - 1;
      mesoWrites.push({ ...meso, weekIndex: lastWeekIndex, status: 'completed' });
    } else {
      const correctIndex = micros[activeIdx]!.weekNumber - 1;
      if (meso.weekIndex !== correctIndex) {
        mesoWrites.push({ ...meso, weekIndex: correctIndex });
      }
    }
    // One atomic commit per meso — a mid-loop failure can no longer leave a
    // plan with half its week statuses repaired.
    if (microWrites.length || mesoWrites.length) {
      await repo.commitPlanBatch(profile.userId, { microcycles: microWrites, mesocycles: mesoWrites });
    }
  }
  const migrated: UserProfile = { ...profile, migratedWeekStatusRepair: true, updatedAt: new Date().toISOString() };
  await repo.upsertProfile(migrated);
  return migrated;
}
