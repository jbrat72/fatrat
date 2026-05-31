/**
 * Pure-ish helpers that resolve "today's session" for a user.
 *
 * Strategy:
 *   1. Today's session by date wins outright — covers both scheduled sessions
 *      inside a microcycle and ad-hoc workouts launched from the picker.
 *   2. Otherwise, find the active macrocycle → mesocycle → microcycle and
 *      return the next pending session in that microcycle.
 *   3. If nothing's left, return null.
 */
import type { DataRepository } from '@/lib/firestore';
import type {
  WorkoutSession, Microcycle, Mesocycle, Macrocycle,
} from '@/types';

export interface ResolvedToday {
  macrocycle: Macrocycle | null;
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
  // program context (macro/meso/micro) so the Today UI can label the session.
  const todaySession = await repo.getTodaySession(userId, isoDate);

  const macro = await repo.getActiveMacrocycle(userId);
  const mesos = macro ? await repo.listMesocycles(macro.id) : [];
  const meso = mesos.find((m) => m.status === 'active') ?? mesos[0] ?? null;
  const micros = meso ? await repo.listMicrocycles(meso.id) : [];
  const micro = micros.find((m) => m.status === 'active') ?? micros[micros.length - 1] ?? null;

  // Only accept the date-matched session if it's ad-hoc (no macroId) or
  // belongs to the user's currently active macro. A leftover programmed
  // session from a cancelled plan is otherwise stale and shouldn't show.
  if (todaySession) {
    const linkedToProgram = todaySession.macrocycleId != null;
    const matchesActive = linkedToProgram && macro && macro.id === todaySession.macrocycleId;
    if (!linkedToProgram || matchesActive) {
      return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: todaySession, state: 'today' };
    }
  }

  if (!micro) {
    return { macrocycle: macro, mesocycle: meso, microcycle: null, session: null, state: 'none' };
  }

  const microSessions = await repo.listSessionsInMicrocycle(micro.id);
  const pending = microSessions.find((s) => !s.completed);
  if (pending) {
    return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: pending, state: 'pending' };
  }

  return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: null, state: 'none' };
}
