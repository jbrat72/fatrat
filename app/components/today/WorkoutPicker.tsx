'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, MuscleBadge } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import type { ProgramTemplate, WorkoutCategory, ExerciseDefinition, ExerciseEntry, SetEntry } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the user picks a workout — receives the materialized exercise entries to seed AdHocWorkoutModal. */
  onPick: (entries: ExerciseEntry[], sourceLabel: string) => void;
  /** Called when the user wants to log a fully custom workout from scratch. */
  onCreateCustom: () => void;
}

const CATEGORY_ORDER: WorkoutCategory[] = ['upper-body', 'lower-body', 'core', 'full-body', 'custom'];
const CATEGORY_LABEL: Record<WorkoutCategory, string> = {
  'upper-body': 'Upper Body',
  'lower-body': 'Lower Body',
  'core': 'Core',
  'full-body': 'Full Body',
  'custom': 'Other',
};

/**
 * Sheet that lists single-workout templates the user can run ad-hoc.
 * Grouped by category. Includes a "Create Custom Workout" row at the top.
 */
export function WorkoutPicker({ open, onClose, onPick, onCreateCustom }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [workouts, setWorkouts] = useState<ProgramTemplate[]>([]);
  const [defs, setDefs] = useState<Record<string, ExerciseDefinition>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      const repo = getRepository();
      const [tpls, global, custom] = await Promise.all([
        repo.listTemplates(),
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
      ]);
      if (cancelled) return;
      const wks = tpls.filter((t) => t.kind === 'workout');
      const map: Record<string, ExerciseDefinition> = {};
      for (const e of [...custom, ...global]) map[e.id] = e;
      setWorkouts(wks);
      setDefs(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const grouped = useMemo(() => {
    const out = new Map<WorkoutCategory, ProgramTemplate[]>();
    for (const w of workouts) {
      const cat = w.category ?? 'custom';
      const list = out.get(cat) ?? [];
      list.push(w);
      out.set(cat, list);
    }
    return out;
  }, [workouts]);

  if (!open) return null;

  const choose = (tpl: ProgramTemplate) => {
    const day = tpl.weeks[0]?.days[0];
    if (!day) return;
    const entries: ExerciseEntry[] = day.exercises.map((slot) => {
      const def = defs[slot.exerciseId];
      const muscle = def?.primaryMuscle ?? 'core';
      const metric = def?.metric ?? 'weight-reps';
      const sets: SetEntry[] = Array.from({ length: slot.prescribedSets }, (_, i) => ({
        setIndex: i,
        completed: false,
      }));
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
    });
    onPick(entries, tpl.name);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between z-10">
          <div className="section-head">PICK A WORKOUT</div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 space-y-4 pb-8">
          {/* Create custom — sits at the top so it's easy to find */}
          <button
            type="button"
            onClick={() => { onClose(); onCreateCustom(); }}
            className="w-full card p-3 text-left flex items-center gap-3 hover:border-accent transition"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center text-accent text-xl leading-none">+</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">Create Custom Workout</div>
              <div className="text-xs text-ink-dim">Pick exercises on the fly, no template needed.</div>
            </div>
          </button>

          {loading && <p className="text-sm text-ink-mute text-center py-4">Loading workouts…</p>}

          {!loading && workouts.length === 0 && (
            <p className="text-sm text-ink-mute text-center py-4">No saved workouts yet.</p>
          )}

          {!loading && CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={cat}>
                <div className="section-head mb-2">{CATEGORY_LABEL[cat]}</div>
                <div className="space-y-1.5">
                  {list.map((tpl) => {
                    const day = tpl.weeks[0]?.days[0];
                    const exCount = day?.exercises.length ?? 0;
                    const muscles = new Set<string>();
                    for (const slot of day?.exercises ?? []) {
                      const m = defs[slot.exerciseId]?.primaryMuscle;
                      if (m) muscles.add(m);
                    }
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => choose(tpl)}
                        className="w-full card p-3 text-left flex items-start gap-3 hover:border-accent transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-sm truncate">{tpl.name}</div>
                            {tpl.isCustom && <span className="text-2xs uppercase tracking-wider2 text-ink-mute">Custom</span>}
                          </div>
                          <div className="text-xs text-ink-dim mt-0.5 tnum">
                            {exCount} exercise{exCount === 1 ? '' : 's'}
                            {tpl.restSeconds != null && ` · ${tpl.restSeconds < 60 ? `${tpl.restSeconds}s` : `${Math.round(tpl.restSeconds / 60)} min`} rest`}
                          </div>
                          {tpl.description && (
                            <div className="text-xs text-ink-mute mt-1 line-clamp-2">{tpl.description}</div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-wrap gap-1 justify-end max-w-[40%]">
                          {[...muscles].slice(0, 3).map((m) => (
                            <MuscleBadge key={m} muscle={m as any} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer: link to the templates page for managing the library */}
          <div className="pt-2 border-t border-ink-line">
            <Button
              variant="ghost"
              block
              onClick={() => { onClose(); router.push('/plan/templates'); }}
            >
              Manage workout library
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
