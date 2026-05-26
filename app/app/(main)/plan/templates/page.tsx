'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';
import { TemplateWizard } from '@/components/plan/TemplateWizard';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, UserMode } from '@/types';

const MODE_RANK: Record<UserMode, number> = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export default function TemplatesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    getRepository().listTemplates().then(setTemplates);
  }, [refreshTick]);

  if (!user) return null;

  // Custom templates first, then global — stable within each group.
  const visible = templates
    .filter((t) => MODE_RANK[user.mode] >= MODE_RANK[t.minMode])
    .sort((a, b) => Number(b.isCustom ?? false) - Number(a.isCustom ?? false));

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan" label="Plan" /></div>
      <PageTitle title="Templates" subtitle="Pick a starting point. You can customize anything after." />
      <div className="px-4 space-y-2">
        <button type="button" onClick={() => setWizardOpen(true)} className="block w-full text-left">
          <Card className="!border-accent/50 hover:!border-accent transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="section-head text-accent">NEW</div>
                <div className="font-semibold text-base mt-1">Create Custom Template</div>
                <p className="text-sm text-ink-dim mt-1">Build your own plan from scratch in the wizard.</p>
              </div>
              <span className="text-accent text-2xl leading-none shrink-0">+</span>
            </div>
          </Card>
        </button>

        {visible.map((t) => (
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

      <TemplateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={(mode) => {
          if (mode === 'activate') router.push('/today');
          else setRefreshTick((n) => n + 1);
        }}
      />
    </div>
  );
}
