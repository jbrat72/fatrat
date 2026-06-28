'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ChoiceCard, ChoicePill, TextField, PageTitle } from '@/components/ui';
import { coarseFromItems } from '@/lib/exercise/equipment';
import type {
  UserMode, UserProfile, ExperienceTier, PeriodizationFamiliarity, PrimaryGoal, Units, Sex,
} from '@/types';
import { getRepository } from '@/lib/firestore';
import { useUser } from '@/components/app';

// Onboarding only collects profile basics + feature mode. Equipment is set up
// afterward on Profile → My Equipment (a Today nudge prompts for it), goals /
// days / schedule are per-program in the Plan wizard, and experience is re-asked
// there.

interface Draft {
  displayName: string;
  dob: string;
  sex: Sex | '';
  units: Units;
  heightCm: number | undefined;
  weightKg: number | undefined;
  chosenMode: UserMode | '';
  advancedTerminology: boolean;
}

const EMPTY_DRAFT: Draft = {
  displayName: '', dob: '', sex: '', units: 'imperial',
  heightCm: undefined, weightKg: undefined, chosenMode: '', advancedTerminology: false,
};

export function OnboardingWizard() {
  const router = useRouter();
  const { setActiveUserId, refresh, firebaseUser } = useUser();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const canAdvance = (() => {
    switch (step) {
      case 0: return d.displayName.trim().length > 0 && d.heightCm != null && d.weightKg != null && d.sex !== '';
      case 1: return d.chosenMode !== '';
    }
    return false;
  })();

  const totalSteps = 2;

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
      // Experience is re-asked in the Plan wizard; seed a neutral default.
      experience: '6mo-2yr' as ExperienceTier,
      periodizationFamiliarity: 'none' as PeriodizationFamiliarity,
      // Goal / training days / session length are chosen per-program.
      primaryGoal: 'general-fitness' as PrimaryGoal,
      daysPerWeek: 3,
      timePerSessionMin: 60,
      // No equipment chosen yet — the Today screen nudges the user to set it up
      // on Profile → My Equipment.
      equipment: coarseFromItems([]),
      equipmentProfiles: [{ id: 'default', name: 'My Gym', items: [] }],
      defaultEquipmentProfileId: 'default',
      mode: d.chosenMode as UserMode,
      advancedTerminology: wantsAdvancedTerms,
      createdAt: now,
      updatedAt: now,
    };
    await getRepository().upsertProfile(profile);
    await setActiveUserId(userId);
    // No auto-generated plan — new users land on Today and build a plan when ready.
    await refresh();
    router.push('/today');
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-12">
          <div className="font-semibold tracking-widest2 text-base">FAT<span className="text-accent">RAT</span></div>
          <div className="text-xs text-ink-dim tracking-wider2">Step {step + 1} / {totalSteps}</div>
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
              <TextField label="Date of birth" type="date" value={d.dob} onChange={(e) => update('dob', e.target.value)} />
              <div>
                <div className="text-xs font-semibold tracking-wider2 uppercase text-ink-dim mb-1">Sex</div>
                <div className="flex gap-2 flex-wrap">
                  {(['male','female'] as Sex[]).map((s) => (
                    <ChoicePill key={s} value={s} label={s[0]!.toUpperCase() + s.slice(1)} selected={d.sex === s} onSelect={() => update('sex', s)} />
                  ))}
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
            <PageTitle title="Pick your mode" subtitle="The same data, different levels of detail. You can switch anytime in Settings." />
            <div className="space-y-3">
              <ChoiceCard
                value="BASIC"
                label={<>BASIC <span className="text-ink-dim text-sm font-normal">— &quot;Just help me work out&quot;</span></>}
                description="No jargon. Today's workout, big buttons, an easy week every 5–6 weeks. Perfect if you just want to show up."
                selected={d.chosenMode === 'BASIC'}
                onSelect={(v) => update('chosenMode', v)}
              />
              <ChoiceCard
                value="INTERMEDIATE"
                label={<>INTERMEDIATE <span className="text-ink-dim text-sm font-normal">— &quot;Show me I'm progressing&quot;</span></>}
                description="Training blocks, a 5-point effort scale, simple volume indicator, end-of-block recap. Structured without the overhead."
                selected={d.chosenMode === 'INTERMEDIATE'}
                onSelect={(v) => update('chosenMode', v)}
              />
              <ChoiceCard
                value="ADVANCED"
                label={<>ADVANCED <span className="text-ink-dim text-sm font-normal">— &quot;Give me the full system&quot;</span></>}
                description="Macro/meso/microcycles, full RPE/RIR, MEV/MAV/MRV tracking, e1RM charts, deload detection, mesocycle review."
                selected={d.chosenMode === 'ADVANCED'}
                onSelect={(v) => update('chosenMode', v)}
              />
            </div>

            {(d.chosenMode === 'INTERMEDIATE' || d.chosenMode === 'ADVANCED') && (
              <div className="mt-5">
                <div className="section-head mb-1">TERMINOLOGY</div>
                <p className="text-xs text-ink-dim mb-2">How would you like training terms shown? You can switch this anytime.</p>
                <div className="grid grid-cols-1 gap-2">
                  <ChoiceCard value="plain" label="Plain language" description="Everyday words — effort as Easy / Just Right / Hard, simple volume cues, “block” and “week”." selected={!d.advancedTerminology} onSelect={() => update('advancedTerminology', false)} />
                  <ChoiceCard value="advanced" label="Advanced terminology" description="RIR / RPE effort, MEV / MAV / MRV volume landmarks, mesocycle / microcycle naming." selected={d.advancedTerminology} onSelect={() => update('advancedTerminology', true)} />
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-bg/95 backdrop-blur border-t border-ink-line">
        <div className="mx-auto max-w-md p-3 flex items-center gap-2">
          {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <div className="flex-1" />
          {step < totalSteps - 1
            ? <Button disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>Continue</Button>
            : <Button disabled={!canAdvance} onClick={submit}>Finish</Button>}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}
