'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, MuscleBadge, ModeChip, PageTitle, BackButton } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { terminologyMode, usesAdvancedTerminology } from '@/lib/periodization';
import type { Mesocycle, Microcycle, WorkoutSession } from '@/types';
import { ChangePlanSheet } from '@/components/plan/ChangePlanSheet';
import { PlanWizardV2 } from '@/components/plan/PlanWizardV2';
import { activateWizardProgram, saveWizardDraft, saveWizardToGallery } from '@/lib/wizard/persist';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function MesoDetailPage() {
  const { mesoId } = useParams<{ mesoId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [micros, setMicros] = useState<Microcycle[]>([]);
  const [sessionsByMicro, setSessionsByMicro] = useState<Record<string, WorkoutSession[]>>({});
  const [changeOpen, setChangeOpen] = useState(false);
  const [editV2Open, setEditV2Open] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user || !mesoId) return;
    const load = async () => {
      const repo = getRepository();
      const m = await repo.getMesocycle(mesoId);
      setMeso(m);
      if (!m) return;
      const ms = await repo.listMicrocycles(m.id);
      setMicros(ms.sort((a, b) => a.weekNumber - b.weekNumber));
      const byMicro: Record<string, WorkoutSession[]> = {};
      for (const mc of ms) {
        byMicro[mc.id] = await repo.listSessionsInMicrocycle(mc.id);
      }
      setSessionsByMicro(byMicro);
    };
    load();
  }, [user, mesoId, refreshTick]);

  if (!user || !meso) return <div className="p-6 text-ink-dim">Loading…</div>;

  const microLabel = terminologyMode(user) === 'ADVANCED' ? 'Microcycle' : 'Week';

  return (
    <div>
      <div className="px-4 pt-4 flex items-center justify-between">
        <BackButton href="/plan" label="Plan" />
        <Button variant="ghost" size="sm" onClick={() => setChangeOpen(true)}>Change</Button>
      </div>
      <PageTitle title={meso.name} subtitle={meso.programStyle === 'traditional' ? `${meso.weeks}-week program` : `${meso.weeks}-week block · ${meso.phaseType}`} trailing={<ModeChip mode={user.mode} />} />
      <div className="px-4 space-y-3">
        <Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Weeks" value={String(meso.weeks)} />
            <Stat label="Current" value={`Wk ${meso.weekIndex + 1}`} />
            <Stat label="Status" value={meso.status} />
          </div>
        </Card>

        {micros.map((m) => {
          const sessions = sessionsByMicro[m.id] ?? [];
          return (
            <Card key={m.id} className={m.status === 'active' ? 'border-accent/60' : ''}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="section-head">{microLabel.toUpperCase()} {m.weekNumber}</div>
                <div className="text-xs text-ink-dim tnum">
                  {usesAdvancedTerminology(user) && m.targetRIR != null && <span>{m.targetRIR} RIR · </span>}
                  <span className="capitalize">{m.status}</span>
                </div>
              </div>
              {sessions.length === 0 && <p className="text-sm text-ink-dim">No sessions in this week.</p>}
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/plan/day/${s.id}`} className="block rounded-lg border border-ink-line bg-bg-card hover:border-ink-dim transition p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {DAYS[s.dayOfWeek]} <span className="text-ink-dim font-normal">· {s.date}</span>
                          </div>
                          <div className="text-xs text-ink-dim mt-0.5">
                            {s.exercises.length} exercises
                            {s.completed && <span className="text-ok"> · done</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end max-w-[55%]">
                          {Array.from(new Set(s.exercises.map((e) => e.muscle))).slice(0, 3).map((mu) => (
                            <MuscleBadge key={mu} muscle={mu} />
                          ))}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}

        <div className="pt-2">
          <Button variant="ghost" onClick={() => router.push('/plan')}>← Back to Plan</Button>
        </div>
      </div>
      <ChangePlanSheet
        open={changeOpen}
        meso={meso}
        micros={micros}
        sessions={Object.values(sessionsByMicro).flat()}
        onClose={() => setChangeOpen(false)}
        onChanged={() => setRefreshTick((n) => n + 1)}
        onEdit={() => {
          // Editing rebuilds the plan in Plan Wizard v2, seeded with its name.
          // Saving archives the current plan and starts a fresh one.
          setChangeOpen(false);
          setEditV2Open(true);
        }}
      />
      {editV2Open && user && (
        <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
          <PlanWizardV2
            user={user}
            initialName={meso.name}
            onSaveDraft={async (st, pr, id) => (await saveWizardDraft(st, user, pr, id)).id}
            onClose={() => setEditV2Open(false)}
            onSaveToGallery={async (state, program) => {
              try { await saveWizardToGallery(state, user, program); setEditV2Open(false); }
              catch (err) { alert('Could not save to gallery: ' + ((err as Error)?.message ?? 'unknown error')); }
            }}
            onComplete={async (state, program) => {
              try { await activateWizardProgram(state, program, user); router.push('/today'); }
              catch (err) { alert('Could not save: ' + ((err as Error)?.message ?? 'unknown error')); }
            }}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider2 text-ink-mute uppercase">{label}</div>
      <div className="text-base font-semibold mt-0.5 capitalize">{value}</div>
    </div>
  );
}
