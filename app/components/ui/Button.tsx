'use client';
import { cn } from '@/lib/ui/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-14 px-6 text-base',
};

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hot active:bg-accent-hot',
  ghost:   'bg-transparent text-ink border border-ink-line hover:bg-bg-card',
  danger:  'bg-danger text-white hover:bg-danger/90',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  leading,
  trailing,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
        SIZE[size],
        VARIANT[variant],
        block && 'w-full',
        className,
      )}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
