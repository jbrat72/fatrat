/**
 * Pure-ish helpers that resolve "today" for a user.
 *
 * Strategy:
 *   1. Pull every session whose date is today — there may be more than one
 *      (a completed workout + a follow-on ad-hoc, e.g.).
 *   2. Pick a "primary" session for the Today header: prefer the earliest
 *      pending today-session; otherwise the most recent completed one; else
 *      the next pending session in the active microcycle.
 *   3. Surface the full list separately so the UI can render every session
 *      as its own card.
 */
import type { DataRepository } from '@/lib/firestore';
import type {
  WorkoutSession, Microcycle, Mesocycle,
} from '@/types';

export interface ResolvedToday {
  mesocycle: Mesocycle | null;
  microcycle: Microcycle | null;
  /** The session the Today header's primary action targets. */
  session: WorkoutSession | null;
  /** Every session whose date is today (sorted by start time). */
  todaySessions: WorkoutSession[];
  /** "today" — primary is dated today. "pending" — primary is scheduled
   *  later in the week. "none" — nothing left for now. */
  state: 'today' | 'pending' | 'none';
}

export async function resolveToday(
  repo: DataRepository,
  userId: string,
  isoDate: string,
): Promise<ResolvedToday> {
  const todaySessions = await repo.listSessionsOnDate(userId, isoDate);

  const meso = await repo.getActivePlan(userId);
  const micros = meso ? await repo.listMicrocycles(meso.id) : [];
  const micro = micros.find((m) => m.status === 'active') ?? micros[micros.length - 1] ?? null;

  // Filter out stale programmed sessions from cancelled plans — a session
  // linked to a meso that isn't the user's active one is left over and
  // shouldn't show on Today. Ad-hoc sessions (no mesocycleId) always pass.
  const liveTodaySessions = todaySessions.filter((s) => {
    if (s.mesocycleId == null) return true;
    return meso != null && meso.id === s.mesocycleId;
  });

  // Pick a primary: earliest still-pending today session wins (so the user
  // sees a Start/Continue button). Otherwise the most recent completed one.
  const pendingToday = liveTodaySessions.find((s) => !s.completed);
  if (pendingToday) {
    return { mesocycle: meso, microcycle: micro, session: pendingToday, todaySessions: liveTodaySessions, state: 'today' };
  }
  const completedToday = [...liveTodaySessions].reverse().find((s) => s.completed);
  if (completedToday) {
    return { mesocycle: meso, microcycle: micro, session: completedToday, todaySessions: liveTodaySessions, state: 'today' };
  }

  // Nothing on today's date — look ahead in the active micro for the next
  // pending session so Today can suggest it.
  if (!micro) {
    return { mesocycle: meso, microcycle: null, session: null, todaySessions: liveTodaySessions, state: 'none' };
  }
  const microSessions = await repo.listSessionsInMicrocycle(micro.id);
  // Only surface a session that is actually due (dated on/before today). A
  // future session (e.g. next week's first day, when this week finished early)
  // must NOT show up as "today's workout" — it appears under "UP NEXT" instead.
  const pending = microSessions.find((s) => !s.completed && s.date <= isoDate);
  if (pending) {
    return { mesocycle: meso, microcycle: micro, session: pending, todaySessions: liveTodaySessions, state: 'pending' };
  }
  return { mesocycle: meso, microcycle: micro, session: null, todaySessions: liveTodaySessions, state: 'none' };
}
