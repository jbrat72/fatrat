'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card, Button, ChoicePill } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { EQUIP_GROUPS, equipLabel, getEquipmentProfiles, defaultProfileId, newProfileId } from '@/lib/exercise/equipment';
import type { EquipmentProfile } from '@/types';

/**
 * Collapsible "My Equipment" card for the Profile page. Multiple setups are
 * selected from a dropdown and edited one at a time in the same space (no
 * stacking). Edits apply to local state immediately and persist in the
 * background; local state is the source of truth once mounted and re-seeds
 * only when the active user changes.
 */
export function EquipmentManager() {
  const { user, refresh } = useUser();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<EquipmentProfile[]>([]);
  const [defId, setDefId] = useState<string>('');
  const [selId, setSelId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const ps = getEquipmentProfiles(user);
    const def = defaultProfileId(user);
    setProfiles(ps);
    setDefId(def);
    setSelId((cur) => (ps.some((p) => p.id === cur) ? cur : def || ps[0]?.id || ''));
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

  const sel = profiles.find((p) => p.id === selId) ?? profiles[0];

  const toggleItem = (item: string) =>
    sel && persist(profiles.map((p) => (p.id === sel.id ? { ...p, items: p.items.includes(item) ? p.items.filter((x) => x !== item) : [...p.items, item] } : p)), defId);
  const renameProfile = (name: string) =>
    sel && persist(profiles.map((p) => (p.id === sel.id ? { ...p, name } : p)), defId);
  const setDefault = () => sel && persist(profiles, sel.id);
  const addProfile = () => {
    const np: EquipmentProfile = { id: newProfileId(), name: `Setup ${profiles.length + 1}`, items: [] };
    setSelId(np.id);
    persist([...profiles, np], defId);
  };
  const deleteProfile = () => {
    if (!sel || profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== sel.id);
    setSelId(next[0].id);
    persist(next, next.some((p) => p.id === defId) ? defId : next[0].id);
  };

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span className="font-medium">My Equipment</span>
        <span className="text-ink-mute text-2xl leading-none transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-xs text-ink-dim mb-3">Set up each place you train (Home, Gym, Travel…). When you build a program you pick which setup it&apos;s for — add a piece (e.g. a pull-up bar) and it shows up in that program&apos;s swaps immediately.</p>

          <div className="flex items-center gap-2 mb-3">
            <select value={selId} onChange={(e) => setSelId(e.target.value)} className="flex-1 bg-bg-input border border-ink-line rounded-md px-2.5 py-2 text-sm font-semibold" aria-label="Choose a setup">
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === defId ? '  (default)' : ''}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={addProfile}>+ Add</Button>
          </div>

          {sel && (
            <div className="rounded-xl border border-ink-line p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <input key={sel.id} defaultValue={sel.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sel.name) renameProfile(v); }} className="flex-1 bg-bg-input border border-ink-line rounded-md px-2.5 py-1.5 text-sm font-semibold" aria-label="Setup name" />
                {defId === sel.id ? <span className="text-[11px] text-accent font-semibold px-1">Default</span> : <button type="button" onClick={setDefault} className="text-[11px] text-ink-mute hover:text-ink">Set default</button>}
                {profiles.length > 1 && <button type="button" onClick={deleteProfile} className="text-[11px] text-ink-mute hover:text-danger">Delete</button>}
              </div>
              {Object.entries(EQUIP_GROUPS).map(([grp, list]) => (
                <div key={grp} className="mb-2">
                  <div className="text-[11px] text-ink-mute uppercase tracking-wide mb-1">{grp}</div>
                  <div className="flex gap-1.5 flex-wrap">{list.map((i) => (
                    <ChoicePill key={i} value={i} label={equipLabel(i)} selected={sel.items.includes(i)} onSelect={() => toggleItem(i)} />
                  ))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
