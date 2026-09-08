/**
 * Auto-complete training plans whose calendar window has fully elapsed.
 *
 * `planAdvance` (advance.ts) only marks a mesocycle 'completed' when the LAST
 * session of the last week is finished. If the final workouts are skipped
 * (never completed) — e.g. the user got sick and ran out the clock — advance
 * never fires, and the plan is left dangling as 'active' forever. Every surface
 * then guesses "where am I" differently (the Plan header clamps the calendar
 * week to the plan length, the Training Weeks calendar falls back to whichever
 * micro is still flagged 'active', History counts elapsed calendar weeks), so
 * the same finished plan shows three different, contradictory positions.
 *
 * A plan's window is genuinely over once today is on/after startDate +
 * weeks*7 days: there are no scheduled days left. At that point the block is
 * finished regardless of how the last sessions ended.
 */
import type { DataRepository } from '@/lib/firestore';
import type { Mesocycle } from '@/types';
import { todayIso } from '@/lib/ui/date';

/** True when a plan's full calendar window (weeks × 7 days from its start) has
 *  elapsed — the point past which no scheduled day remains. Plans without a
 *  start date can't be dated, so they're never auto-completed. */
export function isPlanElapsed(
  // startDate is optional here (not Pick<Mesocycle>): the type says it is
  // required, but plans migrated from the old Macrocycle model can lack it.
  meso: { startDate?: Mesocycle['startDate']; weeks: Mesocycle['weeks'] },
  today: string = todayIso(),
): boolean {
  if (!meso.startDate) return false;
  const endMs = Date.parse(meso.startDate) + meso.weeks * 7 * 86400000;
  return Date.parse(today) >= endMs;
}

/**
 * Mark any active-but-elapsed plan (and its lingering active week) completed,
 * so a finished block stops masquerading as in progress. Fire-and-forget safe:
 * completing an already-complete plan is a no-op, and failures are non-fatal.
 * Returns the ids of the plans it completed.
 */
export async function completeElapsedPlans(repo: DataRepository, userId: string): Promise<string[]> {
  const mesos = await repo.listMesocycles(userId);
  const stale = mesos.filter((m) => m.status === 'active' && isPlanElapsed(m));
  const completed: string[] = [];
  for (const m of stale) {
    // Also flip any micro still flagged 'active' — it's the stray flag the
    // Training Weeks calendar was highlighting as "current".
    const micros = await repo.listMicrocycles(m.id);
    const activeMicros = micros
      .filter((mi) => mi.status === 'active')
      .map((mi) => ({ ...mi, status: 'completed' as const }));
    await repo.commitPlanBatch(userId, {
      mesocycles: [{ ...m, status: 'completed' }],
      microcycles: activeMicros,
    });
    completed.push(m.id);
  }
  return completed;
}
