'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button } from '@/components/ui';
import { ExerciseCard, RestTimer, ExerciseTimer, ExerciseHistorySheet, SwapExerciseModal, SessionFeedbackModal, SorenessCheckIn, StructureSheet } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import { resolveToday } from '@/lib/session/resolveToday';
import { hydrateFromHistory } from '@/lib/session/hydrateFromHistory';
import { nudgeNextSet } from '@/lib/session/nextSetNudge';
import { planAdvance } from '@/lib/session/advance';
import { seedWeightsFromCalibration } from '@/lib/periodization/calibration';
import { defaultRestSec, terminologyMode, isPeriodizedSession } from '@/lib/periodization';
import { removeExerciseAt, pairSuperset, unlinkGroup } from '@/lib/workout/structure';
import type { WorkoutSession, SetEntry, ExerciseEntry, SessionFeedback, Mesocycle, Microcycle, ExerciseDefinition, MovementPattern, MuscleGroup, SorenessRating, MuscleSoreness } from '@/types';
import { todayIso } from '@/lib/ui/date';
import { withRetry } from '@/lib/util/retry';
import { resolveExerciseDef } from '@/lib/exercise/resolveDef';

/** With the Firestore offline cache, a write is durable locally the moment it
 *  is issued — the promise only resolves on SERVER ack, so awaiting it raw
 *  would hang navigation while offline. Wait briefly so real rejections
 *  (rules, invalid data) can surface, then proceed: 'pending' just means
 *  offline/slow and the write will sync on reconnect. */
async function settleWrite(p: Promise<unknown>, ms = 1200): Promise<'ok' | 'err' | 'pending'> {
  return Promise.race([
    p.then(() => 'ok' as const, () => 'err' as const),
    new Promise<'pending'>((r) => setTimeout(() => r('pending'), ms)),
  ]);
}


// todayIso() now imported from @/lib/ui/date — keeps the stamp in the user's local timezone.

type SorenessAction = 'add' | 'reduce' | 'skip' | 'none';

export default function WorkoutPage() {
  const router = useRouter();
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  // False until the first load resolves -- lets us show "Loading..." instead of a
  // dead-end before we know whether there's a session to work on.
  const [loaded, setLoaded] = useState(false);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number>(0);
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(0);
  const [restSec, setRestSec] = useState(0);
  // Exercise-timer overlay (time-based sets). 0 = closed.
  const [exerciseTimerSec, setExerciseTimerSec] = useState(0);
  const [exerciseTimerLabel, setExerciseTimerLabel] = useState<string | null>(null);
  const [timerTarget, setTimerTarget] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [exerciseDefs, setExerciseDefs] = useState<Record<string, ExerciseDefinition>>({});
  // Last-time performance per exercise id (completed sets from the most recent
  // prior session that trained it) — shown under each set as a reference.
  const [lastPerf, setLastPerf] = useState<Record<string, SetEntry[]>>({});
  // Same prior-performance map keyed by normalized exercise name — a fallback
  // for when the exercise id drifted (variety pick, swap, library id change) so
  // PREV still resolves by name.
  const [lastPerfByName, setLastPerfByName] = useState<Record<string, SetEntry[]>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  // A set that's been logged but is waiting on its "how did it feel?" rating.
  // Until effort is picked, focus doesn't advance and the rest timer is held.
  const [pendingEffort, setPendingEffort] = useState<{ exIdx: number; setIdx: number } | null>(null);
  // Index of the exercise armed for an in-workout superset pairing (null = off).
  const [supersetFrom, setSupersetFrom] = useState<number | null>(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const structureDecided = useRef(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [priorMuscles, setPriorMuscles] = useState<Set<MuscleGroup>>(new Set());
  const [sorenessAsked, setSorenessAsked] = useState<Set<MuscleGroup>>(new Set());
  const [sorenessMuscle, setSorenessMuscle] = useState<MuscleGroup | null>(null);
  // Per-muscle feedback: collected as each muscle group is finished.
  const [feedbackMuscle, setFeedbackMuscle] = useState<MuscleGroup | null>(null);
  const [feedbackAsked, setFeedbackAsked] = useState<Set<MuscleGroup>>(new Set());
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when a background session save was REJECTED (not merely offline). */
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Cancellation guard: this load can outlive the screen (user backs out
    // mid-load). Without it the orphaned load kept running — setting state on
    // an unmounted page and even stamping startedAt on a workout the user
    // never started.
    let cancelled = false;
    const load = async () => {
      const repo = getRepository();
      // (The old sleep/retry loop that beat the ad-hoc read-after-write race
      // is gone: the Firestore offline cache gives read-your-own-write
      // consistency, so the session created by Start Workout is always
      // visible to this read.)
      const res = await resolveToday(repo, user.userId, todayIso());
      if (cancelled) return;
      let s = res.session;
      // No session to work on -- don't trap the user on the nav-less workout
      // screen; bounce back to the full Today shell.
      if (!s) { setLoaded(true); router.replace('/today'); return; }
      if (s) {
        const prior = await repo.listSessions(user.userId, { limit: 100 });
        if (cancelled) return;
        const hydrated = hydrateFromHistory(s, prior);
        if (hydrated !== s) { await repo.upsertSession(hydrated); s = hydrated; }
        // Muscles trained in any earlier session — they get a soreness check-in.
        const trained = new Set<MuscleGroup>();
        for (const ps of prior) {
          if (ps.id === s.id) continue;
          for (const ex of ps.exercises) trained.add(ex.muscle);
        }
        setPriorMuscles(trained);
        // Build the "last time" reference: most recent prior completed sets per
        // exercise, keyed by both id and normalized name (name is the fallback
        // when the id drifted between sessions).
        const perf: Record<string, SetEntry[]> = {};
        const perfByName: Record<string, SetEntry[]> = {};
        const sortedPrior = [...prior].sort((a, b) => b.date.localeCompare(a.date));
        for (const ps of sortedPrior) {
          if (ps.id === s.id) continue;
          for (const ex of ps.exercises) {
            const nameKey = ex.name.trim().toLowerCase();
            if (perf[ex.exerciseId] && perfByName[nameKey]) continue;
            const done = ex.sets.filter((x) => x.completed && x.setType !== 'skip' && (x.weightKg != null || x.reps != null || x.timeSec != null));
            if (!done.length) continue;
            if (!perf[ex.exerciseId]) perf[ex.exerciseId] = done;
            if (nameKey && !perfByName[nameKey]) perfByName[nameKey] = done;
          }
        }
        setLastPerf(perf);
        setLastPerfByName(perfByName);
      }
      if (cancelled) return;
      setSession(s);
      setMeso(res.mesocycle);
      setMicro(res.microcycle);
      const [globalDefs, userDefs] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId).catch(() => [] as ExerciseDefinition[]),
      ]);
      if (cancelled) return;
      const byId: Record<string, ExerciseDefinition> = {};
      // Bundled library first so every id resolves even if the backend list is
      // missing newer entries; repo globals + custom exercises overlay it.
      for (const e of GLOBAL_EXERCISES) byId[e.id] = e;
      for (const e of globalDefs) byId[e.id] = e;
      for (const e of userDefs) byId[e.id] = e;
      setExerciseDefs(byId);
      if (s && !s.startedAt) {
        const started: WorkoutSession = { ...s, startedAt: new Date().toISOString() };
        await repo.upsertSession(started);
        s = started;
        setSession(started);
      }
      if (s) {
        const focus = findNextPending(s);
        if (focus) { setActiveExerciseIdx(focus.exIdx); setActiveSetIdx(focus.setIdx); }
        else { setActiveSetIdx(null); }
      }
      setLoaded(true);
    };
    // Never hang on "Loading…": if the load rejects (transient read error), mark
    // loaded and fall back to the no-session screen instead of an infinite spinner.
    load().catch((e) => { console.warn('workout load failed', e); if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [user]);

  // Soreness check-in: when the active exercise is the first one for a muscle
  // that was trained in an earlier session, ask how sore it got.
  useEffect(() => {
    if (!session || sorenessMuscle) return;
    // Soreness drives volume adjustments in the periodization model — only
    // periodized sessions (microcycleId + non-traditional meso) use it.
    if (!isPeriodizedSession(session, meso)) return;
    const ex = session.exercises[activeExerciseIdx];
    if (!ex) return;
    const muscle = ex.muscle;
    if (session.exercises.findIndex((e) => e.muscle === muscle) !== activeExerciseIdx) return;
    if (!priorMuscles.has(muscle)) return;
    // Maintenance-tier muscles aren't volume-adjusted, so skip their check-in.
    if ((meso?.muscleTiers?.[muscle] ?? 'grow') === 'maintain') return;
    if (sorenessAsked.has(muscle)) return;
    if ((session.soreness ?? []).some((sr) => sr.muscle === muscle)) return;
    setSorenessMuscle(muscle);
  }, [session, activeExerciseIdx, priorMuscles, sorenessAsked, sorenessMuscle, meso]);

  // Ad-hoc workouts have no Today card to structure on beforehand, so offer the
  // structure sheet once when an ad-hoc session is freshly started.
  useEffect(() => {
    if (structureDecided.current || !session) return;
    const noneLogged = !session.exercises.some((ex) => ex.sets.some((s) => s.completed));
    if (session.microcycleId == null && session.exercises.length > 1 && noneLogged) {
      structureDecided.current = true;
      setStructureOpen(true);
    }
  }, [session]);

  const queueSave = (next: WorkoutSession) => {
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      // Observed save: retry transient rejections, surface hard failures in
      // the banner instead of silently dropping the logged set. (While
      // offline the promise simply stays pending — the write is already
      // durable in the local cache and syncs later; that is NOT an error.)
      withRetry(() => getRepository().upsertSession(next))
        .then(() => setSaveError(false))
        .catch((e) => { console.warn('session save failed', e); setSaveError(true); });
    }, 350);
  };

  const pauseWorkout = async () => {
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    if (session) {
      const res = await settleWrite(getRepository().upsertSession(session));
      // A REJECTED save means the pause would lose edits — stay on the page
      // and show the banner. 'pending' (offline) is durable locally; proceed.
      if (res === 'err') { setSaveError(true); return; }
    }
    router.push('/today');
  };

  // Discard an ad-hoc workout the user decided not to do — deletes the session
  // entirely (only offered for ad-hoc sessions, never programmed plan days).
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardWorkout = async () => {
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    if (session) await getRepository().deleteSession(session.id);
    router.push('/today');
  };

  const updateSessionNotes = (notes: string) => {
    if (!session) return;
    const next = { ...session, notes };
    setSession(next); queueSave(next);
  };

  // Day-start override — switch the whole session to straight sets, or back.
  const setStraightSets = (straight: boolean) => {
    if (!session) return;
    const next: WorkoutSession = straight
      ? { ...session, prescribedExercises: session.exercises, exercises: straighten(session.exercises) }
      : { ...session, exercises: session.prescribedExercises ?? session.exercises, prescribedExercises: undefined };
    setSession(next); queueSave(next);
    const focus = findNextPending(next);
    setActiveExerciseIdx(focus?.exIdx ?? 0);
    setActiveSetIdx(focus?.setIdx ?? null);
  };

  const dismissSoreness = () => {
    if (!sorenessMuscle) return;
    setSorenessAsked((prev) => new Set(prev).add(sorenessMuscle));
    setSorenessMuscle(null);
  };

  // Records the soreness rating and applies the chosen volume change to the
  // current week — today's session and the remaining sessions in this micro.
  // `sets` is the tier-aware magnitude (emphasize adds 2, grow adds 1, etc.).
  const resolveSoreness = async (rating: SorenessRating, action: SorenessAction, sets: number) => {
    if (!session || !sorenessMuscle) return;
    const muscle = sorenessMuscle;
    const repo = getRepository();

    const entry: MuscleSoreness = { muscle, rating, collectedAt: new Date().toISOString() };
    let next: WorkoutSession = { ...session, soreness: [...(session.soreness ?? []), entry] };
    if (action !== 'none') {
      next = { ...next, exercises: adjustExercises(next.exercises, muscle, action, sets) };
    }
    setSession(next);
    queueSave(next);

    // 'add' / 'reduce' also ripple to the rest of this training week.
    if ((action === 'add' || action === 'reduce') && micro) {
      try {
        const micSessions = await repo.listSessionsInMicrocycle(micro.id);
        for (const ms of micSessions) {
          if (ms.id === session.id || ms.completed || ms.date <= session.date) continue;
          if (!ms.exercises.some((e) => e.muscle === muscle)) continue;
          await repo.upsertSession({ ...ms, exercises: adjustExercises(ms.exercises, muscle, action, sets) });
        }
      } catch {/* don't block the workout */}
    }

    setSorenessAsked((prev) => new Set(prev).add(muscle));
    setSorenessMuscle(null);

    // 'skip' removed exercises — re-focus on the next pending set.
    if (action === 'skip') {
      const focus = findNextPending(next);
      setActiveExerciseIdx(focus?.exIdx ?? 0);
      setActiveSetIdx(focus?.setIdx ?? null);
    }
  };

  // Per-muscle feedback resolved mid-workout — `fb` is the full merged feedback.
  const resolveMuscleFeedback = (fb: SessionFeedback) => {
    if (!session || !feedbackMuscle) return;
    const next = { ...session, feedback: fb };
    setSession(next);
    queueSave(next);
    setFeedbackAsked((prev) => new Set(prev).add(feedbackMuscle));
    setFeedbackMuscle(null);
  };

  const skipMuscleFeedback = () => {
    if (!feedbackMuscle) return;
    setFeedbackAsked((prev) => new Set(prev).add(feedbackMuscle));
    setFeedbackMuscle(null);
  };

  const updateSet = (exIdx: number, setIdx: number, nextSet: SetEntry) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? nextSet : s)) } : ex,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
  };

  // Phase 1 of logging: mark the set done and surface its "how did it feel?"
  // prompt. Advancing to the next set + starting the rest timer is deferred to
  // setEffort, so nothing moves until the user rates the set.
  const logSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const ex = session.exercises[exIdx]!;
    const current = ex.sets[setIdx]!;
    const committed: SetEntry = { ...current, completed: true };
    const exercises = session.exercises.map((e, i) =>
      i === exIdx ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? committed : s)) } : e,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    setPendingEffort({ exIdx, setIdx });
  };

  // Phase 2: the user rated the just-logged set. Record the effort, nudge the
  // following set, prompt for muscle feedback if the group finished, then
  // advance focus + start the rest timer.
  const setEffort = (exIdx: number, setIdx: number, rpe: SetEntry['rpe']) => {
    if (!session) return;
    const ex = session.exercises[exIdx]!;
    const current = ex.sets[setIdx]!;
    const committed: SetEntry = { ...current, completed: true, rpe };

    // Auto-nudge the very next set in this exercise based on what just happened.
    const nextSetIdx = setIdx + 1;
    const nextRaw = ex.sets[nextSetIdx];
    const updatedSets = ex.sets.map((s, j) => {
      if (j === setIdx) return committed;
      if (j === nextSetIdx && nextRaw && !nextRaw.completed && ex.setStyle !== 'pyramid' && nextRaw.setType !== 'drop') {
        return nudgeNextSet(committed, ex.prescribedRepsLow, ex.prescribedRepsHigh, ex.prescribedRIR, nextRaw, user?.units ?? 'metric', micro?.targetRIR);
      }
      return s;
    });

    const exercises = session.exercises.map((e, i) =>
      i === exIdx ? { ...e, sets: updatedSets } : e,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    setPendingEffort(null);

    // Per-muscle feedback: if this set finished the muscle group, ask for it.
    // Core is excluded — it's a noise-prone signal (everything trains it
    // incidentally) and Brian doesn't want to be asked.
    const justMuscle = ex.muscle;
    if (
      justMuscle !== 'core' &&
      isPeriodizedSession(next, meso) &&
      muscleFinished(next, justMuscle) &&
      !next.feedback?.perMuscle.some((p) => p.muscle === justMuscle) &&
      !feedbackAsked.has(justMuscle) &&
      !feedbackMuscle
    ) {
      setFeedbackMuscle(justMuscle);
    }

    // Advance focus — superset-aware (alternates between paired exercises).
    const focus = nextFocusAfter(next, exIdx, setIdx);

    // Phase-appropriate rest timer — skipped between the two exercises of a
    // superset round, and skipped when nothing is left to do.
    const anyPending = next.exercises.some((e) => e.sets.some((s) => !s.completed));
    const intoSupersetPartner =
      ex.supersetGroup != null && focus != null &&
      next.exercises[focus.exIdx]?.supersetGroup === ex.supersetGroup &&
      focus.setIdx === setIdx;
    if (anyPending && !intoSupersetPartner) {
      const def = exerciseDefs[ex.exerciseId];
      const patterns: MovementPattern[] = def?.patterns ?? [];
      const rest = next.restSeconds
        ?? meso?.restSeconds
        ?? defaultRestSec(meso?.phaseType ?? 'hypertrophy', patterns);
      setRestSec(rest);
    }

    if (focus) {
      setActiveExerciseIdx(focus.exIdx);
      setActiveSetIdx(focus.setIdx);
      if (focus.exIdx !== exIdx) {
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`[data-exercise-idx="${focus.exIdx}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } else {
      setActiveSetIdx(null);
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    }
  };

  // Skip a single set — marks it completed (so focus advances) and tags it
  // with setType:'skip' so stats can filter it out.
  const skipSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, completed: true, setType: 'skip' as const } : s)) }
        : ex,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    const focus = nextFocusAfter(next, exIdx, setIdx);
    if (focus) { setActiveExerciseIdx(focus.exIdx); setActiveSetIdx(focus.setIdx); }
    else { setActiveSetIdx(null); }
  };

  const unlockSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, completed: false } : s)) } : ex,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    // Re-editing the set that was awaiting an effort rating cancels that prompt.
    if (pendingEffort?.exIdx === exIdx && pendingEffort?.setIdx === setIdx) setPendingEffort(null);
    setActiveExerciseIdx(exIdx); setActiveSetIdx(setIdx);
  };

  const swapExercise = async (exIdx: number, newDef: { id: string; name: string; primaryMuscle: any; metric?: ExerciseDefinition['metric'] }) => {
    if (!session) return;
    // Prefill the swapped-in exercise from the user's last performance of IT —
    // otherwise the sets keep the previous exercise's numbers (and the range's
    // low-end reps), which is never what you did on this movement.
    const prior = lastPerf[newDef.id] ?? lastPerfByName[newDef.name.trim().toLowerCase()];
    const lastPrior = prior && prior.length ? prior[prior.length - 1] : undefined;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const sets = ex.sets.map((s, j) => {
        if (s.completed) return s;
        const p = prior?.[j] ?? lastPrior;
        if (!p) return { ...s, weightKg: undefined };
        return { ...s, weightKg: p.weightKg ?? s.weightKg, reps: p.reps ?? s.reps, timeSec: p.timeSec ?? s.timeSec };
      });
      // Carry the new exercise's metric so a bodyweight→loaded swap (or vice
      // versa) shows the right inputs instead of inheriting the old metric.
      return { ...ex, exerciseId: newDef.id, name: newDef.name, muscle: newDef.primaryMuscle, metric: newDef.metric ?? 'weight-reps', swappedFromExerciseId: ex.exerciseId, sets };
    });
    const next = { ...session, exercises };
    setSession(next); queueSave(next); setSwapFor(null);
  };

  const activateSet = (exIdx: number, setIdx: number) => { setActiveExerciseIdx(exIdx); setActiveSetIdx(setIdx); };

  const addSet = (exIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      const newSet: SetEntry = { setIndex: ex.sets.length, weightKg: last?.weightKg, reps: last?.reps, completed: false };
      return { ...ex, sets: [...ex.sets, newSet] };
    });
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
  };

  // Drop the last not-yet-logged set (lower the set count mid-workout). Keeps
  // completed sets and never goes below one set.
  const removeSet = (exIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      const lastPending = [...ex.sets.keys()].reverse().find((j) => !ex.sets[j]!.completed);
      if (lastPending == null) return ex; // every set logged — nothing to trim
      const sets = ex.sets.filter((_, j) => j !== lastPending).map((s, j) => ({ ...s, setIndex: j }));
      return { ...ex, sets };
    });
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    if (activeExerciseIdx === exIdx) {
      const focus = findNextPending(next, { fromExercise: exIdx, fromSet: 0 });
      setActiveSetIdx(focus?.exIdx === exIdx ? focus.setIdx : null);
    }
  };

  // Skip every remaining (un-logged) set in an exercise so the workout can be
  // finished without doing them. Tagged setType:'skip' so stats ignore them.
  const skipRemaining = (exIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: ex.sets.map((s) => (s.completed ? s : { ...s, completed: true, setType: 'skip' as const })) }
        : ex,
    );
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    const focus = findNextPending(next);
    setActiveExerciseIdx(focus?.exIdx ?? exIdx);
    setActiveSetIdx(focus?.setIdx ?? null);
  };

  // Remove an exercise from today's workout entirely. Dissolves an orphaned
  // superset partner. Won't remove the last remaining exercise.
  const removeExercise = (exIdx: number) => {
    if (!session || session.exercises.length <= 1) return;
    const exercises = removeExerciseAt(session.exercises, exIdx);
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    setActiveExerciseIdx((idx) => Math.min(idx, exercises.length - 1));
    setActiveSetIdx(null);
  };

  // Superset two exercises mid-workout. `startSuperset` arms an exercise;
  // `completeSuperset` pairs it with the chosen partner (pairSuperset groups +
  // reorders them adjacent). Focus is recomputed since indices shift.
  const startSuperset = (i: number) => setSupersetFrom((cur) => (cur === i ? null : i));
  const completeSuperset = (j: number) => {
    if (!session || supersetFrom == null || supersetFrom === j) { setSupersetFrom(null); return; }
    const exercises = pairSuperset(session.exercises, supersetFrom, j);
    const next = { ...session, exercises };
    setSession(next); queueSave(next);
    setSupersetFrom(null);
    const focus = findNextPending(next);
    setActiveExerciseIdx(focus?.exIdx ?? 0);
    setActiveSetIdx(focus?.setIdx ?? null);
  };
  const unlinkSuperset = (i: number) => {
    if (!session) return;
    const g = session.exercises[i]?.supersetGroup;
    if (g == null) return;
    const next = { ...session, exercises: unlinkGroup(session.exercises, g) };
    setSession(next); queueSave(next);
  };

  const completion = useMemo(() => {
    if (!session) return { total: 0, done: 0 };
    let total = 0, done = 0;
    for (const ex of session.exercises) {
      total += ex.sets.length;
      done += ex.sets.filter((s) => s.completed).length;
    }
    return { total, done };
  }, [session]);

  // Group consecutive exercises that share a superset group.
  const blocks = useMemo(() => {
    const out: { idxs: number[]; group: number | null }[] = [];
    if (!session) return out;
    let i = 0;
    while (i < session.exercises.length) {
      const g = session.exercises[i]!.supersetGroup ?? null;
      if (g != null) {
        const idxs = [i];
        let j = i + 1;
        while (j < session.exercises.length && session.exercises[j]!.supersetGroup === g) {
          idxs.push(j); j += 1;
        }
        out.push({ idxs, group: g });
        i = j;
      } else {
        out.push({ idxs: [i], group: null });
        i += 1;
      }
    }
    return out;
  }, [session]);

  // Workout finish: collect feedback for any muscle still missing it, then
  // finalize. If every worked muscle already has feedback, finalize straight.
  const requestFinish = () => {
    if (!session) return;
    if (isPeriodizedSession(session, meso) && musclesMissingFeedback(session).length > 0) {
      setFeedbackOpen(true);
    } else {
      finalizeWorkout(session.feedback ?? null);
    }
  };

  const finalizeWorkout = async (feedback: SessionFeedback | null = null) => {
    if (!session) return;
    // Kill any pending debounced save — otherwise a save queued by the last
    // set's effort rating fires ~350ms from now and re-upserts the PRE-final
    // (completed:false) session over the finalized one.
    if (saveDebounce.current) { clearTimeout(saveDebounce.current); saveDebounce.current = null; }
    const repo = getRepository();
    // Sweep every set that was never logged into a skip (completed:true +
    // setType:'skip'), so finishing leaves no pending sets and history shows
    // programmed-but-skipped work. Exercises with zero completed sets stay on
    // the session (all skipped). Stats go through isPerformedSet
    // (lib/session/performedSets) which filters skips, so this is consistent
    // end-to-end.
    const sweptExercises = session.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.completed ? s : { ...s, completed: true, setType: 'skip' as const })),
    }));
    const final: WorkoutSession = {
      ...session,
      exercises: sweptExercises,
      completed: true,
      completedAt: new Date().toISOString(),
      feedback: feedback ?? session.feedback,
    };

    // Plan-advance only runs if we have a meso + micro context. If the session
    // is standalone, just persist + route to the summary.
    let mesoCompletedId: string | null = null;
    if (meso && micro) {
      try {
        const microSessions = await repo.listSessionsInMicrocycle(micro.id);
        const micros = await repo.listMicrocycles(meso.id);
        // planAdvance substitutes `final` for its stored copy itself, so the
        // reads above don't need to see the final write — which lets the
        // finished session and every structural status flip commit in ONE
        // atomic batch. The old sequential writes could fail midway and leave
        // the week advanced while the session doc still said "in progress".
        const patch = planAdvance({ completedSession: final, microSessions, microcycle: micro, micros, mesocycle: meso });
        const microWrites: Microcycle[] = [];
        if (patch.microcycleCompleted) microWrites.push(patch.microcycleCompleted);
        if (patch.microcycleActivated) microWrites.push(patch.microcycleActivated);
        const mesoWrites: Mesocycle[] = [];
        if (patch.mesocycleCompleted) {
          mesoWrites.push(patch.mesocycleCompleted);
          mesoCompletedId = patch.mesocycleCompleted.id;
        } else if (patch.mesocycleWeekIndex != null) {
          mesoWrites.push({ ...meso, weekIndex: patch.mesocycleWeekIndex });
        }
        const cRes = await settleWrite(repo.commitPlanBatch(final.userId, {
          sessions: [final],
          microcycles: microWrites,
          mesocycles: mesoWrites,
        }), 1500);
        if (cRes === 'err') throw new Error('plan batch commit rejected');
        // When the calibration week finishes, estimate e1RM from the logged top
        // sets and seed working weights into the remaining weeks.
        const calIdx = meso.weekKinds?.indexOf('cal') ?? -1;
        if (patch.microcycleCompleted && calIdx >= 0 && patch.microcycleCompleted.weekNumber === calIdx + 1) {
          try { await seedWeightsFromCalibration(repo, patch.mesocycleCompleted ?? meso, patch.microcycleCompleted); }
          catch (e) { console.warn('calibration seed failed', e); }
        }
      } catch (err) {
        // Advance failed — still persist the finished workout so it's never lost.
        console.warn('plan advance failed', err);
        mesoCompletedId = null;
        const r = await settleWrite(repo.upsertSession(final));
        if (r === 'err') { setSaveError(true); return; } // stay here — nothing was saved
      }
    } else {
      const r = await settleWrite(repo.upsertSession(final));
      if (r === 'err') { setSaveError(true); return; }
    }

    setSession(final);
    // Finishing a mesocycle shows its recap; any other finish returns to the
    // full Today screen (the completed session shows there as a card).
    if (mesoCompletedId) router.push(`/plan/recap/${mesoCompletedId}`);
    else router.push('/today');
  };

  if (!user || !loaded) return <div className="p-6 text-ink-dim">Loading…</div>;
  // No session resolved. The load effect also tries to redirect to /today, but
  // this screen has no bottom nav, so always give an explicit way back rather
  // than risk stranding the user.
  if (!session) return (
    <div className="p-6 space-y-4">
      <p className="text-ink-dim">Nothing to work on right now.</p>
      <Button onClick={() => router.replace('/today')}>Back to Today</Button>
    </div>
  );

  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][session.dayOfWeek];
  const isResting = restSec > 0;
  const missingFeedback = musclesMissingFeedback(session);
  const isStraightened = !!session.prescribedExercises;
  const hasSpecialStyles =
    !isStraightened && session.exercises.some((ex) => ex.setStyle != null && ex.setStyle !== 'straight');
  const canToggleStyles = completion.done === 0 && (isStraightened || hasSpecialStyles);

  // Resolve prior performance for an exercise: exact id, then the id it was
  // swapped from, then a normalized-name match.
  const priorFor = (ex: ExerciseEntry): SetEntry[] | undefined =>
    lastPerf[ex.exerciseId]
    ?? (ex.swappedFromExerciseId ? lastPerf[ex.swappedFromExerciseId] : undefined)
    ?? lastPerfByName[ex.name.trim().toLowerCase()];

  const renderCard = (i: number) => {
    const ex = session.exercises[i]!;
    // Stable identity key: remove/soreness-skip/superset-reorder all shift
    // indices, and an index key made per-card state (open ⋮ menu, row errors)
    // jump to a different exercise. Occurrence suffix disambiguates duplicates.
    const occ = session.exercises.slice(0, i).filter((e) => e.exerciseId === ex.exerciseId).length;
    return (
      <ExerciseCard
        key={`${ex.exerciseId}#${occ}`}
        exercise={ex}
        exerciseIndex={i}
        mode={terminologyMode(user)}
        units={user.units}
        liveMetric={(() => { const d = resolveExerciseDef(exerciseDefs, ex); return d ? (d.metric ?? 'weight-reps') : undefined; })()}
        lastSets={priorFor(ex)}
        activeSetIndex={activeExerciseIdx === i ? activeSetIdx : null}
        awaitingEffortSetIdx={pendingEffort?.exIdx === i ? pendingEffort.setIdx : null}
        disabled={isResting}
        onActivateSet={(s) => activateSet(i, s)}
        onUpdateSet={(s, next) => updateSet(i, s, next)}
        onLogSet={(s) => logSet(i, s)}
        onEffort={(s, rpe) => setEffort(i, s, rpe)}
        onUnlockSet={(s) => unlockSet(i, s)}
        onAddSet={() => addSet(i)}
        onRemoveSet={() => removeSet(i)}
        canRemoveSet={ex.sets.length > 1 && ex.sets.some((s) => !s.completed)}
        onShowHistory={() => setHistoryFor(ex.exerciseId)}
        onSwap={() => setSwapFor(i)}
        onSkip={() => skipRemaining(i)}
        onRemove={() => removeExercise(i)}
        canRemove={session.exercises.length > 1}
        supersetMode={supersetFrom == null ? 'idle' : supersetFrom === i ? 'armed' : 'candidate'}
        supersetPartnerName={supersetFrom != null ? session.exercises[supersetFrom]?.name : undefined}
        onSuperset={() => startSuperset(i)}
        onPairHere={() => completeSuperset(i)}
        onCancelSuperset={() => setSupersetFrom(null)}
        onUnlinkSuperset={ex.supersetGroup != null ? () => unlinkSuperset(i) : undefined}
        onSkipSet={(s) => skipSet(i, s)}
        onStartTimer={(setIdx) => {
          const target = ex.sets[setIdx]?.timeSec ?? ex.prescribedTimeLow ?? 30;
          setExerciseTimerLabel(ex.name);
          setExerciseTimerSec(target);
          setTimerTarget({ exIdx: i, setIdx });
        }}
      />
    );
  };

  return (
    <div className="pb-40">
      <div className="px-4 pt-5 pb-3 border-b border-ink-line">
        <div className="section-head">{micro ? `WEEK ${micro.weekNumber}` : 'WEEK ?'} · {dayName.toUpperCase()}</div>
        <div className="text-xl font-medium leading-tight mt-1">{meso?.name ?? 'Today'}</div>
        <div className="text-xs text-ink-dim mt-0.5 tnum">{completion.done} / {completion.total} sets logged</div>
        <div className="h-1 mt-2 bg-ink-line rounded">
          <div className="h-1 bg-accent rounded transition-all" style={{ width: completion.total ? `${(completion.done / completion.total) * 100}%` : '0%' }} />
        </div>
        {isResting && <div className="mt-2 text-xs text-warn font-medium">⏱ Resting — inputs locked until the timer finishes or you skip.</div>}
        {saveError && (
          <div className="mt-2 text-xs text-danger font-medium">
            ⚠ Some changes couldn&apos;t be saved — check your connection. Logging another set retries automatically.
          </div>
        )}
      </div>

      {canToggleStyles && (
        <div className="px-4 pt-3">
          <div className="card p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-dim">
              {isStraightened
                ? 'Doing straight sets today — the plan\'s set styles are paused.'
                : "Today's plan includes supersets, pyramids or drop sets."}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setStraightSets(!isStraightened)}>
              {isStraightened ? 'Use prescribed styles' : 'Straight sets today'}
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-1">
        <details className="card p-3">
          <summary className="cursor-pointer flex items-center justify-between">
            <span className="section-head">SESSION NOTES</span>
            <span className="text-xs text-ink-mute">{session.notes ? `${session.notes.length} chars` : 'add note'}</span>
          </summary>
          <textarea
            className="mt-2 w-full min-h-[64px] px-3 py-2 rounded-lg bg-bg-input text-ink border border-ink-line focus:border-accent outline-none text-sm"
            placeholder="How you felt today, gym crowded, what to remember…"
            value={session.notes ?? ''}
            onChange={(e) => updateSessionNotes(e.target.value)}
          />
        </details>
      </div>

      <div className="px-4 py-3 space-y-3">
        {blocks.map((block) =>
          block.group != null ? (
            <div
              key={`ss-${block.idxs[0]}`}
              className="rounded-[16px] border border-accent/40 bg-accent/5 p-1.5 space-y-1.5"
            >
              <div className="px-2 pt-1 section-head text-accent">Superset</div>
              {block.idxs.map((i) => renderCard(i))}
            </div>
          ) : (
            renderCard(block.idxs[0]!)
          ),
        )}
      </div>

      <RestTimer seconds={restSec} onDismiss={() => setRestSec(0)} compact soundsEnabled={user?.soundsEnabled !== false} />

      <ExerciseTimer
        seconds={exerciseTimerSec}
        label={exerciseTimerLabel ?? undefined}
        onDismiss={(elapsedSec) => {
          // Pre-fill the held time into the set's time input (user still taps LOG).
          if (timerTarget && elapsedSec > 0 && session) {
            const cur = session.exercises[timerTarget.exIdx]?.sets[timerTarget.setIdx];
            if (cur) updateSet(timerTarget.exIdx, timerTarget.setIdx, { ...cur, timeSec: elapsedSec });
          }
          setExerciseTimerSec(0); setExerciseTimerLabel(null); setTimerTarget(null);
        }}
        soundsEnabled={user?.soundsEnabled !== false}
      />

      <SorenessCheckIn
        key={sorenessMuscle ?? 'none'}
        open={sorenessMuscle !== null}
        muscle={sorenessMuscle}
        tier={(sorenessMuscle && meso?.muscleTiers?.[sorenessMuscle]) || 'grow'}
        onResolve={resolveSoreness}
        onSkip={dismissSoreness}
      />

      {/* Per-muscle feedback — opens when a muscle group is finished mid-workout. */}
      <SessionFeedbackModal
        key={feedbackMuscle ?? 'pm-none'}
        open={feedbackMuscle !== null}
        session={session}
        muscles={feedbackMuscle ? [feedbackMuscle] : []}
        existing={session.feedback ?? null}
        onCancel={skipMuscleFeedback}
        onSave={resolveMuscleFeedback}
      />

      {/* Final feedback — collects any muscle skipped during the workout. */}
      <SessionFeedbackModal
        key="final-feedback"
        open={feedbackOpen}
        session={session}
        muscles={missingFeedback}
        existing={session.feedback ?? null}
        onCancel={() => { setFeedbackOpen(false); finalizeWorkout(session.feedback ?? null); }}
        onSave={(fb) => { setFeedbackOpen(false); finalizeWorkout(fb); }}
      />

      <ExerciseHistorySheet exerciseId={historyFor ?? ''} open={historyFor !== null} onClose={() => setHistoryFor(null)} />

      <SwapExerciseModal
        equipmentProfileId={meso?.equipmentProfileId}
        open={swapFor !== null}
        fromExerciseId={swapFor != null ? session.exercises[swapFor]?.exerciseId ?? '' : ''}
        onClose={() => setSwapFor(null)}
        onPick={(def) => { if (swapFor != null) swapExercise(swapFor, def); }}
      />

      {structureOpen && session && (
        <StructureSheet
          exercises={session.exercises}
          allowed={meso?.allowedSetTypes ?? []}
          onCancel={() => setStructureOpen(false)}
          onStart={(exs) => {
            const next = { ...session, exercises: exs };
            setSession(next); queueSave(next); setStructureOpen(false);
            const focus = findNextPending(next);
            setActiveExerciseIdx(focus?.exIdx ?? 0);
            setActiveSetIdx(focus?.setIdx ?? null);
          }}
        />
      )}

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setConfirmDiscard(false)}>
          <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-ink-line p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">Discard this workout?</div>
            <p className="text-sm text-ink-dim mt-1.5">It will be removed and won't be saved to your history.</p>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>Keep going</Button>
              <Button onClick={discardWorkout} className="bg-danger border-danger text-white">Discard</Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-ink-line z-20">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          <Button variant="ghost" onClick={pauseWorkout}>Pause Workout</Button>
          {!session.microcycleId && (
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)} className="text-danger">Discard</Button>
          )}
          <div className="flex-1" />
          <Button onClick={requestFinish} disabled={completion.done === 0} className={completion.done === completion.total ? 'animate-pulseRed shadow-glow' : ''}>
            {completion.done === completion.total ? 'Finish workout' : `Finish (${completion.done}/${completion.total})`}
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

/**
 * Apply a soreness-driven volume change to a session's exercise list.
 * `count` is the number of sets to add / remove per matching exercise — it
 * carries the tier-aware magnitude (emphasized muscles add two, etc.).
 */
function adjustExercises(
  exercises: ExerciseEntry[],
  muscle: MuscleGroup,
  action: SorenessAction,
  count: number,
): ExerciseEntry[] {
  if (action === 'none') return exercises;
  if (action === 'skip') {
    // Drop the muscle's exercises that have not been started yet.
    return exercises.filter((ex) => ex.muscle !== muscle || ex.sets.some((s) => s.completed));
  }
  return exercises.map((ex) => {
    if (ex.muscle !== muscle) return ex;
    if (action === 'add') {
      const sets: SetEntry[] = [...ex.sets];
      for (let k = 0; k < count; k++) {
        const last = sets[sets.length - 1];
        sets.push({ setIndex: sets.length, weightKg: last?.weightKg, reps: last?.reps, completed: false });
      }
      return { ...ex, sets, prescribedSets: sets.length };
    }
    // reduce — drop up to `count` not-yet-completed sets, never below one set.
    let sets: SetEntry[] = [...ex.sets];
    for (let k = 0; k < count; k++) {
      if (sets.length <= 1) break;
      let removeIdx = -1;
      for (let i = sets.length - 1; i >= 0; i--) {
        if (!sets[i]!.completed) { removeIdx = i; break; }
      }
      if (removeIdx === -1) break;
      sets = sets.filter((_, i) => i !== removeIdx);
    }
    sets = sets.map((s, i) => ({ ...s, setIndex: i }));
    return { ...ex, sets, prescribedSets: sets.length };
  });
}

/** True when every exercise for `muscle` has all its sets completed. */
function muscleFinished(session: WorkoutSession, muscle: MuscleGroup): boolean {
  const exs = session.exercises.filter((e) => e.muscle === muscle);
  if (exs.length === 0) return false;
  let anyCompleted = false;
  for (const ex of exs) {
    for (const s of ex.sets) {
      if (s.completed) anyCompleted = true;
      else return false;
    }
  }
  return anyCompleted;
}

/** Muscles with at least one completed set this session.
 *  Core is intentionally excluded — feedback prompts skip it. */
function workedMuscles(session: WorkoutSession): MuscleGroup[] {
  const seen = new Set<MuscleGroup>();
  for (const ex of session.exercises) {
    if (ex.muscle === 'core') continue;
    // A muscle counts as worked only with a genuinely logged set — a skipped
    // set is completed:true but setType:'skip', so it must not count.
    if (ex.sets.some((s) => s.completed && s.setType !== 'skip')) seen.add(ex.muscle);
  }
  return [...seen];
}

/** Worked muscles that do not yet have feedback recorded. */
function musclesMissingFeedback(session: WorkoutSession): MuscleGroup[] {
  const have = new Set((session.feedback?.perMuscle ?? []).map((p) => p.muscle));
  return workedMuscles(session).filter((m) => !have.has(m));
}

function findNextPending(
  session: WorkoutSession,
  start: { fromExercise: number; fromSet: number } = { fromExercise: 0, fromSet: 0 },
): { exIdx: number; setIdx: number } | null {
  for (let i = start.fromExercise; i < session.exercises.length; i++) {
    const ex = session.exercises[i]!;
    const startSet = i === start.fromExercise ? start.fromSet : 0;
    for (let j = startSet; j < ex.sets.length; j++) {
      if (!ex.sets[j]!.completed) return { exIdx: i, setIdx: j };
    }
  }
  for (let i = 0; i < session.exercises.length; i++) {
    const ex = session.exercises[i]!;
    for (let j = 0; j < ex.sets.length; j++) {
      if (!ex.sets[j]!.completed) return { exIdx: i, setIdx: j };
    }
  }
  return null;
}

/**
 * The next set to focus after logging (exIdx, setIdx). For a superset, focus
 * alternates between the paired exercises (A1, B1, A2, B2 …); otherwise it is
 * the plain next pending set.
 */
function nextFocusAfter(
  session: WorkoutSession,
  exIdx: number,
  setIdx: number,
): { exIdx: number; setIdx: number } | null {
  const group = session.exercises[exIdx]?.supersetGroup;
  if (group != null) {
    const gIdxs = session.exercises
      .map((e, i) => (e.supersetGroup === group ? i : -1))
      .filter((i) => i >= 0);
    const pos = gIdxs.indexOf(exIdx);
    const maxSets = Math.max(...gIdxs.map((i) => session.exercises[i]!.sets.length));
    let s = setIdx;
    let p = pos + 1;
    while (s < maxSets) {
      while (p < gIdxs.length) {
        const ei = gIdxs[p]!;
        const set = session.exercises[ei]!.sets[s];
        if (set && !set.completed) return { exIdx: ei, setIdx: s };
        p += 1;
      }
      p = 0;
      s += 1;
    }
    const lastIdx = gIdxs[gIdxs.length - 1]!;
    return findNextPending(session, { fromExercise: lastIdx + 1, fromSet: 0 });
  }
  return findNextPending(session, { fromExercise: exIdx, fromSet: setIdx + 1 });
}

/**
 * Converts an exercise list to plain straight sets — un-pairs supersets, drops
 * the drop-set rows, and flattens pyramid steps. Used by the day-start override.
 */
function straighten(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map((ex) => {
    let sets = ex.sets;
    if (ex.setStyle === 'drop') {
      sets = sets.filter((set) => set.setType !== 'drop').map((set, i) => ({ ...set, setIndex: i }));
    }
    if (ex.setStyle === 'pyramid') {
      const base = sets[0]?.weightKg;
      sets = sets.map((set) => ({ ...set, weightKg: base, reps: ex.prescribedRepsLow ?? set.reps }));
    }
    return { ...ex, setStyle: 'straight' as const, supersetGroup: undefined, sets };
  });
}
