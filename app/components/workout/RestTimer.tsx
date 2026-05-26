'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';

interface Props {
  /** Auto-start with this many seconds whenever it changes. 0 hides the timer. */
  seconds: number;
  onDismiss?: () => void;
  compact?: boolean;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function RestTimer({ seconds, onDismiss, compact }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const total = useRef(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    total.current = seconds;
  }, [seconds]);

  // Tick down once per second while remaining > 0.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss when timer reaches 0 — quick "done" flash, then hide.
  useEffect(() => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
    if (seconds > 0 && remaining === 0) {
      dismissTimer.current = setTimeout(() => onDismiss?.(), 600);
    }
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [remaining, seconds, onDismiss]);

  if (seconds <= 0) return null;
  const pct = total.current > 0 ? (1 - remaining / total.current) * 100 : 0;
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
          <button
            type="button"
            onClick={() => setRemaining((r) => Math.max(0, r - 30))}
            className="h-9 px-3 rounded-lg border border-ink-line text-sm font-semibold"
          >
            −30s
          </button>
          <button
            type="button"
            onClick={() => setRemaining((r) => r + 30)}
            className="h-9 px-3 rounded-lg border border-ink-line text-sm font-semibold"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={() => onDismiss?.()}
            className="h-9 px-3 rounded-lg bg-accent text-white text-sm font-semibold"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
