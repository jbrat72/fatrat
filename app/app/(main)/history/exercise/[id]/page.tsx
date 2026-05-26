'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, PageTitle, BackButton } from '@/components/ui';
import { Sparkline, type SparkPoint } from '@/components/charts';
import { getRepository } from '@/lib/firestore';
import { weightSeries, e1rmSeries, personalBests } from '@/lib/progress';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import type { WorkoutSession } from '@/types';

type Mode = 'weight' | 'e1rm';

export default function ExerciseHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [chartMode, setChartMode] = useState<Mode>('weight');

  useEffect(() => {
    if (!user) return;
    getRepository().listSessions(user.userId, { limit: 200 }).then(setSessions);
  }, [user]);

  const exerciseName = useMemo(() => {
    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.exerciseId === id);
      if (ex) return ex.name;
    }
    return id;
  }, [sessions, id]);

  const wSeries = useMemo(() => weightSeries(sessions, id ?? ''), [sessions, id]);
  const eSeries = useMemo(() => e1rmSeries(sessions, id ?? ''), [sessions, id]);

  const pr = useMemo(() => personalBests(sessions).find((p) => p.exerciseId === id), [sessions, id]);

  const isAdvanced = user?.mode === 'ADVANCED';

  // Convert series to chart-ready points in the user's display units.
  const data: SparkPoint[] = useMemo(() => {
    const s = chartMode === 'e1rm' ? eSeries : wSeries;
    return s.map((p) => ({
      x: p.date,
      y: kgToDisplay(p.value, user?.units ?? 'imperial') ?? 0,
      y2: isAdvanced ? p.rpe : undefined,
      isPR: p.isPR,
      label: `${p.date} · ${kgToDisplay(p.value, user?.units ?? 'imperial')} ${weightLabel(user?.units ?? 'imperial')} × ${p.reps}${p.rpe != null ? ` @ RPE ${p.rpe}` : ''}`,
    }));
  }, [chartMode, eSeries, wSeries, user?.units, isAdvanced]);

  if (!user) return null;

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
                <div className="text-2xl font-semibold tnum mt-1">
                  {kgToDisplay(pr.weightKg, user.units)} {weightLabel(user.units)}
                  <span className="text-ink-dim font-normal"> × {pr.reps}</span>
                </div>
                <div className="text-xs text-ink-dim mt-0.5">{pr.date}{pr.rpe != null ? ` · RPE ${pr.rpe}` : ''}</div>
              </div>
              <span className="text-2xl">🔥</span>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="section-head">PROGRESSION</div>
            {isAdvanced && (
              <div className="flex gap-1">
                <ModeTab active={chartMode === 'weight'} onClick={() => setChartMode('weight')}>Weight</ModeTab>
                <ModeTab active={chartMode === 'e1rm'} onClick={() => setChartMode('e1rm')}>e1RM</ModeTab>
              </div>
            )}
          </div>
          <Sparkline
            data={data}
            showSecond={isAdvanced}
            yLabel={chartMode === 'e1rm' ? `e1RM (${weightLabel(user.units)})` : `Top set (${weightLabel(user.units)})`}
          />
          {data.length > 0 && (
            <div className="text-[10px] text-ink-mute mt-1 flex justify-between tnum">
              <span>{data[0]!.x as string}</span>
              <span>{data[data.length - 1]!.x as string}</span>
            </div>
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
