'use client';
import { cn } from '@/lib/ui/cn';
import type { UserMode, EffortRPE } from '@/types';
import {
  rpeFromBasicFeel,
  rpeFromIntermediateFeel,
  basicFeelFromRPE,
  intermediateFeelFromRPE,
  rirFromRPE,
} from '@/lib/periodization';

interface Props {
  mode: UserMode;
  value: EffortRPE | undefined;
  onChange: (rpe: EffortRPE | undefined) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Mode-aware effort picker.
 *   BASIC        → 3 buttons: Easy / Just Right / Hard          (RPE 6 / 7.5 / 9)
 *   INTERMEDIATE → 5 buttons: Easy / Solid / Tough / Hard / Failed
 *   ADVANCED     → RPE pills 6,7,8,9,10 + half-steps, with RIR readout
 *
 * Always writes the underlying numeric RPE. The same value rendered in BASIC
 * round-trips back through `basicFeelFromRPE` so historical RPE values from a
 * downshifted user still surface as the nearest bucket.
 */
export function EffortPicker({ mode, value, onChange, className, compact }: Props) {
  if (mode === 'BASIC') {
    return (
      <div className={cn('flex gap-1.5', className)}>
        {(['easy', 'just-right', 'hard'] as const).map((feel) => {
          const rpe = rpeFromBasicFeel(feel);
          const active = value != null && basicFeelFromRPE(value) === feel;
          const label = feel === 'easy' ? 'Easy' : feel === 'just-right' ? 'Just Right' : 'Hard';
          return (
            <EffortPill
              key={feel}
              active={active}
              danger={feel === 'hard'}
              onClick={() => onChange(active ? undefined : rpe)}
              compact={compact}
            >
              {label}
            </EffortPill>
          );
        })}
      </div>
    );
  }

  if (mode === 'INTERMEDIATE') {
    const feels = [
      { key: 'smooth', label: 'Easy' },
      { key: 'solid', label: 'Solid' },
      { key: 'tough', label: 'Tough' },
      { key: 'grinding', label: 'Hard' },
      { key: 'failed', label: 'Failed' },
    ] as const;
    return (
      <div className={cn('flex gap-1 flex-wrap', className)}>
        {feels.map(({ key, label }) => {
          const rpe = rpeFromIntermediateFeel(key);
          const active = value != null && intermediateFeelFromRPE(value) === key;
          const danger = key === 'grinding' || key === 'failed';
          return (
            <EffortPill key={key} active={active} danger={danger} onClick={() => onChange(active ? undefined : rpe)} compact={compact}>
              {label}
            </EffortPill>
          );
        })}
      </div>
    );
  }

  // ADVANCED — RPE pills with RIR readout
  const stops: EffortRPE[] = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1 flex-wrap">
        {stops.map((rpe) => {
          const active = value === rpe;
          const danger = rpe >= 9;
          return (
            <EffortPill key={rpe} active={active} danger={danger} onClick={() => onChange(active ? undefined : rpe)} compact={compact}>
              {rpe}
            </EffortPill>
          );
        })}
      </div>
      {value != null && (
        <div className="text-xs text-ink-dim tnum">
          RPE {value} · RIR {rirFromRPE(value)}
        </div>
      )}
    </div>
  );
}

function EffortPill({
  active, danger, onClick, compact, children,
}: { active: boolean; danger?: boolean; onClick: () => void; compact?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border font-semibold transition active:scale-[0.97]',
        compact ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm',
        active
          ? danger
            ? 'bg-danger/15 border-danger text-danger'
            : 'bg-accent text-white border-accent'
          : 'bg-bg-input text-ink-dim border-ink-line hover:border-ink-dim',
      )}
    >
      {children}
    </button>
  );
}
