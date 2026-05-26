import { cn } from '@/lib/ui/cn';
import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  title: string;
  trailing?: ReactNode;
}
export function SectionHeader({ title, trailing, className, ...rest }: Props) {
  return (
    <div {...rest} className={cn('flex items-center justify-between mb-2', className)}>
      <h2 className="section-head">{title}</h2>
      {trailing}
    </div>
  );
}

interface PageTitleProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}
export function PageTitle({ title, subtitle, trailing }: PageTitleProps) {
  return (
    <div className="flex items-end justify-between px-4 pt-6 pb-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-ink-dim text-sm mt-1">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}
