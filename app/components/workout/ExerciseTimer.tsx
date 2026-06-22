'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { doubleBeep } from '@/lib/ui/beep';

interface Props {
  /** Start the countdown with this many seconds. 0 hides the timer. */
  seconds: number;
  /** Optional caption (e.g. exercise name "Plank"). */
  label?: string;
  /** Called when the timer is dismissed (manually or after auto-close). */
  /** Called on close with how long was actually held (seconds). */
  onDismiss: (elapsedSec: number) => void;
  /** When true, plays a double-beep when the timer reaches zero. */
  soundsEnabled?: boolean;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Countdown overlay for time-based exercises (plank, dead hang, loaded
 * carries). Counts down from the prescribed time, beeps at zero, holds on
 * "Time's up" until the user dismisses so they can read it.
 *
 * The user can still adjust their actual logged time via the time input —
 * this timer is purely an audible/visual hold-cue.
 */
export function ExerciseTimer({ seconds, label, onDismiss, soundsEnabled = true }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const total = useRef(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    total.current = seconds;
    beepedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Beep once when the countdown finishes; no auto-dismiss so the user
  // can confirm the time. They tap Done (or Cancel) to close.
  useEffect(() => {
    if (seconds > 0 && remaining === 0 && !beepedRef.current) {
      beepedRef.current = true;
      doubleBeep(soundsEnabled);
    }
  }, [remaining, seconds, soundsEnabled]);

  const dismiss = () => onDismiss(Math.max(0, Math.round(total.current - remaining)));

  if (seconds <= 0) return null;
  const pct = total.current > 0 ? (1 - remaining / total.current) * 100 : 0;
  const done = remaining === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={dismiss}>
      <div
        className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl border-t border-ink-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-ink-line">
          <div className={cn('h-1 transition-all', done ? 'bg-ok' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
        <div className="px-4 pt-4 pb-6">
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-dim uppercase">
            {done ? "Time's up" : (label ?? 'Hold')}
          </div>
          <div className={cn('mt-1 text-6xl font-bold tnum text-center', done && 'text-ok')}>
            {fmt(remaining)}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRemaining((r) => Math.max(0, r - 10))}
              className="h-11 px-4 rounded-lg border border-ink-line text-sm font-semibold"
            >
              −10s
            </button>
            <button
              type="button"
              onClick={() => setRemaining((r) => r + 10)}
              className="h-11 px-4 rounded-lg border border-ink-line text-sm font-semibold"
            >
              +10s
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="h-11 px-5 rounded-lg bg-accent text-white text-sm font-semibold"
            >
              {done ? 'Done' : 'Stop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
