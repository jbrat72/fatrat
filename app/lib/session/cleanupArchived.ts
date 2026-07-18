/**
 * One-shot cleanup that deletes orphan uncompleted sessions tied to
 * archived mesocycles. Cancel-plan flows from v0.60+ already delete the
 * pending sessions at cancel time, but data created before that landed
 * (or by an earlier `archive` path) can still have stale `Mon-Wed-Fri`
 * scheduled sessions hanging around in Firestore.
 *
 * These stale sessions surface in History's All-blocks (by-date) calendar
 * as Skipped/Planned cells on dates the user has long moved past, even
 * though the plan is cancelled.
 *
 * Safe to call repeatedly — it only deletes uncompleted sessions referencing
 * archived mesos. Completed sessions are kept (they belong in History).
 */
import type { DataRepository } from '@/lib/firestore';

export async function cleanupArchivedPendingSessions(
  repo: DataRepository,
  userId: string,
): Promise<number> {
  try {
    const mesos = await repo.listMesocycles(userId);
    const archivedIds = new Set(mesos.filter((m) => m.status === 'archived').map((m) => m.id));
    if (archivedIds.size === 0) return 0;
    const all = await repo.listSessions(userId, { limit: 1000 });
    const orphans = all.filter((s) => !s.completed && s.mesocycleId != null && archivedIds.has(s.mesocycleId));
    if (orphans.length > 0) {
      // One batched delete instead of a per-doc loop.
      await repo.commitPlanBatch(userId, { deleteSessionIds: orphans.map((s) => s.id) });
    }
    return orphans.length;
  } catch {
    return 0;
  }
}
