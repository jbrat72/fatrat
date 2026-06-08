'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card, Button, ChoicePill } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { EQUIP_GROUPS, equipLabel, getEquipmentProfiles, defaultProfileId, newProfileId } from '@/lib/exercise/equipment';
import type { EquipmentProfile } from '@/types';

/**
 * Collapsible "My Equipment" card for the Profile page. Edits are applied to
 * local state immediately (so toggling an item never waits on a server round-
 * trip and the page doesn't jump to the top), then persisted in the background.
 * Local state is the source of truth once mounted; it re-seeds only when the
 * active user changes.
 */
export function EquipmentManager() {
  const { user, refresh } = useUser();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<EquipmentProfile[]>([]);
  const [defId, setDefId] = useState<string>('');

  useEffect(() => {
    if (user) { setProfiles(getEquipmentProfiles(user)); setDefId(defaultProfileId(user)); }
    // Re-seed only when the active user changes — our own edits update local
    // state directly, so we must not clobber them on every profile refresh.
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const persist = (next: EquipmentProfile[], nextDef: string) => {
    setProfiles(next);
    setDefId(nextDef);
    getRepository()
      .upsertProfile({ ...user, equipmentProfiles: next, defaultEquipmentProfileId: nextDef, updatedAt: new Date().toISOString() })
      .then(() => refresh())
      .catch(() => { /* best-effort; local state already reflects the change */ });
  };

  const toggleItem = (pid: string, item: string) =>
    persist(profiles.map((p) => (p.id === pid ? { ...p, items: p.items.includes(item) ? p.items.filter((x) => x !== item) : [...p.items, item] } : p)), defId);
  const renameProfile = (pid: string, name: string) =>
    persist(profiles.map((p) => (p.id === pid ? { ...p, name } : p)), defId);
  const addProfile = () => persist([...profiles, { id: newProfileId(), name: 'New setup', items: [] }], defId);
  const setDefault = (pid: string) => persist(profiles, pid);
  const deleteProfile = (pid: string) => {
    if (profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== pid);
    persist(next, next.some((p) => p.id === defId) ? defId : next[0].id);
  };

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span className="section-head">MY EQUIPMENT</span>
        <span className="text-ink-mute text-sm transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-xs text-ink-dim mb-3">Set up each place you train (Home, Gym, Travel…). When you build a program you pick which setup it&apos;s for — add a piece (e.g. a pull-up bar) and it shows up in that program&apos;s swaps immediately.</p>
          {profiles.map((pf) => (
            <div key={pf.id} className="rounded-xl border border-ink-line p-3 mb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <input defaultValue={pf.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pf.name) renameProfile(pf.id, v); }} className="flex-1 bg-bg-input border border-ink-line rounded-md px-2.5 py-1.5 text-sm font-semibold" aria-label="Setup name" />
                {defId === pf.id ? <span className="text-[11px] text-accent font-semibold px-1">Default</span> : <button type="button" onClick={() => setDefault(pf.id)} className="text-[11px] text-ink-mute hover:text-ink">Set default</button>}
                {profiles.length > 1 && <button type="button" onClick={() => deleteProfile(pf.id)} className="text-[11px] text-ink-mute hover:text-danger">Delete</button>}
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
        </div>
      )}
    </Card>
  );
}
