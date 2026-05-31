'use client';
import { useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { Card, MuscleBadge, Button } from '@/components/ui';
import { SetLoggerRow, type SetRowState } from './SetLoggerRow';
import type { ExerciseEntry, SetEntry, UserMode, Units } from '@/types';

interface Props {
  exercise: ExerciseEntry;
  exerciseIndex: number;
  mode: UserMode;
  units: Units;
  activeSetIndex: number | null;
  disabled?: boolean;
  onActivateSet: (i: number) => void;
  onUpdateSet: (i: number, next: SetEntry) => void;
  onLogSet: (i: number) => void;
  onUnlockSet: (i: number) => void;
  onAddSet: () => void;
  onSwap?: () => void;
  onSkip?: () => void;
  onSkipSet?: (i: number) => void;
  onRemove?: () => void;
  onShowHistory?: () => void;
}

export function ExerciseCard({
  exercise, exerciseIndex, mode, units, activeSetIndex, disabled,
  onActivateSet, onUpdateSet, onLogSet, onUnlockSet, onAddSet,
  onSwap, onSkip, onSkipSet, onRemove, onShowHistory,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const loggedCount = exercise.sets.filter((s) => s.completed && s.setType !== 'skip').length;
  const totalCount = exercise.sets.length;
  // The exercise is "done" once every set is dealt with (logged or skipped),
  // but the visible count only includes actually-logged sets.
  const allDone = totalCount > 0 && exercise.sets.every((s) => s.completed);

  const stateFor = (setIdx: number, set: SetEntry): SetRowState => {
    if (setIdx === activeSetIndex) return 'active';
    if (set.completed) return 'locked';
    return 'future';
  };

  return (
    <Card
      data-exercise-idx={exerciseIndex}
      className={cn(
        'p-0 overflow-visible scroll-mt-20',
        allDone && 'border-ok/40',
      )}
    >
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <MuscleBadge muscle={exercise.muscle} />
            {allDone && (
              <span className="inline-flex items-center gap-1 text-ok text-[10px] tracking-wider2 font-semibold uppercase">
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l4 4 8-8"/></svg>
                Done
              </span>
            )}
          </div>
          <div className="mt-2 font-medium text-base leading-tight">{exercise.name}</div>
          <div className="text-xs text-ink-dim mt-0.5">
            {totalCount} sets · {(() => {
              const m = exercise.metric ?? 'weight-reps';
              if (m === 'time' || m === 'weight-time') {
                return `${exercise.prescribedTimeLow ?? '?'}–${exercise.prescribedTimeHigh ?? '?'}s`;
              }
              return `${exercise.prescribedRepsLow ?? '?'}–${exercise.prescribedRepsHigh ?? '?'} reps`;
            })()}
            {mode === 'ADVANCED' && exercise.prescribedRIR != null && ` · ${exercise.prescribedRIR} RIR`}
            {exercise.setStyle === 'pyramid' && ' · Pyramid'}
            {exercise.setStyle === 'drop' && ' · Drop sets'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShowHistory}
            className="w-8 h-8 rounded-md border border-ink-line text-ink-dim hover:text-ink"
            aria-label="Exercise history"
            title="Exercise history"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" className="mx-auto" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 5v4h4" /><path d="M12 7v5l3 2" />
            </svg>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-md border border-ink-line text-ink-dim hover:text-ink"
              aria-label="More options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 card p-1 z-20">
                <MenuItem onClick={() => { onAddSet(); setMenuOpen(false); }}>+ Add set</MenuItem>
                <MenuItem onClick={() => { onSwap?.(); setMenuOpen(false); }}>↔ Replace exercise</MenuItem>
                <MenuItem onClick={() => { onSkip?.(); setMenuOpen(false); }}>⏭ Skip sets</MenuItem>
                <MenuItem onClick={() => { onRemove?.(); setMenuOpen(false); }} danger>✕ Remove</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {exercise.sets.map((set, i) => (
          <SetLoggerRow
            key={i}
            set={set}
            index={i}
            mode={mode}
            units={units}
            state={stateFor(i, set)}
            disabled={disabled}
            metric={exercise.metric}
            onActivate={() => onActivateSet(i)}
            onChange={(next) => onUpdateSet(i, next)}
            onLog={() => onLogSet(i)}
            onUnlock={() => onUnlockSet(i)}
            onSkip={onSkipSet ? () => onSkipSet(i) : undefined}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-t border-ink-line flex items-center justify-between">
        <span className={cn('text-xs tnum', allDone ? 'text-ok' : 'text-ink-dim')}>
          {loggedCount} / {totalCount} logged
        </span>
        <Button variant="ghost" size="sm" onClick={onAddSet} disabled={disabled}>+ Set</Button>
      </div>
    </Card>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left text-sm px-3 py-2 rounded-md hover:bg-bg-elev',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {children}
    </button>
  );
}
