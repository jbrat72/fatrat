'use client';
import { cn } from '@/lib/ui/cn';
import type { ReactNode } from 'react';

interface OptionProps<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  recommended?: boolean;
  selected?: boolean;
  onSelect: (v: T) => void;
}
export function ChoiceCard<T extends string>({
  value, label, description, recommended, selected, onSelect,
}: OptionProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left card p-4 transition',
        selected ? '!border-accent !bg-accent/10' : 'hover:border-ink-line/80',
      )}
    >
      {recommended && (
        <div className="mb-2">
          <span className="inline-flex items-center rounded-md bg-accent/15 text-accent text-[10px] tracking-widest2 font-semibold px-2 py-0.5">
            RECOMMENDED FOR YOU
          </span>
        </div>
      )}
      <div className="font-semibold text-ink">{label}</div>
      {description ? <div className="text-sm text-ink-dim mt-1">{description}</div> : null}
    </button>
  );
}

interface PillProps<T extends string> {
  value: T;
  label: ReactNode;
  selected?: boolean;
  onSelect: (v: T) => void;
  className?: string;
}
export function ChoicePill<T extends string>({ value, label, selected, onSelect, className }: PillProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition',
        selected
          ? 'bg-accent text-white border-accent'
          : 'bg-bg-card text-ink border-ink-line hover:border-ink-dim',
        className,
      )}
    >
      {label}
    </button>
  );
}
