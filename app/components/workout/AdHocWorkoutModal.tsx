'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/app';
import { Button, MuscleBadge, InlineNumber, TextField } from '@/components/ui';
import { cn } from '@/lib/ui/cn';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import type { ExerciseDefinition, ExerciseEntry, SetEntry, WorkoutSession } from '@/types';

interface Props {
  open: boolean;
  /** ISO YYYY-MM-DD of the day this workout is logged on. */
  date: string;
  microcycleId?: string;
  mesocycleId?: string;
  macrocycleId?: string;
  /** When set, the modal opens pre-populated with these exercises (one entry
   *  per slot, sets blanked but with prescribed reps/time copied). */
  initialExercises?: ExerciseEntry[];
  /** Optional title to show on the sheet (e.g. the source template name). */
  sourceLabel?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const DEFAULT_SET_COUNT = 3;

function blankSets(count: number): SetEntry[] {
  return Array.from({ length: count }, (_, i) => ({ setIndex: i, completed: false }));
}

/**
 * Ad-hoc workout logger. Lets the user log a strength workout on any day —
 * pick exercises from the library, enter weight + reps per set, save.
 * The result is a completed WorkoutSession (merged into an existing session
 * for that date if one already exists).
 */
export function AdHocWorkoutModal({
  open, date, microcycleId, mesocycleId, macrocycleId, initialExercises, sourceLabel, onClose, onSaved,
}: Props) {
  const { user } = useUser();
  const [library, setLibrary] = useState<ExerciseDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);

  // When opening with a pre-filled workout, hide the exercise picker by
  // default so the screen reads as "run this workout" — not "create custom".
  // The user can still tap to expose it if they want to add another move.
  useEffect(() => {
    if (!open) return;
    setPickerOpen(!initialExercises || initialExercises.length === 0);
  }, [open, initialExercises]);

  useEffect(() => {
    if (!open || !user) return;
    setSearch('');
    setEntries(initialExercises ? initialExercises.map((e) => ({ ...e, sets: blankSets(e.prescribedSets || DEFAULT_SET_COUNT) })) : []);
    let cancelled = false;
    (async () => {
      const repo = getRepository();
      const [global, custom] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
      ]);
      if (!cancelled) setLibrary([...custom, ...global]);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const pickedIds = useMemo(() => new Set(entries.map((e) => e.exerciseId)), [entries]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? library.filter((e) => e.name.toLowerCase().includes(q)) : library;
    return list.slice(0, 24);
  }, [library, search]);

  const hasContent = entries.some((e) => e.sets.some((s) => s.reps != null || s.weightKg != null || s.timeSec != null));

  if (!open || !user) return null;
  const units = user.units;

  const addExercise = (def: ExerciseDefinition) => {
    if (pickedIds.has(def.id)) return;
    setEntries((es) => [
      ...es,
      {
        exerciseId: def.id,
        name: def.name,
        muscle: def.primaryMuscle,
        metric: def.metric,
        prescribedSets: DEFAULT_SET_COUNT,
        sets: blankSets(DEFAULT_SET_COUNT),
      },
    ]);
  };

  const removeExercise = (idx: number) => {
    setEntries((es) => es.filter((_, i) => i !== idx));
  };

  const updateSet = (exIdx: number, setIdx: number, next: SetEntry) => {
    setEntries((es) =>
      es.map((e, i) =>
        i === exIdx ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? next : s)) } : e,
      ),
    );
  };

  const addSet = (exIdx: number) => {
    setEntries((es) =>
      es.map((e, i) => {
        if (i !== exIdx) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [...e.sets, { setIndex: e.sets.length, weightKg: last?.weightKg, reps: last?.reps, completed: false }],
        };
      }),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setEntries((es) =>
      es.map((e, i) => (i === exIdx ? { ...e, sets: e.sets.filter((_, j) => j !== setIdx) } : e)),
    );
  };

  const save = async () => {
    if (!hasContent || saving) return;
    setSaving(true);
    const repo = getRepository();

    // Keep only sets the user actually filled in; drop exercises left empty.
    const exercises: ExerciseEntry[] = entries
      .map((e) => {
        const sets = e.sets
          .filter((s) => s.reps != null || s.weightKg != null || s.timeSec != null)
          .map((s, i): SetEntry => ({ ...s, setIndex: i, completed: true }));
        return { ...e, prescribedSets: sets.length, sets };
      })
      .filter((e) => e.sets.length > 0);

    if (exercises.length === 0) { setSaving(false); return; }

    const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const existing = await repo.getTodaySession(user.userId, date);

    let session: WorkoutSession;
    if (existing) {
      session = {
        ...existing,
        completed: true,
        completedAt: existing.completedAt ?? new Date().toISOString(),
        exercises: [...existing.exercises, ...exercises],
        microcycleId: existing.microcycleId ?? microcycleId,
        mesocycleId: existing.mesocycleId ?? mesocycleId,
        macrocycleId: existing.macrocycleId ?? macrocycleId,
      };
    } else {
      session = {
        id: 'adhoc-' + Math.random().toString(36).slice(2, 9),
        userId: user.userId,
        date,
        dayOfWeek: dow,
        completed: true,
        completedAt: new Date().toISOString(),
        exercises,
        cardio: [],
        microcycleId,
        mesocycleId,
        macrocycleId,
      };
    }

    await repo.upsertSession(session);
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="section-head">{sourceLabel ? sourceLabel.toUpperCase() : 'LOG A WORKOUT'}</div>
            <div className="text-xs text-ink-dim mt-0.5 tnum">{date}{sourceLabel ? ' · pre-filled, edit anything' : ''}</div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-4 pb-8">
          {/* Exercise picker — collapsed when the modal opens with a pre-filled
              workout, so the screen doesn't look like the empty create-custom
              flow stacked on top. The user can expand it to add more. */}
          {pickerOpen ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="section-head">ADD EXERCISE</div>
                {initialExercises && initialExercises.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="text-[11px] text-ink-mute hover:text-ink underline-offset-2 hover:underline"
                  >
                    Hide
                  </button>
                )}
              </div>
              <TextField
                placeholder="Search the library — bench, row, squat…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                {results.length === 0 && (
                  <p className="text-sm text-ink-mute py-2">No exercises match that search.</p>
                )}
                {results.map((ex) => {
                  const added = pickedIds.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => addExercise(ex)}
                      disabled={added}
                      className="w-full text-left card flex items-center gap-3 p-2.5 transition disabled:opacity-50 enabled:hover:border-accent"
                    >
                      <MuscleBadge muscle={ex.primaryMuscle} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{ex.name}</div>
                        <div className="text-xs text-ink-dim capitalize">{ex.equipment}</div>
                      </div>
                      <span className={added ? 'text-ok text-xs font-semibold' : 'text-accent text-lg leading-none'}>
                        {added ? 'Added' : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Button variant="ghost" block onClick={() => setPickerOpen(true)}>+ Add an exercise</Button>
          )}

          {/* Picked exercises with set logging */}
          <div>
            <div className="section-head mb-2">WORKOUT</div>
            {entries.length === 0 ? (
              <p className="text-sm text-ink-dim">Add exercises above, then log your sets here.</p>
            ) : (
              <div className="space-y-3">
                {entries.map((ex, exIdx) => (
                  <div key={ex.exerciseId} className="card p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MuscleBadge muscle={ex.muscle} />
                      <span className="font-medium text-sm truncate flex-1">{ex.name}</span>
                      <button
                        type="button"
                        onClick={() => removeExercise(exIdx)}
                        className="w-7 h-7 rounded-md border border-ink-line text-ink-dim hover:text-danger"
                        aria-label={`Remove ${ex.name}`}
                      >
                        ✕
                      </button>
                    </div>

                    {(() => {
                      const m = ex.metric ?? 'weight-reps';
                      const showWeight = m === 'weight-reps' || m === 'weight-time';
                      const showReps = m === 'weight-reps' || m === 'reps';
                      const showTime = m === 'time' || m === 'weight-time';
                      const twoCol = showWeight && (showReps || showTime);
                      return (
                        <div className={cn(
                          'grid items-center gap-2',
                          twoCol
                            ? 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_28px]'
                            : 'grid-cols-[24px_minmax(0,1fr)_28px]',
                        )}>
                          <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute">SET</div>
                          {showWeight && <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute">WEIGHT</div>}
                          {showReps && <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute">REPS</div>}
                          {showTime && <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute">TIME</div>}
                          <div />
                          {ex.sets.map((set, setIdx) => (
                            <FragmentRow key={setIdx}>
                              <div className="text-sm text-ink-mute tabular-nums font-medium text-center">{setIdx + 1}</div>
                              {showWeight && (
                                <InlineNumber
                                  value={kgToDisplay(set.weightKg, units)}
                                  onChange={(n) => updateSet(exIdx, setIdx, { ...set, weightKg: displayToKg(n, units) })}
                                  step={units === 'imperial' ? 5 : 2.5}
                                  decimals={1}
                                  unit={weightLabel(units)}
                                  ariaLabel={`${ex.name} set ${setIdx + 1} weight`}
                                />
                              )}
                              {showReps && (
                                <InlineNumber
                                  value={set.reps}
                                  onChange={(n) => updateSet(exIdx, setIdx, { ...set, reps: n })}
                                  step={1}
                                  decimals={0}
                                  ariaLabel={`${ex.name} set ${setIdx + 1} reps`}
                                />
                              )}
                              {showTime && (
                                <InlineNumber
                                  value={set.timeSec}
                                  onChange={(n) => updateSet(exIdx, setIdx, { ...set, timeSec: n })}
                                  step={5}
                                  min={1}
                                  decimals={0}
                                  unit="s"
                                  ariaLabel={`${ex.name} set ${setIdx + 1} time`}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeSet(exIdx, setIdx)}
                                disabled={ex.sets.length <= 1}
                                className="w-7 h-7 rounded-md border border-ink-line text-ink-mute hover:text-danger disabled:opacity-30 disabled:pointer-events-none"
                                aria-label={`Remove set ${setIdx + 1}`}
                              >
                                –
                              </button>
                            </FragmentRow>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="mt-2">
                      <Button variant="ghost" size="sm" onClick={() => addSet(exIdx)}>+ Set</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <div className="flex-1" />
            <Button onClick={save} disabled={!hasContent || saving}>
              {saving ? 'Saving…' : 'Save workout'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A transparent wrapper so set cells flow directly into the parent grid. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
