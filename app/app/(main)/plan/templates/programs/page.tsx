'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';
import { PlanWizardV2 } from '@/components/plan/PlanWizardV2';
import { activateWizardProgram } from '@/lib/wizard/persist';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, UserMode } from '@/types';

const MODE_RANK: Record<UserMode, number> = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export default function ProgramTemplatesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    getRepository().listTemplates().then(setTemplates);
  }, [refreshTick]);

  const programs = useMemo(() => {
    if (!user) return [];
    return templates
      .filter((t) => (t.kind ?? 'program') === 'program')
      .filter((t) => MODE_RANK[user.mode] >= MODE_RANK[t.minMode])
      .sort((a, b) => Number(b.isCustom ?? false) - Number(a.isCustom ?? false));
  }, [templates, user]);

  if (!user) return null;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan/templates" label="Templates" /></div>
      <PageTitle title="Programs" subtitle="Multi-week plans you can pick up and run." />
      <div className="px-4 space-y-2">
        <button type="button" onClick={() => setWizardOpen(true)} className="block w-full text-left">
          <Card className="!border-accent/50 hover:!border-accent transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="section-head text-accent">NEW</div>
                <div className="font-semibold text-base mt-1">Create Custom Program</div>
                <p className="text-sm text-ink-dim mt-1">Build your own plan from scratch in the wizard.</p>
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
      </div>

      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
          <PlanWizardV2
            user={user}
            onClose={() => { setWizardOpen(false); setRefreshTick((n) => n + 1); }}
            onComplete={async (state, program) => {
              if (savingRef.current) return;
              savingRef.current = true;
              try {
                await activateWizardProgram(state, program, user);
                router.push('/today');
              } catch (err) {
                savingRef.current = false;
                alert('Could not save your program: ' + ((err as Error)?.message ?? 'unknown error'));
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
