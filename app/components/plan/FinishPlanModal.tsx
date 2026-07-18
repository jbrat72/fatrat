'use client';
import { useMemo, useState } from 'react';
import { todayIso, formatDayDate } from '@/lib/ui/date';

const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowAt = (pos: number) => (1 + pos) % 7; // pos 0 = Monday


interface Props {
  /** Number of training days in the typical week (split length). */
  workDayCount: number;
  /** Typical-week rest days as day-of-week indices (0=Sun..6=Sat). */
  restDays: number[];
  onCancel: () => void;
  onSaveToGallery: () => void;
  onActivate: (startDate: string, firstWeek: { offsets: number[]; dropCount: number }) => void;
}

/**
 * Shown when the user taps "Finish" on the last wizard page. Lets them either
 * save the plan to the Gallery or activate it. Activation asks for a start
 * date and — if that date is mid-week — lets them lay out a shorter first week
 * (work days auto-placed in the remaining days; rest days movable).
 */
export function FinishPlanModal({ workDayCount, restDays, onCancel, onSaveToGallery, onActivate }: Props) {
  const [step, setStep] = useState<'choose' | 'schedule'>('choose');
  const [date, setDate] = useState<string>(todayIso());

  const startDow = useMemo(() => new Date(date + 'T00:00:00').getDay(), [date]);
  const startPos = (startDow - 1 + 7) % 7; // 0 = Monday
  const typicalWork = (pos: number) => !restDays.includes(dowAt(pos));
  const remainingPositions = useMemo(() => Array.from({ length: 7 - startPos }, (_, k) => startPos + k), [startPos]);

  // Default week-1 work = the typical work days that fall on/after the start.
  const survivors = useMemo(
    () => remainingPositions.filter((p) => typicalWork(p)),
    [remainingPositions, restDays], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [workSet, setWorkSet] = useState<Set<number>>(new Set());
  // Re-seed whenever the start date (and thus the remaining window) changes.
  const seedKey = `${startPos}|${survivors.join(',')}`;
  const [seededKey, setSeededKey] = useState<string>('');
  if (seededKey !== seedKey) { setWorkSet(new Set(survivors)); setSeededKey(seedKey); }

  const maxWork = Math.min(workDayCount, remainingPositions.length);
  const toggle = (pos: number) => {
    if (pos < startPos) return; // past — locked
    setWorkSet((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) { if (next.size > 1) next.delete(pos); }
      else if (next.size < maxWork) next.add(pos);
      return next;
    });
  };

  const offsets = [...workSet].sort((a, b) => a - b);
  const dropCount = Math.max(0, workDayCount - offsets.length);
  const midWeek = startPos > 0;

  const dayBox = (pos: number, mode: 'typical' | 'first') => {
    const isPast = mode === 'first' && pos < startPos;
    const isWork = mode === 'typical' ? typicalWork(pos) : workSet.has(pos);
    const base = 'h-11 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center';
    const cls = isPast
      ? 'border-ink-line bg-bg-input/40 text-ink-mute opacity-40'
      : isWork
        ? 'bg-accent/15 border-accent/50 text-accent-hot'
        : 'border-dashed border-ink-line text-ink-mute';
    const inner = (
      <>
        <span className="text-[9px] uppercase opacity-70">{DOW_ABBR[dowAt(pos)]}</span>
        <span>{isPast ? '—' : isWork ? 'train' : 'rest'}</span>
      </>
    );
    if (mode === 'first' && !isPast) {
      return <button key={pos} type="button" onClick={() => toggle(pos)} className={`${base} ${cls}`}>{inner}</button>;
    }
    return <div key={pos} className={`${base} ${cls}`}>{inner}</div>;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-ink-line max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-line sticky top-0 bg-bg-card">
          <div className="font-bold text-[15px]">{step === 'choose' ? 'Finish your plan' : 'Activate — pick a start date'}</div>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-ink-mute hover:text-ink text-lg leading-none px-1">✕</button>
        </div>

        {step === 'choose' && (
          <div className="p-4 space-y-3">
            <p className="text-[13px] text-ink-dim">Activate it now to start training, or save it to your Gallery to run later.</p>
            <button type="button" onClick={() => setStep('schedule')} className="w-full text-left rounded-2xl border border-accent/50 bg-accent/10 hover:border-accent p-4">
              <div className="font-semibold text-[15px]">Activate this plan</div>
              <div className="text-[13px] text-ink-dim mt-0.5">Pick a start date — even mid-week — and start training.</div>
            </button>
            <button type="button" onClick={onSaveToGallery} className="w-full text-left rounded-2xl border border-ink-line bg-bg-card hover:border-ink-mute p-4">
              <div className="font-semibold text-[15px]">Save to Gallery</div>
              <div className="text-[13px] text-ink-dim mt-0.5">Keep it for later. Nothing gets scheduled until you activate it.</div>
            </button>
          </div>
        )}

        {step === 'schedule' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wide text-ink-mute mb-1">Start date</label>
              <input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-bg-input border border-ink-line rounded-lg px-3 py-2 text-sm" />
              <p className="text-[12px] text-ink-mute mt-1">Starts {formatDayDate(date, 'medium')}.</p>
            </div>

            {midWeek ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">Your typical week</div>
                  <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, p) => dayBox(p, 'typical'))}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">This first week — {offsets.length} day{offsets.length === 1 ? '' : 's'}</div>
                  <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, p) => dayBox(p, 'first'))}</div>
                  <p className="text-[12px] text-ink-mute mt-1.5">Days before your start are greyed out. Tap a remaining day to flip it between train and rest. Workouts that don&apos;t fit this week are skipped — your normal week resumes next Monday.</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-dim">You&apos;re starting on a Monday, so your first week runs your full typical schedule.</p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('choose')} className="rounded-lg border border-ink-line px-3 py-2 text-[13px] text-ink-dim hover:text-ink">Back</button>
              <button
                type="button"
                disabled={offsets.length === 0}
                onClick={() => onActivate(date, { offsets, dropCount })}
                className="flex-1 rounded-lg bg-accent text-white font-semibold px-3 py-2 text-[14px] disabled:opacity-40"
              >
                Activate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
