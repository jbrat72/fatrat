'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import type { SetEntry, UserMode, Units, ExerciseMetric } from '@/types';
import { InlineNumber } from '@/components/ui';
import { EffortPicker } from './EffortPicker';
import { kgToDisplay, displayToKg, weightLabel } from '@/lib/ui/units';
import { formatPrev } from '@/lib/ui/sets';
import { effortFeelLabel } from '@/lib/periodization';

export type SetRowState = 'future' | 'active' | 'awaiting' | 'locked';

interface Props {
  set: SetEntry;
  index: number;
  mode: UserMode;
  units: Units;
  /** How this exercise measures a set. Defaults to weight-reps. */
  metric?: ExerciseMetric;
  /** What the user did on this set last time they trained this exercise. */
  lastSet?: SetEntry;
  state: SetRowState;
  /** Shared grid-template-columns string so every row aligns under the header. */
  gridTemplate: string;
  disabled?: boolean;
  onActivate: () => void;
  onChange: (next: SetEntry) => void;
  onLog: () => void;
  onUnlock?: () => void;
  onSkip?: () => void;
  /** Effort chosen after logging — advances to the next set / starts the timer. */
  onEffort?: (rpe: SetEntry['rpe']) => void;
  /** Called when the user taps "Start timer" on a time-based set. */
  onStartTimer?: () => void;
}

export function SetLoggerRow({
  set, index, mode, units, metric = 'weight-reps', lastSet, state, gridTemplate,
  disabled, onActivate, onChange, onLog, onUnlock, onSkip, onEffort, onStartTimer,
}: Props) {
  const [logError, setLogError] = useState<string | null>(null);
  const isDrop = set.setType === 'drop';
  const isSkipped = set.setType === 'skip';
  const showWeight = metric === 'weight-reps' || metric === 'weight-time';
  const showReps = metric === 'weight-reps' || metric === 'reps';
  const showTime = metric === 'time' || metric === 'weight-time';
  // Bodyweight (rep-based) moves can be loaded — offer an OPTIONAL weight field.
  const addedWeight = metric === 'reps';
  const weightCol = showWeight || addedWeight;

  const isActive = state === 'active';
  const isAwaiting = state === 'awaiting';
  const isLocked = state === 'locked';
  const checked = isAwaiting || isLocked;
  const inputsDisabled = !isActive || disabled;

  // Clear the warning the moment the required fields are filled in.
  useEffect(() => {
    const wOk = !showWeight || set.weightKg != null;
    const rOk = !showReps || set.reps != null;
    const tOk = !showTime || set.timeSec != null;
    if (logError && wOk && rOk && tOk) setLogError(null);
  }, [set.weightKg, set.reps, set.timeSec, showWeight, showReps, showTime, logError]);

  useEffect(() => { if (state !== 'active' && logError) setLogError(null); }, [state, logError]);

  const handleLogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (isLocked || isAwaiting) { onUnlock?.(); return; }
    if (state === 'future') { onActivate(); return; }
    // Active — validate the entry (effort is asked AFTER logging now).
    if (showWeight && set.weightKg == null) { setLogError(showTime ? 'Enter weight and time' : 'Enter weight and reps'); return; }
    if (showReps && set.reps == null) { setLogError(showWeight ? 'Enter weight and reps' : 'Enter reps'); return; }
    if (showTime && set.timeSec == null) { setLogError(showWeight ? 'Enter weight and time' : 'Enter time'); return; }
    setLogError(null);
    onLog();
  };

  return (
    <div
      onClick={() => { if (state === 'future') onActivate(); if (isLocked) onUnlock?.(); }}
      className={cn(
        'relative rounded-lg transition',
        isActive && 'bg-accent/10',
        isAwaiting && 'bg-bg-elev',
        (state === 'future' || isLocked) && 'cursor-pointer',
        isDrop && 'ml-4',
        disabled && !isAwaiting && 'opacity-60 pointer-events-none',
      )}
    >
      {/* Left accent rule for the active / just-logged row. */}
      {(isActive || isAwaiting) && <div className={cn('absolute left-0 top-1 bottom-1 rounded bg-accent', isActive ? 'w-1' : 'w-0.5')} />}

      <div className="grid items-center gap-2 px-1.5 py-1.5" style={{ gridTemplateColumns: gridTemplate }}>
        <div className={cn('text-center text-sm tabular-nums font-medium', isActive ? 'text-accent font-semibold' : 'text-ink-mute')}>
          {isDrop ? <span className="text-warn text-[9px] font-semibold tracking-wider2">DROP</span>
            : isSkipped ? <span className="text-ink-mute text-[9px] font-semibold tracking-wider2">SKIP</span>
              : index + 1}
        </div>

        <div className="text-center leading-tight min-w-0">
          <div className="text-[14px] text-ink-dim tnum truncate">{formatPrev(lastSet, metric, units)}</div>
          {lastSet?.rpe != null && lastSet.setType !== 'skip' && (
            <div className={cn('text-[11px] tracking-wide truncate', lastSet.rpe >= 9 ? 'text-danger/70' : 'text-ink-mute/80')}>
              {effortFeelLabel(lastSet.rpe, mode)}
            </div>
          )}
        </div>

        {weightCol && (
          <InlineNumber
            value={kgToDisplay(set.weightKg, units)}
            onChange={(n) => onChange({ ...set, weightKg: displayToKg(n, units) })}
            step={units === 'imperial' ? 5 : 2.5}
            decimals={1}
            disabled={inputsDisabled}
            highlight={isActive}
            ariaLabel={`Set ${index + 1} weight`}
          />
        )}

        {showReps && (
          <InlineNumber
            value={set.reps}
            onChange={(n) => onChange({ ...set, reps: n })}
            step={1}
            decimals={0}
            disabled={inputsDisabled}
            highlight={isActive}
            ariaLabel={`Set ${index + 1} reps`}
          />
        )}

        {showTime && (
          <InlineNumber
            value={set.timeSec}
            onChange={(n) => onChange({ ...set, timeSec: n })}
            step={5}
            min={1}
            time
            disabled={inputsDisabled}
            highlight={isActive}
            ariaLabel={`Set ${index + 1} time`}
          />
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLogClick}
            disabled={disabled}
            className="log-check"
            data-on={checked}
            aria-pressed={checked}
            aria-label={checked ? 'Unlock set' : 'Log set'}
          >
            {checked && (
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10l4 4 8-8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Active: timer button (time metric) + skip affordance. */}
      {isActive && (
        <div className="px-2 pb-2" onClick={(e) => e.stopPropagation()}>
          {showTime && onStartTimer && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartTimer(); }}
              disabled={disabled}
              className="mb-2 w-full h-8 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs font-semibold active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              ▶ Start timer
            </button>
          )}
          {logError && <div className="mb-1 text-xs text-danger text-right">{logError}</div>}
          {onSkip && (
            <div className="flex justify-end">
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

      {/* Just logged: ask how it felt — advancing waits on this. */}
      {isAwaiting && (
        <div className="px-2 pb-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute uppercase mb-1.5">How did it feel?</div>
          <EffortPicker
            mode={mode}
            value={set.rpe}
            onChange={(rpe) => { if (rpe != null) onEffort?.(rpe); }}
            compact
          />
        </div>
      )}
    </div>
  );
}
