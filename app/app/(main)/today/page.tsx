'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Card, PageTitle, Button, MuscleBadge } from '@/components/ui';
import { BodyWeightCheckIn, CardioLogModal, StreakCard, WorkoutPicker } from '@/components/today';
import { AdHocWorkoutModal } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { resolveToday, type ResolvedToday } from '@/lib/session/resolveToday';
import { todayIso } from '@/lib/ui/date';
import type { ExerciseEntry } from '@/types';

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TodayPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [today, setToday] = useState<ResolvedToday | null>(null);
  const [dayOrdinal, setDayOrdinal] = useState<number | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adHocSeed, setAdHocSeed] = useState<{ entries?: ExerciseEntry[]; label?: string }>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    resolveToday(getRepository(), user.userId, todayIso()).then(setToday);
  }, [user, refreshTick]);

  // Work out which training day of the week this session is (1st, 2nd, 3rd…).
  useEffect(() => {
    const micro = today?.microcycle;
    const session = today?.session;
    if (!micro || !session) { setDayOrdinal(null); return; }
    getRepository().listSessionsInMicrocycle(micro.id).then((ss) => {
      const ordered = [...ss].sort((a, b) => a.date.localeCompare(b.date));
      const idx = ordered.findIndex((s) => s.id === session.id);
      setDayOrdinal(idx >= 0 ? idx + 1 : null);
    });
  }, [today]);

  if (loading) return <div className="p-6 text-ink-dim">Loading…</div>;
  if (!user) {
    return (
      <div className="p-6">
        No user. <Link className="text-accent" href="/onboarding">Start onboarding →</Link>
      </div>
    );
  }

  const session = today?.session;
  const meso = today?.mesocycle;
  const micro = today?.microcycle;
  // The session that the workout button actually starts/continues — only when
  // it's scheduled for today and not finished. Otherwise the button is ad-hoc.
  const todaySession = session && session.date === todayIso() && !session.completed ? session : null;
  const workoutLabel = todaySession
    ? (todaySession.startedAt ? 'Continue Workout' : 'Start Workout')
    : 'Ad-Hoc Workout';

  return (
    <div>
      <PageTitle title="Today" subtitle={`Welcome back, ${user.displayName}.`} />
      <div className="px-4 space-y-3">
        <StreakCard />

        <Card>
          <div className="section-head mb-2">LOG WORKOUT</div>
          <div className="grid grid-cols-5 gap-2">
            {todaySession ? (
              <Link href="/today/workout" className="col-span-3 block">
                <Button block>{workoutLabel}</Button>
              </Link>
            ) : (
              <Button block className="col-span-3" onClick={() => setPickerOpen(true)}>{workoutLabel}</Button>
            )}
            <Button variant="ghost" block className="col-span-2" onClick={() => setCardioOpen(true)}>Log Cardio</Button>
          </div>
        </Card>

        <BodyWeightCheckIn />

        {!session && (
          <Card>
            <div className="section-head mb-2">NO SESSION</div>
            <p className="text-ink-dim text-sm mb-3">
              Nothing prescribed right now. Pick a program from the Plan tab.
            </p>
            <Link href="/plan/templates"><Button block>Pick a program</Button></Link>
          </Card>
        )}

        {session && (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-tight">
                  {micro ? `WEEK ${micro.weekNumber}` : ''}
                  {dayOrdinal ? <span className="text-accent">{` DAY ${dayOrdinal}`}</span> : ''}
                </div>
                {meso?.name && <div className="text-lg font-medium leading-tight mt-0.5">{meso.name}</div>}
                <div className="text-xs text-ink-dim mt-1">{formatLongDate(session.date)}</div>
              </div>
              {session.completed && (
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-ok text-[11px] tracking-wider2 font-semibold uppercase">
                    ✓ Done
                  </span>
                </div>
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {session.exercises.map((ex, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{ex.name}</div>
                    <div className="text-xs text-ink-dim tnum">
                      {ex.sets.length} × {(() => {
                        const m = ex.metric ?? 'weight-reps';
                        if (m === 'time' || m === 'weight-time') {
                          return `${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`;
                        }
                        return `${ex.prescribedRepsLow ?? '?'}–${ex.prescribedRepsHigh ?? '?'}`;
                      })()}
                    </div>
                  </div>
                  <MuscleBadge muscle={ex.muscle} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <CardioLogModal
        open={cardioOpen}
        onClose={() => setCardioOpen(false)}
        onSaved={() => setRefreshTick((n) => n + 1)}
        microcycleId={today?.microcycle?.id}
        mesocycleId={today?.mesocycle?.id}
        macrocycleId={today?.macrocycle?.id}
      />

      <AdHocWorkoutModal
        open={adHocOpen}
        date={todayIso()}
        initialExercises={adHocSeed.entries}
        sourceLabel={adHocSeed.label}
        onClose={() => { setAdHocOpen(false); setAdHocSeed({}); }}
        onSaved={() => { setAdHocOpen(false); setAdHocSeed({}); setRefreshTick((n) => n + 1); }}
        microcycleId={today?.microcycle?.id}
        mesocycleId={today?.mesocycle?.id}
        macrocycleId={today?.macrocycle?.id}
      />

      <WorkoutPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(entries, label) => {
          setAdHocSeed({ entries, label });
          setPickerOpen(false);
          setAdHocOpen(true);
        }}
        onCreateCustom={() => {
          // Route the user into the Single Workouts page in create mode —
          // they get the full naming + category + filter flow there, and
          // their new workout joins the picker library afterwards.
          router.push('/plan/templates/workouts?create=1');
        }}
      />
    </div>
  );
}
