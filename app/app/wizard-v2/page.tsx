'use client';
/** Chunk 2 preview route for Plan Wizard v2. Not linked in nav. Visit
 *  /wizard-v2 to click through. Works signed-in (uses your profile) or
 *  signed-out (falls back to a stub profile so the preview never blanks). */
import { Component, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { PlanWizardV2 } from '@/components/plan/PlanWizardV2';
import type { UserProfile } from '@/types';

const STUB_USER: UserProfile = {
  userId: 'preview', displayName: 'Preview', units: 'imperial',
  dob: '1990-01-01', sex: 'male', heightCm: 178, weightKg: 84,
  experience: '2yr-plus', periodizationFamiliarity: 'fuzzy',
  primaryGoal: 'build-muscle', daysPerWeek: 4, timePerSessionMin: 60,
  equipment: ['commercial-gym'], mode: 'INTERMEDIATE',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return (
      <div className="max-w-[720px] mx-auto p-6 text-ink">
        <h1 className="text-xl font-bold mb-2">Wizard preview crashed</h1>
        <p className="text-ink-dim text-sm mb-3">The error below is from the wizard component — paste it back to debug.</p>
        <pre className="whitespace-pre-wrap text-[12px] bg-bg-card border border-ink-line rounded-xl p-3 text-danger">{String(this.state.err?.stack || this.state.err)}</pre>
      </div>
    );
    return this.props.children;
  }
}

export default function WizardV2Preview() {
  const { user, loading } = useUser();
  const router = useRouter();
  if (loading) return <div className="p-6 text-ink-dim">Loading…</div>;
  const profile = user ?? STUB_USER;
  return (
    <div className="min-h-screen bg-bg text-ink">
      {!user && <div className="bg-warn/15 text-warn text-[12px] text-center py-1.5">Preview mode — no signed-in user, using a stub profile.</div>}
      <Boundary>
        <PlanWizardV2
          user={profile}
          onClose={() => router.push('/plan/templates/programs')}
          onComplete={(state, program) => { console.log('wizard complete', state, program); alert('Program generated! (persistence comes in Chunk 3)'); }}
        />
      </Boundary>
    </div>
  );
}
