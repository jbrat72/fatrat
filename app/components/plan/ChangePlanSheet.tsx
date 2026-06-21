'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { todayIso } from '@/lib/ui/date';
import type { Mesocycle, Microcycle, WorkoutSession } from '@/types';

interface Props {
  open: boolean;
  /** The active training plan (post-Macrocycle, the meso IS the plan). */
  meso: Mesocycle;
  micros: Microcycle[];
  sessions: WorkoutSession[];
  onClose: () => void;
  /** Called after any destructive action so the caller can refetch. */
  onChanged: () => void;
  /** Called when the user picks "Edit this plan". The caller closes this
   *  sheet and opens Plan Wizard v2 pre-populated with the active plan. */
  onEdit?: () => void;
}

/**
 * Shared sheet for managing the current training plan. Three actions:
 *   1. Cancel this plan — archives the active mesocycle.
 *   2. Restart from a new date — shifts every session's date by a delta and
 *      clears completion so the program effectively starts on the new date.
 *   3. Cancel and switch — cancel + navigate to /plan/templates.
 */
export function ChangePlanSheet({ open, meso, micros, sessions, onClose, onChanged, onEdit }: Props) {
  const router = useRouter();
  const [restartSheet, setRestartSheet] = useState(false);
  const [restartDate, setRestartDate] = useState(todayIso());
  const [restartSaving, setRestartSaving] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);

  if (!open) return null;

  const archiveCurrent = async () => {
    const repo = getRepository();
    // Drop pending (un-logged) sessions so they don't show up as orphan
    // workouts on Today after the plan is archived. Completed sessions
    // stay for History.
    for (const sn of sessions) {
      if (!sn.completed) {
        try { await repo.deleteSession(sn.id); } catch { /* keep going */ }
      }
    }
    await repo.upsertMesocycle({ ...meso, status: 'archived' });
  };

  const doCancel = async () => {
    if (cancelSaving) return;
    setCancelSaving(true);
    try {
      await archiveCurrent();
      onChanged();
      onClose();
    } finally {
      setCancelSaving(false);
    }
  };

  const doCancelAndSwitch = async () => {
    if (cancelSaving) return;
    setCancelSaving(true);
    try {
      await archiveCurrent();
      onClose();
      router.push('/plan/templates');
    } finally {
      setCancelSaving(false);
    }
  };

  const doRestart = async () => {
    if (sessions.length === 0 || restartSaving) return;
    setRestartSaving(true);
    try {
      const repo = getRepository();
      const dayMs = 24 * 60 * 60 * 1000;
      const sortedByDate = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
      const oldFirst = sortedByDate[0]!.date;
      const newFirst = restartDate;
      const delta = Math.round(
        (new Date(newFirst + 'T00:00:00').getTime() - new Date(oldFirst + 'T00:00:00').getTime()) / dayMs,
      );
      for (const sn of sessions) {
        const d = new Date(sn.date + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const newIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const newDow = d.getDay() as 0|1|2|3|4|5|6;
        await repo.upsertSession({
          ...sn,
          date: newIso,
          dayOfWeek: newDow,
          completed: false,
          startedAt: undefined,
          completedAt: undefined,
        });
      }
      const sortedMicros = [...micros].sort((a, b) => a.weekNumber - b.weekNumber);
      for (let i = 0; i < sortedMicros.length; i++) {
        await repo.upsertMicrocycle({ ...sortedMicros[i]!, status: i === 0 ? 'active' : 'draft' });
      }
      await repo.upsertMesocycle({ ...meso, weekIndex: 0, status: 'active', startDate: newFirst });
      setRestartSheet(false);
      onChanged();
      onClose();
    } finally {
      setRestartSaving(false);
    }
  };

  // The Restart sub-sheet — only this is visible when restartSheet is true.
  if (restartSheet) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => { if (!restartSaving) setRestartSheet(false); }}>
        <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
            <div className="section-head">RESTART PROGRAM</div>
            <button type="button" onClick={() => setRestartSheet(false)} disabled={restartSaving} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink disabled:opacity-40" aria-label="Close">✕</button>
          </div>
          <div className="px-4 py-4 space-y-3 pb-8">
            <p className="text-sm text-ink-dim">
              Pick a new start date. Every workout in this program will shift so the first one
              lands on the date you choose, and any logged sets get cleared. Use this if you
              set up the program early and want to restart on the day you actually begin.
            </p>
            <label className="block">
              <span className="section-head mb-1 block">New start date</span>
              <input
                type="date"
                value={restartDate}
                onChange={(e) => setRestartDate(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-bg-input border border-ink-line text-ink text-sm font-medium"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" block onClick={() => setRestartSheet(false)} disabled={restartSaving}>Cancel</Button>
              <Button variant="danger" block onClick={doRestart} disabled={restartSaving || !restartDate}>
                {restartSaving ? 'Restarting…' : 'Restart program'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main change sheet.
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => { if (!cancelSaving) onClose(); }}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
          <div>
            <div className="section-head">CHANGE TRAINING PLAN</div>
            <div className="text-base font-semibold mt-1 truncate">{meso.name}</div>
          </div>
          <button type="button" onClick={onClose} disabled={cancelSaving} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink disabled:opacity-40" aria-label="Close">✕</button>
        </div>
        <div className="px-4 py-4 space-y-2 pb-8">
          {onEdit && (
            <Button block size="lg" onClick={onEdit} disabled={cancelSaving}>
              Edit this plan
            </Button>
          )}
          <Button block variant="danger" size="lg" onClick={doCancel} disabled={cancelSaving}>
            {cancelSaving ? 'Cancelling…' : 'Cancel this plan'}
          </Button>
          <Button block variant="ghost" size="lg" onClick={() => { setRestartDate(todayIso()); setRestartSheet(true); }} disabled={cancelSaving}>
            Restart from a new date…
          </Button>
          <Button block variant="ghost" size="lg" onClick={doCancelAndSwitch} disabled={cancelSaving}>
            Cancel and switch plans
          </Button>
          <p className="text-xs text-ink-mute text-center pt-2">
            “Cancel” archives the current plan — your logged history stays in History. “Restart”
            keeps the program but moves it to a new start date and clears logged work.
          </p>
        </div>
      </div>
    </div>
  );
}
