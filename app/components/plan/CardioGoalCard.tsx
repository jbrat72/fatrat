'use client';
import { useState, type ReactNode } from 'react';
import { useUser } from '@/components/app';
import { Card, Button } from '@/components/ui';
import { getRepository } from '@/lib/firestore';

/** Plan-screen card to view/set the weekly cardio goal (minutes).
 *  With `embedded`, renders its inner content only (no Card chrome) so it can
 *  sit inside another card, e.g. the Current Training Plan card. */
export function CardioGoalCard({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, refresh } = useUser();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const goal = user.cardioWeeklyGoalMin ?? 0;
  const startEdit = () => { setVal(goal ? String(goal) : ''); setEditing(true); };
  const save = async () => {
    const n = Math.max(0, Math.round(Number(val) || 0));
    setSaving(true);
    try {
      await getRepository().upsertProfile({ ...user, cardioWeeklyGoalMin: n, updatedAt: new Date().toISOString() });
      await refresh();
      setEditing(false);
    } finally { setSaving(false); }
  };

  const Wrapper = embedded
    ? ({ children }: { children: ReactNode }) => <div>{children}</div>
    : ({ children }: { children: ReactNode }) => <Card>{children}</Card>;

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="section-head">CARDIO GOAL</div>
          {goal > 0
            ? <div className="text-lg font-medium mt-0.5 tnum">{goal}<span className="text-ink-dim text-sm font-normal"> min / week</span></div>
            : <div className="text-sm text-ink-dim mt-0.5">No weekly cardio goal set.</div>}
        </div>
        {!editing && (goal > 0
          ? <Button variant="ghost" size="sm" onClick={startEdit}>Edit</Button>
          : <Button size="sm" onClick={startEdit}>Set Goal</Button>)}
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 90"
            className="w-24 h-10 px-3 rounded-lg bg-bg-input text-ink border border-ink-line focus:border-accent outline-none text-sm tnum"
          />
          <span className="text-sm text-ink-dim">min / week</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      )}
    </Wrapper>
  );
}
