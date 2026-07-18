'use client';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Max height of the sheet body (defaults to 85vh). */
  maxHeightClass?: string;
}

/**
 * Bottom sheet scaffold — backdrop, slide-up card, click-outside close.
 * The `fixed inset-0 bg-black/60 flex items-end` shell is hand-rolled in
 * ~20 modals across the app; new sheets should use this instead (existing
 * ones migrate opportunistically).
 */
export function Sheet({ open, onClose, children, maxHeightClass = 'max-h-[85vh]' }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div
        className={`mx-auto max-w-md w-full bg-bg-card rounded-t-2xl overflow-y-auto ${maxHeightClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
