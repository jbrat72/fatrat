'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PageTitle, Card, Button, MuscleBadge, BackButton } from '@/components/ui';
import { TemplateWizard } from '@/components/plan/TemplateWizard';
import { SingleWorkoutWizard } from '@/components/plan/SingleWorkoutWizard';
import { getRepository } from '@/lib/firestore';
import { todayIso } from '@/lib/ui/date';
import type { ProgramTemplate, ExerciseDefinition, Macrocycle, ExerciseEntry, SetEntry, WorkoutSession } from '@/types';

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [defs, setDefs] = useState<Record<string, ExerciseDefinition>>({});
  const [activeMacro, setActiveMacro] = useState<Macrocycle | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [modifyMode, setModifyMode] = useState(false);


  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const repo = getRepository();
      const [t, exercises, custom, macro] = await Promise.all([
        repo.getTemplate(id),
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
        repo.getActiveMacrocycle(user.userId),
      ]);
      setTemplate(t);
      const map: Record<string, ExerciseDefinition> = {};
      for (const e of [...custom, ...exercises]) map[e.id] = e;
      setDefs(map);
      setActiveMacro(macro);
    };
    load();
  }, [id, user]);

  if (!user || !template) return <div className="p-6 text-ink-dim">Loading…</div>;

  const isWorkout = template.kind === 'workout';

  // Single-workout flow: materialize exercise entries from the template's
  // single day, then open AdHocWorkoutModal pre-populated.
  const workoutEntries: ExerciseEntry[] = isWorkout
    ? (template.weeks[0]?.days[0]?.exercises ?? []).map((slot) => {
        const def = defs[slot.exerciseId];
        const muscle = def?.primaryMuscle ?? 'core';
        const metric = def?.metric ?? 'weight-reps';
        const sets: SetEntry[] = Array.from({ length: slot.prescribedSets }, (_, i) => ({ setIndex: i, weightKg: slot.startingWeightKg, completed: false }));
        return {
          exerciseId: slot.exerciseId,
          name: def?.name ?? slot.exerciseId,
          muscle,
          metric,
          prescribedSets: slot.prescribedSets,
          prescribedRepsLow: slot.repsLow,
          prescribedRepsHigh: slot.repsHigh,
          prescribedTimeLow: slot.timeLow,
          prescribedTimeHigh: slot.timeHigh,
          sets,
        };
      })
    : [];

  const startUsing = async () => {
    if (isWorkout) {
      if (!user) return;
      const repo = getRepository();
      const date = todayIso();
      const existing = await repo.getTodaySession(user.userId, date);
      const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const session: WorkoutSession = {
        id: existing?.id ?? ('workout-' + Math.random().toString(36).slice(2, 9)),
        userId: user.userId,
        name: template.name,
        date,
        dayOfWeek: dow,
        completed: false,
        startedAt: new Date().toISOString(),
        exercises: workoutEntries,
        cardio: existing?.cardio ?? [],
        // Intentionally no microcycleId/mesocycleId/macrocycleId — this is
        // an ad-hoc workout, not a programmed day.
      };
      await repo.upsertSession(session);
      router.push('/today/workout');
      return;
    }
    if (activeMacro) setConfirmOpen(true);
    else setWizardOpen(true);
  };

  return (
    <div className="pb-6">
      <div className="px-4 pt-4"><BackButton href="/plan/templates" label="Templates" /></div>
      <PageTitle title={template.name} subtitle={template.description} />
      <div className="px-4 space-y-3">
        {!isWorkout && (
          <Card>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="section-head">DAYS/WK</div>
                <div className="text-2xl font-semibold tnum mt-1">{template.daysPerWeek}</div>
              </div>
              <div>
                <div className="section-head">SPLIT</div>
                <div className="text-sm font-semibold mt-1 uppercase">{template.split.replace('-', ' ')}</div>
              </div>
              <div>
                <div className="section-head">{template.programStyle === 'traditional' ? 'STYLE' : 'PHASE'}</div>
                <div className="text-sm font-semibold mt-1 capitalize">{template.programStyle === 'traditional' ? 'Traditional' : template.defaultPhase}</div>
              </div>
            </div>
          </Card>
        )}

        {isWorkout && (
          <Card>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="section-head">CATEGORY</div>
                <div className="text-sm font-semibold mt-1 capitalize">{(template.category ?? 'workout').toString().replace('-', ' ')}</div>
              </div>
              <div>
                <div className="section-head">REST</div>
                <div className="text-sm font-semibold mt-1 tnum">
                  {template.restSeconds != null
                    ? (template.restSeconds < 60 ? `${template.restSeconds}s` : `${Math.round(template.restSeconds / 60)} min`)
                    : '—'}
                </div>
              </div>
            </div>
          </Card>
        )}

        {(isWorkout ? [template.weeks[0]?.days[0]].filter(Boolean) : template.weeks[0]?.days ?? []).map((day, di) => (
          <Card key={di}>
            <div className="section-head mb-2">{(day!.dayLabel || 'WORKOUT').toUpperCase()}</div>
            <ul className="space-y-2">
              {day!.exercises.map((slot, si) => {
                const def = defs[slot.exerciseId];
                const metric = def?.metric ?? 'weight-reps';
                const useTime = metric === 'time' || metric === 'weight-time';
                return (
                  <li key={si} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{def?.name ?? slot.exerciseId}</div>
                      <div className="text-xs text-ink-dim tnum">
                        {slot.prescribedSets} × {useTime
                          ? `${slot.timeLow ?? '?'}–${slot.timeHigh ?? '?'}s`
                          : `${slot.repsLow ?? '?'}–${slot.repsHigh ?? '?'}`}
                        {slot.startingRIR != null && ` · ${slot.startingRIR} RIR`}
                      </div>
                    </div>
                    {def && <MuscleBadge muscle={def.primaryMuscle} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}

        <Button block size="lg" onClick={startUsing}>
          {isWorkout ? 'Use This Workout' : 'Use This Template'}
        </Button>
        {template.isCustom && (
          <Button
            block
            variant="ghost"
            size="lg"
            onClick={() => { setModifyMode(true); setWizardOpen(true); }}
          >
            Modify
          </Button>
        )}
        <p className="text-xs text-ink-mute text-center">
          {isWorkout ? (
            template.isCustom
              ? <>“Use This Workout” opens it in the logger pre-filled. “Modify” edits the saved workout.</>
              : <>“Use This Workout” opens it in the logger pre-filled — adjust anything, log your sets, and save.</>
          ) : (
            template.isCustom
              ? <>“Use This Template” starts a fresh program from it. “Modify” edits this template in the wizard and saves changes back to it.</>
              : <>Opens the plan builder pre-loaded with this template — review or tweak anything, then activate it or save it as your own template.</>
          )}
        </p>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setConfirmOpen(false)}>
          <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-ink-line">
              <div className="section-head">Switch plan?</div>
            </div>
            <div className="px-4 py-4 space-y-3 pb-8">
              <p className="text-sm text-ink-dim">
                You&apos;re currently on{' '}
                <span className="text-ink font-medium">{activeMacro?.name}</span>. Setting up this
                template opens the plan builder — your current plan is replaced only if you
                activate the new one at the end. You can also just save it as a template.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" block onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button block onClick={() => { setConfirmOpen(false); setWizardOpen(true); }}>Continue</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Program wizard — only for program-kind templates */}
      {!isWorkout && (
        <TemplateWizard
          open={wizardOpen}
          initialTemplate={template}
          modifyTemplateId={modifyMode ? template.id : undefined}
          onClose={() => { setWizardOpen(false); setModifyMode(false); }}
          onSaved={(mode) => router.push(mode === 'activate' ? '/today' : '/plan/templates')}
        />
      )}

      {/* Workout wizard — only for workout-kind templates, in Modify mode */}
      {isWorkout && (
        <SingleWorkoutWizard
          open={wizardOpen}
          initialTemplate={template}
          modifyTemplateId={modifyMode ? template.id : undefined}
          onClose={() => { setWizardOpen(false); setModifyMode(false); }}
          onSaved={() => router.push('/plan/templates')}
        />
      )}


    </div>
  );
}
