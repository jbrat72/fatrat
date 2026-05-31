'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import type { WorkoutSession } from '@/types';

interface HistoryRow {
  weightKg: number | undefined;
  reps: number[];
  weekNumber?: number;
  dayOfWeek: number;
  date: string;
  mesoName?: string;
}

interface Props {
  exerciseId: string;
  open: boolean;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ExerciseHistorySheet({ exerciseId, open, onClose }: Props) {
  const { user } = useUser();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [mesoName, setMesoName] = useState<string | undefined>();

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const repo = getRepository();
      const sessions = await repo.listSessions(user.userId, { limit: 100 });
      const active = await repo.getActivePlan(user.userId);
      setMesoName(active?.name);

      // For each session that contains the exercise, group sets.
      const microIdToWeek = new Map<string, number>();
      if (active) {
        const micros = await repo.listMicrocycles(active.id);
        for (const m of micros) microIdToWeek.set(m.id, m.weekNumber);
      }

      const out: HistoryRow[] = [];
      for (const s of sessions) {
        const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
        if (!ex) continue;
        const loggedSets = ex.sets.filter((x) => x.completed && x.reps != null);
        if (loggedSets.length === 0) continue;
        // Common weight: pick the most-frequent weightKg across logged sets.
        const counts = new Map<number, number>();
        for (const set of loggedSets) {
          if (set.weightKg == null) continue;
          counts.set(set.weightKg, (counts.get(set.weightKg) ?? 0) + 1);
        }
        const topWeight = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        out.push({
          weightKg: topWeight,
          reps: loggedSets.map((s) => s.reps!),
          weekNumber: s.microcycleId ? microIdToWeek.get(s.microcycleId) : undefined,
          dayOfWeek: s.dayOfWeek,
          date: s.date,
          mesoName: active?.name,
        });
      }
      setRows(out);
    };
    load();
  }, [exerciseId, open, user]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="section-head">EXERCISE HISTORY</div>
            {mesoName && <div className="text-xs text-ink-dim mt-0.5">{mesoName}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 divide-y divide-ink-line">
          {rows.length === 0 && (
            <div className="py-6 text-ink-dim text-sm">No history yet for this exercise.</div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="py-4 flex items-start justify-between gap-3">
              <div className="text-2xl font-semibold tnum">
                {kgToDisplay(r.weightKg, user!.units) ?? '—'}{' '}
                <span className="text-base font-normal text-ink-dim">{weightLabel(user!.units)}</span>{' '}
                <span className="text-ink-dim font-normal text-xl">×</span>{' '}
                <span className="tnum">{r.reps.join(', ')}</span>
              </div>
              <div className="text-right text-sm">
                {r.weekNumber != null && (
                  <div className="font-semibold">Week {r.weekNumber} · {DAYS[r.dayOfWeek]}</div>
                )}
                <div className="text-ink-dim text-xs tnum">{r.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
