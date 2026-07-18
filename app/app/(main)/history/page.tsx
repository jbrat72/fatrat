'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/app';
import { PageTitle, Card, Button } from '@/components/ui';
import { WeekCalendar, CalendarLegend } from '@/components/history';
import { SessionDetailModal } from '@/components/workout';
import { Sparkline, type SparkPoint } from '@/components/charts';
import { CardioLogModal } from '@/components/today';
import { AdHocWorkoutModal } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { cardioStats } from '@/lib/ui/cardio';
import { formatSetValue } from '@/lib/ui/sets';
import { topSetSeries, e1rmSeries, byExerciseName } from '@/lib/progress';
import { terminologyMode, usesAdvancedTerminology } from '@/lib/periodization';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { cn } from '@/lib/ui/cn';
import type { Mesocycle, Microcycle, WorkoutSession, ExerciseMetric } from '@/types';
import { todayIso } from '@/lib/ui/date';

interface AddDayInfo {
  date: string;
  weekNumber: number;
  dayOfWeek: 0|1|2|3|4|5|6;
}

type ChartMetric = 'weight' | 'reps' | 'time';
type ChartRange = '30d' | '60d' | '90d' | '1y' | 'all';

const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const RANGE_OPTIONS: { value: ChartRange; label: string; days: number | null }[] = [
  { value: '30d', label: 'Past 30 Days', days: 30 },
  { value: '60d', label: 'Past 60 Days', days: 60 },
  { value: '90d', label: 'Past 90 Days', days: 90 },
  { value: '1y',  label: 'Past Year',    days: 365 },
  { value: 'all', label: 'All Time',     days: null },
];

/** ISO date `days` before today (local). */
function isoDaysAgo(days: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function HistoryPage() {
  const { user } = useUser();
  const [allMesos, setAllMesos] = useState<Mesocycle[]>([]);
  const [currentMesoId, setCurrentMesoId] = useState<string | null>(null);
  const [selectedMesoId, setSelectedMesoId] = useState<string>('all');
  const [micros, setMicros] = useState<Microcycle[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('all');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('weight');
  const [chartRange, setChartRange] = useState<ChartRange>('all');
  const [addDay, setAddDay] = useState<AddDayInfo | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const repo = getRepository();
      // (The archived-plan session sweep moved to UserProvider — it now runs
      // once post-sign-in instead of deleting docs on every History mount.)
      const flat = await repo.listMesocycles(user.userId);
      setAllMesos([...flat].sort((a, b) => (b.weekIndex - a.weekIndex)));

      // Exactly one block is "current": the user's active mesocycle. When
      // there is no active plan currentMesoId stays null — we don't fall back
      // to "whatever meso happens to be first", which would mislabel an
      // archived plan as the current one after the user cancelled their program.
      const current = flat.find((m) => m.status === 'active') ?? null;
      setCurrentMesoId(current?.id ?? null);
      // Default 'all' selection — leave selectedMesoId alone; the page now
      // defaults to All blocks (by date) so the user sees their full history.
    };
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every session for the user — the progression chart spans all of them.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getRepository().listSessions(user.userId, { limit: 1000 })
      .then((ss) => { if (!cancelled) setAllSessions(ss); })
      .catch((e) => console.warn('history sessions load failed', e));
    return () => { cancelled = true; };
  }, [user, refreshTick]);

  // Maps weekNumber → source block name when in 'all' mode. The calendar
  // header uses this to show which block each week belonged to.
  const [blockNameByWeek, setBlockNameByWeek] = useState<Map<number, string> | undefined>(undefined);
  const [calendarWeeks, setCalendarWeeks] = useState<{ startDate: string; blockName?: string }[] | undefined>(undefined);
  /** The week currently displayed by WeekCalendar, surfaced via callback. */
  const [viewWeek, setViewWeek] = useState<{ weekNumber: number; startDate: string | null }>({ weekNumber: 1, startDate: null });
  /** Session ids that are currently expanded in the WEEK SESSIONS list. */
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // Calendar data: either a single block, or all blocks concatenated with
  // renumbered weeks (sorted by each micro's earliest session date).
  useEffect(() => {
    if (!user) return;
    // Cancellation: switching blocks fires this per selection; without the
    // guard a slow fetch for block A could land after block B's and render
    // the wrong block's rows under the new header.
    let cancelled = false;
    const load = async () => {
      const repo = getRepository();
      if (selectedMesoId !== 'all') {
        if (!selectedMesoId) {
          setMicros([]); setSessions([]); setBlockNameByWeek(undefined); setCalendarWeeks(undefined); return;
        }
        const ms = await repo.listMicrocycles(selectedMesoId);
        if (cancelled) return;
        ms.sort((a, b) => a.weekNumber - b.weekNumber);
        // One query for the whole block (was one query per week).
        const ss = await repo.listSessionsForMeso(selectedMesoId);
        if (cancelled) return;
        setMicros(ms);
        setSessions(ss);
        setBlockNameByWeek(undefined);
        setCalendarWeeks(undefined);
        return;
      }
      // 'all' mode — bucket every session into calendar weeks (Mon-Sun, or
      // whatever weekStartsOn says), then build a chronological list of
      // active weeks. Each week's blockName is the most-common parent meso
      // among its sessions. The calendar's date-organized mode then merges
      // sessions from multiple blocks that overlap the same calendar week.
      const mesos = await repo.listMesocycles(user.userId);
      const mesoNameById = new Map(mesos.map((m) => [m.id, m.name] as const));
      const all = await repo.listSessions(user.userId, { limit: 1000 });
      if (cancelled) return;
      const weekStart = user.weekStartsOn ?? 1;
      const startOfWeekIso = (iso: string): string => {
        const d = new Date(iso + 'T00:00:00');
        const dow = d.getDay();
        const back = (dow - weekStart + 7) % 7;
        d.setDate(d.getDate() - back);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      // Bucket sessions by their week's start date.
      const sessionsByWeekStart = new Map<string, WorkoutSession[]>();
      for (const sess of all) {
        const wkStart = startOfWeekIso(sess.date);
        const arr = sessionsByWeekStart.get(wkStart) ?? [];
        arr.push(sess);
        sessionsByWeekStart.set(wkStart, arr);
      }
      const weeksSorted = [...sessionsByWeekStart.keys()].sort();
      const nameByWeek = new Map<number, string>();
      const calWeeks: { startDate: string; blockName?: string }[] = [];
      weeksSorted.forEach((wkStart, i) => {
        const wkSessions = sessionsByWeekStart.get(wkStart)!;
        // Pick the dominant block: the meso that accounts for the most
        // sessions in this week. Ties broken by first-seen.
        const tallies = new Map<string, number>();
        for (const ss of wkSessions) {
          const mid = ss.mesocycleId;
          if (!mid) continue;
          tallies.set(mid, (tallies.get(mid) ?? 0) + 1);
        }
        let topMesoId: string | undefined;
        let topCount = -1;
        for (const [mid, n] of tallies) {
          if (n > topCount) { topCount = n; topMesoId = mid; }
        }
        const blockName = topMesoId ? mesoNameById.get(topMesoId) : undefined;
        if (blockName) nameByWeek.set(i + 1, blockName);
        calWeeks.push({ startDate: wkStart, blockName });
      });
      setMicros([]);  // not used in date-organized mode
      setSessions(all);
      setBlockNameByWeek(nameByWeek);
      setCalendarWeeks(calWeeks);
    };
    load().catch((e) => console.warn('history calendar load failed', e));
    return () => { cancelled = true; };
  }, [selectedMesoId, refreshTick, user]);

  // Sessions feeding the progression chart, narrowed to the chosen date range.
  const chartSessions = useMemo(() => {
    // Progression reflects finished workouts only — a pending/unfinished
    // session's sets must not appear in the chart or the exercise dropdown.
    const finished = allSessions.filter((s) => s.completed);
    const opt = RANGE_OPTIONS.find((o) => o.value === chartRange);
    if (!opt || opt.days == null) return finished;
    const cutoff = isoDaysAgo(opt.days);
    return finished.filter((s) => s.date >= cutoff);
  }, [allSessions, chartRange]);

  const exerciseOptions = useMemo(() => {
    // Consolidate by normalized name so the same exercise logged under drifted
    // ids shows once — the chart series matches by name to mirror this.
    const map = new Map<string, string>(); // normalized name -> display name
    for (const s of chartSessions) {
      for (const ex of s.exercises) {
        const key = ex.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, ex.name);
      }
    }
    return [...map.values()].map((name) => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [chartSessions]);

  // Default to the first exercise; also re-anchor when the range changes and the
  // current selection is no longer present.
  useEffect(() => {
    if (exerciseOptions.length === 0) return;
    if (!exerciseOptions.some((e) => e.id === selectedExerciseId)) {
      setSelectedExerciseId(exerciseOptions[0]!.id);
    }
  }, [exerciseOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdvanced = !!user && usesAdvancedTerminology(user);

  // The metric of the selected exercise (weight-reps / reps / time / weight-time),
  // read from its logged sessions. Drives which axes the chart can show.
  const selectedMetric: ExerciseMetric = useMemo(() => {
    if (selectedExerciseId === 'all') return 'weight-reps';
    const matcher = byExerciseName(selectedExerciseId);
    for (const s of chartSessions) {
      const ex = s.exercises.find(matcher);
      if (ex) return ex.metric ?? 'weight-reps';
    }
    return 'weight-reps';
  }, [selectedExerciseId, chartSessions]);

  // Which toggle options apply to this exercise's metric.
  const availableMetrics: ChartMetric[] = useMemo(() => {
    switch (selectedMetric) {
      case 'reps': return ['reps'];
      case 'time': return ['time'];
      case 'weight-time': return ['weight', 'time'];
      default: return ['weight', 'reps'];
    }
  }, [selectedMetric]);

  // Keep the selected metric valid when switching to an exercise that doesn't
  // support it (e.g. from a barbell lift to a plank).
  useEffect(() => {
    if (!availableMetrics.includes(chartMetric)) setChartMetric(availableMetrics[0]!);
  }, [availableMetrics]); // eslint-disable-line react-hooks/exhaustive-deps

  // e1RM only applies to weighted rep work, and only for advanced users.
  const showE1rm = chartMetric === 'weight' && isAdvanced && selectedMetric === 'weight-reps';

  const chartData: SparkPoint[] = useMemo(() => {
    if (selectedExerciseId === 'all' || !user) return [];
    // selectedExerciseId holds the exercise's display name; match by name so
    // id-drifted variants of the same exercise are combined.
    const matcher = byExerciseName(selectedExerciseId);
    const series = showE1rm ? e1rmSeries(chartSessions, matcher) : topSetSeries(chartSessions, matcher);
    return series.map((p) => {
      if (chartMetric === 'reps') {
        return {
          x: p.date,
          y: p.reps ?? 0,
          isPR: p.isPR,
          label: `${p.date} · ${p.reps ?? 0} reps${p.weightKg != null ? ` @ ${kgToDisplay(p.weightKg, user.units)} ${weightLabel(user.units)}` : ''}`,
        };
      }
      if (chartMetric === 'time') {
        return {
          x: p.date,
          y: p.timeSec ?? 0,
          isPR: p.isPR,
          label: `${p.date} · ${p.timeSec ?? 0}s${p.weightKg != null ? ` @ ${kgToDisplay(p.weightKg, user.units)} ${weightLabel(user.units)}` : ''}`,
        };
      }
      // weight (or e1RM, which already stores its estimate in value)
      const w = showE1rm ? p.value : (p.weightKg ?? 0);
      return {
        x: p.date,
        y: kgToDisplay(w, user.units) ?? 0,
        y2: isAdvanced ? p.rpe : undefined,
        isPR: p.isPR,
        label: `${p.date} · ${kgToDisplay(w, user.units)} ${weightLabel(user.units)}${p.reps != null ? ` × ${p.reps}` : ''}${p.rpe != null ? ` @ RPE ${p.rpe}` : ''}`,
      };
    });
  }, [selectedExerciseId, chartMetric, chartSessions, user, isAdvanced, showE1rm]);

  if (!user) return null;

  const selectedMeso = selectedMesoId === 'all' ? null : (allMesos.find((m) => m.id === selectedMesoId) ?? null);
  const metricTabLabel = (m: ChartMetric) =>
    m === 'reps' ? 'Reps'
    : m === 'time' ? 'Time'
    : (isAdvanced && selectedMetric === 'weight-reps') ? 'e1RM' : 'Weight';
  const chartYLabel =
    chartMetric === 'reps' ? 'Top-set reps'
    : chartMetric === 'time' ? 'Top-set time (s)'
    : showE1rm ? `e1RM (${weightLabel(user.units)})`
    : `Top set (${weightLabel(user.units)})`;

  return (
    <div>
      <PageTitle title="History" subtitle={selectedMesoId === 'all' ? 'Every workout, sorted by date.' : 'Every session in this training block.'} />
      <div className="px-4 space-y-3">
        {allMesos.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="section-head mb-1">BLOCK</div>
                <select
                  value={selectedMesoId ?? 'all'}
                  onChange={(e) => setSelectedMesoId(e.target.value)}
                  className="w-full h-10 px-2 rounded-lg bg-bg-input border border-ink-line text-ink text-sm font-medium"
                >
                  <option value="all">All blocks (by date)</option>
                  {allMesos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.id === currentMesoId ? ' · current' : m.status === 'completed' ? ' · done' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedMeso && (
                <div className="text-right text-xs text-ink-dim tnum">
                  <div>{selectedMeso.weeks}-wk · {selectedMeso.phaseType}</div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="section-head mb-3">TRAINING WEEKS</div>
          <WeekCalendar
            key={selectedMesoId ?? 'none'}
            micros={micros}
            isCurrent={selectedMesoId === 'all' || (selectedMesoId === currentMesoId && currentMesoId != null)}
            sessions={sessions}
            extraCompletedSessions={selectedMesoId === 'all' ? [] : allSessions.filter(
              (s) => s.completed && s.mesocycleId !== selectedMesoId,
            )}
            todayIso={todayIso()}
            mode={terminologyMode(user)}
            weekStartsOn={user.weekStartsOn ?? 1}
            totalWeeks={selectedMeso?.weeks ?? (calendarWeeks?.length ?? micros.length)}
            blockNameByWeek={blockNameByWeek}
            calendarWeeks={calendarWeeks}
            onSelectSession={(id) => setSelectedSessionId(id)}
            onSelectDay={(info) => setAddDay(info)}
            onViewWeekChange={(weekNumber, startDate) => setViewWeek({ weekNumber, startDate })}
          />
          <CalendarLegend className="mt-3" />
        </Card>

        {/* Always-expanded WEEK SESSIONS card. Each session row collapses
            individually — tap to reveal exercise summary; tap again to
            collapse. The chevron at the right opens the full post-workout
            summary at /history/session/[id]. */}
        {viewWeek.startDate && (() => {
          const start = viewWeek.startDate!;
          const wkStart = new Date(start + 'T00:00:00');
          const weekEnd = (() => {
            // Local components, NOT toISOString(): converting local midnight to
            // UTC lands a day early in UTC+ timezones, dropping the week's
            // final day from the list below.
            const d = new Date(wkStart); d.setDate(d.getDate() + 6);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
          })();
          const weekSessions = (selectedMesoId === 'all' ? sessions : allSessions)
            .filter((s) => s.date >= start && s.date <= weekEnd)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date));
          return (
            <Card>
              <div className="section-head">WEEK SESSIONS</div>
              <div className="text-xs text-ink-dim mt-0.5 tnum">
                {weekSessions.length === 0
                  ? 'No workouts this week'
                  : `${weekSessions.length} workout${weekSessions.length === 1 ? '' : 's'}`}
              </div>
              {weekSessions.length > 0 && (
                <ul className="mt-3 divide-y divide-ink-line">
                  {weekSessions.map((sess) => {
                    const d = new Date(sess.date + 'T00:00:00');
                    const dayName = DOW_NAMES[d.getDay()];
                    const exCount = sess.exercises.filter((e) => e.sets.some((s) => s.completed)).length;
                    const cardioCount = sess.cardio?.length ?? 0;
                    const summary = sess.completed
                      ? (exCount > 0 || cardioCount > 0
                          ? [
                              exCount > 0 ? `${exCount} exercise${exCount === 1 ? '' : 's'}` : null,
                              cardioCount > 0 ? `${cardioCount} cardio` : null,
                            ].filter(Boolean).join(' · ')
                          : 'Logged')
                      : 'Pending';
                    const isOpen = expandedSessionIds.has(sess.id);
                    const toggleOpen = () => {
                      setExpandedSessionIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(sess.id)) next.delete(sess.id);
                        else next.add(sess.id);
                        return next;
                      });
                    };
                    return (
                      <li key={sess.id} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={toggleOpen}
                            aria-expanded={isOpen}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="text-xs text-ink-mute tracking-wider2 uppercase">{dayName} · {sess.date}</div>
                            <div className="text-sm font-medium truncate mt-0.5">
                              {sess.name ?? (sess.exercises.length > 0
                                ? sess.exercises.slice(0, 3).map((e) => e.name).join(' · ')
                                : (cardioCount > 0 ? 'Cardio' : 'Session'))}
                            </div>
                            <div className="text-xs text-ink-dim mt-0.5 tnum">
                              {summary}
                              {sess.completed && (
                                <span className="text-ok ml-2">✓ Done</span>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <svg
                              viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className={cn('text-ink-mute transition-transform', isOpen && 'rotate-180')}
                              onClick={toggleOpen}
                              aria-hidden
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            <button
                              type="button"
                              onClick={() => setSelectedSessionId(sess.id)}
                              className="text-xs text-accent font-medium px-2 py-1"
                              aria-label={`Open ${sess.date} session`}
                            >
                              Open
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="mt-2 pl-1">
                            {sess.exercises.length > 0 && (
                              <ul className="space-y-1.5">
                                {sess.exercises.map((ex, i) => {
                                  const logged = ex.sets.filter((s) => s.completed && s.setType !== 'skip');
                                  return (
                                    <li key={i} className="text-xs text-ink-dim">
                                      <div className="font-medium text-ink">{ex.name}</div>
                                      <div className="tnum mt-0.5">
                                        {logged.length > 0
                                          ? logged.map((s) => formatSetValue(s, ex.metric ?? 'weight-reps', user.units)).join(' · ')
                                          : 'No sets logged'}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {sess.cardio.length > 0 && (
                              <ul className={cn('space-y-0.5', sess.exercises.length > 0 && 'mt-2 pt-2 border-t border-ink-line')}>
                                {sess.cardio.map((c, j) => (
                                  <li key={j} className="text-xs text-ink-dim tnum">
                                    <span className="capitalize text-ink">{c.activityType.replace('-', ' ')}</span>
                                    {` · ${cardioStats(c, user.units)}`}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })()}

        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="section-head">PROGRESSION</div>
            {exerciseOptions.length > 0 && (
              <select
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="h-9 px-2 rounded-lg bg-bg-input border border-ink-line text-xs font-medium max-w-[55%] truncate"
              >
                <option value="all">— pick an exercise —</option>
                {exerciseOptions.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            )}
          </div>

          <select
            value={chartRange}
            onChange={(e) => setChartRange(e.target.value as ChartRange)}
            className="w-full h-9 px-2 mb-3 rounded-lg bg-bg-input border border-ink-line text-xs font-medium"
            aria-label="Progression date range"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {selectedExerciseId !== 'all' && availableMetrics.length > 1 && (
            <div className="flex gap-1 mb-3">
              {availableMetrics.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMetric(m)}
                  className={cn(
                    'flex-1 h-8 rounded-lg text-xs font-medium border transition',
                    chartMetric === m
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-input border-ink-line text-ink-dim hover:text-ink',
                  )}
                >
                  {metricTabLabel(m)}
                </button>
              ))}
            </div>
          )}

          {selectedExerciseId === 'all' ? (
            <p className="text-sm text-ink-dim">Pick an exercise to see its progression over the selected range.</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-ink-dim">No logged sets for this exercise in this range yet.</p>
          ) : (
            <>
              <Sparkline
                data={chartData}
                showSecond={chartMetric === 'weight' && isAdvanced}
                yLabel={chartYLabel}
                key={`${selectedExerciseId}-${chartMetric}`}
              />
              <div className="text-[10px] text-ink-mute mt-1 flex justify-between tnum">
                <span>{chartData[0]!.x as string}</span>
                <span>{chartData[chartData.length - 1]!.x as string}</span>
              </div>
            </>
          )}
        </Card>
      </div>

      <SessionDetailModal
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
        onAddToDay={() => {
          const s = sessions.find((x) => x.id === selectedSessionId);
          if (!s) return;
          const weekNumber = micros.find((m) => m.id === s.microcycleId)?.weekNumber ?? 1;
          setSelectedSessionId(null);
          setAddDay({ date: s.date, weekNumber, dayOfWeek: s.dayOfWeek });
        }}
      />

      {addDay && !cardioOpen && !adHocOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setAddDay(null)}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
              <div>
                <div className="section-head">ADD TO THIS DAY</div>
                <div className="text-xs text-ink-dim mt-0.5">
                  {DOW_NAMES[addDay.dayOfWeek]} · {addDay.date} · Week {addDay.weekNumber}
                </div>
              </div>
              <button type="button" onClick={() => setAddDay(null)} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
            </div>
            <div className="px-4 py-4 space-y-2 pb-8">
              <Button block size="lg" onClick={() => setAdHocOpen(true)}>
                Log a workout
              </Button>
              <Button block variant="ghost" size="lg" onClick={() => setCardioOpen(true)}>
                Log cardio
              </Button>
              <p className="text-xs text-ink-mute text-center pt-2">
                Adding extra sessions does not change your program — they show up here as logged history.
              </p>
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
          mesocycleId={selectedMesoId === 'all' ? undefined : (selectedMesoId ?? undefined)}
          planName={selectedMeso?.name}
        />
      )}

      {addDay && (
        <AdHocWorkoutModal
          open={adHocOpen}
          date={addDay.date}
          onClose={() => setAdHocOpen(false)}
          onSaved={() => { setRefreshTick((n) => n + 1); setAddDay(null); setAdHocOpen(false); }}
          microcycleId={micros.find((m) => m.weekNumber === addDay.weekNumber)?.id}
          mesocycleId={selectedMesoId === 'all' ? undefined : (selectedMesoId ?? undefined)}
          planName={selectedMeso?.name}
        />
      )}
    </div>
  );
}
