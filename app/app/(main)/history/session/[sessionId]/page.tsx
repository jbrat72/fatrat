'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, MuscleBadge, BackButton } from '@/components/ui';
import { SessionFeedbackModal, EditableSetTable } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { PUMP_LABEL, VOLUME_LABEL, PAIN_LABEL } from '@/lib/ui/feedback';
import { terminologyMode, effortShort, isPeriodizedSession } from '@/lib/periodization';
import type { WorkoutSession, Mesocycle, Microcycle, SessionFeedback, MuscleGroup, ExerciseEntry, SetEntry } from '@/types';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  /** Exercise index currently in edit mode, or null. */
  const [editIdx, setEditIdx] = useState<number | null>(null);
  /** Draft sets for the exercise being edited. */
  const [draftSets, setDraftSets] = useState<SetEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !sessionId) return;
    const load = async () => {
      const repo = getRepository();
      const s = await repo.getSession(sessionId);
      setSession(s);
      if (s?.mesocycleId)  setMeso(await repo.getMesocycle(s.mesocycleId));
      if (s?.microcycleId) setMicro(await repo.getMicrocycle(s.microcycleId));
    };
    load();
  }, [user, sessionId]);

  const stats = useMemo(() => {
    if (!session) return { sets: 0, reps: 0, volumeKg: 0, byMuscle: [] as { m: string; sets: number }[] };
    let sets = 0, reps = 0, volumeKg = 0;
    const muscleSets = new Map<string, number>();
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (!s.completed) continue;
        sets += 1;
        reps += s.reps ?? 0;
        volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
        muscleSets.set(ex.muscle, (muscleSets.get(ex.muscle) ?? 0) + 1);
      }
    }
    return { sets, reps, volumeKg, byMuscle: [...muscleSets.entries()].map(([m, sets]) => ({ m, sets })) };
  }, [session]);

  // Worked muscles that still need feedback.
  const missingFeedback = useMemo<MuscleGroup[]>(() => {
    if (!session) return [];
    const have = new Set((session.feedback?.perMuscle ?? []).map((p) => p.muscle));
    const worked = new Set<MuscleGroup>();
    for (const ex of session.exercises) {
      if (ex.muscle === 'core') continue; // core never gets feedback
      if (ex.sets.some((s) => s.completed)) worked.add(ex.muscle);
    }
    return [...worked].filter((m) => !have.has(m));
  }, [session]);

  if (!user || !session) return <div className="p-6 text-ink-dim">Loading…</div>;

  const saveFeedback = async (fb: SessionFeedback) => {
    const repo = getRepository();
    const updated = { ...session, feedback: fb };
    await repo.upsertSession(updated);
    setSession(updated);
    setFeedbackOpen(false);
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
    const repo = getRepository();
    const exercises: ExerciseEntry[] = session.exercises.map((ex, i) => (
      i === editIdx ? { ...ex, sets: draftSets } : ex
    ));
    const updated = { ...session, exercises };
    await repo.upsertSession(updated);
    setSession(updated);
    setEditIdx(null);
    setDraftSets([]);
    setSaving(false);
  };

  const units = user.units;
  const dayName = DAYS[session.dayOfWeek];

  return (
    <div className="pb-12">
      <div className="px-4 pt-4">
        <BackButton href="/today" label="Today" />
      </div>
      <div className="px-4 pt-6 pb-3">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workout done!</h1>
        <p className="text-ink-dim mt-1 text-sm">
          {dayName} · {session.date}{meso ? ` · ${meso.name}` : ''}{micro ? ` · Week ${micro.weekNumber}` : ''}
        </p>
      </div>

      <div className="px-4 space-y-3">
        <Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Sets" value={String(stats.sets)} />
            <Stat label="Reps" value={String(stats.reps)} />
            <Stat label="Volume" value={String(Math.round(kgToDisplay(stats.volumeKg, units) ?? 0).toLocaleString())} suffix={weightLabel(units)} />
          </div>
        </Card>

        {stats.byMuscle.length > 0 && (
          <Card>
            <div className="section-head mb-2">MUSCLES TRAINED</div>
            <ul className="space-y-1.5">
              {stats.byMuscle.map((b) => (
                <li key={b.m} className="flex items-center justify-between">
                  <MuscleBadge muscle={b.m as any} />
                  <span className="text-sm text-ink-dim tnum">{b.sets} sets</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <div className="section-head mb-2">EXERCISES</div>
          <ul className="space-y-3">
            {session.exercises.map((ex, i) => {
              const fb = session.feedback?.perMuscle.find((p) => p.muscle === ex.muscle);
              const m = ex.metric ?? 'weight-reps';
              const isEditing = editIdx === i;
              return (
                <li key={i}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="text-sm font-medium truncate flex-1">{ex.name}</div>
                    {isEditing ? (
                      <span className="text-[10px] tracking-wider2 font-semibold text-accent uppercase">Editing</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          className="text-xs text-accent font-medium disabled:opacity-40"
                          disabled={editIdx != null}
                        >
                          Edit
                        </button>
                        <Link href={`/history/exercise/${ex.exerciseId}`} className="text-xs text-accent">Details</Link>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <EditableSetTable
                      sets={draftSets}
                      metric={m}
                      units={units}
                      onChange={setDraftSets}
                    />
                  ) : (
                    <ul className="text-xs text-ink-dim space-y-0.5">
                      {ex.sets.filter((s) => s.completed).map((s, j) => {
                        let body: React.ReactNode;
                        if (s.setType === 'skip') {
                          body = <span className="text-ink-mute">Skipped</span>;
                        } else if (m === 'time') {
                          body = <>{s.timeSec ?? '—'}s</>;
                        } else if (m === 'weight-time') {
                          body = <>{kgToDisplay(s.weightKg, units) ?? '—'} {weightLabel(units)} × {s.timeSec ?? '—'}s</>;
                        } else if (m === 'reps') {
                          body = <>× {s.reps ?? '—'}</>;
                        } else {
                          body = <>{kgToDisplay(s.weightKg, units) ?? '—'} {weightLabel(units)} × {s.reps ?? '—'}</>;
                        }
                        return (
                          <li key={j} className="tnum">
                            {j + 1}: {body}
                            {s.setType !== 'skip' && s.rpe != null && <span className="text-ink-mute"> · {effortShort(terminologyMode(user), s.rpe)}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {isEditing && (
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  )}

                  {!isEditing && fb && (
                    <div className="mt-1.5 pt-1.5 border-t border-ink-line flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                      <span>Pump <span className="text-ink-dim">{PUMP_LABEL[fb.pump]}</span></span>
                      <span>Volume <span className="text-ink-dim">{VOLUME_LABEL[fb.volume]}</span></span>
                      <span>Joint pain <span className="text-ink-dim">{PAIN_LABEL[fb.pain]}</span></span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {missingFeedback.length > 0 && isPeriodizedSession(session, meso) && (
          <Card className="border-accent/40">
            <div className="section-head mb-2 text-accent">FEEDBACK</div>
            <p className="text-sm text-ink-dim mb-3">
              {session.feedback
                ? 'Some muscles still need a check-in — pump, volume, joint pain.'
                : 'Tell us how it felt and we’ll tune your next workout — pump, volume, joint pain.'}
            </p>
            <Button block onClick={() => setFeedbackOpen(true)}>Add feedback</Button>
          </Card>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <Button block size="lg" onClick={() => router.push('/today')}>Back to Today</Button>
        </div>
      </div>

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
      <div className="text-xl font-semibold numeric mt-0.5">
        {value}
        {suffix && <span className="text-ink-dim text-xs font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
