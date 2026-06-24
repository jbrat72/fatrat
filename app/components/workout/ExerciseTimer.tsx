'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { doubleBeep } from '@/lib/ui/beep';

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

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Countdown overlay for time-based exercises (plank, dead hang, loaded carries).
 * Wall-clock timed so a throttled/backgrounded tab can't stall it: a deadline
 * setTimeout beeps near zero and a visibility/focus check catches up. Holds on
 * "Time's up" until the user dismisses.
 */
export function ExerciseTimer({ seconds, label, onDismiss, soundsEnabled = true }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const endAtRef = useRef(0);
  const beepedRef = useRef(false);
  const alarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef({ soundsEnabled });
  cb.current = { soundsEnabled };

  const fireAlarm = useCallback(() => {
    if (beepedRef.current) return;
    beepedRef.current = true;
    setRemaining(0);
    doubleBeep(cb.current.soundsEnabled);
  }, []);

  const scheduleAlarm = useCallback((ms: number) => {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    alarmRef.current = setTimeout(fireAlarm, Math.max(0, ms));
  }, [fireAlarm]);

  useEffect(() => {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    beepedRef.current = false;
    totalRef.current = seconds;
    if (seconds <= 0) { setRemaining(0); return; }
    endAtRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    scheduleAlarm(seconds * 1000);
    const tick = () => {
      const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) fireAlarm();
    };
    tickRef.current = setInterval(tick, 250);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      if (alarmRef.current) clearTimeout(alarmRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [seconds, scheduleAlarm, fireAlarm]);

  const adjust = (delta: number) => {
    if (delta > 0) beepedRef.current = false;
    endAtRef.current = Math.max(Date.now(), endAtRef.current + delta * 1000);
    totalRef.current = Math.max(1, totalRef.current + delta);
    const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemaining(rem);
    if (rem > 0) scheduleAlarm(endAtRef.current - Date.now());
    else fireAlarm();
  };

  const dismiss = () => onDismiss(Math.max(0, Math.round(totalRef.current - remaining)));

  if (seconds <= 0) return null;
  const pct = totalRef.current > 0 ? (1 - remaining / totalRef.current) * 100 : 0;
  const done = remaining === 0;

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
            {fmt(remaining)}
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
