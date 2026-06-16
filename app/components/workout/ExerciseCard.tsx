'use client';
import { useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { Card, MuscleBadge, Button } from '@/components/ui';
import { SetLoggerRow, type SetRowState } from './SetLoggerRow';
import { weightLabel } from '@/lib/ui/units';
import type { ExerciseEntry, SetEntry, EffortRPE, UserMode, Units } from '@/types';

type SupersetMode = 'idle' | 'armed' | 'candidate';

interface Props {
  exercise: ExerciseEntry;
  exerciseIndex: number;
  mode: UserMode;
  units: Units;
  /** Live metric from the exercise definition. Overrides the saved
   *  exercise.metric so a stale denormalized value (e.g. 'reps' on what is
   *  now a 'weight-reps' lift) doesn't keep showing the wrong input. */
  liveMetric?: ExerciseEntry['metric'];
  /** The matching exercise's completed sets from the last time it was trained. */
  lastSets?: SetEntry[];
  activeSetIndex: number | null;
  /** Index of the set that was just logged and is waiting on an effort rating. */
  awaitingEffortSetIdx?: number | null;
  disabled?: boolean;
  onActivateSet: (i: number) => void;
  onUpdateSet: (i: number, next: SetEntry) => void;
  onLogSet: (i: number) => void;
  onUnlockSet: (i: number) => void;
  /** Effort chosen for a just-logged set — gates advancing to the next set. */
  onEffort?: (i: number, rpe: EffortRPE | undefined) => void;
  onAddSet: () => void;
  onRemoveSet?: () => void;
  /** Whether a set can still be trimmed (more than one set, at least one pending). */
  canRemoveSet?: boolean;
  onSwap?: () => void;
  onSkip?: () => void;
  onSkipSet?: (i: number) => void;
  onRemove?: () => void;
  /** Whether this exercise can be removed (false when it's the last one). */
  canRemove?: boolean;
  /** Superset pairing (mid-workout). */
  supersetMode?: SupersetMode;
  supersetPartnerName?: string;
  onSuperset?: () => void;
  onPairHere?: () => void;
  onCancelSuperset?: () => void;
  onUnlinkSuperset?: () => void;
  onShowHistory?: () => void;
  /** Called when the user taps Start timer on a time-based set. */
  onStartTimer?: (setIdx: number) => void;
}

export function ExerciseCard({
  exercise, exerciseIndex, mode, units, liveMetric, lastSets, activeSetIndex, awaitingEffortSetIdx, disabled,
  onActivateSet, onUpdateSet, onLogSet, onUnlockSet, onEffort, onAddSet, onRemoveSet, canRemoveSet,
  onSwap, onSkip, onSkipSet, onRemove, canRemove,
  supersetMode = 'idle', supersetPartnerName, onSuperset, onPairHere, onCancelSuperset, onUnlinkSuperset,
  onShowHistory, onStartTimer,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const loggedCount = exercise.sets.filter((s) => s.completed && s.setType !== 'skip').length;
  const totalCount = exercise.sets.length;
  // The exercise is "done" once every set is dealt with (logged or skipped),
  // but the visible count only includes actually-logged sets.
  const allDone = totalCount > 0 && exercise.sets.every((s) => s.completed);

  const metric = liveMetric ?? exercise.metric ?? 'weight-reps';
  const showWeight = metric === 'weight-reps' || metric === 'weight-time';
  const showReps = metric === 'weight-reps' || metric === 'reps';
  const showTime = metric === 'time' || metric === 'weight-time';
  const addedWeight = metric === 'reps';
  const weightCol = showWeight || addedWeight;

  // Build the table columns dynamically so the header and every row align.
  const cols: { label: string; w: string }[] = [
    { label: 'SET', w: '1.75rem' },
    { label: 'PREV', w: 'minmax(40px,1fr)' },
  ];
  if (weightCol) cols.push({ label: (showWeight ? '' : '+') + weightLabel(units).toUpperCase(), w: 'minmax(52px,1fr)' });
  if (showReps) cols.push({ label: 'REPS', w: 'minmax(52px,1fr)' });
  if (showTime) cols.push({ label: 'TIME', w: 'minmax(52px,1fr)' });
  cols.push({ label: 'LOG', w: '2.5rem' });
  const gridTemplate = cols.map((c) => c.w).join(' ');

  const stateFor = (setIdx: number, set: SetEntry): SetRowState => {
    if (awaitingEffortSetIdx === setIdx) return 'awaiting';
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
        supersetMode === 'armed' && 'border-accent',
      )}
    >
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <MuscleBadge muscle={exercise.muscle} />
            {exercise.supersetGroup != null && (
              <span className="text-[10px] tracking-wider2 font-semibold uppercase text-accent">⛓ Superset</span>
            )}
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
              if (showTime) return `${exercise.prescribedTimeLow ?? '?'}–${exercise.prescribedTimeHigh ?? '?'}s`;
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
              <div className="absolute right-0 mt-1 w-52 card p-1 z-20">
                <MenuItem onClick={() => { onAddSet(); setMenuOpen(false); }}>+ Add set</MenuItem>
                {onRemoveSet && (
                  <MenuItem onClick={() => { onRemoveSet(); setMenuOpen(false); }} disabled={canRemoveSet === false}>− Remove set</MenuItem>
                )}
                <MenuItem onClick={() => { onSwap?.(); setMenuOpen(false); }}>↔ Replace exercise</MenuItem>
                {exercise.supersetGroup != null
                  ? onUnlinkSuperset && <MenuItem onClick={() => { onUnlinkSuperset(); setMenuOpen(false); }}>⛓ Unlink superset</MenuItem>
                  : onSuperset && <MenuItem onClick={() => { onSuperset(); setMenuOpen(false); }}>⛓ Superset with…</MenuItem>}
                <MenuItem onClick={() => { onSkip?.(); setMenuOpen(false); }}>⏭ Skip remaining sets</MenuItem>
                <MenuItem onClick={() => { onRemove?.(); setMenuOpen(false); }} danger disabled={canRemove === false}>✕ Remove exercise</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Superset pairing strip */}
      {supersetMode === 'armed' && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
          <span className="text-[12px] text-accent-hot font-medium">Pick another exercise to superset with this one</span>
          <button type="button" onClick={onCancelSuperset} className="text-[12px] text-ink-mute">Cancel</button>
        </div>
      )}
      {supersetMode === 'candidate' && (
        <button
          type="button"
          onClick={onPairHere}
          className="mx-3 mb-2 w-[calc(100%-1.5rem)] rounded-lg border border-accent bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent active:scale-[0.99]"
        >
          ⛓ Pair with {supersetPartnerName}
        </button>
      )}

      <div className="px-3 pb-2">
        {/* Table header */}
        <div className="grid items-center gap-2 px-1.5 pb-1 border-b border-ink-line" style={{ gridTemplateColumns: gridTemplate }}>
          {cols.map((c, k) => (
            <div key={k} className="text-center text-[10px] tracking-wider2 font-semibold text-ink-mute uppercase">{c.label}</div>
          ))}
        </div>

        <div className="mt-1 space-y-0.5">
          {exercise.sets.map((set, i) => (
            <SetLoggerRow
              key={i}
              set={set}
              index={i}
              mode={mode}
              units={units}
              metric={metric}
              gridTemplate={gridTemplate}
              state={stateFor(i, set)}
              disabled={disabled}
              lastSet={lastSets ? (lastSets[i] ?? lastSets[lastSets.length - 1]) : undefined}
              onActivate={() => onActivateSet(i)}
              onChange={(next) => onUpdateSet(i, next)}
              onLog={() => onLogSet(i)}
              onUnlock={() => onUnlockSet(i)}
              onEffort={onEffort ? (rpe) => onEffort(i, rpe) : undefined}
              onSkip={onSkipSet ? () => onSkipSet(i) : undefined}
              onStartTimer={onStartTimer ? () => onStartTimer(i) : undefined}
            />
          ))}
        </div>
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

function MenuItem({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left text-sm px-3 py-2 rounded-md hover:bg-bg-elev disabled:opacity-40 disabled:hover:bg-transparent',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {children}
    </button>
  );
}
