'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';
import { SingleWorkoutWizard } from '@/components/plan/SingleWorkoutWizard';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, UserMode } from '@/types';

const MODE_RANK: Record<UserMode, number> = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export default function WorkoutTemplatesPage() {
  const { user } = useUser();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    getRepository().listTemplates().then(setTemplates);
  }, [refreshTick]);

  const workouts = useMemo(() => {
    if (!user) return [];
    return templates
      .filter((t) => t.kind === 'workout')
      .filter((t) => MODE_RANK[user.mode] >= MODE_RANK[t.minMode])
      .sort((a, b) => Number(b.isCustom ?? false) - Number(a.isCustom ?? false));
  }, [templates, user]);

  if (!user) return null;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan/templates" label="Templates" /></div>
      <PageTitle title="Single Workouts" subtitle="One-shot routines for ad-hoc training." />
      <div className="px-4 space-y-2">
        <button type="button" onClick={() => setWizardOpen(true)} className="block w-full text-left">
          <Card className="!border-accent/50 hover:!border-accent transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="section-head text-accent">NEW</div>
                <div className="font-semibold text-base mt-1">Create Custom Workout</div>
                <p className="text-sm text-ink-dim mt-1">A single routine that shows up in your Ad-Hoc Workout picker.</p>
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
      </div>

      <SingleWorkoutWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}
