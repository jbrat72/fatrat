'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { Button, MuscleBadge } from '@/components/ui';
import { PUMP_OPTIONS, VOLUME_OPTIONS, PAIN_OPTIONS, PUMP_LABEL, VOLUME_LABEL, PAIN_LABEL, worstPain } from '@/lib/ui/feedback';
import type {
  MuscleGroup, SessionFeedback, PerMuscleFeedback, WorkoutSession,
  PumpLevel, VolumeLevel, PainLevel,
} from '@/types';

interface Props {
  open: boolean;
  session: WorkoutSession | null;
  /** Restrict the form to these muscles. Defaults to all worked muscles. */
  muscles?: MuscleGroup[];
  /** Existing feedback to merge new answers into (per-muscle collection). */
  existing?: SessionFeedback | null;
  onCancel: () => void;
  onSave: (feedback: SessionFeedback) => void;
}

/**
 * Post-session feedback form. Used three ways:
 *  - per muscle, mid-workout, as each muscle group is finished (`muscles=[m]`);
 *  - at workout finish, for any muscles skipped during the session;
 *  - retroactively from the session summary, for the whole session.
 * `existing` feedback is merged so per-muscle collection accumulates.
 */
export function SessionFeedbackModal({ open, session, muscles, existing, onCancel, onSave }: Props) {
  const targetMuscles = useMemo<MuscleGroup[]>(() => {
    if (!session) return [];
    if (muscles) return muscles;
    const seen = new Set<MuscleGroup>();
    for (const ex of session.exercises) {
      if (ex.sets.some((s) => s.completed)) seen.add(ex.muscle);
    }
    return [...seen];
  }, [session, muscles]);

  const initial = useMemo(() => {
    const p = {} as Record<MuscleGroup, PumpLevel>;
    const v = {} as Record<MuscleGroup, VolumeLevel>;
    const j = {} as Record<MuscleGroup, PainLevel>;
    for (const m of existing?.perMuscle ?? []) {
      p[m.muscle] = m.pump; v[m.muscle] = m.volume; j[m.muscle] = m.pain;
    }
    return { p, v, j };
  }, [existing]);

  const [pump, setPump] = useState<Record<MuscleGroup, PumpLevel>>(initial.p);
  const [volume, setVolume] = useState<Record<MuscleGroup, VolumeLevel>>(initial.v);
  const [pain, setPain] = useState<Record<MuscleGroup, PainLevel>>(initial.j);

  if (!open || !session) return null;

  const allAnswered = targetMuscles.every((m) => pump[m] && volume[m] && pain[m]);
  const single = targetMuscles.length === 1;

  const submit = () => {
    const answered: PerMuscleFeedback[] = targetMuscles.map((m) => ({
      muscle: m, pump: pump[m]!, volume: volume[m]!, pain: pain[m]!,
    }));
    // Carry forward existing feedback for muscles not in this form.
    const targetSet = new Set(targetMuscles);
    const carried = (existing?.perMuscle ?? []).filter((m) => !targetSet.has(m.muscle));
    const perMuscle = [...carried, ...answered];
    const fb: SessionFeedback = {
      jointPainOverall: worstPain(perMuscle.map((m) => m.pain)),
      perMuscle,
      collectedAt: new Date().toISOString(),
    };
    onSave(fb);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onCancel}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
          <div>
            <div className="section-head">{single ? 'MUSCLE CHECK-IN' : 'HOW DID IT GO?'}</div>
            <div className="text-xs text-ink-dim mt-0.5">
              {single
                ? 'You just finished this muscle — quick check-in.'
                : 'Quick check-in so we can tune your next session.'}
            </div>
          </div>
          <button type="button" onClick={onCancel} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-5">
          {targetMuscles.length === 0 && (
            <p className="text-sm text-ink-dim">No muscles tracked yet — log at least one set to fill this in.</p>
          )}

          {targetMuscles.map((m, i) => (
            <section key={m} className={cn('space-y-3 pt-1', i > 0 && 'border-t border-ink-line pt-3')}>
              <div className="flex items-center gap-2">
                <MuscleBadge muscle={m} />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="section-head">PUMP</div>
                  <div className="text-xs text-ink-dim">{pump[m] ? PUMP_LABEL[pump[m]!] : 'Pick one'}</div>
                </div>
                <OptionRow options={PUMP_OPTIONS} value={pump[m]} onChange={(v) => setPump({ ...pump, [m]: v })} />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="section-head">VOLUME</div>
                  <div className="text-xs text-ink-dim">{volume[m] ? VOLUME_LABEL[volume[m]!] : 'Pick one'}</div>
                </div>
                <OptionRow options={VOLUME_OPTIONS} value={volume[m]} onChange={(v) => setVolume({ ...volume, [m]: v })} />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="section-head">JOINT PAIN</div>
                  <div className="text-xs text-ink-dim">{pain[m] ? PAIN_LABEL[pain[m]!] : 'Pick one'}</div>
                </div>
                <OptionRow options={PAIN_OPTIONS} value={pain[m]} onChange={(v) => setPain({ ...pain, [m]: v })} dangerValues={['high']} />
              </div>
            </section>
          ))}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-bg-card pb-4 -mx-4 px-4 border-t border-ink-line">
            <Button variant="ghost" onClick={onCancel}>Skip</Button>
            <div className="flex-1" />
            <Button onClick={submit} disabled={targetMuscles.length > 0 && !allAnswered}>
              Save feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OptionRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  dangerValues?: T[];
}

function OptionRow<T extends string>({ options, value, onChange, dangerValues }: OptionRowProps<T>) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        const danger = dangerValues?.includes(o.value) ?? false;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 h-11 rounded-lg border-2 text-xs font-semibold transition active:scale-95 px-1 leading-tight',
              active
                ? (danger ? 'bg-danger text-white border-danger' : 'bg-accent text-white border-accent')
                : (danger
                    ? 'bg-bg-input border-ink-line text-danger hover:border-danger'
                    : 'bg-bg-input border-ink-line text-ink-dim hover:border-ink-dim'),
            )}
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
