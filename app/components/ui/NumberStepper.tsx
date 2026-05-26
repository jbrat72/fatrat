'use client';
import { cn } from '@/lib/ui/cn';
import { useCallback, useRef } from 'react';

interface Props {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  /** decimals when displaying — 0 for reps, 1 for weight */
  decimals?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

const LONG_PRESS_MS = 350;
const ACCEL_TICK_MS = 60;

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  decimals = 0,
  placeholder = '',
  className,
  ariaLabel,
}: Props) {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = useCallback((n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return Number(v.toFixed(decimals));
  }, [min, max, decimals]);

  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    onChange(clamp(base + dir * step));
  };

  const handlePressStart = (dir: 1 | -1) => {
    bump(dir);
    startTimeoutRef.current = setTimeout(() => {
      tickRef.current = setInterval(() => bump(dir), ACCEL_TICK_MS);
    }, LONG_PRESS_MS);
  };
  const handlePressEnd = () => {
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    startTimeoutRef.current = null;
    tickRef.current = null;
  };

  return (
    <div className={cn('flex items-stretch gap-2', className)} aria-label={ariaLabel}>
      <button
        type="button"
        className="w-10 rounded-lg bg-bg-input border border-ink-line text-ink-dim text-xl active:bg-bg-card"
        onMouseDown={() => handlePressStart(-1)}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart(-1)}
        onTouchEnd={handlePressEnd}
        aria-label="Decrease"
      >
        −
      </button>
      <input
        inputMode="decimal"
        className="stepper-cell flex-1 min-w-0"
        value={value == null ? '' : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') return onChange(undefined);
          const n = Number(raw.replace(',', '.'));
          if (!Number.isFinite(n)) return;
          onChange(clamp(n));
        }}
      />
      <button
        type="button"
        className="w-10 rounded-lg bg-bg-input border border-ink-line text-ink-dim text-xl active:bg-bg-card"
        onMouseDown={() => handlePressStart(1)}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart(1)}
        onTouchEnd={handlePressEnd}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
