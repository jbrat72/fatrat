'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { Button, TextField, InlineNumber, MuscleBadge } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import { personalizeLibrary } from '@/lib/exercise/personalize';
import { defaultRepRange, defaultTimeRange } from '@/lib/program';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import type {
  ExerciseDefinition, EquipmentType, MuscleGroup, ProgramTemplate, TemplateExerciseSlot, WorkoutCategory,
} from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, save updates this existing workout template id (modify mode). */
  modifyTemplateId?: string;
  /** Optional preload (used by Modify). */
  initialTemplate?: ProgramTemplate | null;
  onSaved?: () => void;
}

const STEP_TITLES = ['Workout', 'Exercises', 'Starting weights, reps & rest'];

const CATEGORY_OPTIONS: { value: WorkoutCategory; label: string }[] = [
  { value: 'upper-body', label: 'Upper Body' },
  { value: 'lower-body', label: 'Lower Body' },
  { value: 'core', label: 'Core' },
  { value: 'full-body', label: 'Full Body' },
  { value: 'custom', label: 'Other' },
];

const REST_OPTIONS = [30, 45, 60, 90, 120, 180, 240, 300];

// Equipment categories you can filter by on step 1. Selecting none = no filter.
const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'smith', label: 'Smith' },
];

// Muscle filter pills shown above the exercise search.
const MUSCLE_FILTERS: { value: MuscleGroup | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hams' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
  { value: 'neck', label: 'Neck' },
];

// Which muscles a single-workout category cares about. full-body / custom
// returns null meaning "no restriction".
function musclesForCategory(cat: WorkoutCategory): MuscleGroup[] | null {
  if (cat === 'upper-body') return ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'];
  if (cat === 'lower-body') return ['quads', 'hamstrings', 'glutes', 'calves'];
  if (cat === 'core') return ['core'];
  return null; // full-body, custom — no restriction
}
const fmtRest = (s: number) => (s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

interface Picked {
  exerciseId: string;
  prescribedSets: number;
}

/**
 * Compact 3-step wizard for creating a single ad-hoc workout template.
 * Mirrors the program wizard's visual language but skips the program-only
 * concepts (weeks, periodization, supersets, etc.).
 */
export function SingleWorkoutWizard({ open, onClose, modifyTemplateId, initialTemplate, onSaved }: Props) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkoutCategory>('upper-body');
  const [restSeconds, setRestSeconds] = useState(120);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [library, setLibrary] = useState<ExerciseDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType[]>([]);
  const [weightEdits, setWeightEdits] = useState<Record<string, { weight?: number; repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number }>>({});
  const [saving, setSaving] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const initRef = useRef<string | null>(null);

  // Load library
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const repo = getRepository();
      const [global, custom, prefs] = await Promise.all([
        repo.listGlobalExercises(),
        repo.listUserExercises(user.userId),
        repo.getExercisePrefs(user.userId),
      ]);
      if (!cancelled) setLibrary(personalizeLibrary([...custom, ...global], prefs));
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  // Preload from initialTemplate (Modify)
  useEffect(() => {
    if (!open || !initialTemplate || library.length === 0) return;
    if (initRef.current === initialTemplate.id) return;
    initRef.current = initialTemplate.id;
    const day = initialTemplate.weeks[0]?.days[0];
    if (!day) return;
    setStep(0);
    setName(initialTemplate.name);
    setCategory(initialTemplate.category ?? 'custom');
    setRestSeconds(initialTemplate.restSeconds ?? 120);
    setPicked(day.exercises.map((slot) => ({ exerciseId: slot.exerciseId, prescribedSets: slot.prescribedSets })));
    const edits: typeof weightEdits = {};
    for (const slot of day.exercises) {
      const wDisp = slot.startingWeightKg != null ? kgToDisplay(slot.startingWeightKg, user!.units) ?? undefined : undefined;
      edits[slot.exerciseId] = { repsLow: slot.repsLow, repsHigh: slot.repsHigh, timeLow: slot.timeLow, timeHigh: slot.timeHigh, weight: wDisp };
    }
    setWeightEdits(edits);
  }, [open, initialTemplate, library]);

  // Scroll to top on step change
  useEffect(() => {
    const toTop = () => mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    toTop();
    const raf = requestAnimationFrame(toTop);
    const t = window.setTimeout(toTop, 50);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
  }, [step]);

  const reset = () => {
    setStep(0); setName(''); setCategory('upper-body'); setRestSeconds(120);
    setPicked([]); setSearch(''); setWeightEdits({}); setSaving(false); setEquipmentFilter([]);
    initRef.current = null;
  };
  const close = () => { reset(); onClose(); };

  const units = user?.units ?? 'metric';
  const wLabel = weightLabel(units);
  const wInc = units === 'imperial' ? 5 : 2.5;
  const wDecimals = units === 'imperial' ? 0 : 1;

  const pickedDefs = useMemo(() =>
    picked.map((p) => ({ p, def: library.find((e) => e.id === p.exerciseId) })).filter((x) => x.def) as { p: Picked; def: ExerciseDefinition }[],
    [picked, library],
  );

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.exerciseId)), [picked]);

  const allowedMuscles = useMemo(() => musclesForCategory(category), [category]);

  // Filter pills shown above the search: always include 'all', then either
  // every muscle (full-body / custom) or just the ones the category covers.
  const visibleMuscleFilters = useMemo(() => {
    if (!allowedMuscles) return MUSCLE_FILTERS;
    const allow = new Set<string>(allowedMuscles);
    return MUSCLE_FILTERS.filter((m) => m.value === 'all' || allow.has(m.value));
  }, [allowedMuscles]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = library;
    if (allowedMuscles) {
      const allow = new Set<string>(allowedMuscles);
      list = list.filter((e) => allow.has(e.primaryMuscle));
    }
    if (muscleFilter !== 'all') list = list.filter((e) => e.primaryMuscle === muscleFilter);
    if (equipmentFilter.length > 0) {
      const allow = new Set<EquipmentType>(equipmentFilter);
      list = list.filter((e) => allow.has(e.equipment));
    }
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    // No slice — the search box and muscle filter narrow this down already,
    // and capping was hiding newer entries that sort late in the seed.
    return list;
  }, [library, search, muscleFilter, equipmentFilter, allowedMuscles]);

  // If the user changes the category and the current muscle filter is no
  // longer allowed, drop back to 'all'.
  useEffect(() => {
    if (muscleFilter === 'all') return;
    if (allowedMuscles && !allowedMuscles.includes(muscleFilter)) {
      setMuscleFilter('all');
    }
  }, [allowedMuscles, muscleFilter]);

  const add = (def: ExerciseDefinition) => {
    if (pickedIds.has(def.id)) return;
    setPicked((ps) => [...ps, { exerciseId: def.id, prescribedSets: 3 }]);
  };
  const remove = (id: string) => setPicked((ps) => ps.filter((p) => p.exerciseId !== id));
  const bumpSets = (id: string, delta: number) =>
    setPicked((ps) => ps.map((p) => p.exerciseId === id ? { ...p, prescribedSets: Math.max(1, Math.min(8, p.prescribedSets + delta)) } : p));
  const move = (id: string, delta: -1 | 1) =>
    setPicked((ps) => {
      const i = ps.findIndex((p) => p.exerciseId === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  if (!open) return null;

  const totalSteps = STEP_TITLES.length;
  const canAdvance = (() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return picked.length > 0;
    return true;
  })();

  const handleSave = async () => {
    if (!user || saving || picked.length === 0) return;
    setSaving(true);
    const repo = getRepository();
    const slots: TemplateExerciseSlot[] = pickedDefs.map(({ p, def }) => {
      const metric = def.metric ?? 'weight-reps';
      const useReps = metric === 'weight-reps' || metric === 'reps';
      const useTime = metric === 'time' || metric === 'weight-time';
      const useWeight = metric === 'weight-reps' || metric === 'weight-time';
      const isBand = def.equipment === 'band';
      const ed = weightEdits[p.exerciseId] ?? {};
      const dr = defaultRepRange(def);
      const dt = defaultTimeRange(def);
      const repsLow = useReps ? (ed.repsLow ?? dr.repsLow) : undefined;
      const repsHigh = useReps && repsLow != null ? Math.max(repsLow, ed.repsHigh ?? dr.repsHigh) : undefined;
      const timeLow = useTime ? (ed.timeLow ?? dt.timeLow) : undefined;
      const timeHigh = useTime && timeLow != null ? Math.max(timeLow, ed.timeHigh ?? dt.timeHigh) : undefined;
      const startingWeightKg =
        useWeight && !isBand && ed.weight != null
          ? (displayToKg(ed.weight, user.units) ?? undefined)
          : undefined;
      return {
        exerciseId: p.exerciseId,
        prescribedSets: p.prescribedSets,
        repsLow, repsHigh, timeLow, timeHigh, startingWeightKg,
      };
    });

    const id = modifyTemplateId ?? ('wk-custom-' + Date.now().toString(36));
    const tpl: ProgramTemplate = {
      id,
      name: name.trim() || 'Custom Workout',
      description: `Custom ${CATEGORY_OPTIONS.find((c) => c.value === category)?.label.toLowerCase()} workout`,
      kind: 'workout',
      category,
      daysPerWeek: 1,
      split: 'upper-lower',
      defaultPhase: 'hypertrophy',
      progressionScheme: 'linear',
      minMode: 'BASIC',
      isCustom: true,
      createdBy: user.displayName,
      restSeconds,
      weeks: [{ weekIndex: 0, days: [{ dayLabel: 'Workout', exercises: slots }] }],
    };
    try {
      await repo.upsertTemplate(tpl);
      onSaved?.();
      close();
    } catch (e) {
      // Keep the wizard open so nothing typed is lost; closing on a failed
      // save silently discarded the workout.
      console.warn('workout template save failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <header className="shrink-0 border-b border-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-12">
          <div className="section-head">{modifyTemplateId ? 'EDIT WORKOUT' : 'NEW WORKOUT'}</div>
          <button type="button" onClick={close} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>
        <div className="h-1 bg-ink-line">
          <div className="h-1 bg-accent transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="text-xs text-ink-mute tracking-wider2 mb-1">STEP {step + 1} / {totalSteps}</div>
          <h2 className="text-xl font-semibold mb-4">{STEP_TITLES[step]}</h2>

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <div className="section-head mb-1">Workout name</div>
                <TextField placeholder="e.g. Tuesday Push" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <div className="section-head mb-2">Category</div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                        category === c.value ? 'bg-accent text-white border-accent' : 'bg-bg-card text-ink border-ink-line hover:border-ink-dim',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-head mb-1">Equipment (optional)</div>
                <p className="text-xs text-ink-dim mb-2">
                  Tap any you want to use. Leave all off to see every exercise.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_OPTIONS.map((e) => {
                    const selected = equipmentFilter.includes(e.value);
                    return (
                      <button
                        key={e.value}
                        type="button"
                        onClick={() => setEquipmentFilter((prev) =>
                          prev.includes(e.value) ? prev.filter((v) => v !== e.value) : [...prev, e.value],
                        )}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium border transition',
                          selected
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                        )}
                      >
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="section-head mb-2">ADD EXERCISES</div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {visibleMuscleFilters.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMuscleFilter(m.value)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium border transition',
                        muscleFilter === m.value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <TextField placeholder="Search the library — bench, row, plank…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                  {results.length === 0 && <p className="text-sm text-ink-mute py-2">No exercises match that search.</p>}
                  {results.map((ex) => {
                    const added = pickedIds.has(ex.id);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => add(ex)}
                        disabled={added}
                        className="w-full text-left card flex items-center gap-3 p-2.5 transition disabled:opacity-50 enabled:hover:border-accent"
                      >
                        <MuscleBadge muscle={ex.primaryMuscle} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{ex.name}</div>
                          <div className="text-xs text-ink-dim capitalize">{ex.equipment}</div>
                        </div>
                        <span className={added ? 'text-ok text-xs font-semibold' : 'text-accent text-lg leading-none'}>{added ? 'Added' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="section-head mb-2">YOUR WORKOUT ({picked.length})</div>
                {picked.length === 0 ? (
                  <p className="text-sm text-ink-dim">Add a few exercises above.</p>
                ) : (
                  <div className="space-y-1.5">
                    {pickedDefs.map(({ p, def }, idx) => (
                      <div key={p.exerciseId} className="card p-2.5 flex items-center gap-2">
                        <MuscleBadge muscle={def.primaryMuscle} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{def.name}</div>
                          <div className="text-xs text-ink-dim tnum">{p.prescribedSets} sets</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => bumpSets(p.exerciseId, -1)} disabled={p.prescribedSets <= 1} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30">−</button>
                          <button type="button" onClick={() => bumpSets(p.exerciseId, 1)} disabled={p.prescribedSets >= 8} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30">+</button>
                          <button type="button" onClick={() => move(p.exerciseId, -1)} disabled={idx === 0} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30" aria-label="Move up">↑</button>
                          <button type="button" onClick={() => move(p.exerciseId, 1)} disabled={idx === picked.length - 1} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30" aria-label="Move down">↓</button>
                          <button type="button" onClick={() => remove(p.exerciseId)} className="w-7 h-7 rounded-md border border-ink-line text-ink-mute hover:text-danger" aria-label="Remove">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-ink-dim">
                Starting weight, reps, and hold time per exercise — pre-fills the logger
                when you run this workout. Adjust anything that looks off.
              </p>

              <div className="card p-3">
                <div className="section-head mb-1">REST BETWEEN SETS</div>
                <p className="text-xs text-ink-dim mb-2">Auto-starts the rest timer at this duration.</p>
                <div className="flex gap-1.5 flex-wrap">
                  {REST_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setRestSeconds(sec)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium border transition tnum',
                        restSeconds === sec
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-input text-ink-dim border-ink-line hover:text-ink',
                      )}
                    >
                      {fmtRest(sec)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {pickedDefs.map(({ p, def }) => {
                  const metric = def.metric ?? 'weight-reps';
                  const showWeight = metric === 'weight-reps' || metric === 'weight-time';
                  const showReps = metric === 'weight-reps' || metric === 'reps';
                  const showTime = metric === 'time' || metric === 'weight-time';
                  const dr = defaultRepRange(def);
                  const dt = defaultTimeRange(def);
                  const ed = weightEdits[p.exerciseId] ?? {};
                  const repsLow = ed.repsLow ?? dr.repsLow;
                  const repsHigh = ed.repsHigh ?? dr.repsHigh;
                  const timeLow = ed.timeLow ?? dt.timeLow;
                  const timeHigh = ed.timeHigh ?? dt.timeHigh;
                  const weight = ed.weight ?? 0;
                  const setEdit = (patch: typeof ed) =>
                    setWeightEdits((prev) => ({ ...prev, [p.exerciseId]: { ...(prev[p.exerciseId] ?? {}), ...patch } }));
                  return (
                    <div key={p.exerciseId} className="card p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-medium text-sm truncate">{def.name}</div>
                        <MuscleBadge muscle={def.primaryMuscle} />
                      </div>
                      <div className="flex items-end gap-2">
                        {showWeight && (
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Weight</div>
                            {def.equipment === 'band' ? (
                              <div className="w-full h-11 px-2 rounded-lg bg-bg-input border border-ink-line text-sm font-semibold text-center text-ink-dim flex items-center justify-center">
                                Band
                              </div>
                            ) : (
                              <InlineNumber
                                value={weight}
                                onChange={(v) => setEdit({ weight: v ?? 0 })}
                                step={wInc}
                                min={0}
                                decimals={wDecimals}
                                unit={wLabel}
                              />
                            )}
                          </div>
                        )}
                        {showReps && (<>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Reps low</div>
                            <InlineNumber value={repsLow} onChange={(v) => setEdit({ repsLow: v ?? 1 })} step={1} min={1} max={50} unit="reps" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Reps high</div>
                            <InlineNumber value={repsHigh} onChange={(v) => setEdit({ repsHigh: v ?? 1 })} step={1} min={1} max={50} unit="reps" />
                          </div>
                        </>)}
                        {showTime && (<>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Time low</div>
                            <InlineNumber value={timeLow} onChange={(v) => setEdit({ timeLow: v ?? 1 })} step={5} min={1} max={600} unit="s" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="section-head mb-1">Time high</div>
                            <InlineNumber value={timeHigh} onChange={(v) => setEdit({ timeHigh: v ?? 1 })} step={5} min={1} max={600} unit="s" />
                          </div>
                        </>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-ink-line bg-bg">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={close}>Cancel</Button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>Continue</Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || picked.length === 0}>
              {saving ? 'Saving…' : modifyTemplateId ? 'Save changes' : 'Save workout'}
            </Button>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}
