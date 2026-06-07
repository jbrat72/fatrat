'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, ModeChip, PageTitle, ChoicePill } from '@/components/ui';
import { ModeSwitchDialog } from '@/components/settings';
import { getRepository } from '@/lib/firestore';
import { EQUIP_GROUPS, equipLabel, getEquipmentProfiles, defaultProfileId, newProfileId } from '@/lib/exercise/equipment';
import type { EquipmentProfile } from '@/types';
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
  const { user, refresh, firebaseUser, signOut } = useUser();
  const [modeOpen, setModeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const setSoundsEnabled = async (soundsEnabled: boolean) => {
    await getRepository().upsertProfile({ ...user, soundsEnabled, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const saveProfiles = async (next: EquipmentProfile[], newDefault?: string) => {
    const curDefault = defaultProfileId(user);
    const def = newDefault ?? (next.some((p) => p.id === curDefault) ? curDefault : next[0]?.id);
    await getRepository().upsertProfile({ ...user, equipmentProfiles: next, defaultEquipmentProfileId: def, updatedAt: new Date().toISOString() });
    await refresh();
  };
  const eqProfiles = getEquipmentProfiles(user);
  const eqDefaultId = defaultProfileId(user);
  const toggleItem = (pid: string, item: string) => saveProfiles(eqProfiles.map((p) => p.id === pid ? { ...p, items: p.items.includes(item) ? p.items.filter((x) => x !== item) : [...p.items, item] } : p));
  const renameProfile = (pid: string, name: string) => saveProfiles(eqProfiles.map((p) => p.id === pid ? { ...p, name } : p));
  const addProfile = () => saveProfiles([...eqProfiles, { id: newProfileId(), name: 'New setup', items: [] }]);
  const deleteProfile = (pid: string) => { if (eqProfiles.length <= 1) return; const next = eqProfiles.filter((p) => p.id !== pid); saveProfiles(next, next.some((p) => p.id === eqDefaultId) ? eqDefaultId : next[0].id); };

  const doExport = async (fmt: 'json' | 'csv') => {
    setExporting(true);
    const repo = getRepository();
    const [profile, allMesos, sessions, bodyWeight] = await Promise.all([
      repo.getProfile(user.userId),
      repo.listMesocycles(user.userId),
      repo.listSessions(user.userId, { limit: 1000 }),
      repo.listBodyWeight(user.userId),
    ]);
    const microPromises = allMesos.map((m) => repo.listMicrocycles(m.id));
    const allMicros = (await Promise.all(microPromises)).flat();

    const bundle: ExportBundle = {
      profile: profile!,
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
          <div className="section-head mb-2">SOUNDS</div>
          <p className="text-xs text-ink-dim mb-2">
            Double-beep when the rest timer or exercise timer reaches zero.
          </p>
          <div className="flex gap-2">
            <ChoicePill value="on" label="On" selected={user.soundsEnabled !== false} onSelect={() => setSoundsEnabled(true)} />
            <ChoicePill value="off" label="Off" selected={user.soundsEnabled === false} onSelect={() => setSoundsEnabled(false)} />
          </div>
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
          <div className="section-head mb-2">MY EQUIPMENT</div>
          <p className="text-xs text-ink-dim mb-3">Set up each place you train (Home, Gym, Travel…). When you build a program you pick which setup it's for — add a piece (e.g. a pull-up bar) and it shows up in that program's swaps immediately.</p>
          {eqProfiles.map((pf) => (
            <div key={pf.id} className="rounded-xl border border-ink-line p-3 mb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <input defaultValue={pf.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pf.name) renameProfile(pf.id, v); }} className="flex-1 bg-bg-input border border-ink-line rounded-md px-2.5 py-1.5 text-sm font-semibold" aria-label="Setup name" />
                {eqDefaultId === pf.id ? <span className="text-[11px] text-accent font-semibold px-1">Default</span> : <button type="button" onClick={() => saveProfiles(eqProfiles, pf.id)} className="text-[11px] text-ink-mute hover:text-ink">Set default</button>}
                {eqProfiles.length > 1 && <button type="button" onClick={() => deleteProfile(pf.id)} className="text-[11px] text-ink-mute hover:text-danger">Delete</button>}
              </div>
              {Object.entries(EQUIP_GROUPS).map(([grp, list]) => (
                <div key={grp} className="mb-2">
                  <div className="text-[11px] text-ink-mute uppercase tracking-wide mb-1">{grp}</div>
                  <div className="flex gap-1.5 flex-wrap">{list.map((i) => (
                    <ChoicePill key={i} value={i} label={equipLabel(i)} selected={pf.items.includes(i)} onSelect={() => toggleItem(pf.id, i)} />
                  ))}</div>
                </div>
              ))}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addProfile}>+ Add setup</Button>
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
          <div className="section-head mb-2">ACCOUNT</div>
          {firebaseUser?.email && (
            <p className="text-ink-dim text-sm mb-2">
              Signed in as <span className="text-ink font-medium">{firebaseUser.email}</span>.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); router.replace('/login'); }}
            >
              Sign out
            </Button>
            <Button variant="ghost" size="sm" disabled>Delete account (coming soon)</Button>
          </div>
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
