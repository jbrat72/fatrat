'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, PageTitle, BackButton } from '@/components/ui';
import { Sparkline, type SparkPoint } from '@/components/charts';
import { getRepository } from '@/lib/firestore';
import { topSetSeries, e1rmSeries, byExerciseId } from '@/lib/progress';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import type { WorkoutSession, ExerciseMetric } from '@/types';

type ChartMode = 'weight' | 'reps' | 'time' | 'e1rm';

export default function ExerciseHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('weight');

  useEffect(() => {
    if (!user) return;
    getRepository().listSessions(user.userId, { limit: 200 }).then(setSessions);
  }, [user]);

  const matcher = useMemo(() => byExerciseId(id ?? ''), [id]);

  const exerciseName = useMemo(() => {
    for (const s of sessions) {
      const ex = s.exercises.find(matcher);
      if (ex) return ex.name;
    }
    return id;
  }, [sessions, matcher, id]);

  // The exercise's metric, read from its logged sessions.
  const metric: ExerciseMetric = useMemo(() => {
    for (const s of sessions) {
      const ex = s.exercises.find(matcher);
      if (ex) return ex.metric ?? 'weight-reps';
    }
    return 'weight-reps';
  }, [sessions, matcher]);

  const isAdvanced = user?.mode === 'ADVANCED';

  // Which chart axes this metric supports.
  const availableModes: ChartMode[] = useMemo(() => {
    switch (metric) {
      case 'reps': return ['reps'];
      case 'time': return ['time'];
      case 'weight-time': return ['weight', 'time'];
      default: return isAdvanced ? ['weight', 'e1rm', 'reps'] : ['weight', 'reps'];
    }
  }, [metric, isAdvanced]);

  useEffect(() => {
    if (!availableModes.includes(chartMode)) setChartMode(availableModes[0]!);
  }, [availableModes]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = useMemo(
    () => (chartMode === 'e1rm' ? e1rmSeries(sessions, matcher) : topSetSeries(sessions, matcher)),
    [chartMode, sessions, matcher],
  );

  // Best (PR) by the exercise's own metric.
  const pr = useMemo(() => {
    const pts = topSetSeries(sessions, matcher);
    if (pts.length === 0) return null;
    return pts.reduce((best, p) => (p.value > best.value ? p : best));
  }, [sessions, matcher]);

  const data: SparkPoint[] = useMemo(() => {
    const units = user?.units ?? 'imperial';
    return series.map((p) => {
      if (chartMode === 'reps') {
        return { x: p.date, y: p.reps ?? 0, isPR: p.isPR, label: `${p.date} · ${p.reps ?? 0} reps` };
      }
      if (chartMode === 'time') {
        return { x: p.date, y: p.timeSec ?? 0, isPR: p.isPR, label: `${p.date} · ${p.timeSec ?? 0}s` };
      }
      const w = chartMode === 'e1rm' ? p.value : (p.weightKg ?? 0);
      return {
        x: p.date,
        y: kgToDisplay(w, units) ?? 0,
        y2: isAdvanced ? p.rpe : undefined,
        isPR: p.isPR,
        label: `${p.date} · ${kgToDisplay(w, units)} ${weightLabel(units)}${p.reps != null ? ` × ${p.reps}` : ''}${p.rpe != null ? ` @ RPE ${p.rpe}` : ''}`,
      };
    });
  }, [chartMode, series, user?.units, isAdvanced]);

  if (!user) return null;

  const modeLabel = (m: ChartMode) =>
    m === 'weight' ? 'Weight' : m === 'e1rm' ? 'e1RM' : m === 'reps' ? 'Reps' : 'Time';
  const yLabel =
    chartMode === 'reps' ? 'Top-set reps'
    : chartMode === 'time' ? 'Top-set time (s)'
    : chartMode === 'e1rm' ? `e1RM (${weightLabel(user.units)})`
    : `Top set (${weightLabel(user.units)})`;

  const prMain = !pr ? ''
    : metric === 'reps' ? `${pr.reps ?? 0} reps`
    : metric === 'time' ? `${pr.timeSec ?? 0}s`
    : metric === 'weight-time'
      ? `${kgToDisplay(pr.weightKg ?? 0, user.units)} ${weightLabel(user.units)} × ${pr.timeSec ?? 0}s`
      : `${kgToDisplay(pr.weightKg ?? 0, user.units)} ${weightLabel(user.units)} × ${pr.reps ?? 0}`;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/history" label="History" /></div>
      <PageTitle title={exerciseName} subtitle="Progression over time" />
      <div className="px-4 space-y-3">
        {pr && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="section-head">BEST</div>
                <div className="text-2xl font-semibold tnum mt-1">{prMain}</div>
                <div className="text-xs text-ink-dim mt-0.5">{pr.date}{pr.rpe != null ? ` · RPE ${pr.rpe}` : ''}</div>
              </div>
              <span className="text-2xl">🔥</span>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="section-head">PROGRESSION</div>
            {availableModes.length > 1 && (
              <div className="flex gap-1">
                {availableModes.map((m) => (
                  <ModeTab key={m} active={chartMode === m} onClick={() => setChartMode(m)}>{modeLabel(m)}</ModeTab>
                ))}
              </div>
            )}
          </div>
          {data.length === 0 ? (
            <p className="text-sm text-ink-dim">No logged sets for this exercise yet.</p>
          ) : (
            <>
              <Sparkline
                data={data}
                showSecond={isAdvanced && (chartMode === 'weight' || chartMode === 'e1rm')}
                yLabel={yLabel}
                key={chartMode}
              />
              <div className="text-[10px] text-ink-mute mt-1 flex justify-between tnum">
                <span>{data[0]!.x as string}</span>
                <span>{data[data.length - 1]!.x as string}</span>
              </div>
            </>
          )}
        </Card>

        <div className="pt-1">
          <Button variant="ghost" onClick={() => router.push('/history')}>← Back to history</Button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-2.5 rounded-md text-xs font-semibold transition ${active ? 'bg-accent text-white' : 'bg-bg-input text-ink-dim border border-ink-line'}`}
    >
      {children}
    </button>
  );
}
