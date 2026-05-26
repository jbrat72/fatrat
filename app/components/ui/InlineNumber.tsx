'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';

interface Props {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Tap-to-edit numeric input. Closed: compact box. Open: expanded editor
 *  with +/- on the right (long-press fast-scrolls). Sized so numbers fit. */
const LONG_PRESS_MS = 280;
const ACCEL_TICK_MS = 60;

export function InlineNumber({
  value, onChange, step = 1, min = 0, max,
  decimals = 0, unit, placeholder = '—',
  className, disabled, ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!open) setDraft(value == null ? '' : String(value)); }, [value, open]);
  useLayoutEffect(() => {
    if (open) requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) commit(); };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return +v.toFixed(decimals);
  };
  const fmt = (n: number | undefined) => {
    if (n == null) return placeholder;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(decimals);
  };
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') onChange(undefined);
    else {
      const n = Number(trimmed.replace(',', '.'));
      if (Number.isFinite(n)) onChange(clamp(n));
    }
    setOpen(false);
  };
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = clamp(base + dir * step);
    onChange(next);
    setDraft(String(next));
  };
  const pressStart = (e: React.MouseEvent | React.TouchEvent, dir: 1 | -1) => {
    e.stopPropagation(); e.preventDefault(); bump(dir);
    longPressRef.current = setTimeout(() => { tickRef.current = setInterval(() => bump(dir), ACCEL_TICK_MS); }, LONG_PRESS_MS);
  };
  const pressEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    longPressRef.current = null; tickRef.current = null;
  };

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      {!open ? (
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            'w-full h-11 px-2 rounded-lg bg-bg-input border border-ink-line',
            'text-sm font-semibold text-center numeric',
            'transition active:scale-[0.98] hover:border-ink-dim',
            'disabled:opacity-50 disabled:pointer-events-none',
            value == null && 'text-ink-mute font-normal',
          )}
        >
          {fmt(value)}
          {unit && value != null && <span className="text-ink-mute text-[10px] font-normal ml-1">{unit}</span>}
        </button>
      ) : (
        /* Open: expands in place; smaller font + slim +/- to leave more room for digits */
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-xl bg-bg-elev border-2 border-accent shadow-glow p-1.5"
        >
          <div className="flex items-stretch gap-1">
            <input
              ref={inputRef}
              inputMode="decimal"
              className="flex-1 min-w-0 h-12 px-1 text-center text-base font-semibold numeric bg-bg-input border border-ink-line rounded-md outline-none focus:border-accent"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'ArrowUp')   { e.preventDefault(); bump(1); }
                if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
              }}
            />
            <div className="flex flex-col gap-0.5 w-7 flex-none">
              <button type="button" aria-label="Increase"
                onMouseDown={(e) => pressStart(e, 1)} onMouseUp={pressEnd} onMouseLeave={pressEnd}
                onTouchStart={(e) => pressStart(e, 1)} onTouchEnd={pressEnd}
                className="flex-1 rounded-md bg-bg-input border border-ink-line text-ink text-sm font-semibold active:scale-95">
                +
              </button>
              <button type="button" aria-label="Decrease"
                onMouseDown={(e) => pressStart(e, -1)} onMouseUp={pressEnd} onMouseLeave={pressEnd}
                onTouchStart={(e) => pressStart(e, -1)} onTouchEnd={pressEnd}
                className="flex-1 rounded-md bg-bg-input border border-ink-line text-ink text-sm font-semibold active:scale-95">
                −
              </button>
            </div>
          </div>
          {unit && <div className="text-[9px] text-ink-mute tracking-wider2 mt-1 text-center uppercase">{unit} · enter to confirm</div>}
        </div>
      )}
    </div>
  );
}
