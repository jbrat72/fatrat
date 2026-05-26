/**
 * Pure-ish helpers that resolve "today's session" for a user.
 *
 * Strategy:
 *   1. Find the active microcycle inside the active mesocycle inside the active macrocycle.
 *   2. If a session for today already exists, return it.
 *   3. Otherwise, return the next pending session in that microcycle.
 *   4. If the microcycle has no remaining sessions, fall back to the most recently
 *      finished session (so the Today screen can show a recap state).
 */
import type {
  DataRepository,
} from '@/lib/firestore';
import type {
  WorkoutSession,
  Microcycle,
  Mesocycle,
  Macrocycle,
} from '@/types';

export interface ResolvedToday {
  macrocycle: Macrocycle | null;
  mesocycle: Mesocycle | null;
  microcycle: Microcycle | null;
  session: WorkoutSession | null;
  /** "today" — actually pending now. "future" — scheduled but not today's date. "none" — nothing left this week. */
  state: 'today' | 'pending' | 'none';
}

export async function resolveToday(
  repo: DataRepository,
  userId: string,
  isoDate: string,
): Promise<ResolvedToday> {
  const macro = await repo.getActiveMacrocycle(userId);
  if (!macro) {
    return { macrocycle: null, mesocycle: null, microcycle: null, session: null, state: 'none' };
  }

  const mesos = await repo.listMesocycles(macro.id);
  const meso = mesos.find((m) => m.status === 'active') ?? mesos[0] ?? null;
  if (!meso) {
    return { macrocycle: macro, mesocycle: null, microcycle: null, session: null, state: 'none' };
  }

  const micros = await repo.listMicrocycles(meso.id);
  const micro = micros.find((m) => m.status === 'active') ?? micros[micros.length - 1] ?? null;
  if (!micro) {
    return { macrocycle: macro, mesocycle: meso, microcycle: null, session: null, state: 'none' };
  }

  const microSessions = await repo.listSessionsInMicrocycle(micro.id);

  // Exact-date match wins.
  const todays = microSessions.find((s) => s.date === isoDate);
  if (todays) {
    return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: todays, state: 'today' };
  }

  // Next pending in the week.
  const pending = microSessions.find((s) => !s.completed);
  if (pending) {
    return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: pending, state: 'pending' };
  }

  return { macrocycle: macro, mesocycle: meso, microcycle: micro, session: null, state: 'none' };
}
