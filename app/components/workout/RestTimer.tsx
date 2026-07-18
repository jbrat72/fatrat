'use client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/ui/cn';
import { useCountdown, fmtClock } from './useCountdown';

interface Props {
  /** Auto-start with this many seconds whenever it changes. 0 hides the timer. */
  seconds: number;
  onDismiss?: () => void;
  compact?: boolean;
  /** When true, play a double-beep when the timer reaches zero. */
  soundsEnabled?: boolean;
}

export function RestTimer({ seconds, onDismiss, compact, soundsEnabled = true }: Props) {
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const { remaining, done, pct, adjust } = useCountdown(seconds, soundsEnabled, () => {
    // Rest complete → auto-dismiss shortly after the beep.
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => onDismissRef.current?.(), 600);
  });
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  if (seconds <= 0) return null;

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
            {fmtClock(remaining)}
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
