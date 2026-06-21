'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Card, PageTitle, Button, MuscleBadge } from '@/components/ui';
import { BodyWeightCheckIn, CardioLogModal, StreakCard, WorkoutPicker, TodayWorkoutCard, StartWorkoutModal } from '@/components/today';
import { getRepository } from '@/lib/firestore';
import { resolveToday, type ResolvedToday } from '@/lib/session/resolveToday';
import { todayIso } from '@/lib/ui/date';
import { withRetry } from '@/lib/util/retry';
import { cardioStats } from '@/lib/ui/cardio';
import type { WorkoutSession, Mesocycle, Microcycle, Units, ExerciseEntry } from '@/types';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  /** Other pending days in the active plan (past + future) — offered under
   *  "Swap with another day" in the Start Workout modal. */
  const [otherDays, setOtherDays] = useState<WorkoutSession[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  /** The earliest pending session dated strictly after today, anywhere in
   *  the user's plan — used to offer "pull this workout into today" when
   *  nothing is pending for today. Null when there's nothing scheduled later. */
  const [nextPending, setNextPending] = useState<WorkoutSession | null>(null);
  /** Most recent missed (past, still-pending) session in the active plan — used
   *  to offer pulling a skipped workout forward into today. */
  const [missed, setMissed] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    if (!user) return;
    withRetry(() => resolveToday(getRepository(), user.userId, todayIso()))
      .then(setToday)
      .catch((e) => console.warn('resolveToday failed', e)); // keep last-good UI
  }, [user, refreshTick]);

  // Find the earliest pending session dated strictly after today, restricted
  // to the user's currently active mesocycle so archived / cancelled plans
  // don't surface a stale workout.
  useEffect(() => {
    if (!user) { setNextPending(null); setMissed(null); setOtherDays([]); return; }
    const activeMesoId = today?.mesocycle?.id ?? null;
    if (!activeMesoId) { setNextPending(null); setMissed(null); setOtherDays([]); return; }
    (async () => {
      const all = await withRetry(() => getRepository().listSessions(user.userId, { limit: 200 })).catch(() => null);
      if (!all) return; // transient read failure — leave existing state intact
      const todayStr = todayIso();
      const future = all
        .filter((s) => !s.completed && s.date > todayStr && s.mesocycleId === activeMesoId)
        .sort((a, b) => a.date.localeCompare(b.date));
      setNextPending(future[0] ?? null);
      // Most recent skipped day (past + still unfinished) in the active plan.
      const past = all
        .filter((s) => !s.completed && s.date < todayStr && s.mesocycleId === activeMesoId)
        .sort((a, b) => a.date.localeCompare(b.date));
      setMissed(past[past.length - 1] ?? null);
      // Any other pending day (not today) — newest-missed first, then upcoming.
      setOtherDays([...past.slice().reverse(), ...future]);
    })();
  }, [user, refreshTick, today?.mesocycle?.id]);

  // Work out which training day of the week the primary session is (1st, 2nd…).
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

  // Save day-of structure edits (supersets / styles) made on the Today card.
  const persistStructure = (s: WorkoutSession, exercises: ExerciseEntry[]) =>
    getRepository().upsertSession({ ...s, exercises });

  // Delete an abandoned ad-hoc session straight from Today.
  const deleteAdHoc = async (id: string) => {
    await getRepository().deleteSession(id);
    setRefreshTick((n) => n + 1);
  };

  /**
   * Pull a scheduled session into today. Updates the session's date +
   * dayOfWeek so Today picks it up and the original date becomes an off-day.
   */
  const pullSessionToToday = async (s: WorkoutSession) => {
    if (!user) return;
    const date = todayIso();
    const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    await getRepository().upsertSession({ ...s, date, dayOfWeek: dow });
    setRefreshTick((n) => n + 1);
  };

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
  const todaySessions = today?.todaySessions ?? [];
  // Pending session on today's date — the Start Workout modal targets it.
  const startable = todaySessions.find((s) => !s.completed) ?? null;

  return (
    <div>
      <PageTitle title="Today" subtitle={`Welcome back, ${user.displayName}.`} />
      <div className="px-4 space-y-3">
        <StreakCard />

        <Card>
          <div className="section-head mb-2">LOG WORKOUT</div>
          <div className="grid grid-cols-5 gap-2">
            <Button block className="col-span-3" onClick={() => setStartOpen(true)}>Start Workout</Button>
            <Button variant="ghost" block className="col-span-2" onClick={() => setCardioOpen(true)}>Log Cardio</Button>
          </div>
        </Card>

        <BodyWeightCheckIn />

        {/* Nothing on today's date and nothing pending in the active micro. */}
        {todaySessions.length === 0 && !session && (
          <Card>
            <div className="section-head mb-2">NO SESSION</div>
            <p className="text-ink-dim text-sm mb-3">
              Nothing prescribed right now. Pick a program from the Plan tab.
            </p>
            <Link href="/plan/templates"><Button block>Pick a program</Button></Link>
          </Card>
        )}

        {/* Every session on today's date — pending ones first, then completed. */}
        {todaySessions
          .slice()
          .sort((a, b) => {
            // Pending before completed; within each, by startedAt asc.
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
          })
          .map((s) => {
            // Only attach the active plan's meso/micro to a session that actually
            // belongs to them — otherwise an ad-hoc (or other-week) session would
            // be mislabeled "Week N · <plan>". Ad-hoc sessions render as ad-hoc.
            const sMicro = micro && s.microcycleId === micro.id ? micro : null;
            const sMeso = meso && s.mesocycleId === meso.id ? meso : null;
            const sDay = sMicro && session?.id === s.id ? dayOrdinal : null;
            return !s.completed && s.id === startable?.id && s.exercises.length > 0 ? (
              <TodayWorkoutCard
                key={s.id}
                session={s}
                meso={sMeso}
                micro={sMicro}
                dayOrdinal={sDay}
                units={user.units}
                allowed={sMeso?.allowedSetTypes ?? []}
                onPersist={(exs) => persistStructure(s, exs)}
              />
            ) : (
              <SessionCard
                key={s.id}
                session={s}
                isPrimary={session?.id === s.id}
                meso={sMeso}
                micro={sMicro}
                dayOrdinal={sDay}
                units={user.units}
                onDelete={deleteAdHoc}
              />
            );
          })}

        {/* Catch-up: a scheduled day was skipped (past + still unfinished).
            Offer to pull that missed workout into today. */}
        {!startable && missed && meso && (
          <Card>
            <div className="section-head mb-1 text-warn">MISSED WORKOUT</div>
            <p className="text-sm text-ink-dim mb-2">
              {meso?.name ? `${meso.name} · ` : ''}{formatLongDate(missed.date)}
            </p>
            <p className="text-xs text-ink-dim mb-3">
              Skipped that day? Move it to today — it becomes today&apos;s
              workout and its original day stays an off-day.
            </p>
            <Button block onClick={() => pullSessionToToday(missed)}>
              Move this workout to today
            </Button>
          </Card>
        )}

        {/* Skip-ahead: nothing pending for today, but a future workout in the
            active plan is scheduled. Offer to pull it forward. Shown alongside
            the missed-workout card so the user can pick either. */}
        {!startable && nextPending && meso && (
          <Card>
            <div className="section-head mb-1">UP NEXT</div>
            <p className="text-sm text-ink-dim mb-2">
              {meso?.name ? `${meso.name} · ` : ''}{formatLongDate(nextPending.date)}
            </p>
            <p className="text-xs text-ink-dim mb-3">
              Can't train then? Pull it into today — its original day becomes
              an off-day.
            </p>
            <Button block onClick={() => pullSessionToToday(nextPending)}>
              Pull this workout into today
            </Button>
          </Card>
        )}
      </div>

      <StartWorkoutModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        hasScheduled={!!startable}
        scheduledLabel={startable?.name || meso?.name || "Today's workout"}
        otherDays={otherDays}
        planName={meso?.name}
        onScheduled={() => router.push('/today/workout')}
        onPullDay={async (s) => { await pullSessionToToday(s); router.push('/today/workout'); }}
        onAdHoc={() => setPickerOpen(true)}
      />

      <CardioLogModal
        open={cardioOpen}
        onClose={() => setCardioOpen(false)}
        onSaved={() => setRefreshTick((n) => n + 1)}
      />

      <WorkoutPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (entries, label, opts) => {
          if (!user) return;
          const repo = getRepository();
          const date = todayIso();
          // Find an existing INCOMPLETE today session to reuse (so picking a
          // workout twice doesn't pile up empty drafts). If every today
          // session is completed, create a new one — the user is starting a
          // second workout on top of today's done one.
          const todays = await withRetry(() => repo.listSessionsOnDate(user.userId, date));
          const reuse = todays.find((s) => !s.completed);
          const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          // Ad-hoc workouts are intentionally NOT attached to the active
          // program's micro/meso so the Today card renders them as standalone
          // "Ad-Hoc Workout" instead of "Week N · Day N" of the program.
          const session: WorkoutSession = {
            id: reuse?.id ?? ('day-' + Math.random().toString(36).slice(2, 9)),
            userId: user.userId,
            name: label,
            date,
            dayOfWeek: dow,
            completed: false,
            startedAt: new Date().toISOString(),
            exercises: entries,
            cardio: reuse?.cardio ?? [],
            restSeconds: opts?.restSeconds,
          };
          await repo.upsertSession(session);
          setPickerOpen(false);
          router.push('/today/workout');
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

/** Single-session card on Today. Shared by programmed, ad-hoc, and
 *  cardio-only sessions. */
function SessionCard({
  session, isPrimary, meso, micro, dayOrdinal, units, onDelete,
}: {
  session: WorkoutSession;
  isPrimary: boolean;
  meso: Mesocycle | null;
  micro: Microcycle | null;
  dayOrdinal: number | null;
  units: Units;
  onDelete?: (id: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isCardioOnly = session.exercises.length === 0 && (session.cardio?.length ?? 0) > 0;
  // Open routes to history when done, /today/workout for a pending session
  // (programmed or ad-hoc; cardio-only completed sessions route to history).
  const openHref = session.completed
    ? `/history/session/${session.id}`
    : '/today/workout';
  return (
    <>
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isCardioOnly ? (
            <>
              <div className="text-lg font-semibold leading-tight">CARDIO</div>
              {session.name && <div className="text-lg font-medium leading-tight mt-0.5">{session.name}</div>}
            </>
          ) : session.microcycleId ? (
            <>
              <div className="text-lg font-semibold leading-tight">
                {micro ? `WEEK ${micro.weekNumber}` : ''}
                {dayOrdinal ? <span className="text-accent">{` DAY ${dayOrdinal}`}</span> : ''}
              </div>
              {meso?.name && <div className="text-lg font-medium leading-tight mt-0.5">{meso.name}</div>}
            </>
          ) : (
            <>
              <div className="text-lg font-semibold leading-tight">AD-HOC WORKOUT</div>
              {session.name && <div className="text-lg font-medium leading-tight mt-0.5">{session.name}</div>}
            </>
          )}
          <div className="text-xs text-ink-dim mt-1">{formatLongDate(session.date)}</div>
        </div>
        {session.completed && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-ok text-[11px] tracking-wider2 font-semibold uppercase">
            ✓ Done
          </span>
        )}
      </div>

      {isCardioOnly ? (
        <ul className="mt-4 space-y-2">
          {session.cardio.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="capitalize shrink-0">{c.activityType.replace('-', ' ')}</span>
              <span className="text-ink-dim tnum text-right">{cardioStats(c, units)}</span>
            </li>
          ))}
        </ul>
      ) : (
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
      )}

      <div className="mt-3 pt-3 border-t border-ink-line flex justify-end gap-2">
        {!session.completed && session.microcycleId && meso?.id && isPrimary && (
          <Link href={`/plan/meso/${meso.id}`}>
            <Button variant="ghost" size="sm">Plan</Button>
          </Link>
        )}
        {!session.completed && !session.microcycleId && onDelete && (
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDel(true)}>Delete</Button>
        )}
        <Link href={openHref}>
          <Button size="sm">Open</Button>
        </Link>
      </div>
    </Card>
    {confirmDel && (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setConfirmDel(false)}>
        <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-ink-line p-5" onClick={(e) => e.stopPropagation()}>
          <div className="text-base font-semibold">Delete this workout?</div>
          <p className="text-sm text-ink-dim mt-1.5">This ad-hoc workout will be removed from today. This can't be undone.</p>
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setConfirmDel(false)}>Keep it</Button>
            <Button onClick={() => { setConfirmDel(false); onDelete?.(session.id); }} className="bg-danger border-danger text-white">Delete</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
