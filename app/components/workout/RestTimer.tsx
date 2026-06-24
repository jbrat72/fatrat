'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { doubleBeep } from '@/lib/ui/beep';

interface Props {
  /** Auto-start with this many seconds whenever it changes. 0 hides the timer. */
  seconds: number;
  onDismiss?: () => void;
  compact?: boolean;
  /** When true, play a double-beep when the timer reaches zero. */
  soundsEnabled?: boolean;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function RestTimer({ seconds, onDismiss, compact, soundsEnabled = true }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const endAtRef = useRef(0);
  const beepedRef = useRef(false);
  const alarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest callbacks without re-running the timer effect.
  const cb = useRef({ onDismiss, soundsEnabled });
  cb.current = { onDismiss, soundsEnabled };

  const fireAlarm = useCallback(() => {
    if (beepedRef.current) return;
    beepedRef.current = true;
    setRemaining(0);
    doubleBeep(cb.current.soundsEnabled);
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => cb.current.onDismiss?.(), 600);
  }, []);

  const scheduleAlarm = useCallback((ms: number) => {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    alarmRef.current = setTimeout(fireAlarm, Math.max(0, ms));
  }, [fireAlarm]);

  // (Re)start whenever `seconds` changes. Time is tracked by wall clock so a
  // throttled/backgrounded tab can't stall the countdown — the deadline
  // setTimeout still fires near zero, and a visibility/focus check catches up.
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
      if (dismissRef.current) clearTimeout(dismissRef.current);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [seconds, scheduleAlarm, fireAlarm]);

  const adjust = (delta: number) => {
    if (delta > 0) beepedRef.current = false; // re-arm if adding time after done
    endAtRef.current = Math.max(Date.now(), endAtRef.current + delta * 1000);
    totalRef.current = Math.max(1, totalRef.current + delta);
    const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemaining(rem);
    if (rem > 0) scheduleAlarm(endAtRef.current - Date.now());
    else fireAlarm();
  };

  if (seconds <= 0) return null;
  const pct = totalRef.current > 0 ? (1 - remaining / totalRef.current) * 100 : 0;
  const done = remaining === 0;

  return (
    <div className={cn(
      'fixed left-0 right-0 z-30 bg-bg-card border-t border-ink-line',
      compact ? 'bottom-16' : 'bottom-20',
    )}>
      <div className="h-1 bg-ink-line">
        <div className={cn('h-1 transition-all', done ? 'bg-ok' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-wider2 font-semibold text-ink-dim uppercase">
            {done ? 'Rest complete' : 'Rest'}
          </div>
          <div className={cn('text-2xl font-semibold tnum', done && 'text-ok')}>
            {fmt(remaining)}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => adjust(-30)} className="h-9 px-3 rounded-lg border border-ink-line text-sm font-semibold">−30s</button>
          <button type="button" onClick={() => adjust(30)} className="h-9 px-3 rounded-lg border border-ink-line text-sm font-semibold">+30s</button>
          <button type="button" onClick={() => onDismiss?.()} className="h-9 px-3 rounded-lg bg-accent text-white text-sm font-semibold">Skip</button>
        </div>
      </div>
    </div>
  );
}
