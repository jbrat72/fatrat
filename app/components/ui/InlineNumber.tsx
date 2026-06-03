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

/** Tap-to-edit numeric input. Closed: compact box. Open: an oversized
 *  floating editor that overlays its origin — big +/- buttons and a visible
 *  Done button so mobile users have an obvious commit affordance (the
 *  numeric keypad's Enter is hidden when the user is only using +/-).
 *
 *  The open editor grows toward the screen's interior so the value stays
 *  visible: a cell on the left half anchors its left edge and grows right;
 *  a cell on the right half anchors its right edge and grows left; a cell
 *  already spanning most of the screen stays its current width. */
const LONG_PRESS_MS = 280;
const ACCEL_TICK_MS = 60;
/** Px the popup tries to expand to, when not viewport-constrained. */
const TARGET_POPUP_WIDTH = 260;

export function InlineNumber({
  value, onChange, step = 1, min = 0, max,
  decimals = 0, unit, placeholder = '—',
  className, disabled, ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  /** Inline style for the open popup, computed from the cell's screen position. */
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
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

  // Compute the popup position the moment it opens. Anchor on whichever
  // side has more room and target ~260 px width; if the cell is already at
  // least 75% of viewport width, stay matched to the cell.
  useLayoutEffect(() => {
    if (!open) { setPopupStyle({}); return; }
    const el = wrapRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const cellWidth = rect.width;
    const margin = 8;            // breathing room from the viewport edge
    const wide = cellWidth >= vw * 0.75;
    if (wide) {
      // Full-width row — don't stretch. Match the cell.
      setPopupStyle({ left: 0, right: 0 });
      return;
    }
    const targetWidth = Math.min(TARGET_POPUP_WIDTH, vw - margin * 2);
    const cellCenterX = rect.left + cellWidth / 2;
    if (cellCenterX <= vw / 2) {
      // Left half — anchor the left edge, grow to the right.
      const maxWidth = vw - rect.left - margin;
      const width = Math.min(targetWidth, maxWidth);
      // Negative `right` so it can grow past the cell's right edge.
      setPopupStyle({ left: 0, width });
    } else {
      // Right half — anchor the right edge, grow to the left.
      const maxWidth = rect.right - margin;
      const width = Math.min(targetWidth, maxWidth);
      setPopupStyle({ right: 0, width });
    }
  }, [open]);

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
  // Pointer events unify touch + mouse and fire once per interaction. The
  // previous mouseDown + touchStart pair could both fire on mobile (synthetic
  // mouse event after touch) — that bumped the value by 2 per tap.
  const pressStart = (e: React.PointerEvent, dir: 1 | -1) => {
    e.stopPropagation(); e.preventDefault();
    bump(dir);
    longPressRef.current = setTimeout(() => { tickRef.current = setInterval(() => bump(dir), ACCEL_TICK_MS); }, LONG_PRESS_MS);
  };
  const pressEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    longPressRef.current = null; tickRef.current = null;
  };

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      {/* Closed-state button is always rendered so the row keeps its height
          even when the editor floats above. Hidden visually while open. */}
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(true); }}
        className={cn(
          'w-full h-11 px-2 rounded-lg bg-bg-input border border-ink-line',
          'text-sm font-semibold text-center numeric',
          'transition active:scale-[0.98] hover:border-ink-dim',
          'disabled:opacity-50 disabled:pointer-events-none',
          value == null && 'text-ink-mute font-normal',
          open && 'invisible',
        )}
      >
        {fmt(value)}
        {unit && value != null && <span className="text-ink-mute text-[10px] font-normal ml-1">{unit}</span>}
      </button>

      {open && (
        /* Open: floats above the closed button. Sized by `popupStyle` so it
           grows toward screen interior and never goes off-screen. */
        <div
          onClick={(e) => e.stopPropagation()}
          style={popupStyle}
          className={cn(
            'absolute z-40 top-0',
            'rounded-xl bg-bg-elev border-2 border-accent shadow-glow p-2',
          )}
        >
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              inputMode="decimal"
              className="flex-1 min-w-0 h-16 px-2 text-center text-xl font-semibold numeric bg-bg-input border border-ink-line rounded-md outline-none focus:border-accent"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'ArrowUp')   { e.preventDefault(); bump(1); }
                if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
              }}
            />
            <div className="flex flex-col gap-1 w-12 flex-none">
              <button type="button" aria-label="Increase"
                onPointerDown={(e) => pressStart(e, 1)}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                className="flex-1 rounded-md bg-bg-input border border-ink-line text-ink text-xl font-bold active:scale-95 select-none">
                +
              </button>
              <button type="button" aria-label="Decrease"
                onPointerDown={(e) => pressStart(e, -1)}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                className="flex-1 rounded-md bg-bg-input border border-ink-line text-ink text-xl font-bold active:scale-95 select-none">
                −
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {unit && (
              <div className="text-[10px] text-ink-mute tracking-wider2 uppercase flex-1">{unit}</div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); commit(); }}
              className="px-4 h-9 rounded-md bg-accent text-white text-sm font-semibold active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
