'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card, Button } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import type { Sex } from '@/types';

const CM_PER_IN = 2.54;
const SEX_OPTS: { id: Sex; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
];

function ageFrom(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

/** Collapsible, editable card for the user's personal details. */
export function ProfileInfoCard() {
  const { user, refresh } = useUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saved, setSaved] = useState(false);

  const units = user?.units ?? 'imperial';
  const imperial = units === 'imperial';

  useEffect(() => {
    if (!user) return;
    setName(user.displayName ?? '');
    setDob(user.dob ?? '');
    setSex(user.sex ?? '');
    const w = kgToDisplay(user.weightKg, units);
    setWeight(w != null ? String(w) : '');
    const h = user.heightCm != null ? (imperial ? +(user.heightCm / CM_PER_IN).toFixed(1) : Math.round(user.heightCm)) : null;
    setHeight(h != null ? String(h) : '');
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const save = async () => {
    const wNum = weight.trim() === '' ? undefined : Number(weight);
    const hNum = height.trim() === '' ? undefined : Number(height);
    const weightKg = wNum != null && !isNaN(wNum) ? displayToKg(wNum, units) : undefined;
    const heightCm = hNum != null && !isNaN(hNum) ? (imperial ? +(hNum * CM_PER_IN).toFixed(1) : hNum) : undefined;
    await getRepository().upsertProfile({
      ...user,
      displayName: name.trim() || user.displayName,
      dob: dob || undefined,
      sex: sex || undefined,
      weightKg,
      heightCm,
      updatedAt: new Date().toISOString(),
    });
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const age = ageFrom(user.dob);
  const summary = [age != null ? `${age} yr` : null, user.sex && user.sex !== 'prefer-not-to-say' ? user.sex : null]
    .filter(Boolean).join(' · ');
  const field = 'w-full bg-bg-input border border-ink-line rounded-md px-2.5 py-2 text-sm';

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <span>
          <span className="text-lg font-semibold block leading-tight">{user.displayName}</span>
          {summary && <span className="text-xs text-ink-dim">{summary}</span>}
        </span>
        <span className="text-ink-mute text-sm transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[11px] text-ink-mute uppercase tracking-wide">Name</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-mute uppercase tracking-wide">Birthday</span>
            <input type="date" className={field} value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <div>
            <span className="text-[11px] text-ink-mute uppercase tracking-wide">Sex</span>
            <select className={field} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="">—</option>
              {SEX_OPTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-[11px] text-ink-mute uppercase tracking-wide">Weight ({weightLabel(units)})</span>
              <input type="number" inputMode="decimal" className={field} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="flex-1">
              <span className="text-[11px] text-ink-mute uppercase tracking-wide">Height ({imperial ? 'in' : 'cm'})</span>
              <input type="number" inputMode="decimal" className={field} value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
          </div>
          <Button size="sm" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</Button>
        </div>
      )}
    </Card>
  );
}
