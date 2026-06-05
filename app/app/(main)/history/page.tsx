'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/app';
import { PageTitle, Card, Button } from '@/components/ui';
import { WeekCalendar, CalendarLegend, DaySessionSheet } from '@/components/history';
import { Sparkline, type SparkPoint } from '@/components/charts';
import { CardioLogModal } from '@/components/today';
import { AdHocWorkoutModal } from '@/components/workout';
import { getRepository } from '@/lib/firestore';
import { weightSeries, e1rmSeries } from '@/lib/progress';
import { terminologyMode, usesAdvancedTerminology } from '@/lib/periodization';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { cn } from '@/lib/ui/cn';
import type { Mesocycle, Microcycle, WorkoutSession } from '@/types';
import { todayIso } from '@/lib/ui/date';

interface AddDayInfo {
  date: string;
  weekNumber: number;
  dayOfWeek: 0|1|2|3|4|5|6;
}

type ChartMetric = 'weight' | 'reps';
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
  const [selectedMesoId, setSelectedMesoId] = useState<string | null>(null);
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
      const flat = await repo.listMesocycles(user.userId);
      setAllMesos([...flat].sort((a, b) => (b.weekIndex - a.weekIndex)));

      // Exactly one block is "current": the user's active mesocycle. When
      // there is no active plan currentMesoId stays null — we don't fall back
      // to "whatever meso happens to be first", which would mislabel an
      // archived plan as the current one after the user cancelled their program.
      const current = flat.find((m) => m.status === 'active') ?? null;
      setCurrentMesoId(current?.id ?? null);
      // For initial selection, fall back to the most recent meso so the
      // History dropdown still defaults to something useful when there's no
      // active plan.
      if (!selectedMesoId) setSelectedMesoId((current ?? flat[0])?.id ?? null);
    };
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every session for the user — the progression chart spans all of them.
  useEffect(() => {
    if (!user) return;
    getRepository().listSessions(user.userId, { limit: 1000 }).then(setAllSessions);
  }, [user, refreshTick]);

  // Calendar data: the micros + sessions of the selected block only.
  useEffect(() => {
    if (!selectedMesoId) { setMicros([]); setSessions([]); return; }
    const load = async () => {
      const repo = getRepository();
      const ms = await repo.listMicrocycles(selectedMesoId);
      ms.sort((a, b) => a.weekNumber - b.weekNumber);
      setMicros(ms);
      const ssArr = await Promise.all(ms.map((m) => repo.listSessionsInMicrocycle(m.id)));
      setSessions(ssArr.flat());
    };
    load();
  }, [selectedMesoId, refreshTick]);

  // Sessions feeding the progression chart, narrowed to the chosen date range.
  const chartSessions = useMemo(() => {
    const opt = RANGE_OPTIONS.find((o) => o.value === chartRange);
    if (!opt || opt.days == null) return allSessions;
    const cutoff = isoDaysAgo(opt.days);
    return allSessions.filter((s) => s.date >= cutoff);
  }, [allSessions, chartRange]);

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of chartSessions) {
      for (const ex of s.exercises) {
        if (!map.has(ex.exerciseId)) map.set(ex.exerciseId, ex.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
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

  const chartData: SparkPoint[] = useMemo(() => {
    if (selectedExerciseId === 'all' || !user) return [];
    if (chartMetric === 'reps') {
      // Top-set reps for every session — uses weightSeries (unfiltered by e1RM reliability).
      return weightSeries(chartSessions, selectedExerciseId).map((p) => ({
        x: p.date,
        y: p.reps,
        label: `${p.date} · ${p.reps} reps · ${kgToDisplay(p.value, user.units)} ${weightLabel(user.units)}`,
      }));
    }
    const points = isAdvanced
      ? e1rmSeries(chartSessions, selectedExerciseId)
      : weightSeries(chartSessions, selectedExerciseId);
    return points.map((p) => ({
      x: p.date,
      y: kgToDisplay(p.value, user.units) ?? 0,
      y2: isAdvanced ? p.rpe : undefined,
      isPR: p.isPR,
      label: `${p.date} · ${kgToDisplay(p.value, user.units)} ${weightLabel(user.units)} × ${p.reps}${p.rpe != null ? ` @ RPE ${p.rpe}` : ''}`,
    }));
  }, [selectedExerciseId, chartMetric, chartSessions, user, isAdvanced]);

  if (!user) return null;

  const selectedMeso = allMesos.find((m) => m.id === selectedMesoId) ?? null;
  const weightTabLabel = isAdvanced ? 'e1RM' : 'Weight';
  const chartYLabel =
    chartMetric === 'reps'
      ? 'Top-set reps'
      : isAdvanced
        ? `e1RM (${weightLabel(user.units)})`
        : `Top set (${weightLabel(user.units)})`;

  return (
    <div>
      <PageTitle title="History" subtitle="Every session in this training block." />
      <div className="px-4 space-y-3">
        {allMesos.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="section-head mb-1">BLOCK</div>
                <select
                  value={selectedMesoId ?? ''}
                  onChange={(e) => setSelectedMesoId(e.target.value)}
                  className="w-full h-10 px-2 rounded-lg bg-bg-input border border-ink-line text-ink text-sm font-medium"
                >
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
            isCurrent={selectedMesoId === currentMesoId && currentMesoId != null}
            sessions={sessions}
            extraCompletedSessions={allSessions.filter(
              (s) => s.completed && s.mesocycleId !== selectedMesoId,
            )}
            todayIso={todayIso()}
            mode={terminologyMode(user)}
            weekStartsOn={user.weekStartsOn ?? 1}
            totalWeeks={selectedMeso?.weeks}
            onSelectSession={(id) => setSelectedSessionId(id)}
            onSelectDay={(info) => setAddDay(info)}
          />
          <CalendarLegend className="mt-3" />
        </Card>

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

          {selectedExerciseId !== 'all' && (
            <div className="flex gap-1 mb-3">
              {(['weight', 'reps'] as ChartMetric[]).map((m) => (
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
                  {m === 'weight' ? weightTabLabel : 'Reps'}
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
              />
              <div className="text-[10px] text-ink-mute mt-1 flex justify-between tnum">
                <span>{chartData[0]!.x as string}</span>
                <span>{chartData[chartData.length - 1]!.x as string}</span>
              </div>
            </>
          )}
        </Card>
      </div>

      <DaySessionSheet
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
          mesocycleId={selectedMesoId ?? undefined}
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
          mesocycleId={selectedMesoId ?? undefined}
          planName={selectedMeso?.name}
        />
      )}
    </div>
  );
}
