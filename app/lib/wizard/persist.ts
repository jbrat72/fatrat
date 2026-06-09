/**
 * Plan Wizard v2 — persistence (Chunk 3).
 *
 * Materializes the wizard's reviewed program into the app's data model by
 * reusing the proven `generateCustomProgram` path: we hand it the user's
 * week-1 exercises (as an AssignedWeek) plus the wizard's schedule/tiers/style,
 * and it builds the Mesocycle + Microcycles + day sessions (with the volume
 * ramp, RIR targets and deloads) exactly like the existing custom-program flow.
 * It also saves the program as a custom template, and archives the prior plan.
 */
import { getRepository } from '@/lib/firestore';
import { todayIso } from '@/lib/ui/date';
import {
  generateCustomProgram, buildCustomTemplate, addDaysIso,
  type CustomProgramInput, type AssignedWeek, type WeekKind,
} from '@/lib/program/templateProgram';
import type { ProgramTemplate } from '@/types';
import type { ExerciseDefinition, Mesocycle, MuscleGroup, MuscleTier, SplitType, UserProfile } from '@/types';
import type { WizardState, GeneratedDay } from './types';
import { availableEquipment, durationWeeks, weekStructure } from './engine';

function nextStartIso(startDow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + ((startDow - d.getDay() + 7) % 7));
  return todayIso(d);
}
function splitTypeOf(wiz: string | null): SplitType {
  if (!wiz) return 'custom';
  if (wiz === 'bro') return 'bro-split';
  if (wiz.startsWith('ppl')) return 'PPL';
  if (wiz.startsWith('ul') || wiz === 'phul' || wiz === 'phat') return 'upper-lower';
  if (wiz.startsWith('fb')) return 'full-body';
  return 'custom';
}
function goalLabel(g: string | null): string {
  return ({ muscle: 'Build Muscle', strength: 'Build Strength', transform: 'Transform', leanout: 'Lean Out & Preserve', fitness: 'General Fitness', athletic: 'Athletic Performance' } as Record<string, string>)[g || ''] || 'Custom';
}
const REST_SEC: Record<string, number | undefined> = { short: 45, moderate: 75, long: 150, auto: undefined };

/** Build the CustomProgramInput from the wizard state + reviewed program. */
export function buildWizardInput(
  state: WizardState, days: GeneratedDay[], user: UserProfile, library: ExerciseDefinition[],
): CustomProgramInput {
  // After a 12+ month layoff, drop every muscle one volume tier so the block
  // starts more conservatively (emphasize→grow, grow→maintain).
  const layoff = state.experience.status === 'layoff12';
  const downTier = (t: MuscleTier): MuscleTier => (t === 'emphasize' ? 'grow' : 'maintain');
  const tierOf = (m: MuscleGroup): MuscleTier => {
    const base = (m === 'core' ? 'grow' : (state.prioritization.tiers[m] ?? 'grow')) as MuscleTier;
    return layoff ? downTier(base) : base;
  };
  const week1: AssignedWeek = days.map((d) =>
    d.exercises
      .filter((e) => !!e.exerciseId)
      .map((e) => ({
        muscle: e.muscle,
        tier: tierOf(e.muscle),
        exerciseId: e.exerciseId as string,
        exerciseName: e.name,
        setStyle: e.setStyle,
        supersetGroup: e.supersetGroup,
      })),
  );
  const tiersForInput: Partial<Record<MuscleGroup, MuscleTier>> = {};
  for (const [m, t] of Object.entries(state.prioritization.tiers)) {
    if (t) tiersForInput[m as MuscleGroup] = layoff ? downTier(t as MuscleTier) : (t as MuscleTier);
  }
  // Per-week structure (ramp / calibration / load / deload) from the wizard's
  // own week layout — the single source so preview and program agree.
  const weekKinds: WeekKind[] = weekStructure(state).cols.map((col) => col.kind);
  // Offsets parallel to days, derived from each day's weekday vs the start day.
  const workOffsets = days.map((d) => (d.dow - state.schedule.startDow + 7) % 7);
  // Seed starting weights from the user's 1RM / recent-set baselines (keyed by
  // exercise id — the anchors shown on Page 14, which match the program anchors).
  const RR: Record<string, [number, number]> = { strength: [5, 6], hypertrophy: [8, 12], endurance: [12, 15], mixed: [6, 10] };
  const [repsLow, repsHigh] = RR[state.setsAndReps.repRange || ''] || [8, 12];
  const toKg = (v: number) => (user.units === 'metric' ? v : v / 2.2046226);
  const round = (v: number) => Math.round(v * 2) / 2;
  const startingWeights: NonNullable<CustomProgramInput['startingWeights']> = {};
  if (!state.baselines.calibrationWeek) {
    for (const [id, val] of Object.entries(state.baselines.values)) {
      const method = state.baselines.methods[id] || (state.baselines.allConservative ? 'conservative' : 'working');
      if (method === 'conservative') continue;
      const def = library.find((e) => e.id === id);
      const weighted = !def?.metric || def.metric === 'weight-reps' || def.metric === 'weight-time';
      let weightKg: number | undefined;
      if (method === 'known' && val.oneRM && weighted) weightKg = round(toKg(val.oneRM / (1 + repsLow / 30)));
      else if (method === 'working' && val.weight && weighted) weightKg = round(toKg(val.weight));
      if (weightKg == null) continue;
      startingWeights[id] = { weightKg, repsLow, repsHigh };
    }
  }
  // When a real start date was chosen at activation, anchor week 1 on the
  // Monday on/before it (week-0 offsets then start from the chosen day).
  // Otherwise default to the next Monday.
  const actualStart = state.schedule.startDate;
  const startAnchor = actualStart
    ? addDaysIso(actualStart, -(((new Date(actualStart + 'T00:00:00').getDay()) - 1 + 7) % 7))
    : nextStartIso(state.schedule.startDow);
  const programStyle: 'traditional' | 'periodization' =
    (state.trainingStyle.volumeFramework === 'evidence' || (state.trainingStyle.periodizationStrategy && state.trainingStyle.periodizationStrategy !== 'none'))
      ? 'periodization' : 'traditional';
  return {
    name: state.name.trim() || 'Custom Program',
    weeks: weekKinds.length,
    daysPerWeek: days.length,
    week1,
    tiers: tiersForInput,
    weekKinds,
    library,
    allowed: availableEquipment(state),
    userId: user.userId,
    creatorName: user.displayName,
    goal: goalLabel(state.goal.primary),
    startDate: startAnchor,
    firstWeek: state.schedule.firstWeek,
    startingWeights: Object.keys(startingWeights).length ? startingWeights : undefined,
    workOffsets,
    splitType: splitTypeOf(state.split.type),
    programStyle,
    restSeconds: REST_SEC[state.restAndTempo.restPreference || 'auto'],
  };
}

/**
 * Activate the wizard's program: archive any current plan, persist the new
 * mesocycle/microcycles/sessions, and save it as a custom template.
 * Returns the new active mesocycle.
 */
export async function activateWizardProgram(
  state: WizardState, program: Record<number, GeneratedDay[]>, user: UserProfile, templateId?: string,
): Promise<Mesocycle> {
  const repo = getRepository();
  const globals = await repo.listGlobalExercises();
  let userEx: ExerciseDefinition[] = [];
  try { userEx = await repo.listUserExercises(user.userId); } catch { userEx = []; }
  const library = [...globals, ...userEx];

  const days = program[0] || [];
  if (days.length === 0) throw new Error('No program to save — generate exercises first.');
  const input = buildWizardInput(state, days, user, library);

  // Archive any active plan so only the new block is current.
  const mesos = await repo.listMesocycles(user.userId);
  for (const mz of mesos) if (mz.status === 'active') await repo.upsertMesocycle({ ...mz, status: 'archived' });

  const prog = generateCustomProgram(input);
  // Reuse the draft/template id so the finished plan stays a single instance,
  // and link the active block back to it so the gallery can flag it Active.
  const tpl = buildCustomTemplate(input);
  const finalTplId = templateId || tpl.id;
  const meso = { ...prog.mesocycle, equipmentProfileId: state.equipment.profileId, templateId: finalTplId, weekKinds: input.weekKinds };
  await repo.upsertMesocycle(meso);
  for (const mi of prog.microcycles) await repo.upsertMicrocycle(mi);
  for (const s of prog.sessions) await repo.upsertSession(s);
  await repo.upsertTemplate({ ...tpl, id: finalTplId, isDraft: false });
  return meso;
}

/**
 * Save the finished plan to the Gallery (a non-draft custom template) without
 * activating it — no mesocycle/sessions are created. Reuses the draft/template
 * id so there's only ever one instance of the plan.
 */
export async function saveWizardToGallery(
  state: WizardState, user: UserProfile, program: Record<number, GeneratedDay[]>, templateId?: string,
): Promise<string> {
  const repo = getRepository();
  const globals = await repo.listGlobalExercises();
  let userEx: ExerciseDefinition[] = [];
  try { userEx = await repo.listUserExercises(user.userId); } catch { userEx = []; }
  const library = [...globals, ...userEx];
  const days = program[0] || [];
  if (days.length === 0) throw new Error('No program to save — generate exercises first.');
  const input = buildWizardInput(state, days, user, library);
  const tpl = buildCustomTemplate(input);
  const id = templateId || tpl.id;
  await repo.upsertTemplate({ ...tpl, id, isDraft: false });
  return id;
}

let _draftN = 0;
function draftId(): string { _draftN += 1; return `tpl-draft-${Date.now().toString(36)}-${_draftN}`; }

/**
 * Save the wizard's current state as a resumable draft (a ProgramTemplate
 * carrying the serialized WizardState). Does NOT activate anything. Pass the
 * previously-returned id to keep updating the same draft. If the program has
 * been generated, the draft also gets full week data so it's viewable.
 */
export async function saveWizardDraft(
  state: WizardState, user: UserProfile, program?: Record<number, GeneratedDay[]>, existingId?: string,
): Promise<ProgramTemplate> {
  const repo = getRepository();
  const days = program?.[0] || [];
  let base: ProgramTemplate;
  if (days.length > 0) {
    const library = await repo.listGlobalExercises();
    base = buildCustomTemplate(buildWizardInput(state, days, user, library));
  } else {
    base = {
      id: '', name: state.name.trim() || 'Untitled draft', description: 'Draft — finish it in the wizard',
      kind: 'program', daysPerWeek: state.schedule.daysPerWeek ?? 3, split: splitTypeOf(state.split.type),
      defaultPhase: 'hypertrophy', progressionScheme: 'rir-based', programStyle: 'periodization',
      minMode: 'BASIC', isCustom: true, createdBy: user.displayName, muscleTiers: state.prioritization.tiers, weeks: [],
    };
  }
  const tpl: ProgramTemplate = {
    ...base,
    id: existingId || base.id || draftId(),
    name: state.name.trim() || 'Untitled draft',
    kind: 'program', isDraft: true, draftState: JSON.stringify({ state, program: program ?? {} }), isCustom: true,
  };
  await repo.upsertTemplate(tpl);
  return tpl;
}
