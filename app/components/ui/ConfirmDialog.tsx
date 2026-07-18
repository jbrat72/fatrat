'use client';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). Default true — every
   *  current use is a destructive confirmation. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered confirm dialog. This exact markup was copy-pasted in four places
 * (discard workout, delete ad-hoc ×2, discard wizard edits) — change the
 * styling here, not per call site.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-ink-line p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-semibold">{title}</div>
        <p className="text-sm text-ink-dim mt-1.5">{body}</p>
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm} className={danger ? 'bg-danger border-danger text-white' : undefined}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
