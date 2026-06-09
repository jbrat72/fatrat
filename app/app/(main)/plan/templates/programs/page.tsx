'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PageTitle, Card, BackButton } from '@/components/ui';
import { PlanWizardV2 } from '@/components/plan/PlanWizardV2';
import { activateWizardProgram, saveWizardDraft, saveWizardToGallery } from '@/lib/wizard/persist';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, UserMode } from '@/types';
import type { WizardState, GeneratedDay } from '@/lib/wizard/types';

const MODE_RANK: Record<UserMode, number> = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export default function ProgramTemplatesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeState, setResumeState] = useState<WizardState | null>(null);
  const [resumeProgram, setResumeProgram] = useState<Record<number, GeneratedDay[]>>({});
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    getRepository().listTemplates().then(setTemplates);
    if (user) getRepository().listMesocycles(user.userId)
      .then((ms) => setActiveTemplateId(ms.find((m) => m.status === 'active')?.templateId ?? null))
      .catch(() => { /* non-fatal */ });
  }, [refreshTick, user]);

  const programs = useMemo(() => {
    if (!user) return [];
    return templates
      .filter((t) => (t.kind ?? 'program') === 'program' && !t.isDraft)
      .filter((t) => MODE_RANK[user.mode] >= MODE_RANK[t.minMode])
      .sort((a, b) => Number(b.isCustom ?? false) - Number(a.isCustom ?? false));
  }, [templates, user]);
  const drafts = useMemo(() => templates.filter((t) => t.isDraft && t.draftState), [templates]);
  const openWizard = (resume: WizardState | null, prog: Record<number, GeneratedDay[]> = {}) => { setResumeState(resume); setResumeProgram(prog); setWizardOpen(true); };
  const resumeDraft = (t: ProgramTemplate) => {
    try { const d = JSON.parse(t.draftState as string); openWizard((d.state ?? d) as WizardState, (d.program ?? {}) as Record<number, GeneratedDay[]>); }
    catch { openWizard(null); }
    setResumeDraftId(t.id);
  };
  const discardDraft = async (id: string) => { await getRepository().deleteTemplate(id); setRefreshTick((n) => n + 1); };

  if (!user) return null;

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan/templates" label="Templates" /></div>
      <PageTitle title="Programs" subtitle="Multi-week plans you can pick up and run." />
      <div className="px-4 space-y-2">
        <button type="button" onClick={() => { openWizard(null); setResumeDraftId(null); }} className="block w-full text-left">
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

        {drafts.map((t) => (
          <Card key={t.id} className="hover:border-ink-dim transition-colors">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => resumeDraft(t)} className="min-w-0 flex-1 text-left">
                <div className="section-head text-warn">DRAFT</div>
                <div className="font-semibold text-base mt-1">{t.name}</div>
                <p className="text-sm text-ink-dim mt-1">Unfinished — tap to resume in the wizard.</p>
              </button>
              <button type="button" onClick={() => discardDraft(t.id)} className="shrink-0 text-[12px] text-ink-mute hover:text-danger px-2 py-1" aria-label="Discard draft">Discard</button>
            </div>
          </Card>
        ))}

        {programs.map((t) => (
          <Link key={t.id} href={`/plan/templates/${t.id}`} className="block">
            <Card className="hover:border-ink-dim transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="section-head flex items-center gap-2">{t.isCustom ? 'CUSTOM' : t.split.toUpperCase()}{t.id === activeTemplateId && <span className="text-ok normal-case tracking-normal">● Active</span>}</div>
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
            initialState={resumeState ?? undefined}
            initialProgram={resumeProgram}
            initialDraftId={resumeDraftId ?? undefined}
            onClose={() => { setWizardOpen(false); setResumeState(null); setResumeProgram({}); setResumeDraftId(null); setRefreshTick((n) => n + 1); }}
            onSaveDraft={async (state, program, existingId) => {
              const t = await saveWizardDraft(state, user, program, existingId);
              setRefreshTick((n) => n + 1);
              return t.id;
            }}
            onSaveToGallery={async (state, program, draftId) => {
              if (savingRef.current) return;
              savingRef.current = true;
              try {
                await saveWizardToGallery(state, user, program, draftId ?? resumeDraftId ?? undefined);
                setWizardOpen(false); setResumeState(null); setResumeProgram({}); setResumeDraftId(null); setRefreshTick((n) => n + 1);
              } catch (err) {
                alert('Could not save to gallery: ' + ((err as Error)?.message ?? 'unknown error'));
              } finally { savingRef.current = false; }
            }}
            onComplete={async (state, program, draftId) => {
              if (savingRef.current) return;
              savingRef.current = true;
              try {
                // Reuse the draft/template id so the finished plan replaces the
                // draft in place — one instance, no duplicate.
                await activateWizardProgram(state, program, user, draftId ?? resumeDraftId ?? undefined);
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
