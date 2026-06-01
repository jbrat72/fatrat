'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, MuscleBadge, PageTitle, BackButton } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { terminologyMode, usesAdvancedTerminology, effortShort } from '@/lib/periodization';
import type { WorkoutSession, Mesocycle, Microcycle } from '@/types';
import { todayIso } from '@/lib/ui/date';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function DayDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micro, setMicro] = useState<Microcycle | null>(null);

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

  if (!user || !session) return <div className="p-6 text-ink-dim">Loading…</div>;

  const units = user.units;
  const dayName = DAYS[session.dayOfWeek];
  const today = todayIso();
  const isToday = session.date === today;
  const wLabel = weightLabel(units);

  const setsTotal = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const setsDone = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);

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
        </Card>

        {session.exercises.map((ex, i) => (
          <Card key={i} className="p-0 overflow-visible">
            <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <MuscleBadge muscle={ex.muscle} />
                <div className="font-medium text-base mt-2 truncate">{ex.name}</div>
                <div className="text-xs text-ink-dim mt-0.5">
                  {ex.sets.length} × {ex.prescribedRepsLow ?? '?'}–{ex.prescribedRepsHigh ?? '?'} reps
                  {usesAdvancedTerminology(user) && ex.prescribedRIR != null && ` · ${ex.prescribedRIR} RIR`}
                </div>
              </div>
              <Link href={`/history/exercise/${ex.exerciseId}`}>
                <Button variant="ghost" size="sm">History</Button>
              </Link>
            </div>

            <ul className="px-3 pb-3 space-y-1.5">
              {ex.sets.map((s, idx) => {
                const display = kgToDisplay(s.weightKg, units);
                if (s.completed) {
                  return (
                    <li key={idx} className="rounded-lg border border-ink-line bg-bg-card px-3 py-2 flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-ok/20 text-ok flex items-center justify-center text-[10px] flex-none">✓</span>
                      <span className="text-sm font-medium">Set {idx + 1}</span>
                      <span className="flex-1 text-sm text-ink-dim numeric truncate">
                        {display ?? '—'} {wLabel} × {s.reps ?? '—'}
                        {s.rpe != null && (
                          <span className={`text-ink-mute`}> · {effortShort(terminologyMode(user), s.rpe)}</span>
                        )}
                      </span>
                    </li>
                  );
                }
                // Not yet completed — show the prescription preview
                return (
                  <li key={idx} className="rounded-lg border border-ink-line bg-bg-card/60 px-3 py-2 flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full border border-ink-line flex-none" />
                    <span className="text-sm text-ink-mute">Set {idx + 1}</span>
                    <span className="flex-1 text-sm text-ink-dim numeric truncate">
                      {display != null ? `${display} ${wLabel} × ${s.reps ?? '?'}` : 'Upcoming'}
                    </span>
                  </li>
                );
              })}
            </ul>

            {ex.notes && (
              <div className="px-4 pb-3 text-xs text-ink-dim italic">&ldquo;{ex.notes}&rdquo;</div>
            )}
          </Card>
        ))}

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
