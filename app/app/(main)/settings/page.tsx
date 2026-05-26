'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, ModeChip, PageTitle, ChoicePill } from '@/components/ui';
import { ModeSwitchDialog } from '@/components/settings';
import { getRepository, resetMockRepository } from '@/lib/firestore';
import { toJSON, setsCSV } from '@/lib/export';
import type { ExportBundle } from '@/lib/export';
import type { UserMode, Units } from '@/types';

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, refresh } = useUser();
  const [modeOpen, setModeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!user) return null;

  const switchMode = async (mode: UserMode) => {
    await getRepository().upsertProfile({ ...user, mode, updatedAt: new Date().toISOString() });
    await refresh();
    setModeOpen(false);
  };

  const setUnits = async (units: Units) => {
    await getRepository().upsertProfile({ ...user, units, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const setWeekStart = async (weekStartsOn: number) => {
    await getRepository().upsertProfile({ ...user, weekStartsOn, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const setAdvancedTerminology = async (advancedTerminology: boolean) => {
    await getRepository().upsertProfile({ ...user, advancedTerminology, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const doExport = async (fmt: 'json' | 'csv') => {
    setExporting(true);
    const repo = getRepository();
    const [profile, macrocycles, sessions, bodyWeight] = await Promise.all([
      repo.getProfile(user.userId),
      repo.listMacrocycles(user.userId),
      repo.listSessions(user.userId, { limit: 1000 }),
      repo.listBodyWeight(user.userId),
    ]);
    const mesocyclePromises = macrocycles.map((m) => repo.listMesocycles(m.id));
    const allMesos = (await Promise.all(mesocyclePromises)).flat();
    const microPromises = allMesos.map((m) => repo.listMicrocycles(m.id));
    const allMicros = (await Promise.all(microPromises)).flat();

    const bundle: ExportBundle = {
      profile: profile!,
      macrocycles,
      mesocycles: allMesos,
      microcycles: allMicros,
      sessions,
      bodyWeight,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
    };
    if (fmt === 'json') download(`fatrat-${user.displayName}-${Date.now()}.json`, 'application/json', toJSON(bundle));
    else                download(`fatrat-sets-${user.displayName}-${Date.now()}.csv`, 'text/csv', setsCSV(bundle));
    setExporting(false);
  };

  const doReset = () => {
    resetMockRepository();
    if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <div className="pb-12">
      <PageTitle title="Settings" />
      <div className="px-4 space-y-3">
        <Card>
          <div className="section-head mb-2">MODE</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Current: <ModeChip mode={user.mode} /></div>
              <div className="text-xs text-ink-dim mt-0.5">Switch anytime — your data is preserved.</div>
            </div>
            <Button variant="ghost" onClick={() => setModeOpen(true)}>Change</Button>
          </div>
          {user.mode !== 'BASIC' && (
            <div className="mt-3 pt-3 border-t border-ink-line">
              <div className="section-head mb-1">TERMINOLOGY</div>
              <p className="text-xs text-ink-dim mb-2">
                Plain words, or advanced training terms — RIR/RPE, MEV/MAV/MRV, mesocycles.
              </p>
              <div className="flex gap-2">
                <ChoicePill value="plain" label="Plain language" selected={!user.advancedTerminology} onSelect={() => setAdvancedTerminology(false)} />
                <ChoicePill value="advanced" label="Advanced terms" selected={!!user.advancedTerminology} onSelect={() => setAdvancedTerminology(true)} />
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="section-head mb-2">UNITS</div>
          <div className="flex gap-2">
            <ChoicePill value="imperial" label="lb / in" selected={user.units === 'imperial'} onSelect={() => setUnits('imperial')} />
            <ChoicePill value="metric"   label="kg / cm" selected={user.units === 'metric'}   onSelect={() => setUnits('metric')} />
          </div>
          <div className="text-xs text-ink-dim mt-2">Affects display only — data is stored in metric internally.</div>
        </Card>

        <Card>
          <div className="section-head mb-2">CALENDAR</div>
          <p className="text-xs text-ink-dim mb-2">Which day the calendar week starts on.</p>
          <div className="flex gap-2 flex-wrap">
            <ChoicePill value="1" label="Monday"   selected={(user.weekStartsOn ?? 1) === 1} onSelect={() => setWeekStart(1)} />
            <ChoicePill value="0" label="Sunday"   selected={(user.weekStartsOn ?? 1) === 0} onSelect={() => setWeekStart(0)} />
            <ChoicePill value="6" label="Saturday" selected={(user.weekStartsOn ?? 1) === 6} onSelect={() => setWeekStart(6)} />
          </div>
          <div className="text-xs text-ink-dim mt-2">Display only — it does not change when workouts are scheduled.</div>
        </Card>

        <Card>
          <div className="section-head mb-2">DATA EXPORT</div>
          <p className="text-ink-dim text-sm mb-3">Download a full copy of your data. JSON keeps everything; CSV is a flat per-set table.</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => doExport('json')} disabled={exporting}>Download JSON</Button>
            <Button variant="ghost" size="sm" onClick={() => doExport('csv')}  disabled={exporting}>Download CSV</Button>
          </div>
        </Card>

        <Card>
          <div className="section-head mb-2">NOTIFICATIONS</div>
          <p className="text-ink-dim text-sm">None in v1. Future: rest-day reminders, body-weight prompts, deload heads-ups.</p>
        </Card>

        <Card>
          <div className="section-head mb-2 text-danger">DANGER ZONE</div>
          {!confirmReset ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>Reset demo data</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-danger text-sm">
                This wipes all session history and resets the 3 demo users (Molly / Brian / Zach).
                It does not affect any data in real Firestore (which we're not connected to yet).
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button variant="danger" onClick={doReset}>Reset</Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="section-head mb-2">ACCOUNT</div>
          <p className="text-ink-dim text-sm mb-2">Auth comes online with Firebase. For now, switch demo users from the header pill.</p>
          <Button variant="ghost" size="sm" disabled>Delete account (coming soon)</Button>
        </Card>

        <div className="pt-2 text-center">
          <Button variant="ghost" onClick={() => router.push('/profile')}>← Back</Button>
        </div>
      </div>

      {modeOpen && (
        <ModeSwitchDialog
          current={user.mode}
          onCancel={() => setModeOpen(false)}
          onConfirm={switchMode}
        />
      )}
    </div>
  );
}
