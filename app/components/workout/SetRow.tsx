'use client';
import { cn } from '@/lib/ui/cn';
import { effortShort } from '@/lib/periodization';
import { formatSetValue } from '@/lib/ui/sets';
import type { SetEntry, ExerciseMetric, Units, UserMode } from '@/types';

interface Props {
  set: SetEntry;
  index: number;
  metric: ExerciseMetric;
  units: Units;
  /** Terminology mode for the effort label (RPE → words/number). */
  mode: UserMode;
}

/**
 * One read-only logged-set row: a status dot (✓ done / ✕ skipped / empty
 * pending), the set number, the value (weight × reps / time / "Skipped"), and
 * the effort label when completed. Shared by the Plan page, the session detail
 * modal, and anywhere a logged set is summarized.
 */
export function SetRow({ set, index, metric, units, mode }: Props) {
  const skipped = set.setType === 'skip';
  const completed = set.completed && !skipped;
  const body = formatSetValue(set, metric, units, completed);
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-[12px] tnum',
        skipped ? 'bg-danger/10 text-danger' : completed ? 'bg-ok/10 text-ok' : 'bg-bg-elev/40 text-ink-dim',
      )}
    >
      <span
        className={cn(
          'w-4 h-4 rounded-full text-[10px] flex items-center justify-center flex-none',
          skipped ? 'bg-danger/30 text-danger' : completed ? 'bg-ok/30 text-ok' : 'border border-ink-line',
        )}
      >
        {skipped ? '✕' : completed ? '✓' : ''}
      </span>
      <span className="font-medium">Set {index + 1}</span>
      <span className="flex-1 numeric truncate">
        {body}
        {completed && set.rpe != null && (
          <span className="text-ink-mute"> · {effortShort(mode, set.rpe)}</span>
        )}
      </span>
    </li>
  );
}
