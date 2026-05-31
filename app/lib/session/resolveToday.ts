/**
 * Pure-ish helpers that resolve "today's session" for a user.
 *
 * Strategy:
 *   1. Today's session by date wins outright — covers both scheduled sessions
 *      inside a microcycle and ad-hoc workouts launched from the picker.
 *   2. Otherwise, find the active mesocycle → microcycle and return the next
 *      pending session in that microcycle.
 *   3. If nothing's left, return null.
 */
import type { DataRepository } from '@/lib/firestore';
import type {
  WorkoutSession, Microcycle, Mesocycle,
} from '@/types';

export interface ResolvedToday {
  mesocycle: Mesocycle | null;
  microcycle: Microcycle | null;
  session: WorkoutSession | null;
  /** "today" — actually pending now. "pending" — scheduled later in the week. "none" — nothing left. */
  state: 'today' | 'pending' | 'none';
}

export async function resolveToday(
  repo: DataRepository,
  userId: string,
  isoDate: string,
): Promise<ResolvedToday> {
  // Today's session by date wins — covers ad-hoc workouts as well as
  // scheduled sessions inside a microcycle. We still resolve the active
  // program context (meso/micro) so the Today UI can label the session.
  const todaySession = await repo.getTodaySession(userId, isoDate);

  const meso = await repo.getActivePlan(userId);
  const micros = meso ? await repo.listMicrocycles(meso.id) : [];
  const micro = micros.find((m) => m.status === 'active') ?? micros[micros.length - 1] ?? null;

  // Only accept the date-matched session if it's ad-hoc (no mesocycleId) or
  // belongs to the user's currently active meso. A leftover programmed
  // session from a cancelled plan is otherwise stale and shouldn't show.
  if (todaySession) {
    const linkedToProgram = todaySession.mesocycleId != null;
    const matchesActive = linkedToProgram && meso != null && meso.id === todaySession.mesocycleId;
    if (!linkedToProgram || matchesActive) {
      return { mesocycle: meso, microcycle: micro, session: todaySession, state: 'today' };
    }
  }

  if (!micro) {
    return { mesocycle: meso, microcycle: null, session: null, state: 'none' };
  }

  const microSessions = await repo.listSessionsInMicrocycle(micro.id);
  const pending = microSessions.find((s) => !s.completed);
  if (pending) {
    return { mesocycle: meso, microcycle: micro, session: pending, state: 'pending' };
  }

  return { mesocycle: meso, microcycle: micro, session: null, state: 'none' };
}
