'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, ChoiceCard, ChoicePill, TextField, PageTitle, ModeChip } from '@/components/ui';
import { EQUIP_GROUPS, equipLabel, coarseFromItems } from '@/lib/exercise/equipment';
import type {
  UserMode,
  UserProfile,
  ExperienceTier,
  PeriodizationFamiliarity,
  PrimaryGoal,
  EquipmentAccess,
  CommonInjurySite,
  Units,
  Sex,
  StrengthBaseline,
} from '@/types';
import { recommendMode } from '@/lib/periodization/mode';
import { getRepository } from '@/lib/firestore';
import { useUser } from '@/components/app';

interface Draft {
  displayName: string;
  dob: string;
  sex: Sex | '';
  units: Units;
  heightCm: number | undefined;
  weightKg: number | undefined;

  experience: ExperienceTier | '';
  familiarity: PeriodizationFamiliarity | '';

  equipment: EquipmentAccess[];
  equipmentItems: string[];

  injurySites: CommonInjurySite[];
  injuryNotes: string;
  excludedLifts: string;

  baseline: StrengthBaseline;
  baselineSkipped: boolean;

  chosenMode: UserMode | '';
  advancedTerminology: boolean;
}

const EMPTY_DRAFT: Draft = {
  displayName: '',
  dob: '',
  sex: '',
  units: 'imperial',
  heightCm: undefined,
  weightKg: undefined,
  experience: '',
  familiarity: '',
  equipment: [],
  equipmentItems: [],
  injurySites: [],
  injuryNotes: '',
  excludedLifts: '',
  baseline: {},
  baselineSkipped: false,
  chosenMode: '',
  advancedTerminology: false,
};

const INJURY_LABELS: Record<CommonInjurySite, string> = {
  'lower-back': 'Lower back',
  'shoulders':  'Shoulders',
  'knees':      'Knees',
  'wrists':     'Wrists',
  'elbows':     'Elbows',
};

export function OnboardingWizard() {
  const router = useRouter();
  const { setActiveUserId, refresh, firebaseUser } = useUser();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleArr = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const recommendation = useMemo(() => {
    if (!d.experience || !d.familiarity) return null;
    return recommendMode(d.experience, d.familiarity);
  }, [d.experience, d.familiarity]);

  const canAdvance = (() => {
    switch (step) {
      case 0: return d.displayName.trim().length > 0 && d.heightCm != null && d.weightKg != null && d.sex !== '';
      case 1: return d.experience !== '' && d.familiarity !== '';
      case 2: return true; // equipment — optional (none = bodyweight)
      case 3: return true; // constraints — optional
      case 4: return true; // baseline — optional
      case 5: return d.chosenMode !== '';
      case 6: return true; // confirmation — Finish always enabled
    }
    return false;
  })();

  const totalSteps = 7;

  const submit = async () => {
    const now = new Date().toISOString();
    const userId = firebaseUser?.uid ?? ('user-' + Math.random().toString(36).slice(2, 9));
    const wantsAdvancedTerms = d.chosenMode !== 'BASIC' && d.advancedTerminology;
    const profile: UserProfile = {
      userId,
      displayName: d.displayName.trim(),
      dob: d.dob || undefined,
      sex: (d.sex || 'prefer-not-to-say') as Sex,
      heightCm: d.heightCm,
      weightKg: d.weightKg,
      units: d.units,
      experience: d.experience as ExperienceTier,
      periodizationFamiliarity: d.familiarity as PeriodizationFamiliarity,
      // Goal, training days, and session length are chosen per-program in the
      // Plan wizard now — seed neutral defaults so the profile stays valid.
      primaryGoal: 'general-fitness' as PrimaryGoal,
      daysPerWeek: 3,
      timePerSessionMin: 60,
      equipment: coarseFromItems(d.equipmentItems),
      equipmentProfiles: [{ id: 'default', name: 'My Gym', items: d.equipmentItems }],
      defaultEquipmentProfileId: 'default',
      constraints: (d.injurySites.length || d.injuryNotes || d.excludedLifts)
        ? {
            injurySites: d.injurySites.length ? d.injurySites : undefined,
            injuryNotes: d.injuryNotes || undefined,
            excludedLifts: d.excludedLifts
              ? d.excludedLifts.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          }
        : undefined,
      strengthBaseline: d.baselineSkipped ? undefined : d.baseline,
      mode: d.chosenMode as UserMode,
      advancedTerminology: wantsAdvancedTerms,
      createdAt: now,
      updatedAt: now,
    };
    const repo = getRepository();
    await repo.upsertProfile(profile);
    await setActiveUserId(userId);
    // No auto-generated plan — new users land on Today with no active program
    // and choose a template explicitly (or build a custom one in the wizard).
    await refresh();
    router.push('/today');
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-12">
          <div className="font-semibold tracking-widest2 text-base">
            FAT<span className="text-accent">RAT</span>
          </div>
          <div className="text-xs text-ink-dim tracking-wider2">
            Step {step + 1} / {totalSteps}
          </div>
        </div>
        <div className="h-1 bg-ink-line">
          <div className="h-1 bg-accent transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4 pb-32">
        {step === 0 && (
          <section>
            <PageTitle title="About you" subtitle="The basics — we'll use these for accurate defaults." />
            <div className="space-y-3">
              <TextField label="Display name" value={d.displayName} onChange={(e) => update('displayName', e.target.value)} placeholder="What should we call you?" />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Date of birth" type="date" value={d.dob} onChange={(e) => update('dob', e.target.value)} />
                <div>
                  <div className="text-xs font-semibold tracking-wider2 uppercase text-ink-dim mb-1">Sex</div>
                  <div className="flex gap-2 flex-wrap">
                    {(['male','female'] as Sex[]).map((s) => (
                      <ChoicePill key={s} value={s} label={s[0]!.toUpperCase() + s.slice(1)} selected={d.sex === s} onSelect={() => update('sex', s)} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wider2 uppercase text-ink-dim mb-1">Units</div>
                <div className="flex gap-2">
                  <ChoicePill value="imperial" label="lb / in" selected={d.units === 'imperial'} onSelect={() => update('units', 'imperial')} />
                  <ChoicePill value="metric"  label="kg / cm" selected={d.units === 'metric'}   onSelect={() => update('units', 'metric')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={d.units === 'imperial' ? 'Height (in)' : 'Height (cm)'}
                  inputMode="decimal"
                  value={d.heightCm == null ? '' : String(d.units === 'imperial' ? +(d.heightCm / 2.54).toFixed(1) : d.heightCm)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return update('heightCm', undefined);
                    update('heightCm', d.units === 'imperial' ? n * 2.54 : n);
                  }}
                />
                <TextField
                  label={d.units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'}
                  inputMode="decimal"
                  value={d.weightKg == null ? '' : String(d.units === 'imperial' ? +(d.weightKg * 2.20462).toFixed(1) : d.weightKg)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return update('weightKg', undefined);
                    update('weightKg', d.units === 'imperial' ? n / 2.20462 : n);
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <PageTitle title="Experience" subtitle="This shapes how much detail we surface." />
            <div className="space-y-4">
              <div>
                <div className="section-head mb-2">How long have you been lifting consistently?</div>
                <div className="grid grid-cols-1 gap-2">
                  <ChoiceCard value="lt6mo"     label="Less than 6 months"    selected={d.experience === 'lt6mo'}    onSelect={(v) => update('experience', v)} />
                  <ChoiceCard value="6mo-2yr"   label="6 months to 2 years"   selected={d.experience === '6mo-2yr'}  onSelect={(v) => update('experience', v)} />
                  <ChoiceCard value="2yr-plus"  label="2+ years"              selected={d.experience === '2yr-plus'} onSelect={(v) => update('experience', v)} />
                </div>
              </div>
              <div>
                <div className="section-head mb-2">How familiar are you with RPE, mesocycles, or progressive overload?</div>
                <div className="grid grid-cols-1 gap-2">
                  <ChoiceCard value="none"   label="Not at all"        selected={d.familiarity === 'none'}   onSelect={(v) => update('familiarity', v)} />
                  <ChoiceCard value="fuzzy"  label="Heard of them"     selected={d.familiarity === 'fuzzy'}  onSelect={(v) => update('familiarity', v)} />
                  <ChoiceCard value="fluent" label="I use them"        selected={d.familiarity === 'fluent'} onSelect={(v) => update('familiarity', v)} />
                </div>
              </div>
              {recommendation && (
                <Card className="border-accent/40">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="section-head">RECOMMENDED MODE</span>
                    <ModeChip mode={recommendation.mode} />
                  </div>
                  <p className="text-sm text-ink-dim">{recommendation.reason}</p>
                  <p className="text-xs text-ink-mute mt-2">You'll pick your final mode at the end. You can always change it later.</p>
                </Card>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <PageTitle title="Equipment" subtitle="What can you train with? Your training days, session length, and goals are set per-program in the Plan builder." />
            <div>
              <div className="section-head mb-2">Equipment you own</div>
              {Object.entries(EQUIP_GROUPS).map(([grp, list]) => (
                <div key={grp} className="mb-3">
                  <div className="text-xs text-ink-mute mb-1.5">{grp}</div>
                  <div className="flex gap-2 flex-wrap">
                    {list.map((i) => (
                      <ChoicePill key={i} value={i} label={equipLabel(i)} selected={d.equipmentItems.includes(i)} onSelect={() => update('equipmentItems', toggleArr(d.equipmentItems, i))} />
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-mute mt-2">Pick everything you have access to — leave all unchecked for bodyweight only. You can change this anytime on your Profile under My Equipment.</p>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <PageTitle title="Anything to avoid?" subtitle="Optional — helps us swap exercises automatically." />
            <div className="space-y-3">
              <div>
                <div className="section-head mb-2">Common injury sites</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(INJURY_LABELS) as CommonInjurySite[]).map((s) => (
                    <ChoicePill key={s} value={s} label={INJURY_LABELS[s]} selected={d.injurySites.includes(s)} onSelect={() => update('injurySites', toggleArr(d.injurySites, s))} />
                  ))}
                </div>
              </div>
              <TextField label="Other notes" value={d.injuryNotes} onChange={(e) => update('injuryNotes', e.target.value)} placeholder='e.g. "rotator cuff acting up"' />
              <TextField label="Lifts to exclude" value={d.excludedLifts} onChange={(e) => update('excludedLifts', e.target.value)} placeholder='e.g. "overhead press, deadlift"' hint="Comma-separated. Leave blank if none." />
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <PageTitle title="Starting strength" subtitle="Optional — recent best for the big four. We'll calibrate from your first sessions if you skip." />
            <div className="grid grid-cols-2 gap-3">
              {(['squat', 'bench', 'deadlift', 'overheadPress'] as const).map((k) => (
                <TextField
                  key={k}
                  label={k === 'overheadPress' ? 'Overhead Press' : k[0]!.toUpperCase() + k.slice(1)}
                  inputMode="decimal"
                  value={d.baseline[k] == null ? '' : String(d.baseline[k])}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    update('baseline', { ...d.baseline, [k]: Number.isFinite(n) && n > 0 ? n : undefined });
                  }}
                  placeholder={d.units === 'imperial' ? 'lb' : 'kg'}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => { update('baseline', {}); update('baselineSkipped', true); setStep((s) => s + 1); }}
              className="mt-4 text-sm text-ink-dim underline underline-offset-2"
            >
              Skip — calibrate from my first 2–3 sessions
            </button>
          </section>
        )}

        {step === 5 && (
          <section>
            <PageTitle title="Pick your mode" subtitle="The same data, different levels of detail. You can switch anytime." />
            <div className="space-y-3">
              <ChoiceCard
                value="BASIC"
                label={<>BASIC <span className="text-ink-dim text-sm font-normal">— "Just help me work out"</span></>}
                description="No jargon. Today's workout, big buttons, an easy week every 5–6 weeks. Perfect if you just want to show up."
                selected={d.chosenMode === 'BASIC'}
                recommended={recommendation?.mode === 'BASIC'}
                onSelect={(v) => update('chosenMode', v)}
              />
              <ChoiceCard
                value="INTERMEDIATE"
                label={<>INTERMEDIATE <span className="text-ink-dim text-sm font-normal">— "Show me I'm progressing"</span></>}
                description="Training blocks, a 5-point effort scale, simple volume indicator, end-of-block recap. Structured without the overhead."
                selected={d.chosenMode === 'INTERMEDIATE'}
                recommended={recommendation?.mode === 'INTERMEDIATE'}
                onSelect={(v) => update('chosenMode', v)}
              />
              <ChoiceCard
                value="ADVANCED"
                label={<>ADVANCED <span className="text-ink-dim text-sm font-normal">— "Give me the full system"</span></>}
                description="Macro/meso/microcycles, full RPE/RIR, MEV/MAV/MRV tracking, e1RM charts, deload detection, mesocycle review."
                selected={d.chosenMode === 'ADVANCED'}
                recommended={recommendation?.mode === 'ADVANCED'}
                onSelect={(v) => update('chosenMode', v)}
              />
            </div>

            {(d.chosenMode === 'INTERMEDIATE' || d.chosenMode === 'ADVANCED') && (
              <div className="mt-5">
                <div className="section-head mb-1">TERMINOLOGY</div>
                <p className="text-xs text-ink-dim mb-2">
                  How would you like training terms shown? You can switch this anytime.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <ChoiceCard
                    value="plain"
                    label="Plain language"
                    description="Everyday words — effort as Easy / Just Right / Hard, simple volume cues, “block” and “week”."
                    selected={!d.advancedTerminology}
                    onSelect={() => update('advancedTerminology', false)}
                  />
                  <ChoiceCard
                    value="advanced"
                    label="Advanced terminology"
                    description="RIR / RPE effort, MEV / MAV / MRV volume landmarks, mesocycle / microcycle naming."
                    selected={d.advancedTerminology}
                    onSelect={() => update('advancedTerminology', true)}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {step === 6 && <ConfirmationStep draft={d} />}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-ink-line">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 && (
            <Button disabled={!canAdvance} onClick={() => {
              // when leaving the experience step, pre-select the recommended mode
              if (step === 1 && recommendation && !d.chosenMode) update('chosenMode', recommendation.mode);
              setStep((s) => s + 1);
            }}>Continue</Button>
          )}
          {step === totalSteps - 1 && (
            <Button disabled={!canAdvance} onClick={submit}>Finish</Button>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}


function ConfirmationStep({ draft }: { draft: Draft }) {
  const mode = draft.chosenMode;
  const friendlyMode =
    mode === 'BASIC' ? 'BASIC (simple)' :
    mode === 'INTERMEDIATE' ? 'INTERMEDIATE (structured)' :
    'ADVANCED (full system)';
  const showTerminology = mode === 'INTERMEDIATE' || mode === 'ADVANCED';
  return (
    <section>
      <PageTitle title={`You're set, ${draft.displayName || 'lifter'}.`} subtitle="Here's what we'll start you with." />
      <Card>
        <div className="section-head mb-2">YOUR SETUP</div>
        <ul className="text-sm space-y-1.5">
          <li>Mode: <span className="font-semibold">{friendlyMode}</span></li>
          {showTerminology && (
            <li>Terminology: <span className="font-semibold">{draft.advancedTerminology ? 'Advanced' : 'Plain language'}</span></li>
          )}
          <li>Next: build a plan to set your goal, training days, and schedule.</li>
        </ul>
      </Card>
      <p className="text-xs text-ink-dim text-center mt-3">You can change any of this anytime in Settings.</p>
    </section>
  );
}
