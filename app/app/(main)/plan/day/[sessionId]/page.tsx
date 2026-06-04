'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, MuscleBadge, PageTitle, BackButton } from '@/components/ui';
import { EditableSetTable } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { terminologyMode, usesAdvancedTerminology, effortShort } from '@/lib/periodization';
import type { WorkoutSession, Mesocycle, Microcycle, ExerciseEntry, SetEntry } from '@/types';
import { todayIso } from '@/lib/ui/date';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function DayDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);
  /** Exercise index currently in edit mode, or null. */
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draftSets, setDraftSets] = useState<SetEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !sessionId) return;
    const load = async () => {
      const repo = getRepository();
      const s = await repo.getSession(sessionId);
      setSession(s);
      if (s?.mesocycleId)  setMeso (await repo.getMesocycle(s.mesocycleId));
      if (s?.microcycleId) setMicro(await repo.getMicrocycle(s.microcycleId));
    };
    load();
  }, [user, sessionId]);

  /**
   * Pull a future scheduled session into today. Reschedules in place so the
   * original date becomes an off-day and Today picks the session up.
   */
  const pullToToday = async () => {
    if (!session) return;
    const repo = getRepository();
    const date = todayIso();
    const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const updated = { ...session, date, dayOfWeek: dow };
    await repo.upsertSession(updated);
    setSession(updated);
  };

  if (!user || !session) return <div className="p-6 text-ink-dim">Loading…</div>;

  const units = user.units;
  const dayName = DAYS[session.dayOfWeek];
  const today = todayIso();
  const isToday = session.date === today;
  const wLabel = weightLabel(units);

  const setsTotal = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const setsDone = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);

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

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 flex items-center justify-between gap-3">
        {micro ? (
          <BackButton href={`/plan/meso/${micro.mesocycleId}`} label="Week schedule" />
        ) : (
          <BackButton label="Back" />
        )}
        {session.completed && (
          <span className="inline-flex items-center gap-1.5 text-ok text-[10px] tracking-wider2 font-semibold uppercase">
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l4 4 8-8"/></svg>
            Completed
          </span>
        )}
      </div>
      <PageTitle
        title={`${dayName} · ${session.date}`}
        subtitle={`${meso?.name ?? ''}${micro ? ' · Week ' + micro.weekNumber : ''}`}
      />

      <div className="px-4 space-y-3">
        <Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Exercises" value={String(session.exercises.length)} />
            <Stat label="Sets logged" value={`${setsDone} / ${setsTotal}`} />
            <Stat label="Status" value={session.completed ? 'Done' : (session.startedAt ? 'In progress' : 'Upcoming')} />
          </div>
          {session.notes && (
            <div className="mt-3 pt-3 border-t border-ink-line text-sm text-ink-dim italic">&ldquo;{session.notes}&rdquo;</div>
          )}
          {!session.completed && !session.startedAt && session.date > today && (
            <div className="mt-3 pt-3 border-t border-ink-line">
              <p className="text-xs text-ink-dim mb-2">
                Skipping the originally-scheduled day? Pull this workout to
                today — its original date becomes an off-day.
              </p>
              <Button block size="sm" onClick={pullToToday}>Move to today</Button>
            </div>
          )}
        </Card>

        {session.exercises.map((ex, i) => {
          const m = ex.metric ?? 'weight-reps';
          const isEditing = editIdx === i;
          return (
            <Card key={i} className="p-0 overflow-visible">
              <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <MuscleBadge muscle={ex.muscle} />
                  <div className="font-medium text-base mt-2 truncate">{ex.name}</div>
                  <div className="text-xs text-ink-dim mt-0.5">
                    {ex.sets.length} × {(() => {
                      if (m === 'time' || m === 'weight-time') {
                        return `${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`;
                      }
                      return `${ex.prescribedRepsLow ?? '?'}–${ex.prescribedRepsHigh ?? '?'} reps`;
                    })()}
                    {usesAdvancedTerminology(user) && ex.prescribedRIR != null && ` · ${ex.prescribedRIR} RIR`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <span className="text-[10px] tracking-wider2 font-semibold text-accent uppercase">Editing</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        className="text-xs text-accent font-medium disabled:opacity-40 px-2 h-8"
                        disabled={editIdx != null}
                      >
                        Edit
                      </button>
                      <Link href={`/history/exercise/${ex.exerciseId}`}>
                        <Button variant="ghost" size="sm">History</Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <>
                  <div className="px-3 pb-2">
                    <EditableSetTable
                      sets={draftSets}
                      metric={m}
                      units={units}
                      onChange={setDraftSets}
                    />
                  </div>
                  <div className="px-3 pb-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </>
              ) : (
                <ul className="px-3 pb-3 space-y-1.5">
                  {ex.sets.map((s, idx) => {
                    const display = kgToDisplay(s.weightKg, units);
                    if (s.completed) {
                      let body: React.ReactNode;
                      if (s.setType === 'skip') {
                        body = <span className="text-ink-mute">Skipped</span>;
                      } else if (m === 'time') {
                        body = <>{s.timeSec ?? '—'}s</>;
                      } else if (m === 'weight-time') {
                        body = <>{display ?? '—'} {wLabel} × {s.timeSec ?? '—'}s</>;
                      } else if (m === 'reps') {
                        body = <>× {s.reps ?? '—'}</>;
                      } else {
                        body = <>{display ?? '—'} {wLabel} × {s.reps ?? '—'}</>;
                      }
                      const isSkip = s.setType === 'skip';
                      return (
                        <li key={idx} className="rounded-lg border border-ink-line bg-bg-card px-3 py-2 flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-none ${isSkip ? 'bg-danger/20 text-danger' : 'bg-ok/20 text-ok'}`}>{isSkip ? '✕' : '✓'}</span>
                          <span className="text-sm font-medium">Set {idx + 1}</span>
                          <span className="flex-1 text-sm text-ink-dim numeric truncate">
                            {body}
                            {s.setType !== 'skip' && s.rpe != null && (
                              <span className={`text-ink-mute`}> · {effortShort(terminologyMode(user), s.rpe)}</span>
                            )}
                          </span>
                        </li>
                      );
                    }
                    // Not yet completed — show the prescription preview.
                    let upcoming: React.ReactNode = 'Upcoming';
                    if (m === 'time' || m === 'weight-time') {
                      if (s.timeSec != null) upcoming = `${m === 'weight-time' && display != null ? display + ' ' + wLabel + ' × ' : ''}${s.timeSec}s`;
                    } else if (m === 'reps') {
                      if (s.reps != null) upcoming = `× ${s.reps}`;
                    } else if (display != null) {
                      upcoming = `${display} ${wLabel} × ${s.reps ?? '?'}`;
                    }
                    return (
                      <li key={idx} className="rounded-lg border border-ink-line bg-bg-card/60 px-3 py-2 flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full border border-ink-line flex-none" />
                        <span className="text-sm text-ink-mute">Set {idx + 1}</span>
                        <span className="flex-1 text-sm text-ink-dim numeric truncate">{upcoming}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isEditing && ex.notes && (
                <div className="px-4 pb-3 text-xs text-ink-dim italic">&ldquo;{ex.notes}&rdquo;</div>
              )}
            </Card>
          );
        })}

        {session.cardio.length > 0 && (
          <Card>
            <div className="section-head mb-2">CARDIO</div>
            <ul className="space-y-2">
              {session.cardio.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{c.activityType.replace('-', ' ')}</span>
                  <span className="text-ink-dim tnum">{c.durationMin} min</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-ink-line z-20">
        <div className="mx-auto max-w-md p-3 flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>Back</Button>
          <div className="flex-1" />
          {isToday && !session.completed && (
            <Link href="/today/workout"><Button>{session.startedAt ? 'Continue workout' : 'Start workout'}</Button></Link>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider2 text-ink-mute uppercase">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}
