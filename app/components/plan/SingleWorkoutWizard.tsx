'use client';
/**
 * Single Workout Wizard — builds one ad-hoc workout template.
 *
 * Six steps, keyed by id (never index): setup → muscles → exercises →
 * structure → weights → review. Mirrors the Plan Wizard's atoms (wizardUi)
 * and rules:
 *   - exercises come from the user's EQUIPMENT PROFILE (with a "show all"
 *     escape hatch), not a free-floating equipment filter;
 *   - pick muscle groups first, then exercises per muscle as chips;
 *   - set structure (supersets / pyramid / drop, core placement) is chosen
 *     here and saved on the template slots — the day-of Structure sheet
 *     stays as an override;
 *   - starting weights prefill from the last time each exercise was done;
 *     rep ranges follow one rep-range intent;
 *   - a review step before saving; unsaved NEW workouts persist as a local
 *     draft so closing the sheet loses nothing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, TextField, InlineNumber, MuscleBadge } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import { personalizeLibrary } from '@/lib/exercise/personalize';
import { getEquipmentProfiles, defaultProfileId, itemsForProfile, canUseExercise } from '@/lib/exercise/equipment';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import { formatPrev } from '@/lib/ui/sets';
import { buildLastPerf, lookupLastPerf, lastSetOf, type LastPerf } from '@/lib/session/lastPerformance';
import {
  inferCategory, repRangeForIntent, defaultTimeRange, describeWorkout, estimateMinutes, slotsToEntries,
  type RepIntent,
} from '@/lib/workout/singleWorkout';
import { pairSuperset, unlinkGroup, groupLetters } from '@/lib/workout/structure';
import { StructureEditor } from '@/components/workout/StructureEditor';
import { Eyebrow, SecHead, cardChoice, chip, note } from './wizardUi';
import type {
  ExerciseDefinition, ExerciseEntry, MuscleGroup, ProgramTemplate, SetStyle, TemplateExerciseSlot, UserProfile, WorkoutCategory,
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

type StepId = 'setup' | 'muscles' | 'exercises' | 'structure' | 'weights' | 'review';
const FLOW: StepId[] = ['setup', 'muscles', 'exercises', 'structure', 'weights', 'review'];
const TITLES: Record<StepId, string> = {
  setup: 'Set up your workout', muscles: 'Which muscles?', exercises: 'Pick your exercises',
  structure: 'Sets & structure', weights: 'Starting weights & reps', review: 'Review & save',
};

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'neck'];
const CATEGORIES: { value: WorkoutCategory; label: string }[] = [
  { value: 'upper-body', label: 'Upper Body' }, { value: 'lower-body', label: 'Lower Body' }, { value: 'core', label: 'Core' },
  { value: 'full-body', label: 'Full Body' }, { value: 'custom', label: 'Other' },
];
const INTENTS: { id: RepIntent; label: string; desc: string }[] = [
  { id: 'strength', label: 'Strength (4–6)', desc: 'Heavier loads, longer rest.' },
  { id: 'hypertrophy', label: 'Hypertrophy (8–12)', desc: 'Moderate loads, max tension. The usual pick.' },
  { id: 'endurance', label: 'Endurance (12–20)', desc: 'Lighter loads, shorter rest.' },
];
const REST_OPTIONS: (number | 'auto')[] = ['auto', 30, 45, 60, 90, 120, 180, 240, 300];
const fmtRest = (s: number | 'auto' | undefined) => s == null || s === 'auto' ? 'Auto' : s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DRAFT_KEY = 'fatrat:workoutWizardDraft:v1';
const MAX_SETS = 10;

interface Picked {
  exerciseId: string;
  sets: number;
  setStyle?: SetStyle;
  supersetGroup?: number;
  /** Per-exercise rest override (seconds). */
  restSeconds?: number;
  /** Edits in DISPLAY units; undefined = not edited (defaults apply). */
  weight?: number;
  repsLow?: number; repsHigh?: number; timeLow?: number; timeHigh?: number;
}
interface WizState {
  name: string;
  profileId: string;
  /** Ignore the equipment profile and offer the whole library. */
  showAll: boolean;
  intent: RepIntent;
  rest: number | 'auto';
  muscles: MuscleGroup[];
  picked: Picked[];
  /** null = inferred from the muscles trained. */
  category: WorkoutCategory | null;
}

function blankState(user: UserProfile): WizState {
  return { name: '', profileId: defaultProfileId(user), showAll: false, intent: 'hypertrophy', rest: 'auto', muscles: [], picked: [], category: null };
}
function stateFromTemplate(t: ProgramTemplate, user: UserProfile, defs: Record<string, ExerciseDefinition>): WizState {
  const slots = t.weeks[0]?.days[0]?.exercises ?? [];
  const muscles: MuscleGroup[] = [];
  const picked: Picked[] = slots.map((s) => {
    const m = defs[s.exerciseId]?.primaryMuscle ?? s.muscle;
    if (m && !muscles.includes(m)) muscles.push(m);
    const w = s.startingWeightKg != null ? kgToDisplay(s.startingWeightKg, user.units) ?? undefined : undefined;
    return { exerciseId: s.exerciseId, sets: s.prescribedSets, setStyle: s.setStyle, supersetGroup: s.supersetGroup, restSeconds: s.restSeconds, weight: w, repsLow: s.repsLow, repsHigh: s.repsHigh, timeLow: s.timeLow, timeHigh: s.timeHigh };
  });
  const inferred = inferCategory(muscles);
  return {
    name: t.name, profileId: defaultProfileId(user), showAll: true, intent: 'hypertrophy',
    rest: t.restSeconds ?? 'auto', muscles, picked, category: t.category && t.category !== inferred ? t.category : null,
  };
}
function loadDraft(): { state: WizState; step: number } | null {
  try { const raw = window.localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveDraft(state: WizState, step: number): void {
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, step })); } catch { /* ignore */ }
}
function clearDraft(): void { try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

export function SingleWorkoutWizard({ open, onClose, modifyTemplateId, initialTemplate, onSaved }: Props) {
  const { user } = useUser();
  const [state, setState] = useState<WizState | null>(null);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [library, setLibrary] = useState<ExerciseDefinition[]>([]);
  const [libLoaded, setLibLoaded] = useState(false);
  const [lastPerf, setLastPerf] = useState<LastPerf>({ byId: {}, byName: {} });

  const update = (fn: (s: WizState) => void) => setState((s) => { if (!s) return s; const n = structuredClone(s); fn(n); return n; });

  /* ---- load library + history on open ---- */
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLibLoaded(false);
    (async () => {
      const repo = getRepository();
      const [global, custom, prefs, sessions] = await Promise.all([
        repo.listGlobalExercises(), repo.listUserExercises(user.userId), repo.getExercisePrefs(user.userId),
        repo.listSessions(user.userId, { limit: 100 }).catch(() => []),
      ]);
      if (cancelled) return;
      setLibrary(personalizeLibrary([...custom, ...global], prefs));
      setLastPerf(buildLastPerf(sessions));
      setLibLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const defs = useMemo(() => { const m: Record<string, ExerciseDefinition> = {}; for (const e of library) m[e.id] = e; return m; }, [library]);

  /* ---- (re)initialize state every time the sheet opens ---- */
  useEffect(() => {
    if (!open || !user || !libLoaded) return;
    setSearch(''); setRestored(false);
    if (initialTemplate) { setState(stateFromTemplate(initialTemplate, user, defs)); setStep(0); return; }
    const d = loadDraft();
    if (d && d.state && d.state.picked) { setState(d.state); setStep(Math.min(d.step ?? 0, FLOW.length - 1)); setRestored(true); return; }
    setState(blankState(user)); setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, libLoaded, initialTemplate?.id, user?.userId]);

  // Draft autosave (new workouts only).
  useEffect(() => { if (open && state && !modifyTemplateId) saveDraft(state, step); }, [open, state, step, modifyTemplateId]);

  /* ---- derived ---- */
  const units = user?.units ?? 'metric';
  const profiles = useMemo(() => (user ? getEquipmentProfiles(user) : []), [user]);
  const items = useMemo(() => (user && state ? itemsForProfile(user, state.profileId) : []), [user, state?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  const noEquipment = items.length === 0;
  const showAll = !!state?.showAll || noEquipment;
  const usable = useMemo(() => (showAll ? library : library.filter((e) => canUseExercise(e, items))), [library, items, showAll]);
  const poolFor = (m: MuscleGroup) => usable.filter((e) => e.primaryMuscle === m);
  const pickedIds = useMemo(() => new Set((state?.picked ?? []).map((p) => p.exerciseId)), [state?.picked]);

  const lastFor = (id: string) => lookupLastPerf(lastPerf, { exerciseId: id, name: defs[id]?.name ?? id });
  const lastWeightDisplay = (id: string): number | undefined => {
    const s = lastSetOf(lastFor(id)); return s?.weightKg != null ? kgToDisplay(s.weightKg, units) ?? undefined : undefined;
  };

  /** Resolve a pick into a template slot (edits win, then history, then intent defaults). */
  const toSlot = (p: Picked, s: WizState): TemplateExerciseSlot => {
    const def = defs[p.exerciseId];
    const metric = def?.metric ?? 'weight-reps';
    const useReps = metric === 'weight-reps' || metric === 'reps';
    const useTime = metric === 'time' || metric === 'weight-time';
    const useWeight = (metric === 'weight-reps' || metric === 'weight-time') && def?.equipment !== 'band';
    const rr = repRangeForIntent(s.intent, def);
    const tr = defaultTimeRange(def);
    const repsLow = useReps ? (p.repsLow ?? rr.repsLow) : undefined;
    const repsHigh = useReps && repsLow != null ? Math.max(repsLow, p.repsHigh ?? rr.repsHigh) : undefined;
    const timeLow = useTime ? (p.timeLow ?? tr.timeLow) : undefined;
    const timeHigh = useTime && timeLow != null ? Math.max(timeLow, p.timeHigh ?? tr.timeHigh) : undefined;
    const wDisp = useWeight ? (p.weight ?? lastWeightDisplay(p.exerciseId)) : undefined;
    // Round the stored kg: a display value that came from kg→lb→kg otherwise
    // saves as 85.0033… and shows odd decimals everywhere downstream.
    const kg = wDisp != null && wDisp > 0 ? displayToKg(wDisp, units) : undefined;
    const startingWeightKg = kg != null ? Math.round(kg * 100) / 100 : undefined;
    return {
      exerciseId: p.exerciseId, name: def?.name, muscle: def?.primaryMuscle, prescribedSets: p.sets,
      repsLow, repsHigh, timeLow, timeHigh, startingWeightKg,
      setStyle: p.setStyle, supersetGroup: p.supersetGroup, restSeconds: p.restSeconds,
    };
  };
  const slots = useMemo(() => (state ? state.picked.map((p) => toSlot(p, state)) : []), [state, defs, lastPerf, units]); // eslint-disable-line react-hooks/exhaustive-deps
  const workoutRest = state?.rest === 'auto' ? undefined : state?.rest;
  const trainedMuscles = useMemo(() => Array.from(new Set(slots.map((s) => defs[s.exerciseId]?.primaryMuscle ?? s.muscle).filter(Boolean))) as MuscleGroup[], [slots, defs]);
  const inferred = inferCategory(trainedMuscles);
  const category = state?.category ?? inferred;

  /* ---- structure step: bridge picks ↔ ExerciseEntry for the shared editor ---- */
  const entries: ExerciseEntry[] = useMemo(() => slotsToEntries(slots, defs), [slots, defs]);
  const writeBack = (exs: ExerciseEntry[]) => update((s) => {
    const byId = new Map(s.picked.map((p) => [p.exerciseId, p]));
    s.picked = exs.map((e) => ({ ...(byId.get(e.exerciseId) as Picked), sets: Math.min(MAX_SETS, e.sets.length), setStyle: e.setStyle, supersetGroup: e.supersetGroup }));
  });
  const coreIdx = entries.map((e, i) => (e.muscle === 'core' ? i : -1)).filter((i) => i >= 0);
  const liftIdx = entries.map((e, i) => (e.muscle !== 'core' ? i : -1)).filter((i) => i >= 0);
  const placeCore = (where: 'first' | 'last' | 'superset') => {
    let exs = entries;
    // Unlink any group that contains a core move first, so placement is clean.
    for (const g of Array.from(new Set(exs.filter((e) => e.muscle === 'core' && e.supersetGroup != null).map((e) => e.supersetGroup!)))) exs = unlinkGroup(exs, g);
    const core = exs.filter((e) => e.muscle === 'core');
    const lifts = exs.filter((e) => e.muscle !== 'core');
    if (where === 'first') exs = [...core, ...lifts];
    else if (where === 'last') exs = [...lifts, ...core];
    else {
      exs = [...lifts, ...core];
      const n = Math.min(core.length, lifts.length);
      for (let i = 0; i < n; i++) {
        const a = exs.findIndex((e) => e.exerciseId === lifts[i]!.exerciseId);
        const b = exs.findIndex((e) => e.exerciseId === core[i]!.exerciseId);
        exs = pairSuperset(exs, a, b);
      }
    }
    writeBack(exs);
  };

  /* ---- navigation ---- */
  const stepId = FLOW[step]!;
  const canAdvance = (() => {
    if (!state) return false;
    if (stepId === 'setup') return state.name.trim().length > 0;
    if (stepId === 'muscles') return state.muscles.length > 0;
    if (stepId === 'exercises') return state.picked.length > 0;
    return true;
  })();
  const close = () => { onClose(); };
  const startOver = () => { if (!user) return; clearDraft(); setState(blankState(user)); setStep(0); setRestored(false); };

  /* ---- save ---- */
  const handleSave = async () => {
    if (!user || !state || saving || slots.length === 0) return;
    setSaving(true);
    const repo = getRepository();
    const tpl: ProgramTemplate = {
      id: modifyTemplateId ?? ('wk-custom-' + Date.now().toString(36)),
      name: state.name.trim() || 'Custom Workout',
      description: describeWorkout(slots, workoutRest, defs),
      kind: 'workout',
      category,
      daysPerWeek: 1,
      split: 'upper-lower',
      defaultPhase: 'hypertrophy',
      progressionScheme: 'linear',
      minMode: 'BASIC',
      isCustom: true,
      createdBy: user.displayName,
      createdById: user.userId,
      restSeconds: workoutRest,
      weeks: [{ weekIndex: 0, days: [{ dayLabel: 'Workout', exercises: slots }] }],
    };
    try {
      await repo.upsertTemplate(tpl);
      if (!modifyTemplateId) clearDraft();
      onSaved?.();
      close();
    } catch (e) {
      // Keep the wizard open so nothing typed is lost.
      console.warn('workout template save failed', e);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !user) return null;
  const wLabel = weightLabel(units);
  const wInc = units === 'imperial' ? 5 : 2.5;
  const wDecimals = units === 'imperial' ? 0 : 1;

  /* ================= steps ================= */
  const renderSetup = (s: WizState) => (<>
    <SecHead>Workout name</SecHead>
    <TextField placeholder="e.g. Tuesday Push" value={s.name} onChange={(e) => update((n) => { n.name = e.target.value; })} />
    <SecHead>Equipment</SecHead>
    {profiles.length > 1 && <div className="grid gap-2.5 mb-2">{profiles.map((pr) => cardChoice(s.profileId === pr.id && !s.showAll, () => update((n) => { n.profileId = pr.id; n.showAll = false; }), pr.name, `${pr.items.length} item${pr.items.length === 1 ? '' : 's'}`))}</div>}
    {profiles.length <= 1 && !noEquipment && cardChoice(!s.showAll, () => update((n) => { n.showAll = false; }), profiles[0]?.name ?? 'My equipment', `Only exercises your ${items.length} item${items.length === 1 ? '' : 's'} support.`)}
    <div className="mt-2.5">{cardChoice(showAll, () => update((n) => { n.showAll = true; }), 'Show every exercise', noEquipment ? 'No equipment set up yet — the whole library is offered.' : 'Ignore my equipment list for this workout.')}</div>
    <SecHead>Rep range</SecHead>
    <div className="grid gap-2.5">{INTENTS.map((o) => cardChoice(s.intent === o.id, () => update((n) => { n.intent = o.id; }), o.label, o.desc))}</div>
    <p className="text-[12px] text-ink-mute mt-2">Sets each exercise&apos;s rep range. You can still edit any exercise on the weights step.</p>
    <SecHead>Rest between sets</SecHead>
    <div className="flex flex-wrap gap-2">{REST_OPTIONS.map((r) => chip(s.rest === r, fmtRest(r), () => update((n) => { n.rest = r; }), String(r)))}</div>
    <p className="text-[12px] text-ink-mute mt-2">Auto = longer after compounds, shorter after isolation work. Per-exercise overrides live on the weights step.</p>
  </>);

  const renderMuscles = (s: WizState) => (<>
    <p className="text-[13px] text-ink-dim mb-3">Tap every muscle group this workout trains. The next step lists exercises for each.</p>
    <div className="flex flex-wrap gap-2">{MUSCLES.map((m) => { const n = poolFor(m).length; return chip(s.muscles.includes(m), <>{cap(m)} <span className="text-ink-mute font-normal">· {n}</span></>, () => update((st) => { const i = st.muscles.indexOf(m); if (i >= 0) st.muscles.splice(i, 1); else st.muscles.push(m); }), m, n === 0); })}</div>
    {s.muscles.length > 0 && <div className="mt-4 text-[13px] text-ink-dim">Reads as: <span className="text-ink font-medium">{CATEGORIES.find((c) => c.value === inferCategory(s.muscles))?.label}</span></div>}
  </>);

  const renderExercises = (s: WizState) => {
    const q = search.trim().toLowerCase();
    const togglePick = (e: ExerciseDefinition) => update((st) => {
      const i = st.picked.findIndex((p) => p.exerciseId === e.id);
      if (i >= 0) st.picked.splice(i, 1); else st.picked.push({ exerciseId: e.id, sets: 3 });
    });
    const move = (id: string, d: -1 | 1) => update((st) => { const i = st.picked.findIndex((p) => p.exerciseId === id); const j = i + d; if (i < 0 || j < 0 || j >= st.picked.length) return; [st.picked[i], st.picked[j]] = [st.picked[j]!, st.picked[i]!]; });
    return (<>
      <TextField placeholder="Search — bench, row, plank…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {!showAll && <p className="text-[12px] text-ink-mute mt-2">Showing exercises your equipment supports. <button type="button" className="text-accent-hot font-semibold" onClick={() => update((n) => { n.showAll = true; })}>Show all</button></p>}
      {s.muscles.map((m) => {
        const pool = poolFor(m).filter((e) => !q || e.name.toLowerCase().includes(q));
        return <div key={m} className="wz-sec rounded-2xl border border-ink-line bg-bg-card p-3.5 mt-3">
          <div className="flex justify-between items-center mb-2"><b className="text-[14px]">{cap(m)}</b><span className="text-[12px] text-ink-dim">{pool.filter((e) => pickedIds.has(e.id)).length} picked</span></div>
          {pool.length === 0 ? <div className="text-[12px] text-ink-mute">No matches.</div>
            : <div className="flex flex-wrap gap-2">{pool.map((e) => chip(pickedIds.has(e.id), e.name, () => togglePick(e), e.id))}</div>}
        </div>;
      })}
      <SecHead>Your workout ({s.picked.length})</SecHead>
      {s.picked.length === 0 ? <p className="text-[13px] text-ink-dim">Tap exercises above to add them.</p>
        : <div className="space-y-1.5">{s.picked.map((p, idx) => { const def = defs[p.exerciseId]; return (
          <div key={p.exerciseId} className="rounded-xl border border-ink-line bg-bg-card p-2.5 flex items-center gap-2">
            <MuscleBadge muscle={def?.primaryMuscle ?? 'core'} />
            <div className="flex-1 min-w-0 font-medium text-sm truncate">{def?.name ?? p.exerciseId}</div>
            <button type="button" onClick={() => move(p.exerciseId, -1)} disabled={idx === 0} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30" aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(p.exerciseId, 1)} disabled={idx === s.picked.length - 1} className="w-7 h-7 rounded-md border border-ink-line text-ink-dim disabled:opacity-30" aria-label="Move down">↓</button>
            <button type="button" onClick={() => update((st) => { st.picked = st.picked.filter((x) => x.exerciseId !== p.exerciseId); })} className="w-7 h-7 rounded-md border border-ink-line text-ink-mute hover:text-danger" aria-label="Remove">✕</button>
          </div>); })}</div>}
    </>);
  };

  const renderStructure = () => (<>
    <p className="text-[13px] text-ink-dim mb-3">Sets per exercise, and how they&apos;re performed. Tap <b>Superset</b> on one exercise, then another, to pair them. This is saved with the workout; you can still change it on the day.</p>
    {coreIdx.length > 0 && liftIdx.length > 0 && <>
      <SecHead>Core placement</SecHead>
      <div className="flex flex-wrap gap-2 mb-3">
        {chip(false, 'Core last', () => placeCore('last'), 'last')}
        {chip(false, 'Core first', () => placeCore('first'), 'first')}
        {chip(false, 'Superset core with lifts', () => placeCore('superset'), 'ss')}
      </div>
    </>}
    <StructureEditor exercises={entries} allowed={['pyramid', 'drop']} onChange={writeBack} />
  </>);

  const renderWeights = (s: WizState) => (<>
    <p className="text-[13px] text-ink-dim mb-3">Pre-fills the logger when you run this workout. Weights start from the last time you did each exercise; rep ranges follow your <b>{INTENTS.find((i) => i.id === s.intent)?.label}</b> choice.</p>
    <div className="space-y-2">{s.picked.map((p) => {
      const def = defs[p.exerciseId]; const slot = slots.find((x) => x.exerciseId === p.exerciseId)!;
      const metric = def?.metric ?? 'weight-reps';
      const showWeight = metric === 'weight-reps' || metric === 'weight-time';
      const showReps = metric === 'weight-reps' || metric === 'reps';
      const showTime = metric === 'time' || metric === 'weight-time';
      const last = lastSetOf(lastFor(p.exerciseId));
      const weight = p.weight ?? lastWeightDisplay(p.exerciseId) ?? 0;
      const set = (patch: Partial<Picked>) => update((st) => { const t = st.picked.find((x) => x.exerciseId === p.exerciseId); if (t) Object.assign(t, patch); });
      return <div key={p.exerciseId} className="rounded-2xl border border-ink-line bg-bg-card p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0"><div className="font-medium text-sm truncate">{def?.name ?? p.exerciseId}</div>
            <div className="text-[11px] text-ink-mute tnum">{last ? `Last time: ${formatPrev(last, metric, units)}` : 'No history yet'} · {p.sets} set{p.sets === 1 ? '' : 's'}</div></div>
          <MuscleBadge muscle={def?.primaryMuscle ?? 'core'} />
        </div>
        <div className="flex items-end gap-2">
          {showWeight && <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wide text-ink-mute mb-1">Weight</div>
            {def?.equipment === 'band' ? <div className="h-11 rounded-lg bg-bg-input border border-ink-line text-sm font-semibold text-center text-ink-dim flex items-center justify-center">Band</div>
              : <InlineNumber value={weight} onChange={(v) => set({ weight: v ?? 0 })} step={wInc} min={0} decimals={wDecimals} unit={wLabel} />}</div>}
          {showReps && <>
            <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wide text-ink-mute mb-1">Reps low</div><InlineNumber value={slot.repsLow ?? 8} onChange={(v) => set({ repsLow: v ?? 1 })} step={1} min={1} max={50} unit="reps" /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wide text-ink-mute mb-1">Reps high</div><InlineNumber value={slot.repsHigh ?? 12} onChange={(v) => set({ repsHigh: v ?? 1 })} step={1} min={1} max={50} unit="reps" /></div>
          </>}
          {showTime && <>
            <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wide text-ink-mute mb-1">Time low</div><InlineNumber value={slot.timeLow ?? 30} onChange={(v) => set({ timeLow: v ?? 1 })} step={5} min={1} max={600} unit="s" /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wide text-ink-mute mb-1">Time high</div><InlineNumber value={slot.timeHigh ?? 60} onChange={(v) => set({ timeHigh: v ?? 1 })} step={5} min={1} max={600} unit="s" /></div>
          </>}
        </div>
        <div className="flex items-center gap-2 mt-2.5 text-[12px]">
          <span className="text-[10px] uppercase tracking-wide text-ink-mute">Rest</span>
          <select className="rounded-lg border border-ink-line bg-bg-input px-2 py-1.5 text-[12px]" value={p.restSeconds ?? ''} onChange={(e) => set({ restSeconds: e.target.value === '' ? undefined : Number(e.target.value) })}>
            <option value="">Workout default ({fmtRest(s.rest)})</option>
            {REST_OPTIONS.filter((r): r is number => r !== 'auto').map((r) => <option key={r} value={r}>{fmtRest(r)}</option>)}
          </select>
        </div>
      </div>;
    })}</div>
  </>);

  const renderReview = (s: WizState) => {
    const letters = groupLetters(entries);
    const totalSets = slots.reduce((a, x) => a + x.prescribedSets, 0);
    return (<>
      <SecHead>Name</SecHead>
      <TextField value={s.name} onChange={(e) => update((n) => { n.name = e.target.value; })} placeholder="Workout name" />
      <SecHead>Category</SecHead>
      <div className="flex flex-wrap gap-2">
        {chip(s.category == null, <>Auto · {CATEGORIES.find((c) => c.value === inferred)?.label}</>, () => update((n) => { n.category = null; }), 'auto')}
        {CATEGORIES.map((c) => chip(s.category === c.value, c.label, () => update((n) => { n.category = c.value; }), c.value))}
      </div>
      <SecHead>Muscles</SecHead>
      <div className="flex flex-wrap gap-1.5">{trainedMuscles.map((m) => <MuscleBadge key={m} muscle={m} />)}</div>
      <SecHead>Exercises · {totalSets} sets · ~{estimateMinutes(slots, workoutRest, defs)} min</SecHead>
      <div className="rounded-2xl border border-ink-line overflow-hidden">{entries.map((e, i) => {
        const slot = slots[i]!;
        const rng = slot.timeLow != null ? `${slot.timeLow}–${slot.timeHigh}s` : `${slot.repsLow}–${slot.repsHigh}`;
        const w = slot.startingWeightKg != null ? ` @ ${kgToDisplay(slot.startingWeightKg, units)} ${wLabel}` : '';
        const letter = e.supersetGroup != null ? letters.get(e.supersetGroup) : null;
        return <div key={e.exerciseId} className={`flex items-center gap-2 px-3.5 py-2.5 text-[13px] ${i > 0 ? 'border-t border-ink-line' : ''}`}>
          <MuscleBadge muscle={e.muscle} />
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{e.name}</div>
            <div className="text-[11px] text-ink-mute tnum">{slot.prescribedSets} × {rng}{w}{e.setStyle && e.setStyle !== 'straight' ? ` · ${e.setStyle}${letter ? ' ' + letter : ''}` : ''}{slot.restSeconds != null ? ` · rest ${fmtRest(slot.restSeconds)}` : ''}</div></div>
        </div>; })}</div>
      <div className="text-[12px] text-ink-dim mt-3">Rest: <span className="text-ink">{fmtRest(s.rest)}</span> · Rep range: <span className="text-ink">{INTENTS.find((i) => i.id === s.intent)?.label}</span></div>
      <div className="text-[12px] text-ink-mute mt-1">Library card will read: “{describeWorkout(slots, workoutRest, defs)}”</div>
    </>);
  };

  const body = !state || !libLoaded ? <p className="text-sm text-ink-dim py-6 text-center">Loading…</p>
    : stepId === 'setup' ? renderSetup(state)
    : stepId === 'muscles' ? renderMuscles(state)
    : stepId === 'exercises' ? renderExercises(state)
    : stepId === 'structure' ? renderStructure()
    : stepId === 'weights' ? renderWeights(state)
    : renderReview(state);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <header className="shrink-0 border-b border-ink-line bg-bg/90 backdrop-blur">
        <div className="mx-auto max-w-[720px] flex items-center justify-between px-[18px] h-12">
          <div className="flex items-center gap-2 font-bold tracking-wide"><span className="w-2.5 h-2.5 rounded bg-accent" />{modifyTemplateId ? 'Edit Workout' : 'New Workout'}</div>
          <div className="flex items-center gap-3">
            <div className="text-[12px] text-ink-dim font-mono">{step + 1} / {FLOW.length}</div>
            <button type="button" onClick={close} className="text-ink-mute hover:text-ink text-[13px] font-semibold px-1">Cancel</button>
          </div>
        </div>
        <div className="h-1 bg-ink-line"><div className="h-1 bg-accent transition-all" style={{ width: `${((step + 1) / FLOW.length) * 100}%` }} /></div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-[18px] py-5 pb-8">
          <Eyebrow n={step + 1} title={TITLES[stepId]} />
          {restored && !modifyTemplateId && note('info', <>Restored your unsaved workout. <button type="button" className="text-accent-hot font-semibold" onClick={startOver}>Start over</button></>)}
          {body}
        </div>
      </main>

      <footer className="shrink-0 border-t border-ink-line bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-[720px] px-[18px] py-3 flex items-center gap-2.5">
          {step > 0 ? <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button> : <Button variant="ghost" onClick={close}>Cancel</Button>}
          <div className="flex-1" />
          {step < FLOW.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>Continue</Button>
            : <Button onClick={handleSave} disabled={saving || slots.length === 0 || !state?.name.trim()}>{saving ? 'Saving…' : modifyTemplateId ? 'Save changes' : 'Save workout'}</Button>}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}
