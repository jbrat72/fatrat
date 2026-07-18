'use client';
import { useEffect, useState } from 'react';
import { Card, Button, InlineNumber } from '@/components/ui';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import { todayIso } from '@/lib/ui/date';
import { isoWeekStamp as weekStamp } from '@/lib/progress/streak';

const DISMISS_KEY = 'fatrat:bw-dismissed-week';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Local-timezone week stamp — the old inline version went through
 *  toISOString(), which rolls the week over a day early/late off-UTC. */
const isoWeekStamp = (d = new Date()) => weekStamp(d);

export function BodyWeightCheckIn() {
  const { user } = useUser();
  const [show, setShow] = useState(false);
  const [value, setValue] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [savedThisRender, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const decide = async () => {
      const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem(DISMISS_KEY) : null;
      if (dismissed === isoWeekStamp()) { setShow(false); return; }
      const log = await getRepository().listBodyWeight(user.userId);
      const last = log[log.length - 1];
      if (last) {
        const ageMs = Date.now() - new Date(last.date).getTime();
        if (ageMs < WEEK_MS) { setShow(false); return; }
      }
      setShow(true);
      if (last) setValue(kgToDisplay(last.weightKg, user.units));
    };
    decide();
  }, [user]);

  if (!user || !show) return null;

  const save = async () => {
    if (value == null) return;
    setSaving(true);
    try {
      await getRepository().addBodyWeight(user.userId, {
        date: todayIso(),
        weightKg: displayToKg(value, user.units) ?? 0,
      });
      setSaved(true);
      setTimeout(() => setShow(false), 800);
    } catch (e) {
      console.warn('body weight save failed', e);
    } finally {
      // Without this a rejected write left the button stuck on "Saving…".
      setSaving(false);
    }
  };

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, isoWeekStamp()); } catch {}
    setShow(false);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="section-head">WEEKLY BODY WEIGHT</div>
        <button type="button" onClick={dismiss} className="text-ink-mute text-sm hover:text-ink" aria-label="Dismiss">✕</button>
      </div>
      {savedThisRender ? (
        <p className="text-ok text-sm">Saved. Thanks!</p>
      ) : (
        <>
          <p className="text-ink-dim text-sm mb-3">Optional weekly check-in. Skip if not in the mood.</p>
          <div className="flex items-stretch gap-2">
            <div className="flex-1">
              <InlineNumber
                value={value}
                onChange={setValue}
                step={user.units === 'imperial' ? 0.5 : 0.25}
                decimals={1}
                unit={weightLabel(user.units)}
                ariaLabel="Body weight"
              />
            </div>
            <Button onClick={save} disabled={value == null || saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </>
      )}
    </Card>
  );
}
