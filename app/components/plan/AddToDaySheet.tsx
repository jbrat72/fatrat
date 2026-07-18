'use client';
import type { ReactNode } from 'react';
import { Button, Sheet } from '@/components/ui';

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface AddDayInfo {
  date: string;       // ISO YYYY-MM-DD
  weekNumber: number;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

interface Props {
  day: AddDayInfo;
  onClose: () => void;
  onLogWorkout: () => void;
  onLogCardio: () => void;
  /** Optional extra action row (Plan uses it for "Move a missed workout here"). */
  extra?: ReactNode;
  footer?: string;
}

/**
 * The "ADD TO THIS DAY" bottom sheet — previously copy-pasted wholesale in
 * the Plan and History pages.
 */
export function AddToDaySheet({ day, onClose, onLogWorkout, onLogCardio, extra, footer }: Props) {
  return (
    <Sheet open onClose={onClose} maxHeightClass="max-h-[85vh]">
      <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
        <div>
          <div className="section-head">ADD TO THIS DAY</div>
          <div className="text-xs text-ink-dim mt-0.5">
            {DOW_NAMES[day.dayOfWeek]} · {day.date} · Week {day.weekNumber}
          </div>
        </div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
      </div>
      <div className="px-4 py-4 space-y-2 pb-8">
        <Button block size="lg" onClick={onLogWorkout}>
          Log a workout
        </Button>
        <Button block variant="ghost" size="lg" onClick={onLogCardio}>
          Log cardio
        </Button>
        {extra}
        <p className="text-xs text-ink-mute text-center pt-2">
          {footer ?? 'Adding extra sessions does not change your program — they show up as logged history.'}
        </p>
      </div>
    </Sheet>
  );
}
