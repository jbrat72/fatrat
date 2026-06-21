'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { SetRow } from '@/components/workout';
import { PageTitle, Card, Button, ModeChip, MuscleBadge, MUSCLE_COLOR } from '@/components/ui';
import { VolumeDashboard } from '@/components/plan/VolumeDashboard';
import { PlanWizardV2 } from '@/components/plan/PlanWizardV2';
import { activateWizardProgram, saveWizardDraft, saveWizardToGallery } from '@/lib/wizard/persist';
import { ChangePlanSheet } from '@/components/plan/ChangePlanSheet';
import { WeekCalendar, CalendarLegend } from '@/components/history';
import { CardioLogModal } from '@/components/today';
import { AdHocWorkoutModal } from '@/components/workout';
import { useRouter } from 'next/navigation';
import { getRepository } from '@/lib/firestore';
import { todayIso } from '@/lib/ui/date';
import { cn } from '@/lib/ui/cn';
import { terminologyMode } from '@/lib/periodization';
import type {
  Mesocycle, Microcycle, WorkoutSession, UserMode,
} from '@/types';

const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function intensityFromRIR(rir: number | undefined): string | null {
  if (rir == null) return null;
  if (rir >= 3) return 'Easy';
  if (rir === 2) return 'Moderate';
  if (rir === 1) return 'Hard';
  return 'Peak';
}

interface AddDayInfo {
  date: string;
  weekNumber: number;
  dayOfWeek: 0|1|2|3|4|5|6;
}

export default function PlanPage() {
  const { user } = useUser();
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micros, setMicros] = useState<Microcycle[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<AddDayInfo | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  // When set, the wizard opens pre-populated with the user's current plan
  // ("Edit this plan" path from the Change Plan sheet).
  const [editName, setEditName] = useState<string | null>(null);
  const [changeSheet, setChangeSheet] = useState(false);
  const [moveSheet, setMoveSheet] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const repo = getRepository();
      const active = await repo.getActivePlan(user.userId);
      setMeso(active);
      if (!active) { setMicros([]); setSessions([]); return; }
      const ms = await repo.listMicrocycles(active.id);
      ms.sort((a, b) => a.weekNumber - b.weekNumber);
      setMicros(ms);
      const ssArr = await Promise.all(ms.map((mi) => repo.listSessionsInMicrocycle(mi.id)));
      setSessions(ssArr.flat());
      const cur = ms.find((mi) => mi.status === 'active') ?? ms[0];
      if (cur) setExpandedWeek(cur.id);
    };
    load();
  }, [user, refreshTick]);

  // Reschedule a missed session onto a different (usually empty) date —
  // updates the session's date + dayOfWeek in place.
  const moveMissedSession = async (sessionId: string, toDate: string) => {
    if (!user) return;
    const sn = sessions.find((x) => x.id === sessionId);
    if (!sn) return;
    const dow = new Date(toDate + 'T00:00:00').getDay() as 0|1|2|3|4|5|6;
    await getRepository().upsertSession({ ...sn, date: toDate, dayOfWeek: dow });
    setMoveSheet(false);
    setAddDay(null);
    setRefreshTick((n) => n + 1);
  };

  if (!user) return null;

  if (!meso) {
    return (
      <div>
        <PageTitle title="Plan" />
        <div className="px-4">
          <Card>
            <div className="section-head mb-2">NO TRAINING PLAN</div>
            <p className="text-ink-dim text-sm mb-4">
              Pick a program to spin up a fresh training plan, or build your own.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link href="/plan/templates"><Button block>Pick a program</Button></Link>
              <Button variant="ghost" onClick={() => { setEditName(null); setWizardOpen(true); }}>Build a custom program</Button>
            </div>
          </Card>
        </div>
{wizardOpen && user && (
          <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
            <PlanWizardV2
              user={user}
              initialName={editName ?? undefined}
              onSaveDraft={async (st, pr, id) => (await saveWizardDraft(st, user, pr, id)).id}
              onClose={() => { setWizardOpen(false); setEditName(null); }}
              onSaveToGallery={async (st, pr) => {
                try { await saveWizardToGallery(st, user, pr); setWizardOpen(false); setEditName(null); setRefreshTick((n) => n + 1); }
                catch (e) { alert('Could not save to gallery: ' + ((e as Error)?.message ?? 'unknown error')); }
              }}
              onComplete={async (st, pr) => {
                try { await activateWizardProgram(st, pr, user); setWizardOpen(false); setEditName(null); setRefreshTick((n) => n + 1); }
                catch (e) { alert('Could not save your program: ' + ((e as Error)?.message ?? 'unknown error')); }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const totalWk   = meso.weeks;
  const todayStr  = todayIso();
  const termMode  = terminologyMode(user);

  // Current week tracks the CALENDAR, not completion — finishing a week early
  // must not jump the plan ahead before the next week's dates arrive.
  const currentWk = meso.startDate
    ? Math.min(Math.max(Math.floor((Date.parse(todayStr) - Date.parse(meso.startDate)) / (7 * 86400000)) + 1, 1), totalWk)
    : meso.weekIndex + 1;

  // Day position within the calendar-current week.
  const displayMicro = micros.find((m) => m.weekNumber === currentWk)
    ?? micros.find((m) => m.status === 'active') ?? null;
  const weekSessions = displayMicro
    ? sessions
        .filter((s) => s.microcycleId === displayMicro.id)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const totalDays = weekSessions.length;
  const todayIdx = weekSessions.findIndex((s) => s.date === todayStr);
  const doneCount = weekSessions.filter((s) => s.completed).length;
  const dayNum = totalDays === 0
    ? 0
    : todayIdx >= 0
      ? todayIdx + 1
      : Math.min(doneCount + 1, totalDays);

  return (
    <div>
      <PageTitle title="Plan" />
      <div className="px-4 space-y-3">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="section-head">CURRENT TRAINING PLAN</div>
              <div className="text-lg font-medium truncate mt-0.5">{meso.name}</div>
              <div className="text-xs text-ink-dim mt-1 tnum">
                Week {currentWk} of {totalWk}
                {totalDays > 0 && <> {'·'} Day {dayNum} of {totalDays}</>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ModeChip mode={user.mode} />
              <Button variant="ghost" size="sm" onClick={() => setChangeSheet(true)}>Change</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="section-head mb-3">TRAINING WEEKS</div>
          <WeekCalendar
            key={meso.id}
            variant="expandable"
            micros={micros}
            sessions={sessions}
            todayIso={todayStr}
            mode={termMode}
            weekStartsOn={user.weekStartsOn ?? 1}
            totalWeeks={meso.weeks}
            onSelectSession={(id) => router.push(`/plan/day/${id}`)}
            onSelectDay={(info) => setAddDay(info)}
          />
          <CalendarLegend className="mt-3" />
        </Card>

        <Card>
          <div className="section-head mb-2">WEEKS</div>
          <ul className="divide-y divide-ink-line">
            {micros.map((m) => {
              const weekSessions = sessions
                .filter((s) => s.microcycleId === m.id)
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date));
              const total = weekSessions.length;
              const completed = weekSessions.filter((s) => s.completed).length;
              const skipped = weekSessions.filter((s) => !s.completed && s.date < todayStr).length;
              const isExpanded = expandedWeek === m.id;
              const isCurrent = m.weekNumber === currentWk;
              const isCompleted = m.status === 'completed';
              const intensity =
                termMode === 'ADVANCED'
                  ? (m.targetRIR != null ? `${m.targetRIR} RIR` : null)
                  : intensityFromRIR(m.targetRIR);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedWeek(isExpanded ? null : m.id)}
                    aria-expanded={isExpanded}
                    className="w-full py-3 flex items-center justify-between text-left hover:bg-bg-elev/40 rounded px-2 -mx-2 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        Week {m.weekNumber}
                        {intensity && (
                          <span className="text-ink-dim font-normal text-sm tnum"> {'·'} {intensity}</span>
                        )}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5 tnum">
                        {isCompleted
                          ? `${completed}/${total} sessions${skipped ? ` · ${skipped} skipped` : ''}`
                          : isCurrent
                            ? `${completed}/${total} done so far`
                            : `${total} sessions scheduled`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <WeekStatusPill status={isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'} />
                      <Chevron open={isExpanded} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="pb-3 pl-3 -mt-1 space-y-2">
                      {weekSessions.length === 0 ? (
                        <p className="text-xs text-ink-dim">No sessions scheduled this week yet.</p>
                      ) : (
                        weekSessions.map((s) => (
                          <WeekSessionRow
                            key={s.id}
                            session={s}
                            mode={termMode}
                            units={user.units}
                            todayStr={todayStr}
                            isOpen={expandedSession === s.id}
                            onToggle={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <VolumeDashboard microcycle={micros.find((m) => m.status === 'active') ?? null} />

        <div className="flex gap-2 pt-1">
          <Link href="/plan/templates" className="flex-1">
            <Button variant="ghost" block>Plan Templates</Button>
          </Link>
          <Link href="/exercises" className="flex-1">
            <Button variant="ghost" block>Exercise Library</Button>
          </Link>
        </div>
      </div>

      <ChangePlanSheet
        open={changeSheet}
        meso={meso}
        micros={micros}
        sessions={sessions}
        onClose={() => setChangeSheet(false)}
        onChanged={() => setRefreshTick((n) => n + 1)}
        onEdit={() => {
          // Edit rebuilds the plan in Plan Wizard v2, seeded with its name.
          // Saving archives the current plan and starts a fresh one.
          setEditName(meso.name);
          setChangeSheet(false);
          setWizardOpen(true);
        }}
      />


      {addDay && !cardioOpen && !adHocOpen && !moveSheet && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setAddDay(null)}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
              <div>
                <div className="section-head">ADD TO THIS DAY</div>
                <div className="text-xs text-ink-dim mt-0.5">
                  {DOW_NAMES[addDay.dayOfWeek]} {'·'} {addDay.date} {'·'} Week {addDay.weekNumber}
                </div>
              </div>
              <button type="button" onClick={() => setAddDay(null)} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">{'✕'}</button>
            </div>
            <div className="px-4 py-4 space-y-2 pb-8">
              <Button block size="lg" onClick={() => setAdHocOpen(true)}>
                Log a workout
              </Button>
              <Button block variant="ghost" size="lg" onClick={() => setCardioOpen(true)}>
                Log cardio
              </Button>
              {(() => {
                const missed = sessions
                  .filter((sn) => !sn.completed && sn.date < todayStr)
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (missed.length === 0) return null;
                return (
                  <Button block variant="ghost" size="lg" onClick={() => setMoveSheet(true)}>
                    Move a missed workout here ({missed.length})
                  </Button>
                );
              })()}
              <p className="text-xs text-ink-mute text-center pt-2">
                Adding extra sessions does not change your program — they show up as logged history.
              </p>
            </div>
          </div>
        </div>
      )}

      {moveSheet && addDay && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setMoveSheet(false)}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between z-10">
              <div>
                <div className="section-head">MOVE A MISSED WORKOUT</div>
                <div className="text-xs text-ink-dim mt-0.5">
                  to {DOW_NAMES[addDay.dayOfWeek]} {'·'} {addDay.date}
                </div>
              </div>
              <button type="button" onClick={() => setMoveSheet(false)} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">{'✕'}</button>
            </div>
            <div className="px-4 py-3 space-y-1.5 pb-8">
              {sessions
                .filter((sn) => !sn.completed && sn.date < todayStr)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((sn) => {
                  const m = micros.find((mm) => mm.id === sn.microcycleId);
                  const ord = sessions
                    .filter((x) => x.microcycleId === sn.microcycleId)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .findIndex((x) => x.id === sn.id) + 1;
                  return (
                    <button
                      key={sn.id}
                      type="button"
                      onClick={() => moveMissedSession(sn.id, addDay.date)}
                      className="w-full text-left card p-3 hover:border-accent transition"
                    >
                      <div className="font-medium text-sm">
                        {m ? `Week ${m.weekNumber}` : 'Session'}{ord ? ` · Day ${ord}` : ''}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5 tnum">
                        Was {DOW_NAMES[sn.dayOfWeek]} {sn.date} {'·'} {sn.exercises.length} exercises
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {addDay && (
        <CardioLogModal
          open={cardioOpen}
          onClose={() => setCardioOpen(false)}
          onSaved={() => { setRefreshTick((n) => n + 1); setAddDay(null); setCardioOpen(false); }}
          dateOverride={addDay.date}
          microcycleId={micros.find((m) => m.weekNumber === addDay.weekNumber)?.id}
          mesocycleId={meso.id}
          planName={meso.name}
        />
      )}

      {addDay && (
        <AdHocWorkoutModal
          open={adHocOpen}
          date={addDay.date}
          onClose={() => setAdHocOpen(false)}
          onSaved={() => { setRefreshTick((n) => n + 1); setAddDay(null); setAdHocOpen(false); }}
          microcycleId={micros.find((m) => m.weekNumber === addDay.weekNumber)?.id}
          mesocycleId={meso.id}
          planName={meso.name}
        />
      )}

{wizardOpen && user && (
          <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
            <PlanWizardV2
              user={user}
              initialName={editName ?? undefined}
              onSaveDraft={async (st, pr, id) => (await saveWizardDraft(st, user, pr, id)).id}
              onClose={() => { setWizardOpen(false); setEditName(null); }}
              onSaveToGallery={async (st, pr) => {
                try { await saveWizardToGallery(st, user, pr); setWizardOpen(false); setEditName(null); setRefreshTick((n) => n + 1); }
                catch (e) { alert('Could not save to gallery: ' + ((e as Error)?.message ?? 'unknown error')); }
              }}
              onComplete={async (st, pr) => {
                try { await activateWizardProgram(st, pr, user); setWizardOpen(false); setEditName(null); setRefreshTick((n) => n + 1); }
                catch (e) { alert('Could not save your program: ' + ((e as Error)?.message ?? 'unknown error')); }
              }}
            />
          </div>
        )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" width="14" height="14" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={cn('text-ink-mute transition-transform', open && 'rotate-180')}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function WeekStatusPill({ status }: { status: 'completed' | 'current' | 'upcoming' }) {
  const cls =
    status === 'completed' ? 'bg-ok/20 text-ok border-ok/40' :
    status === 'current'   ? 'bg-accent/20 text-accent border-accent/50' :
                             'bg-bg-elev/60 text-ink-mute border-ink-line';
  const label =
    status === 'completed' ? '✓ Done' :
    status === 'current'   ? '● Current' :
                             '○ Upcoming';
  return (
    <span className={cn('px-2 py-1 rounded-md text-[11px] font-semibold tracking-wider2 border', cls)}>
      {label}
    </span>
  );
}

function WeekSessionRow({
  session, mode, units, todayStr, isOpen, onToggle,
}: {
  session: WorkoutSession;
  mode: UserMode;
  units: 'metric' | 'imperial';
  todayStr: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dayName = DOW_NAMES[session.dayOfWeek] ?? '';
  const isPast = session.date < todayStr;
  const isToday = session.date === todayStr;
  const status: 'done' | 'skipped' | 'today' | 'upcoming' =
    session.completed ? 'done' : isPast ? 'skipped' : isToday ? 'today' : 'upcoming';
  const exNames = session.exercises.map((e) => e.name);
  const muscles = Array.from(new Set(session.exercises.map((e) => e.muscle))).slice(0, 4);
  const showStart = isToday && !session.completed;

  const dotCls =
    status === 'done'    ? 'bg-ok' :
    status === 'today'   ? 'bg-accent' :
    status === 'skipped' ? 'bg-warn' :
                           'bg-ink-line';

  return (
    <div className={cn('rounded-md border', isToday ? 'border-accent/50' : 'border-ink-line')}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 min-w-0 text-left hover:bg-bg-elev/40 transition px-3 py-2 flex items-start justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-mute tracking-wider2 uppercase">
              {dayName} {'·'} {session.date}
            </div>
            <div className="text-sm font-medium mt-0.5 truncate">
              {exNames.length > 0 ? exNames.join(' · ') : (session.cardio.length > 0 ? 'Cardio' : '—')}
            </div>
            {muscles.length > 0 && (
              <div className="mt-1.5 flex gap-1 flex-wrap">
                {muscles.map((mu) => <MuscleBadge key={mu} muscle={mu} />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <span className={cn('w-2.5 h-2.5 rounded-full', dotCls)} aria-label={status} />
            <Chevron open={isOpen} />
          </div>
        </button>
        {showStart && (
          <div className="flex items-center px-2 border-l border-ink-line">
            <Link href="/today/workout">
              <Button size="sm">{session.startedAt ? 'Continue' : 'Start'}</Button>
            </Link>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-ink-line px-3 py-3 space-y-4 bg-bg-card/40">
          {session.exercises.map((ex, i) => (
            <div key={i} className="border-l-2 pl-3" style={{ borderColor: MUSCLE_COLOR[ex.muscle] ?? '#64748b' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <MuscleBadge muscle={ex.muscle} />
                  <div className="font-medium text-sm mt-1 truncate">{ex.name}</div>
                  <div className="text-[11px] text-ink-dim mt-0.5">
                    {ex.sets.length} {'×'} {(() => {
                      const m = ex.metric ?? 'weight-reps';
                      if (m === 'time' || m === 'weight-time') {
                        return `${ex.prescribedTimeLow ?? '?'}–${ex.prescribedTimeHigh ?? '?'}s`;
                      }
                      return `${ex.prescribedRepsLow ?? '?'}–${ex.prescribedRepsHigh ?? '?'} reps`;
                    })()}
                    {mode === 'ADVANCED' && ex.prescribedRIR != null && ` · ${ex.prescribedRIR} RIR`}
                  </div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {ex.sets.map((s, idx) => (
                  <SetRow key={idx} set={s} index={idx} metric={ex.metric ?? 'weight-reps'} units={units} mode={mode} />
                ))}
              </ul>
              {ex.notes && (
                <div className="mt-2 text-[11px] text-ink-mute italic">&ldquo;{ex.notes}&rdquo;</div>
              )}
            </div>
          ))}


          {session.cardio.length > 0 && (
            <div className="rounded-md border border-ink-line bg-bg-card p-2.5">
              <div className="section-head text-[10px] mb-1.5">CARDIO</div>
              <ul className="space-y-1">
                {session.cardio.map((c, i) => (
                  <li key={i} className="text-[12px] text-ink-dim tnum">
                    {c.activityType} {'·'} {c.durationMin} min
                    {c.distanceKm != null && ` · ${c.distanceKm} km`}
                    {c.avgHR != null && ` · ${c.avgHR} bpm`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.notes && (
            <div className="text-[11px] text-ink-dim italic px-1">&ldquo;{session.notes}&rdquo;</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {showStart && (
              <Link href="/today/workout">
                <Button size="sm">{session.startedAt ? 'Continue workout' : 'Start workout'}</Button>
              </Link>
            )}
            <Link href={`/plan/day/${session.id}`}>
              <Button variant="ghost" size="sm">Open full day {'\u2192'}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
