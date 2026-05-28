'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';
import { TemplateWizard } from '@/components/plan/TemplateWizard';
import { SingleWorkoutWizard } from '@/components/plan/SingleWorkoutWizard';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, UserMode } from '@/types';

const MODE_RANK: Record<UserMode, number> = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export default function TemplatesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [programWizardOpen, setProgramWizardOpen] = useState(false);
  const [workoutWizardOpen, setWorkoutWizardOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    getRepository().listTemplates().then(setTemplates);
  }, [refreshTick]);

  // Hooks must run before any early return — split before the user-null guard.
  const { programs, workouts } = useMemo(() => {
    if (!user) return { programs: [] as ProgramTemplate[], workouts: [] as ProgramTemplate[] };
    const visible = templates
      .filter((t) => MODE_RANK[user.mode] >= MODE_RANK[t.minMode])
      .sort((a, b) => Number(b.isCustom ?? false) - Number(a.isCustom ?? false));
    return {
      programs: visible.filter((t) => (t.kind ?? 'program') === 'program'),
      workouts: visible.filter((t) => t.kind === 'workout'),
    };
  }, [templates, user]);

  if (!user) return null;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan" label="Plan" /></div>
      <PageTitle title="Templates" subtitle="Programs span weeks; single workouts are one-shot routines you can run any day." />

      <div className="px-4 space-y-6">
        {/* Programs */}
        <section className="space-y-2">
          <div className="section-head pt-1">PROGRAMS</div>
          <button type="button" onClick={() => setProgramWizardOpen(true)} className="block w-full text-left">
            <Card className="!border-accent/50 hover:!border-accent transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="section-head text-accent">NEW</div>
                  <div className="font-semibold text-base mt-1">Create Custom Program</div>
                  <p className="text-sm text-ink-dim mt-1">Multi-week plan with periodization, set styles, and progression.</p>
                </div>
                <span className="text-accent text-2xl leading-none shrink-0">+</span>
              </div>
            </Card>
          </button>

          {programs.map((t) => (
            <Link key={t.id} href={`/plan/templates/${t.id}`} className="block">
              <Card className="hover:border-ink-dim transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="section-head">{t.isCustom ? 'CUSTOM' : t.split.toUpperCase()}</div>
                    <div className="font-semibold text-base mt-1">
                      {t.name}
                      {t.isCustom && t.createdBy && (
                        <span className="text-ink-dim font-normal">, by {t.createdBy}</span>
                      )}
                    </div>
                    <p className="text-sm text-ink-dim mt-1">{t.description}</p>
                    <div className="text-xs text-ink-mute mt-2 tnum">
                      {t.daysPerWeek} days/wk{t.programStyle === 'traditional' ? ' · traditional' : ` · ${t.defaultPhase} · ${t.progressionScheme.replace('-', ' ')}`}
                    </div>
                  </div>
                  <span className="text-ink-mute text-xl">›</span>
                </div>
              </Card>
            </Link>
          ))}
        </section>

        {/* Single Workouts */}
        <section className="space-y-2">
          <div className="section-head pt-1">SINGLE WORKOUTS</div>
          <button type="button" onClick={() => setWorkoutWizardOpen(true)} className="block w-full text-left">
            <Card className="!border-accent/50 hover:!border-accent transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="section-head text-accent">NEW</div>
                  <div className="font-semibold text-base mt-1">Create Custom Workout</div>
                  <p className="text-sm text-ink-dim mt-1">A one-shot routine. Show up in your Ad-Hoc Workout picker.</p>
                </div>
                <span className="text-accent text-2xl leading-none shrink-0">+</span>
              </div>
            </Card>
          </button>

          {workouts.map((t) => {
            const ex = t.weeks[0]?.days[0]?.exercises ?? [];
            return (
              <Link key={t.id} href={`/plan/templates/${t.id}`} className="block">
                <Card className="hover:border-ink-dim transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="section-head">{t.isCustom ? 'CUSTOM' : (t.category ?? 'workout').toString().toUpperCase().replace('-', ' ')}</div>
                      <div className="font-semibold text-base mt-1">
                        {t.name}
                        {t.isCustom && t.createdBy && (
                          <span className="text-ink-dim font-normal">, by {t.createdBy}</span>
                        )}
                      </div>
                      <p className="text-sm text-ink-dim mt-1">{t.description}</p>
                      <div className="text-xs text-ink-mute mt-2 tnum">
                        {ex.length} exercise{ex.length === 1 ? '' : 's'}
                        {t.restSeconds != null && ` · ${t.restSeconds < 60 ? `${t.restSeconds}s` : `${Math.round(t.restSeconds / 60)} min`} rest`}
                      </div>
                    </div>
                    <span className="text-ink-mute text-xl">›</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      </div>

      <TemplateWizard
        open={programWizardOpen}
        onClose={() => setProgramWizardOpen(false)}
        onSaved={(mode) => {
          if (mode === 'activate') router.push('/today');
          else setRefreshTick((n) => n + 1);
        }}
      />

      <SingleWorkoutWizard
        open={workoutWizardOpen}
        onClose={() => setWorkoutWizardOpen(false)}
        onSaved={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}
