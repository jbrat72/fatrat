'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { Button, MuscleBadge } from '@/components/ui';
import { EditableSetTable } from './EditableSetTable';
import { SetRow } from './SetRow';
import { SessionFeedbackModal } from './SessionFeedbackModal';
import { SwapExerciseModal } from './SwapExerciseModal';
import { getRepository } from '@/lib/firestore';
import { cardioStats } from '@/lib/ui/cardio';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import { resolveExerciseDef } from '@/lib/exercise/resolveDef';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { PUMP_LABEL, VOLUME_LABEL, PAIN_LABEL } from '@/lib/ui/feedback';
import { terminologyMode, usesAdvancedTerminology, effortShort, isPeriodizedSession } from '@/lib/periodization';
import { todayIso } from '@/lib/ui/date';
import type {
  WorkoutSession, Mesocycle, Microcycle, ExerciseEntry, SetEntry, ExerciseDefinition,
  SessionFeedback, MuscleGroup,
} from '@/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SORENESS_LABEL: Record<number, string> = { 1: 'Never got sore', 2: 'Healed a while ago', 3: 'Healed just on time', 4: 'Still sore' };

interface Props {
  sessionId: string | null;
  onClose: () => void;
  /** Called after any change (edit / feedback / reschedule) so callers refresh. */
  onChanged?: () => void;
  /** When provided, shows an "Add cardio or a workout to this day" action. */
  onAddToDay?: () => void;
}

/**
 * The single session detail + edit surface, shown as a modal. Used from both
 * the History calendar and the Plan schedule (and as the target of the
 * /history/session and /plan/day routes) so there's one implementation.
 */
export function SessionDetailModal({ sessionId, onClose, onChanged, onAddToDay }: Props) {
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);
  const [exDefs, setExDefs] = useState<Record<string, ExerciseDefinition>>({});
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draftSets, setDraftSets] = useState<SetEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId || !user) { setSession(null); return; }
    let cancelled = false;
    (async () => {
      const repo = getRepository();
      const s = await repo.getSession(sessionId);
      if (cancelled) return;
      setSession(s);
      setEditIdx(null);
      const [g, u] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId).catch(() => [] as ExerciseDefinition[]),
      ]);
      if (cancelled) return;
      // Seed from the bundled library first so every exercise id resolves even
      // if the backend's global list is missing newer entries; repo + custom
      // exercises overlay it.
      const byId: Record<string, ExerciseDefinition> = {};
      for (const e of GLOBAL_EXERCISES) byId[e.id] = e;
      for (const e of g) byId[e.id] = e;
      for (const e of u) byId[e.id] = e;
      setExDefs(byId);
      if (s?.mesocycleId) setMeso(await repo.getMesocycle(s.mesocycleId)); else setMeso(null);
      if (s?.microcycleId) setMicro(await repo.getMicrocycle(s.microcycleId)); else setMicro(null);
    })();
    return () => { cancelled = true; };
  }, [sessionId, user]);

  // Resolve metric from the live exercise def so a stale stored metric (e.g.
  // 'reps' from an old swap) doesn't hide the weight field.
  const metricFor = (ex: ExerciseEntry) => {
    // A resolved library def is authoritative — many defs omit `metric` and rely
    // on the 'weight-reps' default, so do NOT fall back to the (possibly stale)
    // stored metric when a def is found.
    const d = resolveExerciseDef(exDefs, ex);
    return d ? (d.metric ?? 'weight-reps') : (ex.metric ?? 'weight-reps');
  };

  const stats = useMemo(() => {
    let sets = 0, total = 0, volumeKg = 0;
    if (session) for (const ex of session.exercises) {
      total += ex.sets.length;
      for (const s of ex.sets) {
        if (!s.completed) continue;
        sets += 1;
        volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
    return { sets, total, volumeKg };
  }, [session]);

  const missingFeedback = useMemo<MuscleGroup[]>(() => {
    if (!session) return [];
    const have = new Set((session.feedback?.perMuscle ?? []).map((p) => p.muscle));
    const worked = new Set<MuscleGroup>();
    for (const ex of session.exercises) {
      if (ex.muscle === 'core') continue;
      if (ex.sets.some((s) => s.completed)) worked.add(ex.muscle);
    }
    return [...worked].filter((m) => !have.has(m));
  }, [session]);

  if (!sessionId || !user || !session) return null;

  const units = user.units;
  const wLabel = weightLabel(units);
  const dayName = DAYS[session.dayOfWeek];
  const today = todayIso();
  const isToday = session.date === today;
  const statusLabel = session.completed ? 'Completed' : session.startedAt ? 'In progress' : 'Upcoming';

  const persist = async (updated: WorkoutSession) => {
    await getRepository().upsertSession(updated);
    setSession(updated);
    onChanged?.();
  };

  const startEdit = (idx: number) => {
    const ex = session.exercises[idx];
    if (!ex) return;
    setDraftSets(ex.sets.map((s) => ({ ...s })));
    setEditIdx(idx);
  };
  const cancelEdit = () => { setEditIdx(null); setDraftSets([]); };
  const saveEdit = async () => {
    if (editIdx == null || saving) return;
    setSaving(true);
    const exercises: ExerciseEntry[] = session.exercises.map((ex, i) =>
      i === editIdx ? { ...ex, metric: metricFor(ex), sets: draftSets } : ex,
    );
    await persist({ ...session, exercises });
    setEditIdx(null);
    setDraftSets([]);
    setSaving(false);
  };
  const doSwap = async (def: ExerciseDefinition) => {
    if (swapIdx == null) return;
    const exercises = session.exercises.map((ex, i) =>
      i === swapIdx
        ? { ...ex, exerciseId: def.id, name: def.name, muscle: def.primaryMuscle, metric: def.metric ?? 'weight-reps', swappedFromExerciseId: ex.exerciseId }
        : ex,
    );
    await persist({ ...session, exercises });
    setSwapIdx(null);
  };
  const saveFeedback = async (fb: SessionFeedback) => {
    await persist({ ...session, feedback: fb });
    setFeedbackOpen(false);
  };
  const moveToToday = async () => {
    const dow = new Date(today + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    await persist({ ...session, date: today, dayOfWeek: dow });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="section-head">{dayName.toUpperCase()} · {session.date}</div>
            <div className="text-xs text-ink-dim mt-0.5">
              {statusLabel}{meso ? ` · ${meso.name}` : ''}{micro ? ` · Week ${micro.weekNumber}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-3 pb-8">
          <div className="card p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Exercises" value={String(session.exercises.length)} />
              <Stat label="Sets" value={`${stats.sets} / ${stats.total}`} />
              <Stat label={session.completed ? 'Volume' : 'Status'} value={session.completed ? String(Math.round(kgToDisplay(stats.volumeKg, units) ?? 0).toLocaleString()) : statusLabel} suffix={session.completed ? wLabel : undefined} />
            </div>
            {session.notes && <div className="mt-3 pt-3 border-t border-ink-line text-sm text-ink-dim italic">&ldquo;{session.notes}&rdquo;</div>}
            {!session.completed && !session.startedAt && session.date > today && (
              <div className="mt-3 pt-3 border-t border-ink-line">
                <p className="text-xs text-ink-dim mb-2">Skipping the scheduled day? Pull this workout to today — its original date becomes an off-day.</p>
                <Button block size="sm" onClick={moveToToday}>Move to today</Button>
              </div>
            )}
            {isToday && !session.completed && (
              <div className="mt-3 pt-3 border-t border-ink-line">
                <Link href="/today/workout" onClick={onClose}><Button block>{session.startedAt ? 'Continue workout' : 'Start workout'}</Button></Link>
              </div>
            )}
          </div>

          {session.exercises.map((ex, i) => {
            const m = metricFor(ex);
            const isEditing = editIdx === i;
            return (
              <div key={i} className="card p-0 overflow-visible">
                <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <MuscleBadge muscle={ex.muscle} />
                    <div className="font-medium text-base mt-2 truncate">{ex.name}</div>
                    <div className="text-xs text-ink-dim mt-0.5">
                      {ex.sets.length} × {(m === 'time' || m === 'weight-time')
                        ? `${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`
                        : `${ex.prescribedRepsLow ?? '?'}–${ex.prescribedRepsHigh ?? '?'} reps`}
                      {usesAdvancedTerminology(user) && ex.prescribedRIR != null && ` · ${ex.prescribedRIR} RIR`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => setSwapIdx(i)} className="text-xs text-accent font-medium px-2 h-8">Swap</button>
                        <span className="text-[10px] tracking-wider2 font-semibold text-accent uppercase">Editing</span>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(i)} className="text-xs text-accent font-medium disabled:opacity-40 px-2 h-8" disabled={editIdx != null}>Edit</button>
                        <Link href={`/history/exercise/${ex.exerciseId}`} onClick={onClose}><Button variant="ghost" size="sm">History</Button></Link>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <>
                    <div className="px-3 pb-2"><EditableSetTable sets={draftSets} metric={m} units={units} onChange={setDraftSets} /></div>
                    <div className="px-3 pb-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                  </>
                ) : (
                  <ul className="px-3 pb-3 space-y-1.5">
                    {ex.sets.map((s, idx) => (
                      <SetRow key={idx} set={s} index={idx} metric={m} units={units} mode={terminologyMode(user)} />
                    ))}
                  </ul>
                )}

                {!isEditing && (() => {
                  const fb = session.feedback?.perMuscle.find((p) => p.muscle === ex.muscle);
                  return fb ? (
                    <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                      <span>Pump <span className="text-ink-dim">{PUMP_LABEL[fb.pump]}</span></span>
                      <span>Volume <span className="text-ink-dim">{VOLUME_LABEL[fb.volume]}</span></span>
                      <span>Joint pain <span className="text-ink-dim">{PAIN_LABEL[fb.pain]}</span></span>
                    </div>
                  ) : null;
                })()}
                {!isEditing && ex.notes && <div className="px-4 pb-3 text-xs text-ink-dim italic">&ldquo;{ex.notes}&rdquo;</div>}
              </div>
            );
          })}

          {session.cardio.length > 0 && (
            <div className="card p-3">
              <div className="section-head mb-2">CARDIO</div>
              <ul className="space-y-2">
                {session.cardio.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="capitalize shrink-0">{c.activityType.replace('-', ' ')}</span>
                    <span className="text-ink-dim tnum text-right">{cardioStats(c, units)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingFeedback.length > 0 && isPeriodizedSession(session, meso) && (
            <div className="card p-3 border-accent/40">
              <div className="section-head mb-2 text-accent">FEEDBACK</div>
              <p className="text-sm text-ink-dim mb-3">{session.feedback ? 'Some muscles still need a check-in — pump, volume, joint pain.' : 'Tell us how it felt and we’ll tune your next workout.'}</p>
              <Button block onClick={() => setFeedbackOpen(true)}>Add feedback</Button>
            </div>
          )}

          {(session.soreness ?? []).length > 0 && (
            <div className="card p-3">
              <div className="section-head mb-2">RECOVERY</div>
              <div className="text-xs text-ink-mute mb-1.5">Soreness reported at the start of this session.</div>
              <ul className="space-y-1 text-sm">
                {(session.soreness ?? []).map((sr, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="capitalize">{sr.muscle}</span>
                    <span className="text-ink-dim">{SORENESS_LABEL[sr.rating]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onAddToDay && (
            <Button block onClick={onAddToDay}>Add cardio or a workout to this day</Button>
          )}
        </div>
      </div>

      <SwapExerciseModal
        open={swapIdx !== null}
        fromExerciseId={swapIdx != null ? session.exercises[swapIdx]?.exerciseId ?? '' : ''}
        equipmentProfileId={meso?.equipmentProfileId}
        onClose={() => setSwapIdx(null)}
        onPick={doSwap}
      />

      <SessionFeedbackModal
        open={feedbackOpen}
        session={session}
        muscles={missingFeedback}
        existing={session.feedback ?? null}
        onCancel={() => setFeedbackOpen(false)}
        onSave={saveFeedback}
      />
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider2 text-ink-mute uppercase">{label}</div>
      <div className="text-base font-semibold numeric mt-0.5">{value}{suffix && <span className="text-ink-dim text-xs font-normal ml-1">{suffix}</span>}</div>
    </div>
  );
}
