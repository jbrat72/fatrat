import { cn } from '@/lib/ui/cn';
import type { HTMLAttributes } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('card p-4', className)} />;
}

export function CardRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('flex items-center justify-between gap-3', className)} />;
}
