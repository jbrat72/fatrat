'use client';
import { cn } from '@/lib/ui/cn';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export function TextField({ label, hint, error, className, ...rest }: Props) {
  return (
    <label className="block">
      {label && <div className="text-xs font-semibold tracking-wider2 uppercase text-ink-dim mb-1">{label}</div>}
      <input
        {...rest}
        className={cn(
          'w-full h-11 px-3 rounded-lg bg-bg-input text-ink border tnum',
          error ? 'border-danger' : 'border-ink-line focus:border-accent',
          'outline-none transition',
          className,
        )}
      />
      {hint && !error && <div className="text-xs text-ink-mute mt-1">{hint}</div>}
      {error && <div className="text-xs text-danger mt-1">{error}</div>}
    </label>
  );
}
