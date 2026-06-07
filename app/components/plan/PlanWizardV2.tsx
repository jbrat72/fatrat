'use client';
/**
 * Plan Wizard v2 — UI (Chunk 2).
 *
 * 16-page guided flow, faithful to the approved mockup, driven by the
 * lib/wizard engine for all volume + generation math. Profile fields are
 * read-only from the user's FATRAT profile. This component does NOT persist
 * yet — "Start My Program" calls onComplete with the final state + generated
 * program; Chunk 3 wires materialization to Firestore + Edit-this-plan.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { GLOBAL_EXERCISES } from '@/lib/firestore/seed';
import type { MuscleGroup, UserProfile } from '@/types';
import type {
  WizardState, WizGoal, WizExperience, WizStatus, WizTier, BaseStyle,
  VolumeFramework, PeriodizationStrategy, RepRange, CoreMethod, RestPref,
  GeneratedDay, GeneratedExercise,
} from '@/lib/wizard/types';
import { WIZARD_MUSCLES } from '@/lib/wizard/types';
import {
  SPLIT_SEQ, availableEquipment, weekStructure,
  muscleSetsForWeek, timesPerWeek, durationWeeks,
  poolFor, generateWeek,
} from '@/lib/wizard/engine';

const TOTAL = 16;
const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_OFFSETS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function defaultRestDays(startDow: number, d: number): number[] {
  const work = new Set(DAY_OFFSETS[d] || []); const rest: number[] = [];
  for (let off = 0; off < 7; off++) if (!work.has(off)) rest.push((startDow + off) % 7);
  return rest;
}
function nextDowStr(dow: number): string {
  const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/* ---- profile mapping ---- */
function ageBandFromDob(dob?: string): WizardState['profile']['ageBand'] {
  if (!dob) return '30';
  const age = Math.floor((Date.now() - new Date(dob + 'T00:00:00').getTime()) / 3.15576e10);
  if (age < 18) return 'u18'; if (age < 30) return '18'; if (age < 40) return '30';
  if (age < 50) return '40'; if (age < 60) return '50'; return '60';
}
const INJURY_MAP: Record<string, string> = { 'lower-back': 'lowback', shoulders: 'shoulder', knees: 'knee', wrists: 'elbow', elbows: 'elbow' };

function initState(user: UserProfile): WizardState {
  const injuries = (user.constraints?.injurySites || []).map((s) => INJURY_MAP[s]).filter(Boolean) as string[];
  return {
    name: '',
    goal: { primary: null, secondary: null },
    experience: { level: null, status: null },
    profile: {
      ageBand: ageBandFromDob(user.dob),
      sex: user.sex === 'female' ? 'female' : 'male',
      bodyWeightKg: user.weightKg ?? 80,
      injuries, stubbornAreas: [],
    },
    schedule: { daysPerWeek: null, sessionMinutes: null, startDow: 1, restDays: [], durationWeeks: null },
    equipment: { environment: null, items: [] },
    trainingStyle: { baseStyle: null, volumeFramework: null, periodizationStrategy: null },
    split: { type: null },
    prioritization: { tiers: {} },
    setsAndReps: { repRange: null, setTypes: [], autoVary: false },
    restAndTempo: { restPreference: null, tempoEnabled: false, tempoStyle: null },
    core: { method: null, frequency: null, blockExercises: '2-3', days: [] },
    cardio: { included: null, type: [], frequency: null, placement: null, durationMinutes: null },
    progression: { type: null, deloadProtocol: null, deloadFrequency: null, deloadStyle: null },
    baselines: { methods: {}, values: {}, calibrationWeek: false, allConservative: false },
  };
}

/* ---- small helpers ---- */
function levelRank(l: WizExperience | null) { return ({ beginner: 0, novice: 1, intermediate: 2, advanced: 3 } as Record<string, number>)[l || ''] ?? 0; }
function effLevel(s: WizardState): WizExperience | null {
  let l = s.experience.level;
  if (s.experience.status === 'layoff12' && l) { const o: WizExperience[] = ['beginner', 'novice', 'intermediate', 'advanced']; const i = o.indexOf(l); if (i > 0) return o[i - 1]; }
  return l;
}
const isBeginnerScratch = (s: WizardState) => s.experience.level === 'beginner' && s.experience.status === 'scratch';

export interface PlanWizardV2Props {
  user: UserProfile;
  initialName?: string;
  onClose?: () => void;
  onComplete?: (state: WizardState, program: Record<number, GeneratedDay[]>) => void;
}

export function PlanWizardV2({ user, initialName, onClose, onComplete }: PlanWizardV2Props) {
  const [state, setState] = useState<WizardState>(() => { const s = initState(user); if (initialName) s.name = initialName; return s; });
  const [page, setPage] = useState(0);
  const [program, setProgram] = useState<Record<number, GeneratedDay[]>>({});
  const [seen, setSeen] = useState(false);
  const seenPages = useRef<Set<number>>(new Set());
  const pageRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);

  const update = (fn: (s: WizardState) => void) => setState((s) => { const n: WizardState = structuredClone(s); fn(n); return n; });

  /* ---------- derived option lists & defaults (mirror mockup) ---------- */
  const lib = GLOBAL_EXERCISES;

  function allowedBaseStyles() {
    const g = state.goal.primary, lv = effLevel(state), d = state.schedule.daysPerWeek || 0;
    const score = (p: BaseStyle): { s: number; why: string | null } => {
      let s = 0, why: string | null = null;
      if (p === 'powerlifting' && (g === 'strength' || g === 'athletic')) { s += 3; why = 'Strength-focused goal with barbell access.'; }
      if (p === 'bodybuilding' && g === 'muscle' && levelRank(lv) >= 2 && d >= 4) { s += 3; why = `Build Muscle, ${d} days, ${lv}.`; }
      if (p === 'bodybuilding' && g === 'leanout') { s += 3; why = 'Preserve existing muscle with familiar stimulus.'; }
      if (p === 'hit' && levelRank(lv) < 2) s -= 99;
      if (p === 'powerbuilding' && g === 'transform') { s += 3; why = 'Maximize newbie gains + fat loss.'; }
      if (p === 'powerbuilding' && (g === 'athletic' || g === 'strength' || (g === 'muscle' && d <= 3))) { s += 2; why = 'Blends strength and size.'; }
      if (p === 'fullbody' && (state.experience.level === 'beginner' || d <= 3 || g === 'fitness' || g === 'transform')) { s += 2; why = 'Great for beginners, transform, lower frequency.'; }
      if (p === 'calisthenics' && state.equipment.environment === 'bodyweight') { s += 5; why = 'Bodyweight-only equipment.'; }
      return { s, why };
    };
    let list = BASE_STYLES.map((p) => ({ ...p, ...score(p.id) }));
    if (state.equipment.environment === 'bodyweight') list = list.filter((p) => ['calisthenics', 'fullbody'].includes(p.id));
    else if (state.experience.level === 'beginner') list = list.filter((p) => ['powerlifting', 'bodybuilding', 'fullbody', 'calisthenics'].includes(p.id));
    else if (state.experience.level === 'novice') list = list.filter((p) => p.id !== 'hit');
    return list.sort((a, b) => b.s - a.s);
  }
  function defaultVolumeFramework(): VolumeFramework {
    const bs = state.trainingStyle.baseStyle, lv = effLevel(state);
    if (bs === 'hit' || bs === 'fullbody') return 'med';
    if (state.equipment.environment === 'bodyweight') return 'auto';
    if (state.experience.level === 'beginner' || state.experience.level === 'novice') return 'fixed';
    if (bs === 'bodybuilding' || state.goal.primary === 'leanout') return 'evidence';
    if (levelRank(lv) >= 3) return 'auto';
    return 'evidence';
  }
  const volumeAllowed = (id: VolumeFramework) => state.trainingStyle.baseStyle === 'hit' ? id === 'med' : !(state.experience.level === 'beginner' && id === 'auto');
  function defaultPeriodization(): PeriodizationStrategy {
    const bs = state.trainingStyle.baseStyle;
    if (state.experience.level === 'beginner' || bs === 'hit') return 'none';
    if (bs === 'powerbuilding') return 'dup';
    return 'none';
  }
  function periodizationAllowed(id: PeriodizationStrategy) {
    const bs = state.trainingStyle.baseStyle, wks = durationWeeks(state);
    if (state.experience.level === 'beginner') return id === 'none';
    if (bs === 'hit') return id === 'none';
    if (state.experience.level === 'novice') return id === 'none' || id === 'dup';
    return true;
  }
  function allowedSplits() {
    let list = (SPLITS[state.schedule.daysPerWeek || 0] || []).slice();
    const ph = state.trainingStyle.baseStyle;
    if (ph === 'fullbody' || ph === 'hit') list = list.filter((s) => s.id.startsWith('fb'));
    if (list.length === 0 && (ph === 'fullbody' || ph === 'hit')) list = [{ id: 'fb3', label: 'Full Body', sub: 'Every muscle each session' }];
    const boost = (id: string) => { const i = list.findIndex((s) => s.id === id); if (i > 0) { const [x] = list.splice(i, 1); list.unshift({ ...x, boosted: true }); } };
    if (ph === 'bodybuilding' && (state.schedule.daysPerWeek || 0) >= 5) { boost('bro'); boost('ppl2'); }
    if (ph === 'powerbuilding' && state.schedule.daysPerWeek === 4) boost('phul');
    if (state.goal.primary === 'strength' && state.schedule.daysPerWeek === 4) boost('ul2');
    return list;
  }
  function defaultTier(m: MuscleGroup): WizTier {
    const g = state.goal.primary;
    if (g === 'strength') return (['chest', 'back', 'quads'] as string[]).includes(m) ? 'emphasize' : (['biceps', 'forearms', 'calves'] as string[]).includes(m) ? 'maintain' : 'grow';
    if (g === 'athletic') return (['quads', 'hamstrings', 'glutes'] as string[]).includes(m) ? 'emphasize' : (['biceps', 'forearms', 'calves'] as string[]).includes(m) ? 'maintain' : 'grow';
    if (g === 'transform') return (['chest', 'back', 'quads'] as string[]).includes(m) ? 'emphasize' : 'grow';
    return 'grow';
  }

  /* ---------- onEnter side-effects per page ---------- */
  function onEnter(p: number) {
    update((s) => {
      if (p === 3 && s.schedule.daysPerWeek && s.schedule.restDays.length === 0) s.schedule.restDays = defaultRestDays(s.schedule.startDow, s.schedule.daysPerWeek);
      if (p === 4) { if (s.equipment.environment === 'commercial' && s.equipment.items.length === 0) s.equipment.items = ALL_EQUIP.slice(); if (s.equipment.environment === 'hotel' && s.equipment.items.length === 0) s.equipment.items = ['Resistance Bands']; }
      if (p === 6 && s.schedule.restDays.length === 0 && s.schedule.daysPerWeek) s.schedule.restDays = defaultRestDays(s.schedule.startDow, s.schedule.daysPerWeek);
      if (p === 7 && Object.keys(s.prioritization.tiers).length === 0) WIZARD_MUSCLES.forEach((m) => (s.prioritization.tiers[m] = defaultTier(m)));
      if (p === 8) {
        if (!s.setsAndReps.repRange) { const bs = s.trainingStyle.baseStyle, g = s.goal.primary; s.setsAndReps.repRange = bs === 'powerlifting' ? 'strength' : bs === 'bodybuilding' ? 'hypertrophy' : bs === 'powerbuilding' ? 'mixed' : g === 'transform' ? 'mixed' : g === 'leanout' ? 'hypertrophy' : g === 'strength' ? 'strength' : 'hypertrophy'; }
        if (s.setsAndReps.setTypes.length === 0) s.setsAndReps.setTypes = ['straight'];
        if (s.trainingStyle.baseStyle === 'hit') s.setsAndReps.setTypes = ['straight'];
      }
      if (p === 9 && !s.restAndTempo.restPreference) { const bs = s.trainingStyle.baseStyle, g = s.goal.primary; s.restAndTempo.restPreference = (bs === 'powerlifting' || g === 'strength') ? 'long' : (g === 'transform' || g === 'leanout' || g === 'fitness' || g === 'muscle') ? 'moderate' : 'auto'; }
      if (p === 10 && !s.core.method) { const bs = s.trainingStyle.baseStyle; s.core.method = bs === 'bodybuilding' ? 'block' : (bs === 'fullbody' || bs === 'hit') ? 'superset' : s.goal.primary === 'athletic' ? 'superset' : 'block'; s.core.frequency = s.experience.level === 'beginner' ? '2x' : s.goal.primary === 'athletic' ? '3x' : 'everyother'; }
      if (p === 11 && s.cardio.included === null) { const g = s.goal.primary; if (g === 'transform') Object.assign(s.cardio, { included: 'yes', type: ['hiit', 'liss'], frequency: 3, placement: 'offdays', durationMinutes: 20 }); else if (g === 'leanout') Object.assign(s.cardio, { included: 'yes', type: ['liss'], frequency: 3, placement: 'offdays', durationMinutes: 30 }); else if (g === 'athletic') Object.assign(s.cardio, { included: 'yes', type: ['circuit'], frequency: 2, placement: 'separate', durationMinutes: 20 }); else if (g === 'fitness') Object.assign(s.cardio, { included: 'yes', type: ['liss', 'hiit'], frequency: 3, placement: 'separate', durationMinutes: 30 }); else if (g === 'muscle' || g === 'strength') s.cardio.included = 'no'; }
      if (p === 12 && !s.progression.type) { const lv = effLevel(s); s.progression.type = s.experience.level === 'beginner' ? 'linear' : levelRank(lv) >= 3 ? 'rpe' : 'double'; if (s.trainingStyle.periodizationStrategy === 'dup') s.progression.type = 'undulating'; if (s.trainingStyle.baseStyle === 'hit') s.progression.type = 'double'; if (!s.progression.deloadProtocol) { s.progression.deloadProtocol = 'scheduled'; s.progression.deloadFrequency = 4; s.progression.deloadStyle = 'volume'; } }
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onEnter(page); }, [page]);
  // Normalize training-style modifiers whenever the base style changes.
  useEffect(() => {
    const bs = state.trainingStyle.baseStyle;
    if (bs === ('auto' as BaseStyle)) {
      const top = (allowedBaseStyles()[0]?.id) || 'fullbody';
      update((s) => { s.trainingStyle.baseStyle = top as BaseStyle; s.trainingStyle.volumeFramework = null; s.trainingStyle.periodizationStrategy = null; });
      return;
    }
    if (bs) update((s) => {
      if (s.trainingStyle.baseStyle === 'hit') { s.trainingStyle.volumeFramework = 'med'; s.trainingStyle.periodizationStrategy = 'none'; return; }
      if (!s.trainingStyle.volumeFramework) s.trainingStyle.volumeFramework = defaultVolumeFramework();
      if (!s.trainingStyle.periodizationStrategy) s.trainingStyle.periodizationStrategy = defaultPeriodization();
    });
    /* eslint-disable-next-line */
  }, [state.trainingStyle.baseStyle]);
  // Generate the program for the review/exercises pages (effect, not during render).
  useEffect(() => {
    if (page !== 15) return;
    const { cols, loadCount } = weekStructure(state);
    const loads = cols.filter((c) => c.kind === 'load');
    const wk = loads[0] || cols[0];
    if (wk && !program[0]) {
      const days = generateWeek(state, lib, wk, loadCount).map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      setProgram({ 0: days });
    }
    /* eslint-disable-next-line */
  }, [page, program]);

  /* ---------- generation for page 16 ---------- */

  /* ---------- nav + gating ---------- */
  useEffect(() => {
    const onScroll = () => { if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 12) { setSeen(true); seenPages.current.add(page); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page]);
  // after render of a page/selection: scroll to next section + auto-seen for short pages
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pendingScroll.current != null) {
      const idx = pendingScroll.current; pendingScroll.current = null;
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToSection(idx)));
    }
    const fits = document.body.scrollHeight <= window.innerHeight + 8;
    if (fits || seenPages.current.has(page)) setSeen(true);
  }, [state, page]);
  function sectionAnchors(): HTMLElement[] {
    const p = pageRef.current; if (!p) return [];
    return Array.prototype.filter.call(p.children, (c: Element) => c.classList && (c.classList.contains('wz-sec') || c.classList.contains('wz-field'))) as HTMLElement[];
  }
  function nextSectionIdx(el: HTMLElement): number { const ct = el.getBoundingClientRect().top + window.scrollY; let idx = 0; sectionAnchors().forEach((a) => { if (a.getBoundingClientRect().top + window.scrollY <= ct + 1) idx++; }); return idx; }
  function scrollToSection(idx: number) { const secs = sectionAnchors(); const el = secs[idx]; if (!el) return; const top = el.getBoundingClientRect().top + window.scrollY - 84; window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }

  function goTo(i: number) { setSeen(seenPages.current.has(i)); setPage(i); window.scrollTo(0, 0); }
  function next() { if (!isValid()) return; if (page === 14) { setProgram({}); setPage(15); window.scrollTo(0, 0); setSeen(seenPages.current.has(15)); return; } if (page < TOTAL - 1) goTo(page + 1); else onComplete?.(state, program); }
  function back() { if (page > 0) goTo(page - 1); }

  /* selection that advances to next section */
  function selectSingle(el: HTMLElement | null, fn: (s: WizardState) => void) {
    if (el) pendingScroll.current = nextSectionIdx(el);
    update(fn);
  }

  /* ---------- validity per page ---------- */
  function isValid(): boolean {
    const s = state;
    switch (page) {
      case 0: return !!s.goal.primary;
      case 1: return !!s.experience.level && !!s.experience.status;
      case 2: return true;
      case 3: return !!s.schedule.daysPerWeek && !!s.schedule.sessionMinutes && !!s.schedule.durationWeeks;
      case 4: return !!s.equipment.environment;
      case 5: return !!s.trainingStyle.baseStyle && !!s.trainingStyle.volumeFramework && !!s.trainingStyle.periodizationStrategy;
      case 6: if (!s.split.type) return false; if (s.split.type === 'custom') return !!s.split.customDays && s.split.customDays.length > 0 && s.split.customDays.every((d) => d.length > 0); return true;
      case 7: return true;
      case 8: return !!s.setsAndReps.repRange && (s.trainingStyle.baseStyle === 'hit' || s.setsAndReps.setTypes.length > 0);
      case 9: return s.trainingStyle.baseStyle === 'hit' || !!s.restAndTempo.restPreference;
      case 10: return !!s.core.method && !(s.core.method === 'day' && s.core.days.length === 0);
      case 11: return s.cardio.included !== null;
      case 12: return !!s.progression.type && !!s.progression.deloadProtocol;
      default: return true;
    }
  }

  /* =====================================================================
     RENDER
  ===================================================================== */
  // ---- shared UI atoms ----
  const note = (type: 'info' | 'warn' | 'ok', txt: React.ReactNode) => {
    const cls = type === 'warn' ? 'border-warn/40 bg-warn/10' : type === 'ok' ? 'border-ok/30 bg-ok/10' : 'border-info/30 bg-info/10';
    const ic = type === 'warn' ? '⚠' : type === 'ok' ? '✓' : 'ℹ';
    return <div className={`flex gap-2.5 rounded-xl border ${cls} px-3.5 py-3 text-[13px] my-3`}><span className="shrink-0">{ic}</span><span>{txt}</span></div>;
  };
  const SecHead = ({ children }: { children: React.ReactNode }) => <div className="wz-sec text-[11px] font-semibold uppercase tracking-wider text-ink-dim mt-5 mb-2.5">{children}</div>;
  function cardChoice(sel: boolean, onClick: (e: React.MouseEvent) => void, label: React.ReactNode, desc?: React.ReactNode, extra?: React.ReactNode) {
    return (
      <button type="button" onClick={onClick} className={`relative w-full text-left rounded-2xl border p-4 transition ${sel ? '!border-accent !bg-accent/10' : 'border-ink-line bg-bg-card hover:border-ink-mute'}`}>
        <span className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${sel ? 'bg-accent border-accent text-white' : 'border-ink-line'}`}>{sel ? '✓' : ''}</span>
        <div className="font-semibold text-[15px] pr-7 flex items-center gap-2 flex-wrap">{label}</div>
        {desc && <div className="text-[13px] text-ink-dim mt-1">{desc}</div>}
        {extra}
      </button>
    );
  }
  const chip = (sel: boolean, label: React.ReactNode, onClick: (e: React.MouseEvent) => void, key?: string | number, disabled?: boolean) => (
    <button key={key} type="button" disabled={disabled} onClick={onClick} className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-30 ${sel ? 'border-accent bg-accent/15 text-ink' : 'border-ink-line bg-bg-card text-ink-dim hover:text-ink'}`}>{label}</button>
  );
  const badge = (kind: 'rec' | 'fit' | 'lvl', txt: string) => {
    const c = kind === 'rec' ? 'bg-accent/15 text-accent-hot' : kind === 'fit' ? 'bg-ok/15 text-ok' : 'bg-info/15 text-info';
    return <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${c}`}>{txt}</span>;
  };

  /* ---------- page renderers ---------- */
  const pages: Record<number, () => React.ReactNode> = {
    0: () => {
      const sel = state.goal.primary;
      const secOpts = [
        { id: 'muscle', label: '…build more muscle', hide: ['muscle', 'transform'] },
        { id: 'strength', label: '…get stronger', hide: ['strength', 'transform'] },
        { id: 'loss', label: '…trim down / lose fat', hide: ['transform', 'leanout'] },
        { id: 'cond', label: '…improve conditioning', hide: ['fitness'] },
      ].filter((o) => !o.hide.includes(sel || ''));
      return (<>
        <Eyebrow n={1} title="Let's build your program" sub="Name it for your library, then pick your main goal — every later page adapts to it." />
        <div className="wz-field mb-4"><label className="block text-[13px] font-semibold mb-1.5">Program name</label>
          <input className="w-full rounded-lg border border-ink-line bg-bg-input px-3 py-2.5 text-[15px]" placeholder="e.g. Summer Cut 2026" value={state.name} onChange={(e) => update((s) => { s.name = e.target.value; })} /></div>
        <SecHead>Primary goal</SecHead>
        <div className="grid gap-2.5">{GOALS.map((g) => cardChoice(sel === g.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.goal.primary = g.id; s.goal.secondary = null; }), g.label, g.desc))}</div>
        {sel && <><SecHead>I also want to… (optional)</SecHead><div className="flex flex-wrap gap-2">{secOpts.map((o) => chip(state.goal.secondary === o.id, o.label, () => update((s) => { s.goal.secondary = s.goal.secondary === o.id ? null : o.id; }), o.id))}</div></>}
      </>);
    },
    1: () => (<>
      <Eyebrow n={2} title="How much training experience?" sub="“Consistent” = at least 3×/week on a structured program, not occasional gym visits." />
      <div className="grid gap-2.5">{EXPERIENCE.map((o) => cardChoice(state.experience.level === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.experience.level = o.id; }), o.label, o.desc))}</div>
      <SecHead>Current status</SecHead>
      <div className="grid gap-2.5">{STATUS.map((o) => cardChoice(state.experience.status === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.experience.status = o.id; }), o.label))}</div>
      {['break_short', 'break_long', 'layoff12'].includes(state.experience.status || '') && note('info', 'We’ll add a 1–2 week ramp-up note.' + (state.experience.status === 'layoff12' ? ' After 12+ months off, volume defaults drop one tier.' : ''))}
    </>),
    2: () => {
      const bands: Record<string, string> = { u18: 'Under 18', '18': '18–29', '30': '30–39', '40': '40–49', '50': '50–59', '60': '60+' };
      return (<>
        <Eyebrow n={3} title="Body profile & constraints" sub="Your basics come from your FATRAT profile. Tell us what to target and work around." />
        <div className="wz-field rounded-2xl border border-ink-line bg-bg-card p-4">
          <div className="flex justify-between items-center mb-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim">From your profile</div></div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[14px]">
            <Field k="Age" v={bands[state.profile.ageBand]} /><Field k="Sex" v={cap(state.profile.sex)} />
            <Field k="Weight" v={`${user.units === 'metric' ? state.profile.bodyWeightKg + ' kg' : Math.round(state.profile.bodyWeightKg * 2.205) + ' lb'}`} />
            <Field k="Height" v={user.heightCm ? (user.units === 'metric' ? user.heightCm + ' cm' : Math.round(user.heightCm / 2.54) + ' in') : '—'} />
          </div>
        </div>
        <SecHead>Stubborn areas you want to work on (optional)</SecHead>
        <div className="grid gap-2.5">{STUBBORN.map((o) => cardChoice(state.profile.stubbornAreas.includes(o.id), () => update((s) => toggle(s.profile.stubbornAreas, o.id)), o.label))}</div>
        <SecHead>Injuries or limitations (optional)</SecHead>
        <div className="grid gap-2.5">{INJURIES.map((o) => cardChoice(state.profile.injuries.includes(o.id), () => update((s) => toggle(s.profile.injuries, o.id)), o.label, o.desc))}</div>
        {state.profile.injuries.length > 0 && note('info', 'Flagged areas trigger automatic exercise substitutions (e.g. lower-back → trap-bar deadlift).')}
      </>);
    },
    3: () => (<>
      <Eyebrow n={4} title="Schedule & availability" sub="Determines which splits are possible and how much fits per session." />
      <div className="wz-field mb-1"><label className="block text-[13px] font-semibold mb-1.5">How many days per week?</label>
        <div className="flex flex-wrap gap-2">{[2, 3, 4, 5, 6, 7].map((n) => chip(state.schedule.daysPerWeek === n, String(n), (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.schedule.daysPerWeek = n; s.schedule.restDays = defaultRestDays(s.schedule.startDow, n); s.split.type = null; }), n))}</div></div>
      <div className="wz-field"><label className="block text-[13px] font-semibold mb-1.5 mt-3">Session length</label>
        <div className="flex flex-wrap gap-2">{[30, 45, 60, 75, 90].map((n) => chip(state.schedule.sessionMinutes === n, n + (n === 90 ? '+ min' : ' min'), (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.schedule.sessionMinutes = n; }), n))}</div></div>
      <div className="wz-field"><label className="block text-[13px] font-semibold mb-1.5 mt-3">Start day</label>
        <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map((d) => chip(state.schedule.startDow === d, DOW_ABBR[d], (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.schedule.startDow = d; s.schedule.restDays = defaultRestDays(d, s.schedule.daysPerWeek || 0); }), d))}</div>
        <p className="text-[12px] text-ink-mute mt-1.5">Starts {nextDowStr(state.schedule.startDow)}.</p></div>
      <div className="wz-field"><label className="block text-[13px] font-semibold mb-1.5 mt-3">Program duration</label>
        <div className="flex flex-wrap gap-2">{[{ id: 4, label: '4 weeks' }, { id: 6, label: '6 weeks' }, { id: 8, label: '8 weeks' }, { id: 12, label: '12 weeks' }, { id: 'ongoing', label: 'Ongoing' }].map((o) => chip(state.schedule.durationWeeks === o.id, o.label, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.schedule.durationWeeks = o.id as number | 'ongoing'; }), String(o.id)))}</div></div>
    </>),
    4: () => {
      const env = state.equipment.environment;
      return (<>
        <Eyebrow n={5} title="Equipment access" sub="Filters the exercise library to what you can actually do." />
        <div className="grid gap-2.5">{ENVIRONMENTS.map((o) => cardChoice(env === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.equipment.environment = o.id; if (o.id === 'commercial') s.equipment.items = ALL_EQUIP.slice(); else if (o.id === 'hotel') s.equipment.items = ['Resistance Bands']; else if (o.id !== 'bodyweight') s.equipment.items = []; }), o.label, o.desc))}</div>
        {env && env !== 'bodyweight' && Object.entries(EQUIP_GROUPS).map(([grp, items]) => (
          <Fragment key={grp}><SecHead>{grp}</SecHead><div className="flex flex-wrap gap-2">{items.map((i) => chip(state.equipment.items.includes(i), i, () => update((s) => toggle(s.equipment.items, i)), i))}</div></Fragment>
        ))}
        {env === 'bodyweight' && note('ok', 'Bodyweight selected — Calisthenics boosted, 1RM replaced with bodyweight milestones.')}
      </>);
    },
    5: () => {
      const list = allowedBaseStyles();
      return (<>
        <Eyebrow n={6} title="Training style & modifiers" sub="First, how your sessions are structured. Then two refinements — most people leave them on the defaults." />
        <SecHead>Base training style</SecHead>
        <div className="grid gap-2.5">{list.map((p, i) => cardChoice(state.trainingStyle.baseStyle === p.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.trainingStyle.baseStyle = p.id; s.trainingStyle.volumeFramework = null; s.trainingStyle.periodizationStrategy = null; }), <>{p.label} {i === 0 && p.s > 0 ? badge('rec', 'Recommended') : p.s > 0 ? badge('fit', 'Good fit') : null}</>, p.desc, p.why && p.s > 0 ? <div className="text-[12px] text-ok mt-1.5">★ {p.why}</div> : null))}
          {cardChoice(false, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.trainingStyle.baseStyle = 'auto' as BaseStyle; }), 'Not sure — recommend everything for me', 'We’ll pick the style and both modifiers.')}</div>
        {state.trainingStyle.baseStyle && state.trainingStyle.baseStyle !== ('auto' as BaseStyle) && <>
          <SecHead>Volume framework</SecHead>
          <div className="grid gap-2.5">{VOL_FRAMEWORKS.filter((v) => volumeAllowed(v.id)).map((v) => cardChoice(state.trainingStyle.volumeFramework === v.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.trainingStyle.volumeFramework = v.id; }), <>{v.label} {v.id === defaultVolumeFramework() ? badge('rec', 'Default') : null}</>, v.desc))}</div>
          {state.trainingStyle.baseStyle === 'hit' && note('info', 'HIT locks volume to Minimum Effective Dose — it rejects the volume paradigm by design.')}
          <SecHead>Periodization strategy</SecHead>
          <div className="grid gap-2.5">{PERIODIZATIONS.filter((p) => periodizationAllowed(p.id)).map((p) => cardChoice(state.trainingStyle.periodizationStrategy === p.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.trainingStyle.periodizationStrategy = p.id; }), <>{p.label} {p.id === defaultPeriodization() ? badge('rec', 'Default') : null}</>, p.desc))}</div>
          </>}
      </>);
    },
    6: () => {
      const list = [...allowedSplits(), { id: 'custom', label: 'Custom — build each day', sub: 'Assign muscle groups to each training day yourself', boosted: false }];
      return (<>
        <Eyebrow n={7} title="Training split & rest days" sub={`How muscle groups spread across your ${state.schedule.daysPerWeek} days. Only feasible options shown.`} />
        <div className="grid gap-2.5">{list.map((sp) => (<div key={sp.id}>
          {cardChoice(state.split.type === sp.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.split.type = sp.id; if (sp.id === 'custom') { const n = s.schedule.daysPerWeek || 0; if (!s.split.customDays || s.split.customDays.length !== n) s.split.customDays = Array.from({ length: n }, () => [] as MuscleGroup[]); } }), <>{sp.label} {sp.boosted ? badge('rec', 'Top pick') : null}</>, sp.sub, state.split.type === sp.id ? splitPreview(sp.id) : null)}
          {state.split.type === sp.id ? restPicker() : null}
          {state.split.type === sp.id && sp.id === 'custom' ? customBuilder() : null}
        </div>))}</div>
        {state.split.type === 'custom' && (state.split.customDays || []).some((d) => d.length === 0) && note('warn', 'Assign at least one muscle group to every training day to continue.')}
      </>);
    },
    7: () => {
      const tiers = state.prioritization.tiers; const nE = Object.values(tiers).filter((t) => t === 'emphasize').length;
      return (<>
        <Eyebrow n={8} title="Prioritize muscles" sub="Emphasize the 2–3 you most want to grow. Grow = moderate. Maintain = once a week. N/A drops it." />
        <div className={`text-[12px] mb-3 ${nE >= 3 ? 'text-warn' : 'text-ink-mute'}`}>{nE} / 3 emphasized</div>
        <div className="space-y-1.5">{WIZARD_MUSCLES.map((m) => { const t = tiers[m]; const na = t == null; return (
          <div key={m} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[13px] font-semibold">{cap(m)}</span>
            <button type="button" onClick={() => update((s) => { delete s.prioritization.tiers[m]; })} className={`h-9 w-11 shrink-0 rounded-lg text-[11px] font-semibold border ${na ? 'bg-bg-elev border-ink-dim text-ink' : 'bg-bg-input border-ink-line text-ink-mute'}`}>N/A</button>
            <div className="flex-1 grid grid-cols-3 gap-1.5">{(['maintain', 'grow', 'emphasize'] as WizTier[]).map((tt) => { const on = t === tt; const blocked = tt === 'emphasize' && !on && nE >= 3; return (
              <button key={tt} type="button" disabled={blocked} onClick={() => update((s) => { s.prioritization.tiers[m] = tt; })} className={`h-9 rounded-lg text-[12px] font-semibold border disabled:opacity-30 ${on && tt === 'maintain' ? 'bg-bg-elev border-ink-dim text-ink' : on && tt === 'grow' ? 'bg-info/20 border-info text-info' : on && tt === 'emphasize' ? 'bg-accent border-accent text-white' : 'bg-bg-input border-ink-line text-ink-dim'}`}>{cap(tt)}</button>
            ); })}</div>
          </div>
        ); })}</div>
        {nE > 3 && note('warn', 'Emphasizing too many dilutes the benefit — 3 at most is recommended.')}
      </>);
    },
    8: () => (<>
      <Eyebrow n={9} title="Sets & rep preferences" sub="Pre-set by your training style — override anything." />
      <SecHead>Primary rep range</SecHead>
      <div className="grid gap-2.5">{REP_RANGES.map((o) => cardChoice(state.setsAndReps.repRange === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.setsAndReps.repRange = o.id; }), o.label, o.desc))}</div>
      {state.trainingStyle.baseStyle === 'hit' ? note('info', 'HIT uses one working set to failure. Intensity techniques apply within that single set.') : <>
        <SecHead>Set types (pick at least one)</SecHead>
        <div className="grid gap-2.5">{SET_TYPES.map((o) => { const lv = levelRank(effLevel(state)); const dis = lv < o.min; return cardChoice(state.setsAndReps.setTypes.includes(o.id), () => { if (dis) return; update((s) => toggle(s.setsAndReps.setTypes, o.id)); }, <>{o.label} {dis ? badge('lvl', ['', 'Novice+', 'Intermediate+', 'Advanced'][o.min]) : null}</>, o.desc); })}</div>
      </>}
    </>),
    9: () => (<>
      <Eyebrow n={10} title="Rest periods & tempo" sub="Affects session length, stimulus and energy systems." />
      {state.trainingStyle.baseStyle === 'hit' ? note('info', 'HIT: rest between exercises is 1–2 min. Tempo defaults to controlled negatives.') : <>
        <SecHead>Rest between sets</SecHead>
        <div className="grid gap-2.5">{REST_OPTS.map((o) => cardChoice(state.restAndTempo.restPreference === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.restAndTempo.restPreference = o.id; }), <>{o.label} {o.id === 'auto' ? badge('rec', 'Recommended') : null}</>, o.desc))}</div>
      </>}
      <SecHead>Tempo prescription</SecHead>
      {cardChoice(state.restAndTempo.tempoEnabled, () => update((s) => { s.restAndTempo.tempoEnabled = !s.restAndTempo.tempoEnabled; }), 'Prescribe rep tempo', 'Adds time-under-tension control. Off by default.')}
    </>),
    10: () => {
      const tight = state.schedule.sessionMinutes === 30;
      const freq = () => (<><SecHead>Core frequency</SecHead><div className="flex flex-wrap gap-2">{[{ id: 'every', label: 'Every session' }, { id: 'everyother', label: 'Every other' }, { id: '2x', label: '2×/week' }, { id: '3x', label: '3×/week' }].map((o) => chip(state.core.frequency === o.id, o.label, () => update((s) => { s.core.frequency = o.id; }), o.id))}</div></>);
      const qty = () => (<><SecHead>Exercises per core session</SecHead><div className="flex flex-wrap gap-2">{['1-2', '2-3', '3-4'].map((o) => chip(state.core.blockExercises === o, o + ' exercises', () => update((s) => { s.core.blockExercises = o; }), o))}</div></>);
      const dayPick = () => (<><SecHead>Which day(s)?</SecHead><div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, p) => { const dow = (state.schedule.startDow + p) % 7; const on = state.core.days.includes(dow); return <button key={p} type="button" onClick={() => update((s) => toggle(s.core.days, dow))} className={`h-9 rounded-lg border text-[11px] font-semibold ${on ? 'bg-accent/15 border-accent/40 text-accent-hot' : 'bg-bg-input border-ink-line text-ink-dim'}`}>{DOW_ABBR[dow]}</button>; })}</div></>);
      return (<>
        <Eyebrow n={11} title="Core & abs strategy" sub="Intentionally programmed — not an afterthought." />
        <div className="grid gap-2.5">{CORE_METHODS.map((o) => { const dis = (o.id === 'block' || o.id === 'day') && tight; const seld = state.core.method === o.id; return (<div key={o.id}>
          {cardChoice(seld, () => { if (dis) return; update((s) => { s.core.method = o.id; }); }, o.label, o.desc)}
          {seld && (o.id === 'block') && <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5">{qty()}{freq()}</div>}
          {seld && (o.id === 'day') && <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5">{dayPick()}{qty()}</div>}
          {seld && (o.id === 'superset') && <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5">{freq()}</div>}
        </div>); })}</div>
        {state.core.method === 'day' && state.core.days.length === 0 && note('warn', 'Pick at least one day for your dedicated core session.')}
      </>);
    },
    11: () => (<>
      <Eyebrow n={12} title="Cardio & conditioning" sub="Pre-filled from your goal — adjust freely." />
      <div className="grid gap-2.5">{[{ id: 'yes', label: 'Yes — include it' }, { id: 'restdays', label: 'On rest days only', desc: 'Guidelines, not structured workouts' }, { id: 'no', label: 'No — skip cardio' }].map((o) => cardChoice(state.cardio.included === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.cardio.included = o.id; }), o.label, (o as { desc?: string }).desc))}</div>
      {state.cardio.included === 'yes' && <>
        <SecHead>Type</SecHead><div className="grid gap-2.5">{[{ id: 'liss', label: 'Steady-State (LISS)' }, { id: 'hiit', label: 'HIIT' }, { id: 'circuit', label: 'Conditioning Circuits' }].map((o) => cardChoice(state.cardio.type.includes(o.id), () => update((s) => toggle(s.cardio.type, o.id)), o.label))}</div>
        <SecHead>Frequency</SecHead><div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((n) => chip(state.cardio.frequency === n, n + '×/wk', () => update((s) => { s.cardio.frequency = n; }), n))}</div>
        <SecHead>Duration</SecHead><div className="flex flex-wrap gap-2">{[10, 15, 20, 30, 45].map((n) => chip(state.cardio.durationMinutes === n, n + ' min', () => update((s) => { s.cardio.durationMinutes = n; }), n))}</div>
      </>}
    </>),
    12: () => (<>
      <Eyebrow n={13} title="Progression model" sub="How load, volume and intensity advance over time." />
      <div className="grid gap-2.5">{PROGRESSIONS.map((p) => { const lv = levelRank(effLevel(state)); const dis = lv < p.min; return cardChoice(state.progression.type === p.id, (e) => { if (dis) return; selectSingle(e.currentTarget as HTMLElement, (s) => { s.progression.type = p.id; }); }, <>{p.label} {p.min > 0 ? badge('lvl', ['', '', 'Intermediate+', 'Advanced'][p.min]) : null}</>, p.desc); })}</div>
      <SecHead>Deload protocol</SecHead>
      <div className="grid gap-2.5">{[{ id: 'scheduled', label: 'Scheduled Deload', desc: 'Auto-reduce every Nth week' }, { id: 'reactive', label: 'Reactive Deload', desc: 'Triggered when performance stalls' }, { id: 'none', label: 'No Deload', desc: 'Not recommended past 4 weeks' }].map((o) => cardChoice(state.progression.deloadProtocol === o.id, (e) => selectSingle(e.currentTarget as HTMLElement, (s) => { s.progression.deloadProtocol = o.id as 'scheduled' | 'reactive' | 'none'; }), o.label, o.desc))}</div>
      {state.progression.deloadProtocol === 'scheduled' && <><SecHead>Frequency</SecHead><div className="flex flex-wrap gap-2">{[3, 4, 5, 6].map((n) => chip(state.progression.deloadFrequency === n, 'Every ' + n + 'th wk', () => update((s) => { s.progression.deloadFrequency = n; }), n))}</div></>}
    </>),
    13: () => {
      const bodyweight = state.equipment.environment === 'bodyweight';
      const lifts = programLifts();
      return (<>
        <Eyebrow n={14} title="Strength baselines" sub={bodyweight ? 'Bodyweight program — movement milestones instead of 1RM.' : 'Set starting weights for each main lift. Pick a method per lift.'} />
        {!bodyweight && <>
          <div className="flex flex-wrap gap-2 mb-3">
            {chip(state.baselines.allConservative, (state.baselines.allConservative ? '✓ ' : '↺ ') + 'Start all conservative', () => update((s) => { s.baselines.allConservative = !s.baselines.allConservative; if (s.baselines.allConservative) { s.baselines.calibrationWeek = false; lifts.forEach((l) => (s.baselines.methods[l.id] = 'conservative')); } }))}
            {chip(state.baselines.calibrationWeek, (state.baselines.calibrationWeek ? '✓ ' : '+ ') + 'Add a calibration week to find my 1RM', () => update((s) => { s.baselines.calibrationWeek = !s.baselines.calibrationWeek; if (s.baselines.calibrationWeek) s.baselines.allConservative = false; }))}
          </div>
          {state.baselines.calibrationWeek && note('ok', 'Week 1 becomes a calibration week — each lift is set to “Calculated during calibration week,” and the program runs one week longer.')}
          {lifts.map((l) => { const method = state.baselines.calibrationWeek ? 'calibration' : (state.baselines.methods[l.id] || (state.baselines.allConservative ? 'conservative' : 'working')); const unit = user.units === 'metric' ? 'kg' : 'lb'; const inp = 'w-full rounded-lg border border-ink-line bg-bg-input px-3 py-2.5 text-[15px] font-mono'; const v = state.baselines.values[l.id] || {}; const setV = (patch: { oneRM?: number; weight?: number; reps?: number }) => update((s) => { s.baselines.values[l.id] = { ...(s.baselines.values[l.id] || {}), ...patch }; }); const num = (x: string) => { const n = parseFloat(x); return Number.isFinite(n) ? n : undefined; }; return (<div key={l.id} className="rounded-2xl border border-ink-line bg-bg-card p-3.5 mb-2.5">
            <div className="font-semibold text-[14px] mb-1.5">{l.name}</div>
            {state.baselines.calibrationWeek ? <div className="text-[13px] text-ink-dim">Calculated during calibration week</div> : <>
              <div className="flex flex-wrap gap-2">{[['known', 'Known 1RM'], ['working', 'Recent set'], ['conservative', 'Start conservative']].map(([id, lab]) => chip(method === id, lab, () => update((s) => { s.baselines.methods[l.id] = id as 'known' | 'working' | 'conservative'; }), id))}</div>
              {method === 'known' && <input className={inp + ' mt-2.5'} inputMode="numeric" placeholder={`1RM (${unit})`} value={v.oneRM ?? ''} onChange={(e) => setV({ oneRM: num(e.target.value) })} />}
              {method === 'working' && <><div className="flex items-center gap-2 mt-2.5"><input className={inp} style={{ flex: 2 }} inputMode="numeric" placeholder={`weight (${unit})`} value={v.weight ?? ''} onChange={(e) => setV({ weight: num(e.target.value) })} /><span className="text-ink-mute">×</span><input className={inp} style={{ flex: 1 }} inputMode="numeric" placeholder="reps" value={v.reps ?? ''} onChange={(e) => setV({ reps: num(e.target.value) })} /></div><div className="text-[12px] text-ink-mute mt-1.5">Best from a 3–8 rep set. We estimate your 1RM from this.</div></>}
              {method === 'conservative' && <div className="text-[12px] text-ink-mute mt-1.5">We’ll assign a safe body-weight-relative starting weight for your level.</div>}
            </>}
          </div>); })}
        </>}
        {bodyweight && note('info', 'We’ll assess push-ups, pull-ups, plank and squat depth to set starting progression levels.')}
      </>);
    },
    14: () => renderReview(),
    15: () => renderExercises(),
  };

  /* ---------- page 7 sub-renders ---------- */
  function workDowList(): number[] { const sd = state.schedule.startDow, rest = state.schedule.restDays; const out: number[] = []; for (let p = 0; p < 7; p++) { const dow = (sd + p) % 7; if (!rest.includes(dow)) out.push(dow); } return out; }
  function customBuilder() {
    const dows = workDowList();
    return <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim mb-1">Build each day</div>
      <p className="text-[12px] text-ink-dim mb-2">Tap muscle groups to assign them to each training day. Core is added separately on the Core page.</p>
      {dows.map((dow, i) => (<div key={i} className="mb-3">
        <div className="text-[13px] font-semibold mb-1.5">{DOW_FULL[dow]}{((state.split.customDays?.[i]?.length) || 0) === 0 ? <span className="text-ink-mute font-normal"> — empty</span> : null}</div>
        <div className="flex flex-wrap gap-1.5">{WIZARD_MUSCLES.map((m) => chip((state.split.customDays?.[i] || []).includes(m), cap(m), () => update((s) => { if (!s.split.customDays) s.split.customDays = []; while (s.split.customDays.length < dows.length) s.split.customDays.push([]); toggle(s.split.customDays[i], m); }), m))}</div>
      </div>))}
    </div>;
  }
  function splitPreview(id: string) {
    const sd = state.schedule.startDow; const rest = state.schedule.restDays; let wi = 0;
    const cd = state.split.customDays || [];
    const labelFor = (workIdx: number) => id === 'custom'
      ? ((cd[workIdx] || []).map((m) => cap(m).slice(0, 3)).join('/') || '—')
      : ((SPLIT_SEQ[id] || [])[workIdx] || '—');
    return <div className="grid grid-cols-7 gap-1 mt-2">{Array.from({ length: 7 }, (_, p) => { const dow = (sd + p) % 7; const isRest = rest.includes(dow); const lbl = isRest ? 'rest' : labelFor(wi++); return <div key={p} className={`rounded-md p-1.5 text-center text-[10px] min-h-[48px] ${isRest ? 'border border-dashed border-ink-line text-ink-mute' : 'border border-accent-dim'}`}><div className="font-bold text-ink-dim text-[9px] uppercase">{DOW_ABBR[dow]}</div><div className="mt-1 font-semibold leading-tight">{lbl}</div></div>; })}</div>;
  }
  function restPicker() {
    const sd = state.schedule.startDow, d = state.schedule.daysPerWeek || 0;
    if (d >= 7) return <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5"><p className="text-[12px] text-ink-mute">You train every day — no rest days.</p></div>;
    return <div className="rounded-2xl border border-ink-line bg-bg-card p-3 mt-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim mb-1">Rest days</div>
      <p className="text-[12px] text-ink-dim mb-2">Tap a day to make it rest. You have {7 - d} rest day{7 - d === 1 ? '' : 's'} — marking a new one frees the oldest. Your start day stays a work day.</p>
      <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, p) => { const dow = (sd + p) % 7; const isRest = state.schedule.restDays.includes(dow); const isStart = dow === sd; return <button key={p} type="button" disabled={isStart} onClick={() => update((s) => toggleRest(s, dow))} className={`h-9 rounded-lg border text-[11px] font-semibold ${isStart ? 'bg-accent/15 border-accent/40 text-accent-hot opacity-80' : isRest ? 'bg-bg-elev border-ink-dim text-ink' : 'bg-bg-input border-ink-line text-ink-dim'}`}>{DOW_ABBR[dow]}</button>; })}</div>
    </div>;
  }
  function toggleRest(s: WizardState, dow: number) {
    const d = s.schedule.daysPerWeek || 0; const maxRest = 7 - d; let r = s.schedule.restDays.slice();
    if (dow === s.schedule.startDow) return; if (r.includes(dow)) r = r.filter((x) => x !== dow); else { r.push(dow); while (r.length > maxRest) r.shift(); }
    s.schedule.restDays = r;
  }

  /* ---------- volume card + review ---------- */
  function coreDaysCount() { const d = state.schedule.daysPerWeek || 0; if (state.core.method === 'day') return state.core.days.length; if (state.core.method === 'block' || state.core.method === 'superset') return ({ every: d, everyother: Math.ceil(d / 2), '2x': 2, '3x': 3 } as Record<string, number>)[state.core.frequency || ''] || 0; return 0; }
  function coreExCount() { return ({ '1-2': 2, '2-3': 3, '3-4': 4 } as Record<string, number>)[state.core.blockExercises] || 3; }
  function volumeCard() {
    const { cols, loadCount } = weekStructure(state); const tiers = state.prioritization.tiers; const tpw = timesPerWeek(state);
    const muscles = WIZARD_MUSCLES.filter((m) => tiers[m] != null && (tpw[m] || 0) > 0);
    return <div className="rounded-2xl border border-ink-line bg-bg-card p-3.5 my-3.5">
      <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-1">Volume per week — hard sets per muscle</div>
      <div className="grid gap-y-1" style={{ gridTemplateColumns: `4.5rem repeat(${cols.length}, minmax(0,1fr))` }}>
        <div />{cols.map((c, i) => <div key={i} className="text-[10px] text-center text-ink-mute uppercase">{c.label}</div>)}
        {muscles.map((m) => (<><div key={m} className={`text-[12px] font-semibold ${tiers[m] === 'emphasize' ? 'text-accent-hot' : tiers[m] === 'grow' ? 'text-info' : 'text-ink-mute'}`}>{cap(m)}</div>{cols.map((c, i) => <div key={m + i} className={`font-mono text-[12px] text-center ${c.kind !== 'load' ? 'text-ink-mute' : 'text-ink-dim'}`}>{muscleSetsForWeek(state, m, c, loadCount)}</div>)}</>))}
      </div>
    </div>;
  }
  function renderReview() {
    const G: Record<string, string> = { muscle: 'Build Muscle', strength: 'Build Strength', transform: 'Transform My Body', leanout: 'Lean Out & Preserve', fitness: 'General Fitness', athletic: 'Athletic Performance' };
    const sec = (title: string, goPage: number, body: React.ReactNode) => <div className="rounded-2xl border border-ink-line bg-bg-card p-3.5 mb-2.5"><div className="flex justify-between items-center mb-1.5"><b className="text-[14px]">{title}</b><button className="text-[12px] text-accent-hot" onClick={() => goTo(goPage)}>Edit</button></div><div className="text-[13px] text-ink-dim leading-relaxed">{body}</div></div>;
    const bs = (allowedBaseStyles().find((x) => x.id === state.trainingStyle.baseStyle)?.label) || state.trainingStyle.baseStyle;
    const byT = (t: WizTier) => WIZARD_MUSCLES.filter((m) => state.prioritization.tiers[m] === t).map(cap);
    return (<>
      <Eyebrow n={15} title="Review & generate" sub="Everything you chose. Tap Edit on any section to jump back." />
      {sec('Program', 0, <>Name: <span className="text-ink">{state.name || 'Untitled'}</span> · Goal: {G[state.goal.primary || ''] || '—'}</>)}
      {sec('Training Style', 5, <>Style: <span className="text-ink">{bs || '—'}</span><br />Volume: {state.trainingStyle.volumeFramework || '—'} · Periodization: {state.trainingStyle.periodizationStrategy || '—'}</>)}
      {sec('Split', 6, <>{(allowedSplits().find((x) => x.id === state.split.type)?.label) || '—'} · rest: {state.schedule.restDays.map((d) => DOW_ABBR[d]).join(', ') || 'none'}</>)}
      {sec('Prioritization', 7, <>Emphasize: <span className="text-ink">{byT('emphasize').join(', ') || 'none'}</span><br />Grow: {byT('grow').join(', ') || 'none'}<br />Maintain: {byT('maintain').join(', ') || 'none'}</>)}
      {volumeCard()}
      <p className="text-[12px] text-ink-mute">Tap <b>Generate</b> below to build your exercises.</p>
    </>);
  }

  /* ---------- page 16 exercises ---------- */
  function poolDefs(muscle: MuscleGroup) { return poolFor(muscle, lib, availableEquipment(state), new Set(), itemsForEngine(state)); }
  const fmtPresc = (e: GeneratedExercise) => `${e.sets}×${e.reps}${e.metric === 'time' || e.metric === 'weight-time' ? 's' : ''}`;
  function renderExercises() {
    const phase = 0;
    const days = program[phase] || [];
    return (<>
      <Eyebrow n={16} title="Your program" sub="Pick a different movement from any dropdown, or add/remove exercises. Core is listed like any other muscle group." />
      {days.map((d, di) => {
        const daySets = d.exercises.reduce((a, e) => a + e.sets, 0);
        const addMuscles = d.dayMuscles.filter((m) => m === 'core' || state.prioritization.tiers[m] != null) as string[];
        return <div key={di} className="rounded-2xl border border-ink-line overflow-hidden mb-2.5">
          <div className="flex justify-between items-center px-4 py-3 bg-bg-elev font-bold text-[14px]">{DOW_FULL[d.dow]} — {d.type}<span className="text-[11px] text-ink-dim font-medium">{d.emphasis ? d.emphasis + ' · ' : ''}{daySets} sets</span></div>
          {d.exercises.map((e, ei) => {
            const defs = poolDefs(e.muscle);
            const names = defs.map((x) => x.name);
            const list = names.includes(e.name) ? names : [e.name, ...names];
            return <div key={ei} className="flex items-center gap-2.5 px-4 py-2.5 border-t border-ink-line text-[13px]">
              <span className="w-[72px] shrink-0 text-[12px] font-semibold text-ink-dim">{cap(e.muscle)}{e.anchor ? ' 🔒' : ''}</span>
              <select className="flex-1 min-w-0 rounded-lg border border-ink-line bg-bg-input px-2.5 py-2 text-[13px]" value={e.name} onChange={(ev) => setProgram((pr) => { const c = structuredClone(pr); const ex = c[phase][di].exercises[ei]; const def = defs.find((x) => x.name === ev.target.value); ex.name = ev.target.value; if (def) { const tb = def.metric === 'time' || def.metric === 'weight-time'; const wasTb = ex.metric === 'time' || ex.metric === 'weight-time'; ex.metric = def.metric || 'weight-reps'; ex.reps = tb ? 30 : (wasTb ? 10 : ex.reps); } return c; })}>{list.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <span className="font-mono text-[12px] text-ink-dim">{fmtPresc(e)}</span>
              <button type="button" onClick={() => setProgram((pr) => { const c = structuredClone(pr); c[phase][di].exercises.splice(ei, 1); return c; })} className="w-8 shrink-0 rounded-md border border-ink-line text-ink-mute hover:border-danger hover:text-danger">✕</button>
            </div>;
          })}
          <AddRow muscles={addMuscles} onAdd={(m) => setProgram((pr) => {
            const c = structuredClone(pr); const def = poolDefs(m as MuscleGroup)[0];
            if (def) { const tb = def.metric === 'time' || def.metric === 'weight-time'; c[phase][di].exercises.push({ exerciseId: def.id, name: def.name, muscle: m as MuscleGroup, sets: 3, reps: tb ? 30 : 10, metric: def.metric || 'weight-reps', anchor: false }); }
            return c;
          })} />
        </div>;
      })}
    </>);
  }

  function programLifts(): { id: string; name: string }[] {
    if (state.equipment.environment === 'bodyweight') return [];
    const avail = availableEquipment(state); const items = itemsForEngine(state);
    const out: { id: string; name: string }[] = [];
    (['quads', 'chest', 'back', 'hamstrings', 'shoulders'] as MuscleGroup[]).forEach((m) => { const p = poolFor(m, lib, avail, new Set(), items).find((e) => e.patterns?.includes('compound')); if (p && !out.some((o) => o.id === p.id)) out.push({ id: p.id, name: p.name }); });
    return out;
  }

  /* ---------- chrome ---------- */
  const genBtn = page === 14; const lastBtn = page === 15;
  return (
    <div className="max-w-[720px] mx-auto min-h-screen pb-[130px]">
      <div className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-ink-line px-[18px] pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-bold tracking-wide"><span className="w-2.5 h-2.5 rounded bg-accent" />FATRAT · Plan Wizard</div><div className="text-[12px] text-ink-dim font-mono">{page + 1} / {TOTAL}</div></div>
        <div className="h-1 rounded-full bg-ink-line mt-3 overflow-hidden"><i className="block h-full bg-accent rounded-full transition-all" style={{ width: ((page + 1) / TOTAL * 100) + '%' }} /></div>
      </div>
      <div ref={pageRef} className="px-[18px] pt-5">{pages[page]()}</div>
      <div className="fixed left-0 right-0 bottom-0 z-30 bg-bg/95 backdrop-blur border-t border-ink-line">
        <div className="text-[11px] text-ink-mute text-center pt-1.5 font-mono min-h-[18px]">{!seen ? 'Scroll down to see the whole page ↓' : !isValid() ? 'Make a selection to continue' : ''}</div>
        <div className="max-w-[720px] mx-auto px-[18px] pb-3.5 pt-2 flex gap-2.5">
          {page === 0 ? <Button variant="ghost" onClick={() => onClose?.()}>Close</Button> : <Button variant="ghost" onClick={back}>Back</Button>}
          <Button block disabled={!isValid() || !seen} onClick={next}>{genBtn ? '⚡ Generate My Program' : lastBtn ? 'Start My Program' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- sub-components & static data ---------------- */
function Eyebrow({ n, title, sub }: { n: number; title: string; sub?: React.ReactNode }) {
  return <div className="mb-2"><div className="text-[11px] font-semibold uppercase tracking-widest text-accent">Step {n}</div><h1 className="text-2xl font-bold tracking-tight mt-1.5 mb-1">{title}</h1>{sub && <div className="text-[14px] text-ink-dim">{sub}</div>}</div>;
}
function Field({ k, v }: { k: string; v: React.ReactNode }) { return <div><span className="block text-[11px] uppercase tracking-wide text-ink-mute">{k}</span>{v}</div>; }
function AddRow({ muscles, onAdd }: { muscles: string[]; onAdd: (m: string) => void }) {
  const [m, setM] = useState(muscles[0] || '');
  useEffect(() => { if (!muscles.includes(m)) setM(muscles[0] || ''); }, [muscles, m]);
  return <div className="flex gap-2 items-center px-4 py-3 border-t border-dashed border-ink-line">
    <select className="flex-1 min-w-0 rounded-lg border border-ink-line bg-bg-input px-2.5 py-2 text-[13px]" value={m} onChange={(e) => setM(e.target.value)}>{muscles.map((x) => <option key={x} value={x}>{x.charAt(0).toUpperCase() + x.slice(1)}</option>)}</select>
    <button type="button" onClick={() => m && onAdd(m)} className="shrink-0 rounded-lg border border-accent/60 bg-accent/10 text-accent-hot px-3 py-2 text-[13px] font-semibold">+ Add exercise</button>
  </div>;
}
function toggle<T>(arr: T[], v: T) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
function itemsForEngine(s: WizardState): Set<string> | undefined { return s.equipment.environment === 'commercial' ? undefined : new Set(s.equipment.items); }

const GOALS: { id: WizGoal; label: string; desc: string }[] = [
  { id: 'muscle', label: 'Build Muscle', desc: 'Maximize muscle size, fullness, and definition.' },
  { id: 'strength', label: 'Build Strength', desc: 'Lift heavier. Build raw, functional strength.' },
  { id: 'transform', label: 'Transform My Body', desc: 'Go from soft to strong — build muscle and lose fat. Best if you’re newer to lifting.' },
  { id: 'leanout', label: 'Lean Out & Preserve', desc: 'Cut body fat without losing the muscle you’ve built.' },
  { id: 'fitness', label: 'General Fitness & Conditioning', desc: 'Feel better, move better, build a sustainable routine.' },
  { id: 'athletic', label: 'Athletic Performance', desc: 'Train for a sport, event, or physical challenge.' },
];
const EXPERIENCE: { id: WizExperience; label: string; desc: string }[] = [
  { id: 'beginner', label: 'True Beginner', desc: 'Under 6 months consistent' },
  { id: 'novice', label: 'Novice', desc: '6–18 months consistent' },
  { id: 'intermediate', label: 'Intermediate', desc: '2–4 years consistent' },
  { id: 'advanced', label: 'Advanced', desc: '5+ years consistent, structured' },
];
const STATUS: { id: WizStatus; label: string }[] = [
  { id: 'consistent', label: 'Currently training consistently' },
  { id: 'break_short', label: 'Returning — short break (<3 mo)' },
  { id: 'break_long', label: 'Returning — long break (3–12 mo)' },
  { id: 'layoff12', label: 'Returning — extended layoff (12+ mo)' },
  { id: 'scratch', label: 'Starting from scratch / never trained' },
];
const STUBBORN = [{ id: 'belly', label: 'Belly fat' }, { id: 'glutes', label: 'Flat / flabby glutes' }, { id: 'lovehandles', label: 'Love handles' }, { id: 'arms', label: 'Arm definition' }, { id: 'thighs', label: 'Thighs' }, { id: 'chest', label: 'Chest / pecs' }, { id: 'calves', label: 'Calves' }];
const INJURIES = [{ id: 'shoulder', label: 'Shoulders', desc: 'rotator cuff, impingement, labrum' }, { id: 'lowback', label: 'Lower Back', desc: 'disc, chronic pain, SI joint' }, { id: 'knee', label: 'Knees', desc: 'meniscus, patella, ligament' }, { id: 'elbow', label: 'Wrists / Elbows', desc: 'tendinitis, carpal tunnel' }, { id: 'hip', label: 'Hips', desc: 'impingement, labrum, bursitis' }, { id: 'neck', label: 'Neck / Upper Spine' }];
const ENVIRONMENTS = [{ id: 'commercial', label: 'Commercial Gym', desc: 'Full equipment — uncheck what yours lacks' }, { id: 'home', label: 'Home Gym', desc: 'Build your list from scratch' }, { id: 'garage', label: 'Garage / Minimal', desc: 'Build your list from scratch' }, { id: 'bodyweight', label: 'Bodyweight Only', desc: 'Skips the equipment checklist' }, { id: 'hotel', label: 'Hotel / Travel', desc: 'Bodyweight + bands + maybe dumbbells' }];
const EQUIP_GROUPS: Record<string, string[]> = {
  'Free Weights': ['Barbell & Plates', 'Dumbbells — Fixed', 'Dumbbells — Adjustable', 'Kettlebells', 'EZ Curl Bar', 'Trap Bar'],
  'Racks & Benches': ['Power / Squat Rack', 'Bench — Flat', 'Bench — Adjustable', 'Dip Station'],
  'Machines': ['Smith Machine', 'Leg Press', 'Lat Pulldown / Row', 'Chest/Shoulder Press Machine', 'Leg Curl/Extension', 'Pec Deck', 'Hack Squat'],
  'Cables & Accessories': ['Cable Machine', 'Functional Trainer', 'Resistance Bands', 'Pull-Up Bar', 'Suspension Trainer', 'Landmine', 'Ab Wheel', 'GHD'],
  'Cardio / Conditioning': ['Battle Ropes', 'Sled / Prowler', 'Rower / Assault Bike / Ski Erg'],
};
const ALL_EQUIP = Object.values(EQUIP_GROUPS).flat();
const BASE_STYLES: { id: BaseStyle; label: string; desc: string }[] = [
  { id: 'powerlifting', label: 'Powerlifting / Strength', desc: 'Heavy compound lifts, low reps, long rest.' },
  { id: 'bodybuilding', label: 'Bodybuilding / Hypertrophy', desc: 'High volume, multiple angles per muscle, chase the pump.' },
  { id: 'hit', label: 'High-Intensity Training (HIT)', desc: 'One all-out set to failure per exercise. Brief, brutal.' },
  { id: 'powerbuilding', label: 'Powerbuilding', desc: 'Heavy compounds for strength, higher-rep work for size.' },
  { id: 'fullbody', label: 'Full-Body / Minimalist', desc: 'Train every muscle every session. High frequency.' },
  { id: 'calisthenics', label: 'Calisthenics / Bodyweight', desc: 'Progress by making movements harder, not heavier.' },
];
const VOL_FRAMEWORKS: { id: VolumeFramework; label: string; desc: string }[] = [
  { id: 'fixed', label: 'Fixed Volume', desc: 'Same prescribed sets across the mesocycle.' },
  { id: 'evidence', label: 'Evidence-Based (MEV → MAV → MRV)', desc: 'Ramp from minimum to maximum recoverable volume, then deload.' },
  { id: 'auto', label: 'Autoregulated Volume', desc: 'Add or drop sets based on performance and fatigue.' },
  { id: 'med', label: 'Minimum Effective Dose', desc: 'Only the volume needed to grow. Recovery-first.' },
];
const PERIODIZATIONS: { id: PeriodizationStrategy; label: string; desc: string }[] = [
  { id: 'none', label: 'None / Straight Run', desc: 'Same structure & exercises throughout.' },
  { id: 'dup', label: 'Daily Undulating (DUP)', desc: 'Rep ranges vary session to session; same exercises.' },
  { id: 'weekly', label: 'Weekly Undulating', desc: 'Rep ranges vary week to week; same exercises.' },
];
const SPLITS: Record<number, { id: string; label: string; sub: string; boosted?: boolean }[]> = {
  2: [{ id: 'fb2', label: 'Full Body ×2', sub: 'Both days hit every muscle' }, { id: 'ul', label: 'Upper / Lower', sub: '1 upper, 1 lower' }],
  3: [{ id: 'fb3', label: 'Full Body ×3', sub: 'Every muscle, 3×/week' }, { id: 'ppl', label: 'Push / Pull / Legs', sub: 'Each once' }, { id: 'ulf', label: 'Upper / Lower / Full Body', sub: 'Hybrid' }],
  4: [{ id: 'ul2', label: 'Upper / Lower ×2', sub: 'Upper & lower twice each' }, { id: 'ppl1', label: 'PPL + 1 repeat day', sub: 'You pick the repeat day' }, { id: 'phul', label: 'PHUL', sub: 'Power + Hypertrophy, upper & lower' }],
  5: [{ id: 'pplul', label: 'PPL + Upper / Lower', sub: '5-day classic' }, { id: 'bro', label: 'Bro Split', sub: 'Chest / Back / Shoulders / Legs / Arms' }, { id: 'phat', label: 'PHAT', sub: '2 power + 3 hypertrophy days' }, { id: 'ulppl', label: 'Upper/Lower/Push/Pull/Legs', sub: '' }],
  6: [{ id: 'ppl2', label: 'PPL ×2', sub: 'Each hit twice' }, { id: 'arnold', label: 'Arnold Split', sub: 'Chest+Back / Shoulders+Arms / Legs ×2' }, { id: 'pplul1', label: 'PPL + U/L + repeat', sub: '' }],
  7: [{ id: 'ppl2', label: 'PPL ×2 + 1', sub: 'PPL twice, then a repeat' }, { id: 'arnold', label: 'Arnold Split + 1', sub: 'Chest+Back / Sh+Arms / Legs' }, { id: 'bro', label: 'Bro Split + 2', sub: 'Body-part split, every day' }],
};
const REP_RANGES: { id: RepRange; label: string; desc: string }[] = [
  { id: 'strength', label: 'Strength-Focused (3–6)', desc: 'Heavier loads, longer rest' },
  { id: 'hypertrophy', label: 'Hypertrophy (8–12)', desc: 'Moderate loads, max tension' },
  { id: 'endurance', label: 'Endurance / Metabolic (12–20)', desc: 'Lighter loads, shorter rest' },
  { id: 'mixed', label: 'Mixed / Undulating', desc: 'Heavy compounds, lighter accessories' },
];
const SET_TYPES: { id: string; label: string; desc: string; min: number }[] = [
  { id: 'straight', label: 'Straight Sets', desc: 'Same weight & reps every set.', min: 0 },
  { id: 'pyramid', label: 'Pyramid Sets', desc: 'Increase weight, decrease reps.', min: 0 },
  { id: 'superset', label: 'Supersets', desc: 'Two exercises back to back.', min: 0 },
  { id: 'drop', label: 'Drop Sets', desc: 'To failure, reduce, continue.', min: 1 },
  { id: 'restpause', label: 'Rest-Pause', desc: 'Near-failure, short rest, more reps.', min: 2 },
  { id: 'myo', label: 'Myo-Reps', desc: 'Activation set + mini-sets.', min: 2 },
  { id: 'cluster', label: 'Cluster Sets', desc: 'Mini-sets with intra-set rest.', min: 2 },
  { id: 'mads', label: 'Mechanical Adv. Drop Sets', desc: 'Switch to an easier variation at failure.', min: 3 },
];
const REST_OPTS: { id: RestPref; label: string; desc: string }[] = [
  { id: 'short', label: 'Short (30–60s)', desc: 'Max metabolic stress, shorter sessions' },
  { id: 'moderate', label: 'Moderate (60–90s)', desc: 'The hypertrophy sweet spot' },
  { id: 'long', label: 'Long (2–3 min)', desc: 'Full recovery for heavy compounds' },
  { id: 'auto', label: 'Auto (per exercise)', desc: 'Compounds long, isolations short' },
];
const CORE_METHODS: { id: CoreMethod; label: string; desc: string }[] = [
  { id: 'block', label: 'Dedicated Core Block', desc: 'Core exercises at session end' },
  { id: 'day', label: 'Dedicated Core Day', desc: 'Separate short session on chosen day(s)' },
  { id: 'superset', label: 'Superset Between Lifts', desc: 'Core during compound rest periods' },
  { id: 'compound', label: 'Compound-Only (Indirect)', desc: 'Rely on heavy squats/deadlifts/presses' },
  { id: 'none', label: 'None — I’ll handle it', desc: 'Excluded from the program' },
];
const PROGRESSIONS: { id: string; label: string; desc: string; min: number }[] = [
  { id: 'linear', label: 'Linear Progression', desc: 'Add weight every session. Great for beginners.', min: 0 },
  { id: 'double', label: 'Double Progression', desc: 'Hit top of a rep range, then add weight.', min: 0 },
  { id: 'percent', label: 'Percentage-Based', desc: 'Loads as % of 1RM, rising weekly.', min: 2 },
  { id: 'undulating', label: 'Undulating / Wave', desc: 'Intensity & volume wave session to session.', min: 2 },
  { id: 'rpe', label: 'RPE / RIR Auto-Regulation', desc: 'Load by effort level. Most flexible.', min: 2 },
];
