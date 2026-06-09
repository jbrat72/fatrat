'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import type { SetEntry, UserMode, Units, ExerciseMetric } from '@/types';
import { InlineNumber } from '@/components/ui';
import { EffortPicker } from './EffortPicker';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';

export type SetRowState = 'future' | 'active' | 'locked';

interface Props {
  set: SetEntry;
  index: number;
  mode: UserMode;
  units: Units;
  /** How this exercise measures a set. Defaults to weight-reps. */
  metric?: ExerciseMetric;
  state: SetRowState;
  disabled?: boolean;
  onActivate: () => void;
  onChange: (next: SetEntry) => void;
  onLog: () => void;
  onUnlock?: () => void;
  onSkip?: () => void;
  /** Called when the user taps "Start timer" on a time-based set. The parent
   *  opens the countdown overlay with the set's current/prescribed time. */
  onStartTimer?: () => void;
}

export function SetLoggerRow({
  set, index, mode, units, metric = 'weight-reps', state, disabled, onActivate, onChange, onLog, onUnlock, onSkip, onStartTimer,
}: Props) {
  const [logError, setLogError] = useState<string | null>(null);
  const isHard = set.rpe != null && set.rpe >= 9;
  const isDrop = set.setType === 'drop';
  const isSkipped = set.setType === 'skip';
  const showWeight = metric === 'weight-reps' || metric === 'weight-time';
  const showReps = metric === 'weight-reps' || metric === 'reps';
  const showTime = metric === 'time' || metric === 'weight-time';
  // Bodyweight (rep-based) moves are often loaded — a dumbbell, vest, or dip
  // belt — so offer an OPTIONAL weight field. It's never required to log.
  const addedWeight = metric === 'reps';
  const weightCol = showWeight || addedWeight;

  // Clear the warning the moment any of the required fields is filled in.
  useEffect(() => {
    const wOk = !showWeight || set.weightKg != null;
    const rOk = !showReps || set.reps != null;
    const tOk = !showTime || set.timeSec != null;
    if (logError && wOk && rOk && tOk && set.rpe != null) {
      setLogError(null);
    }
  }, [set.weightKg, set.reps, set.timeSec, set.rpe, showWeight, showReps, showTime, logError]);

  // Also clear the error if the user navigates away from this set.
  useEffect(() => {
    if (state !== 'active' && logError) setLogError(null);
  }, [state, logError]);

  const handleLogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (state === 'locked') { onUnlock?.(); return; }
    if (state === 'future') { onActivate(); return; }
    if (showWeight && set.weightKg == null) {
      setLogError(showTime ? 'Enter weight and time first' : 'Enter weight and reps first'); return;
    }
    if (showReps && set.reps == null) {
      setLogError(showWeight ? 'Enter weight and reps first' : 'Enter reps first'); return;
    }
    if (showTime && set.timeSec == null) {
      setLogError(showWeight ? 'Enter weight and time first' : 'Enter time first'); return;
    }
    if (set.rpe == null) {
      setLogError('Pick how it felt first'); return;
    }
    setLogError(null);
    onLog();
  };

  return (
    <div
      onClick={() => { if (state === 'future') onActivate(); if (state === 'locked') onUnlock?.(); }}
      className={cn(
        'rounded-xl border transition relative',
        state === 'active'  && 'border-2 border-accent bg-bg-elev shadow-glow',
        state === 'locked'  && 'border-ink-line bg-bg-card hover:border-accent cursor-pointer',
        state === 'future'  && 'border-ink-line bg-bg-card/60 cursor-pointer',
        isHard && state === 'active' && 'ring-1 ring-danger/40',
        isDrop && 'ml-5',
        disabled && 'opacity-60 pointer-events-none',
      )}
    >
      <div
        className={cn(
          'items-start gap-3 p-3 grid',
          weightCol && (showReps || showTime)
            ? 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_56px]'
            : 'grid-cols-[24px_minmax(0,1fr)_56px]',
        )}
      >
        <div className="mt-5 text-ink-mute text-sm tabular-nums font-medium">
          {isDrop
            ? <span className="text-warn text-[9px] font-semibold tracking-wider2">DROP</span>
            : isSkipped
              ? <span className="text-ink-mute text-[9px] font-semibold tracking-wider2">SKIP</span>
              : index + 1}
        </div>

        {weightCol && (
          <div>
            <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute mb-1.5">{showWeight ? 'WEIGHT' : '+ WEIGHT'}</div>
            <InlineNumber
              value={kgToDisplay(set.weightKg, units)}
              onChange={(n) => onChange({ ...set, weightKg: displayToKg(n, units) })}
              step={units === 'imperial' ? 5 : 2.5}
              decimals={1}
              unit={weightLabel(units)}
              disabled={state !== 'active' || disabled}
              ariaLabel={`Set ${index + 1} weight`}
            />
          </div>
        )}

        {showReps && (
          <div>
            <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute mb-1.5">REPS</div>
            <InlineNumber
              value={set.reps}
              onChange={(n) => onChange({ ...set, reps: n })}
              step={1}
              decimals={0}
              disabled={state !== 'active' || disabled}
              ariaLabel={`Set ${index + 1} reps`}
            />
          </div>
        )}

        {showTime && (
          <div>
            <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute mb-1.5">TIME</div>
            <InlineNumber
              value={set.timeSec}
              onChange={(n) => onChange({ ...set, timeSec: n })}
              step={5}
              min={1}
              decimals={0}
              unit="s"
              disabled={state !== 'active' || disabled}
              ariaLabel={`Set ${index + 1} time`}
            />
            {state === 'active' && onStartTimer && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStartTimer(); }}
                disabled={disabled}
                className="mt-1.5 w-full h-8 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs font-semibold active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                ▶ Start timer
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute mb-1.5">
            {state === 'locked' ? 'EDIT' : 'LOG'}
          </div>
          <button
            type="button"
            onClick={handleLogClick}
            disabled={disabled}
            className="log-check"
            data-on={state === 'locked'}
            aria-pressed={state === 'locked'}
            aria-label={state === 'locked' ? 'Unlock set' : 'Log set'}
          >
            {state === 'locked' && (
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10l4 4 8-8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {state === 'active' && (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute uppercase mb-1.5">How did it feel?</div>
          <EffortPicker
            mode={mode}
            value={set.rpe}
            onChange={(rpe) => {
              if (rpe != null) setLogError(null);
              onChange({ ...set, rpe });
            }}
            compact
          />
          {logError && <div className="mt-2 text-xs text-danger text-center">{logError}</div>}
          {onSkip && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSkip(); }}
                disabled={disabled}
                className="text-[11px] text-ink-mute hover:text-ink underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                Skip this set
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
