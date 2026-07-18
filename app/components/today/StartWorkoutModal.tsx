'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { WorkoutSession } from '@/types';

function longDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Chest · Triceps · Core" — what the day actually trains, so the rows aren't
 *  all just the plan name. */
function musclesLabel(s: WorkoutSession): string {
  const seen: string[] = [];
  for (const ex of s.exercises) {
    if (ex.muscle && !seen.includes(ex.muscle)) seen.push(ex.muscle);
  }
  if (seen.length === 0) return '';
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const shown = seen.slice(0, 3).map(cap).join(' · ');
  return seen.length > 3 ? `${shown} +${seen.length - 3}` : shown;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Today has a pending scheduled/ad-hoc session ready to start. */
  hasScheduled: boolean;
  scheduledLabel: string;
  /** Other pending days in the active plan (past or future) that can be pulled into today. */
  otherDays: WorkoutSession[];
  planName?: string;
  onScheduled: () => void;
  onPullDay: (session: WorkoutSession) => void;
  onAdHoc: () => void;
}

export function StartWorkoutModal({ open, onClose, hasScheduled, scheduledLabel, otherDays, planName, onScheduled, onPullDay, onAdHoc }: Props) {
  const [view, setView] = useState<'menu' | 'days'>('menu');
  if (!open) return null;
  const close = () => { setView('menu'); onClose(); };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={close}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          {view === 'menu' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">Start Workout</div>
                <button type="button" onClick={close} className="text-ink-mute text-sm">Close</button>
              </div>
              <div className="space-y-2">
                <button type="button" disabled={!hasScheduled} onClick={() => { close(); onScheduled(); }}
                  className="w-full text-left rounded-xl border border-ink-line bg-bg-elev px-4 py-3 disabled:opacity-40 hover:border-accent/50 transition">
                  <div className="font-medium">Scheduled Workout</div>
                  <div className="text-xs text-ink-dim mt-0.5">{hasScheduled ? scheduledLabel : 'Nothing scheduled for today'}</div>
                </button>
                <button type="button" disabled={otherDays.length === 0} onClick={() => setView('days')}
                  className="w-full text-left rounded-xl border border-ink-line bg-bg-elev px-4 py-3 disabled:opacity-40 hover:border-accent/50 transition">
                  <div className="font-medium">Swap with another day</div>
                  <div className="text-xs text-ink-dim mt-0.5">{otherDays.length ? 'Pull a different day’s workout into today' : 'No other days available'}</div>
                </button>
                <button type="button" onClick={() => { close(); onAdHoc(); }}
                  className="w-full text-left rounded-xl border border-ink-line bg-bg-elev px-4 py-3 hover:border-accent/50 transition">
                  <div className="font-medium">Ad-Hoc Workout</div>
                  <div className="text-xs text-ink-dim mt-0.5">Pick or build a one-off workout</div>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setView('menu')} className="text-ink-mute text-sm">‹ Back</button>
                <div className="text-lg font-semibold">Swap with another day</div>
                <button type="button" onClick={close} className="text-ink-mute text-sm">Close</button>
              </div>
              <p className="text-xs text-ink-dim mb-3">Move one of these into today. Its original day becomes an off-day.</p>
              <div className="space-y-2">
                {otherDays.map((s) => (
                  <button key={s.id} type="button" onClick={() => { close(); onPullDay(s); }}
                    className="w-full text-left rounded-xl border border-ink-line bg-bg-elev px-4 py-3 hover:border-accent/50 transition">
                    <div className="font-medium">{musclesLabel(s) || s.name || planName || 'Workout'}</div>
                    <div className="text-xs text-ink-dim mt-0.5">
                      {longDate(s.date)}{s.date < new Date().toISOString().slice(0, 10) ? ' · missed' : ' · upcoming'} · {s.exercises.length} exercises
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
