'use client';
import { cn } from '@/lib/ui/cn';
import { useCountdown, fmtClock } from './useCountdown';

interface Props {
  /** Start the countdown with this many seconds. 0 hides the timer. */
  seconds: number;
  /** Optional caption (e.g. exercise name "Plank"). */
  label?: string;
  /** Called on close with how long was actually held (seconds). */
  onDismiss: (elapsedSec: number) => void;
  /** When true, plays a double-beep when the timer reaches zero. */
  soundsEnabled?: boolean;
}

/**
 * Countdown overlay for time-based exercises (plank, dead hang, loaded carries).
 * Wall-clock timed (see useCountdown). Holds on "Time's up" until the user
 * dismisses.
 */
export function ExerciseTimer({ seconds, label, onDismiss, soundsEnabled = true }: Props) {
  const { remaining, total, done, pct, adjust } = useCountdown(seconds, soundsEnabled);

  const dismiss = () => onDismiss(Math.max(0, Math.round(total - remaining)));

  if (seconds <= 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={dismiss}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl border-t border-ink-line" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 bg-ink-line">
          <div className={cn('h-1 transition-all', done ? 'bg-ok' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
        <div className="px-4 pt-4 pb-6">
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-dim uppercase">
            {done ? "Time's up" : (label ?? 'Hold')}
          </div>
          <div className={cn('mt-1 text-6xl font-bold tnum text-center', done && 'text-ok')}>
            {fmtClock(remaining)}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button type="button" onClick={() => adjust(-10)} className="h-11 px-4 rounded-lg border border-ink-line text-sm font-semibold">−10s</button>
            <button type="button" onClick={() => adjust(10)} className="h-11 px-4 rounded-lg border border-ink-line text-sm font-semibold">+10s</button>
            <button type="button" onClick={dismiss} className="h-11 px-5 rounded-lg bg-accent text-white text-sm font-semibold">{done ? 'Done' : 'Stop'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
