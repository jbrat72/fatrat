/**
 * Auto-advance: when a workout session is marked completed, figure out what
 * structural state to update (microcycle status, next microcycle activation,
 * mesocycle status). Pure-ish — takes input snapshots, returns a patch plan
 * the caller writes through the DataRepository.
 *
 * The function does NOT touch the engine or detect deloads itself — that's
 * deload.ts. The caller can chain deload detection after the structural patch.
 */
import type { Microcycle, Mesocycle, WorkoutSession } from '@/types';

export interface AdvancePatch {
  /** Microcycle whose status should be flipped to 'completed' (if any). */
  microcycleCompleted?: Microcycle;
  /** Microcycle whose status should be flipped to 'active' (if any). */
  microcycleActivated?: Microcycle;
  /** Mesocycle whose status should be flipped to 'completed' (if any). */
  mesocycleCompleted?: Mesocycle;
  /** Mesocycle weekIndex bump (if we moved into the next week). */
  mesocycleWeekIndex?: number;
}

export interface AdvanceInput {
  /** The session that was just marked completed. */
  completedSession: WorkoutSession;
  /** All sessions in the current microcycle (in chronological order). */
  microSessions: WorkoutSession[];
  /** Current microcycle. */
  microcycle: Microcycle;
  /** All microcycles in the current mesocycle (in week order). */
  micros: Microcycle[];
  /** Current mesocycle. */
  mesocycle: Mesocycle;
}

export function planAdvance(input: AdvanceInput): AdvancePatch {
  const { completedSession, microSessions, microcycle, mesocycle } = input;
  // Defensive: the next-week lookup below relies on week order, but callers
  // pass micros straight from the repo, which historically returned them
  // unsorted — that activated the wrong week on completion. Sort here too.
  const micros = [...input.micros].sort((a, b) => a.weekNumber - b.weekNumber);

  // Replace the completed session in our local copy to compute "what's pending now".
  const updated = microSessions.map((s) =>
    s.id === completedSession.id ? completedSession : s,
  );
  const allDone = updated.every((s) => s.completed);

  // Still more sessions left in this week — nothing structural to change.
  if (!allDone) return {};

  // All sessions in this micro are done. Mark it completed.
  const patch: AdvancePatch = {
    microcycleCompleted: { ...microcycle, status: 'completed' },
  };

  // Is there a next microcycle in this meso?
  const idx = micros.findIndex((m) => m.id === microcycle.id);
  const next = idx >= 0 ? micros[idx + 1] : undefined;

  if (next) {
    patch.microcycleActivated = { ...next, status: 'active' };
    patch.mesocycleWeekIndex = next.weekNumber - 1; // 0-based index
    return patch;
  }

  // Last microcycle of the mesocycle → meso is done.
  patch.mesocycleCompleted = { ...mesocycle, status: 'completed' };
  return patch;
}
