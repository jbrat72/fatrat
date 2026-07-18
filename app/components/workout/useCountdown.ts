'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { doubleBeep } from '@/lib/ui/beep';

/**
 * Shared wall-clock countdown machinery for RestTimer and ExerciseTimer —
 * previously duplicated ~90% verbatim between the two, so background-tab
 * fixes had to be applied twice.
 *
 * Time is tracked against a wall-clock deadline so a throttled/backgrounded
 * tab can't stall the countdown: the deadline setTimeout still fires near
 * zero, and a visibility/focus check catches the display up. `onDone` fires
 * exactly once per (re)start, after the beep.
 */
export function useCountdown(seconds: number, soundsEnabled: boolean, onDone?: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const endAtRef = useRef(0);
  const beepedRef = useRef(false);
  const alarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest callbacks without re-running the timer effect.
  const cb = useRef({ soundsEnabled, onDone });
  cb.current = { soundsEnabled, onDone };

  const fireAlarm = useCallback(() => {
    if (beepedRef.current) return;
    beepedRef.current = true;
    setRemaining(0);
    doubleBeep(cb.current.soundsEnabled);
    cb.current.onDone?.();
  }, []);

  const scheduleAlarm = useCallback((ms: number) => {
    if (alarmRef.current) clearTimeout(alarmRef.current);
    alarmRef.current = setTimeout(fireAlarm, Math.max(0, ms));
  }, [fireAlarm]);

  // (Re)start whenever `seconds` changes.
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
    if (delta > 0) beepedRef.current = false; // re-arm if adding time after done
    endAtRef.current = Math.max(Date.now(), endAtRef.current + delta * 1000);
    totalRef.current = Math.max(1, totalRef.current + delta);
    const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemaining(rem);
    if (rem > 0) scheduleAlarm(endAtRef.current - Date.now());
    else fireAlarm();
  };

  const total = totalRef.current;
  return {
    remaining,
    total,
    done: remaining === 0,
    pct: total > 0 ? (1 - remaining / total) * 100 : 0,
    adjust,
  };
}

export function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
