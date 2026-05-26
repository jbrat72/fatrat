'use client';
import { useEffect, useState } from 'react';
import { MuscleBadge, Button } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import { PUMP_LABEL, VOLUME_LABEL, PAIN_LABEL } from '@/lib/ui/feedback';
import { useUser } from '@/components/app';
import { terminologyMode } from '@/lib/periodization';
import type { WorkoutSession, UserMode, EffortRPE, SorenessRating } from '@/types';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const SORENESS_LABEL: Record<SorenessRating, string> = {
  1: 'Never got sore',
  2: 'Healed a while ago',
  3: 'Healed just on time',
  4: 'Still sore',
};

function effortShort(mode: UserMode, rpe: EffortRPE): string {
  if (mode === 'BASIC') {
    if (rpe <= 6.5) return 'Easy';
    if (rpe <= 8)   return 'Just right';
    return 'Hard';
  }
  if (mode === 'INTERMEDIATE') {
    if (rpe <= 6.5) return 'Smooth';
    if (rpe <= 7.5) return 'Solid';
    if (rpe <= 8.5) return 'Tough';
    if (rpe <= 9.5) return 'Grinding';
    return 'Failed';
  }
  return `RPE ${rpe}`;
}

interface Props {
  sessionId: string | null;
  onClose: () => void;
  /** When provided, shows an "Add to this day" action that opens the add menu. */
  onAddToDay?: () => void;
}

export function DaySessionSheet({ sessionId, onClose, onAddToDay }: Props) {
  const { user } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    if (!sessionId) { setSession(null); return; }
    getRepository().getSession(sessionId).then(setSession);
  }, [sessionId]);

  if (!sessionId || !user) return null;
  if (!session) return null;

  const units = user.units;
  const wLabel = weightLabel(units);
  const dayName = DAYS[session.dayOfWeek];

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="section-head">{dayName.toUpperCase()} · {session.date}</div>
            <div className="text-xs text-ink-dim mt-0.5">
              {session.completed ? 'Completed' : session.startedAt ? 'In progress' : 'Upcoming'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {session.notes && (
            <div className="text-sm text-ink-dim italic">&ldquo;{session.notes}&rdquo;</div>
          )}

          {session.exercises.map((ex, i) => {
            const fb = session.feedback?.perMuscle.find((p) => p.muscle === ex.muscle);
            return (
              <div key={i} className="card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MuscleBadge muscle={ex.muscle} />
                  <span className="font-medium text-sm truncate flex-1">{ex.name}</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {ex.sets.filter((s) => s.completed).map((s, j) => {
                    const m = ex.metric ?? 'weight-reps';
                    let body: React.ReactNode;
                    if (s.setType === 'skip') {
                      body = <span className="text-ink-mute">Skipped</span>;
                    } else if (m === 'time') {
                      body = <span>{s.timeSec ?? '—'}s</span>;
                    } else if (m === 'weight-time') {
                      body = <span>{kgToDisplay(s.weightKg, units) ?? '—'} {wLabel} × {s.timeSec ?? '—'}s</span>;
                    } else if (m === 'reps') {
                      body = <span>× {s.reps ?? '—'}</span>;
                    } else {
                      body = <span>{kgToDisplay(s.weightKg, units) ?? '—'} {wLabel} × {s.reps ?? '—'}</span>;
                    }
                    return (
                      <li key={j} className="flex items-center justify-between tnum">
                        <span className="text-ink-dim">Set {j + 1}</span>
                        {s.setType !== 'skip' && s.rpe != null ? (
                          <span className="flex items-center gap-2">
                            {body}
                            <span className="text-ink-mute">· {effortShort(terminologyMode(user), s.rpe)}</span>
                          </span>
                        ) : body}
                      </li>
                    );
                  })}
                  {!ex.sets.some((s) => s.completed) && <li className="text-ink-mute text-xs">No sets logged.</li>}
                </ul>
                {fb && (
                  <div className="mt-2 pt-2 border-t border-ink-line flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                    <span>Pump <span className="text-ink-dim">{PUMP_LABEL[fb.pump]}</span></span>
                    <span>Volume <span className="text-ink-dim">{VOLUME_LABEL[fb.volume]}</span></span>
                    <span>Joint pain <span className="text-ink-dim">{PAIN_LABEL[fb.pain]}</span></span>
                  </div>
                )}
              </div>
            );
          })}

          {session.cardio.length > 0 && (
            <div className="card p-3">
              <div className="section-head mb-2">CARDIO</div>
              <ul className="space-y-1 text-sm">
                {session.cardio.map((c, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="capitalize">{c.activityType.replace('-', ' ')}</span>
                    <span className="text-ink-dim tnum">
                      {c.durationMin} min{c.distanceKm != null ? ` · ${c.distanceKm} km` : ''}{c.avgHR != null ? ` · ${c.avgHR} bpm` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(session.soreness ?? []).length > 0 && (
            <div className="card p-3">
              <div className="section-head mb-2">RECOVERY</div>
              <div className="text-xs text-ink-mute mb-1.5">Soreness reported at the start of this session.</div>
              <ul className="space-y-1 text-sm">
                {(session.soreness ?? []).map((sr, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="capitalize">{sr.muscle}</span>
                    <span className="text-ink-dim">{SORENESS_LABEL[sr.rating]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-1 pb-3 space-y-2">
            {onAddToDay && (
              <Button block onClick={onAddToDay}>Add cardio or a workout to this day</Button>
            )}
            <Button block variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
