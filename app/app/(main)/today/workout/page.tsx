'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button } from '@/components/ui';
import { ExerciseCard, RestTimer, ExerciseTimer, ExerciseHistorySheet, SwapExerciseModal, SessionFeedbackModal, SorenessCheckIn } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { resolveToday } from '@/lib/session/resolveToday';
import { hydrateFromHistory } from '@/lib/session/hydrateFromHistory';
import { nudgeNextSet } from '@/lib/session/nextSetNudge';
import { planAdvance } from '@/lib/session/advance';
import { defaultRestSec, terminologyMode, isPeriodizedSession } from '@/lib/periodization';
import type { WorkoutSession, SetEntry, ExerciseEntry, SessionFeedback, Mesocycle, Microcycle, ExerciseDefinition, MovementPattern, MuscleGroup, SorenessRating, MuscleSoreness } from '@/types';
import { todayIso } from '@/lib/ui/date';


// todayIso() now imported from @/lib/ui/date — keeps the stamp in the user's local timezone.

type SorenessAction = 'add' | 'reduce' | 'skip' | 'none';

export default function WorkoutPage() {
  const router = useRouter();
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number>(0);
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(0);
  const [restSec, setRestSec] = useState(0);
  // Exercise-timer overlay (time-based sets). 0 = closed.
  const [exerciseTimerSec, setExerciseTimerSec] = useState(0);
  const [exerciseTimerLabel, setExerciseTimerLabel] = useState<string | null>(null);
  const [exerciseDefs, setExerciseDefs] = useState<Record<string, ExerciseDefinition>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [priorMuscles, setPriorMuscles] = useState<Set<MuscleGroup>>(new Set());
  const [sorenessAsked, setSorenessAsked] = useState<Set<MuscleGroup>>(new Set());
  const [sorenessMuscle, setSorenessMuscle] = useState<MuscleGroup | null>(null);
  // Per-muscle feedback: collected as each muscle group is finished.
  const [feedbackMuscle, setFeedbackMuscle] = useState<MuscleGroup | null>(null);
  const [feedbackAsked, setFeedbackAsked] = useState<Set<MuscleGroup>>(new Set());
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const repo = getRepository();
      const res = await resolveToday(repo, user.userId, todayIso());
      let s = res.session;
      if (s) {
        const prior = await repo.listSessions(user.userId, { limit: 100 });
        const hydrated = hydrateFromHistory(s, prior);
        if (hydrated !== s) { await repo.upsertSession(hydrated); s = hydrated; }
        // Muscles trained in any earlier session — they get a soreness check-in.
        const trained = new Set<MuscleGroup>();
        for (const ps of prior) {
          if (ps.id === s.id) continue;
          for (const ex of ps.exercises) trained.add(ex.muscle);
        }
        setPriorMuscles(trained);
      }
      setSession(s);
      setMeso(res.mesocycle);
      setMicro(res.microcycle);
      const defs = await repo.listGlobalExercises();
      const byId: Record<string, ExerciseDefinition> = {};
      for (const e of defs) byId[e.id] = e;
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
    };
    load();
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

  const queueSave = (next: WorkoutSession) => {
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => { getRepository().upsertSession(next); }, 350);
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

  const logSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const ex = session.exercises[exIdx]!;
    const current = ex.sets[setIdx]!;
    const committed: SetEntry = { ...current, completed: true };

    // Auto-nudge the very next set in this exercise based on what just happened.
    const nextSetIdx = setIdx + 1;
    const nextRaw    = ex.sets[nextSetIdx];

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

    // Per-muscle feedback: if this set finished the muscle group, ask for it.
    // Pump/volume/pain feedback only drives the periodization model — ad-hoc
    // and traditional sessions don't use it, so we don't prompt for it there.
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
      // Rest precedence: explicit session rest (single-workout templates) →
      // meso wizard setting → phase + movement default. Ad-hoc sessions
      // without any rest hint fall through to the phase default for
      // 'hypertrophy' which is sensible for most lifts.
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
    setActiveExerciseIdx(exIdx); setActiveSetIdx(setIdx);
  };

  const swapExercise = async (exIdx: number, newDef: { id: string; name: string; primaryMuscle: any }) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i === exIdx ? { ...ex, exerciseId: newDef.id, name: newDef.name, muscle: newDef.primaryMuscle, swappedFromExerciseId: ex.exerciseId } : ex,
    );
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
    const repo = getRepository();
    const final: WorkoutSession = {
      ...session,
      completed: true,
      completedAt: new Date().toISOString(),
      feedback: feedback ?? session.feedback,
    };
    await repo.upsertSession(final);

    // Plan-advance only runs if we have a meso + micro context. If the session
    // is standalone, just persist + route to the summary.
    let mesoCompletedId: string | null = null;
    if (meso && micro) {
      try {
        const microSessions = await repo.listSessionsInMicrocycle(micro.id);
        const micros = await repo.listMicrocycles(meso.id);
        const patch = planAdvance({ completedSession: final, microSessions, microcycle: micro, micros, mesocycle: meso });
        if (patch.microcycleCompleted) await repo.upsertMicrocycle(patch.microcycleCompleted);
        if (patch.microcycleActivated) await repo.upsertMicrocycle(patch.microcycleActivated);
        if (patch.mesocycleCompleted) {
          await repo.upsertMesocycle(patch.mesocycleCompleted);
          mesoCompletedId = patch.mesocycleCompleted.id;
        }
        if (patch.mesocycleWeekIndex != null) await repo.upsertMesocycle({ ...meso, weekIndex: patch.mesocycleWeekIndex });
      } catch (err) {
        // Don't block the user from completing — log and continue.
        console.warn('plan advance failed', err);
      }
    }

    setSession(final);
    if (mesoCompletedId) router.push(`/plan/recap/${mesoCompletedId}`);
    else router.push(`/history/session/${final.id}`);
  };

  if (!user) return <div className="p-6 text-ink-dim">Loading…</div>;
  if (!session) return <div className="p-6 text-ink-dim">Nothing prescribed right now. Check the Plan tab.</div>;

  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][session.dayOfWeek];
  const isResting = restSec > 0;
  const missingFeedback = musclesMissingFeedback(session);
  const isStraightened = !!session.prescribedExercises;
  const hasSpecialStyles =
    !isStraightened && session.exercises.some((ex) => ex.setStyle != null && ex.setStyle !== 'straight');
  const canToggleStyles = completion.done === 0 && (isStraightened || hasSpecialStyles);

  const renderCard = (i: number) => {
    const ex = session.exercises[i]!;
    return (
      <ExerciseCard
        key={i}
        exercise={ex}
        exerciseIndex={i}
        mode={terminologyMode(user)}
        units={user.units}
        liveMetric={exerciseDefs[ex.exerciseId]?.metric}
        activeSetIndex={activeExerciseIdx === i ? activeSetIdx : null}
        disabled={isResting}
        onActivateSet={(s) => activateSet(i, s)}
        onUpdateSet={(s, next) => updateSet(i, s, next)}
        onLogSet={(s) => logSet(i, s)}
        onUnlockSet={(s) => unlockSet(i, s)}
        onAddSet={() => addSet(i)}
        onShowHistory={() => setHistoryFor(ex.exerciseId)}
        onSwap={() => setSwapFor(i)}
        onSkipSet={(s) => skipSet(i, s)}
        onStartTimer={(setIdx) => {
          const target = ex.sets[setIdx]?.timeSec ?? ex.prescribedTimeLow ?? 30;
          setExerciseTimerLabel(ex.name);
          setExerciseTimerSec(target);
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
        onDismiss={() => { setExerciseTimerSec(0); setExerciseTimerLabel(null); }}
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
        open={swapFor !== null}
        fromExerciseId={swapFor != null ? session.exercises[swapFor]?.exerciseId ?? '' : ''}
        onClose={() => setSwapFor(null)}
        onPick={(def) => { if (swapFor != null) swapExercise(swapFor, def); }}
      />

      <div className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-ink-line z-20">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push('/today')}>Exit</Button>
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
    if (ex.sets.some((s) => s.completed)) seen.add(ex.muscle);
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
